import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const browser = args.get('--browser');
const url = args.get('--url');
const output = args.get('--output');
const width = Number(args.get('--width') ?? 1440);
const height = Number(args.get('--height') ?? 920);
const port = Number(args.get('--port') ?? 9222);

if (!browser || !url || !output) {
  console.error('Usage: node scripts/capture-screenshot.mjs --browser <path> --url <url> --output <png> [--width 1440] [--height 920]');
  process.exit(2);
}
if (typeof WebSocket === 'undefined') {
  console.error('This script requires Node.js with a global WebSocket implementation.');
  process.exit(2);
}

const profileDir = await mkdtemp(join(tmpdir(), 'gitpilot-chrome-'));
let chrome;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForJson(endpoint, timeoutMs = 15_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return response.json();
      lastError = new Error(`${endpoint} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError ?? new Error(`Timed out waiting for ${endpoint}`);
}

async function parseWsMessage(event) {
  const data = event.data;
  if (typeof data === 'string') return JSON.parse(data);
  if (data instanceof ArrayBuffer) return JSON.parse(Buffer.from(data).toString('utf8'));
  if (ArrayBuffer.isView(data)) return JSON.parse(Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8'));
  if (data && typeof data.text === 'function') return JSON.parse(await data.text());
  return JSON.parse(String(data));
}

function sendDevtools(ws, method, params = {}, timeoutMs = 15_000) {
  const id = sendDevtools.nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMessage);
      reject(new Error(`${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const onMessage = async event => {
      let message;
      try {
        message = await parseWsMessage(event);
      } catch (error) {
        clearTimeout(timer);
        ws.removeEventListener('message', onMessage);
        reject(error);
        return;
      }
      if (message.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      if (message.error) reject(new Error(`${method} failed: ${JSON.stringify(message.error)}`));
      else resolve(message.result ?? {});
    };
    ws.addEventListener('message', onMessage);
  });
}
sendDevtools.nextId = 1;

try {
  chrome = spawn(browser, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-features=MediaRouter,OptimizationHints,Translate',
    '--disable-sync',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'inherit', 'inherit'] });

  chrome.on('exit', code => {
    if (code !== null && code !== 0) console.error(`Chrome exited with status ${code}`);
  });

  console.log('Starting Chrome DevTools screenshot capture');
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  console.log('Chrome DevTools endpoint is ready');
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!targetResponse.ok) throw new Error(`Could not create Chrome tab: ${targetResponse.status}`);
  const target = await targetResponse.json();
  console.log(`Opening target ${url}`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const loaded = new Promise(resolve => {
    ws.addEventListener('message', event => {
      parseWsMessage(event).then(message => {
        if (message.method === 'Page.loadEventFired') resolve();
      }).catch(() => {});
    });
  });

  await sendDevtools(ws, 'Page.enable');
  await sendDevtools(ws, 'Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await sendDevtools(ws, 'Page.navigate', { url });
  await Promise.race([loaded, delay(10_000)]);
  await sendDevtools(ws, 'Runtime.evaluate', { expression: 'document.fonts?.ready ?? Promise.resolve()', awaitPromise: true }, 5_000);
  await delay(1_000);

  console.log('Capturing screenshot');
  const screenshot = await sendDevtools(ws, 'Page.captureScreenshot', { format: 'png', fromSurface: true }, 15_000);
  await writeFile(output, Buffer.from(screenshot.data, 'base64'));
  ws.close();
  console.log(`Saved screenshot to ${output}`);
} finally {
  if (chrome && !chrome.killed) chrome.kill('SIGTERM');
  setTimeout(() => chrome && !chrome.killed && chrome.kill('SIGKILL'), 2_000).unref();
  await rm(profileDir, { recursive: true, force: true });
}
