import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, 'temporary screenshots');

// Args: <url> [label]
const url   = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

if (!url.startsWith('http')) {
  console.error('Usage: node screenshot.mjs <url> [label]');
  console.error('Example: node screenshot.mjs http://localhost:3000 homepage');
  process.exit(1);
}

// Find next available screenshot number (never overwrite)
function nextFilename(label) {
  let n = 1;
  while (true) {
    const name = label
      ? `screenshot-${n}-${label}.png`
      : `screenshot-${n}.png`;
    if (!fs.existsSync(path.join(SCREENSHOTS_DIR, name))) return name;
    n++;
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

    console.log(`Navigating to ${url} ...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    const filename = nextFilename(label);
    const filepath = path.join(SCREENSHOTS_DIR, filename);

    await page.screenshot({ path: filepath, fullPage: true });

    console.log(`Screenshot saved: temporary screenshots/${filename}`);
  } finally {
    await browser.close();
  }
})();
