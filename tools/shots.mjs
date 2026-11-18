// Dev tool: takes the three deterministic screenshots of NEON VOID with
// headless Chromium (Playwright, cached browser) and writes them to
// screenshots/. Not part of the game: it never ships in game/.
import { chromium } from 'playwright-core';
import { statSync } from 'node:fs';

const SHOTS = [
  { name: '1-start.jpg', query: '?shot=start&seed=1' },
  { name: '2-play.jpg', query: '?shot=play&seed=1' },
  { name: '3-end.jpg', query: '?shot=end&seed=1' },
];

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

for (const shot of SHOTS) {
  await page.goto(`http://localhost:8080/${shot.query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, { timeout: 20000 });
  await page.screenshot({ path: `screenshots/${shot.name}`, type: 'jpeg', quality: 82 });
  const size = statSync(`screenshots/${shot.name}`).size;
  console.log(`${shot.name}: ${size} bytes${size > 262144 ? '  OVER 256 KiB!' : ''}`);
}
console.log(errors.length === 0 ? 'no page errors' : `ERRORS:\n${errors.join('\n')}`);
await browser.close();
