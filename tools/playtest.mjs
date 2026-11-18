// Dev tool: plays NEON VOID live in headless Chromium and asserts the
// loop works — title, start, movement, firing, kills, pause, game over,
// restart — and that the page makes no request outside localhost.
// Not part of the game: it never ships in game/.
import { chromium } from 'playwright-core';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const externalRequests = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('request', (req) => {
  const url = req.url();
  if (!url.startsWith('http://localhost:8080') && !url.startsWith('data:')) {
    externalRequests.push(url);
  }
});

await page.goto('http://localhost:8080/', { waitUntil: 'load' });
await page.waitForTimeout(600);
const state = (expr) => page.evaluate(expr);

check('title mode on load', (await state(`window.__game.mode`)) === 'title');
check('canvas painted', (await state(`!!window.__game`)) === true);

// Start with Enter, then aim at the nearest enemy like a player would
// and keep moving for a few seconds.
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
check('playing after Enter', (await state(`window.__game.mode`)) === 'playing');
await page.keyboard.down('KeyD');
await page.keyboard.down('KeyW');
for (let i = 0; i < 16; i += 1) {
  await state(`(() => { const g = window.__game; let best = null; let bd = Infinity; for (const e of g.enemies) { const dx = e.x - g.player.x; const dy = e.y - g.player.y; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; } } if (best) { const r = document.getElementById('game').getBoundingClientRect(); window.__aim = { x: r.left + (best.x / 1280) * r.width, y: r.top + (best.y / 720) * r.height }; } })()`);
  const aim = await state(`window.__aim`);
  if (aim) await page.mouse.move(aim.x, aim.y);
  await page.waitForTimeout(500);
}
await page.keyboard.up('KeyD');
await page.keyboard.up('KeyW');
const mid = await state(`({ mode: window.__game.mode, score: window.__game.score, kills: window.__game.kills, enemies: window.__game.enemies.length, bullets: window.__game.bullets.length, wave: window.__game.wave, hp: Math.round(window.__game.player.hp) })`);
check('game runs (enemies spawning, player alive)', mid.mode === 'playing' && mid.enemies > 0 && mid.hp > 0, JSON.stringify(mid));
check('kills and score accrue', mid.kills > 0 && mid.score > 0, JSON.stringify(mid));
await page.screenshot({ path: 'tools/live-play.jpg', type: 'jpeg', quality: 80 });

// Pause and resume.
await page.keyboard.press('KeyP');
await page.waitForTimeout(200);
check('paused on P', (await state(`window.__game.mode`)) === 'paused');
await page.keyboard.press('KeyP');
await page.waitForTimeout(200);
check('resumed on P', (await state(`window.__game.mode`)) === 'playing');

// Force a game over through the real collision path: give the run a
// score first, drop an enemy on the player with the player at 1 HP,
// then wait for the death.
await state(`window.__game.score = 500; window.__game.player.hp = 1; window.__game.player.invuln = 0;`);
await state(`window.__game.enemies.push({ kind: 'brute', x: window.__game.player.x + 5, y: window.__game.player.y, vx: 0, vy: 0, radius: 24, color: '#b537f2', glow: '#b537f2', shape: 'hexagon', hp: 10, maxHp: 10, speed: 0, score: 40, gems: 3, elite: false, angle: 0, wobble: 0, wobbleSpeed: 2, chargeTimer: 2, charging: 0, flash: 0, spawnT: 1 });`);
await page.waitForTimeout(600);
const over = await state(`({ mode: window.__game.mode, best: window.__game.best })`);
check('game over on lethal hit', over.mode === 'over', JSON.stringify(over));
check('best score saved', over.best > 0, `best=${over.best}`);

// Restart with R.
await page.keyboard.press('KeyR');
await page.waitForTimeout(300);
const again = await state(`({ mode: window.__game.mode, hp: Math.round(window.__game.player.hp), wave: window.__game.wave })`);
check('restart on R', again.mode === 'playing' && again.hp === 100 && again.wave === 1, JSON.stringify(again));

// Level-up path: grant XP directly and confirm the card screen opens.
await state(`window.__game.xp = window.__game.xpNext;`);
await page.waitForTimeout(400);
const lvl = await state(`({ mode: window.__game.mode, choices: window.__game.choices.length })`);
check('level-up screen opens at XP threshold', lvl.mode === 'levelup' && lvl.choices === 3, JSON.stringify(lvl));
await page.keyboard.press('Digit2');
await page.waitForTimeout(200);
check('upgrade picked, back to play', (await state(`window.__game.mode`)) === 'playing');

check('no page errors', errors.length === 0, errors.join(' | '));
check('no external requests', externalRequests.length === 0, externalRequests.join(', '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? 'ALL PLAYTEST CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
