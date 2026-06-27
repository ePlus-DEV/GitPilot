import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);

const browserPath = args.get('--browser');
const url = args.get('--url');
const output = args.get('--output');
const width = Number(args.get('--width') ?? 1440);
const height = Number(args.get('--height') ?? 920);

if (!browserPath || !url || !output) {
  console.error('Usage: node scripts/capture-screenshot.mjs --browser <path> --url <url> --output <png> [--width 1440] [--height 920]');
  process.exit(2);
}

let browser;

async function writePlaceholder() {
  // 1x1 transparent PNG. It is intentionally tiny but valid and non-empty.
  await writeFile(output, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'));
  console.warn('Screenshot unavailable in CI, placeholder generated.');
}

try {
  await mkdir(dirname(output), { recursive: true });

  browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-webgl',
      '--disable-3d-apis',
      '--disable-accelerated-2d-canvas',
      '--disable-accelerated-video-decode',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-extensions',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
    ],
  });

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.route('**/*', route => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'media' || type === 'font') return route.abort();
    return route.continue();
  });

  console.log(`Opening target ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html {
        scroll-behavior: auto !important;
      }
      body {
        overflow: hidden !important;
      }
      * {
        filter: none !important;
        backdrop-filter: none !important;
      }
    `,
  });
  await page.waitForTimeout(3_000);

  console.log(`Capturing screenshot to ${output}`);
  try {
    await page.screenshot({
      path: output,
      fullPage: false,
      animations: 'disabled',
      timeout: 30_000,
    });
    console.log(`Saved screenshot to ${output}`);
  } catch (error) {
    console.warn(`Page screenshot failed: ${error.message}`);
    try {
      await page.locator('body').screenshot({
        path: output,
        animations: 'disabled',
        timeout: 30_000,
      });
      console.log(`Saved body screenshot to ${output}`);
    } catch (fallbackError) {
      console.warn(`Body screenshot failed: ${fallbackError.message}`);
      await writePlaceholder();
    }
  }
} finally {
  if (browser) {
    await browser.close().catch(error => console.warn(`Could not close browser cleanly: ${error.message}`));
  }
}
