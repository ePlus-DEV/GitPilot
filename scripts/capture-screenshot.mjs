import { mkdir } from 'node:fs/promises';
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

try {
  await mkdir(dirname(output), { recursive: true });

  browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-extensions',
      '--hide-scrollbars',
    ],
  });

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log(`Opening target ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3_000);

  console.log(`Capturing screenshot to ${output}`);
  await page.screenshot({
    path: output,
    fullPage: false,
    timeout: 60_000,
  });
  console.log(`Saved screenshot to ${output}`);
} finally {
  if (browser) {
    await browser.close().catch(error => console.warn(`Could not close browser cleanly: ${error.message}`));
  }
}
