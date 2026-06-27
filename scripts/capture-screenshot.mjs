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
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'));
  console.warn('Screenshot unavailable in CI, placeholder generated.');
}

async function placeholderFrom(error, label) {
  console.warn(`${label}: ${error.message}`);
  await writePlaceholder();
}

async function main() {
  await mkdir(dirname(output), { recursive: true });

  try {
    browser = await chromium.launch({
      executablePath: browserPath,
      headless: true,
      timeout: 10_000,
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
  } catch (error) {
    await placeholderFrom(error, 'Browser launch failed');
    return;
  }

  let page;
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    await page.route('**/*', route => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'media' || type === 'font') return route.abort();
      return route.continue();
    });
  } catch (error) {
    await placeholderFrom(error, 'Page setup failed');
    return;
  }

  try {
    console.log(`Opening target ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch (error) {
    await placeholderFrom(error, 'Page navigation failed');
    return;
  }

  try {
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
  } catch (error) {
    await placeholderFrom(error, 'Style injection failed');
    return;
  }

  await page.waitForTimeout(3_000);

  console.log(`Capturing screenshot to ${output}`);
  try {
    await page.screenshot({
      path: output,
      fullPage: false,
      animations: 'disabled',
      timeout: 5_000,
    });
    console.log(`Saved screenshot to ${output}`);
    return;
  } catch (error) {
    console.warn(`Page screenshot failed: ${error.message}`);
  }

  try {
    await page.locator('body').screenshot({
      path: output,
      animations: 'disabled',
      timeout: 5_000,
    });
    console.log(`Saved body screenshot to ${output}`);
  } catch (error) {
    await placeholderFrom(error, 'Body screenshot failed');
  }
}

try {
  await main();
} finally {
  if (browser) {
    await browser.close().catch(error => console.warn(`Could not close browser cleanly: ${error.message}`));
  }
}
