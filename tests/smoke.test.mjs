// Headless production smoke test: boots the built game, plays via synthetic
// keystrokes, captures REAL screenshots, asserts zero uncaught errors.
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const shotDir = path.join(root, 'docs', 'screenshots');
mkdirSync(shotDir, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const server = await preview({ root, preview: { port: 4173, strictPort: true } });
const base = server.resolvedUrls.local[0];
console.log(`preview serving ${base}`);

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.ZEPHYR_BROWSER ?? 'msedge',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
} catch {
  browser = await chromium.launch({ headless: true }); // fallback to bundled chromium
}

const page = await browser.newPage({ viewport: { width: 832, height: 468 } });
page.setDefaultTimeout(150000);
page.setDefaultNavigationTimeout(150000);

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(base, { waitUntil: 'load' });

// 1) world builds and reaches menu
try {
  await page.waitForFunction(() => window.__zephyrState === 'menu', null, { timeout: 90000 });
  check('boots to menu', true);
} catch {
  check('boots to menu', false, 'state never reached "menu"');
}
await page.screenshot({ path: path.join(shotDir, '01-menu.png') });

// 2) start keyboard flight
await page.click('#btn-keyboard');
try {
  await page.waitForFunction(() => window.__zephyrState === 'flying', null, { timeout: 10000 });
  check('enters flying state', true);
} catch {
  check('enters flying state', false, 'state never reached "flying"');
}
await page.waitForTimeout(700);

const altBefore = await page.evaluate(() => ({ p: window.__zephyr.flight.pos.slice(), t: window.__zephyr.simTime }));

// 3) fly: climb for clearance, then dive for speed, bank, flap
await page.keyboard.down('KeyW');
await page.waitForTimeout(1300);
await page.keyboard.up('KeyW');
await page.keyboard.down('KeyS');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyS');
await page.keyboard.down('KeyA');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyA');
await page.keyboard.down('Space');
await page.waitForTimeout(1200);
await page.keyboard.up('Space');

const altAfter = await page.evaluate(() => ({ p: window.__zephyr.flight.pos.slice(), t: window.__zephyr.simTime }));
// Headless SwiftShader renders at ~5fps so wall time ≠ sim time; judge physics
// by simulated velocity, which is what the integration actually produces.
const moved = Math.hypot(
  altAfter.p[0] - altBefore.p[0],
  altAfter.p[1] - altBefore.p[1],
  altAfter.p[2] - altBefore.p[2],
);
const simDt = Math.max(1e-6, altAfter.t - altBefore.t);
const rate = moved / simDt;
check('bird flies under input', moved > 15 && rate > 15, `${moved.toFixed(1)}u over ${simDt.toFixed(2)} sim-s (${rate.toFixed(1)} u/s)`);

const speedTxt = await page.textContent('#hud-speed-val');
check('HUD speed reads > 0', Number(speedTxt) > 0, `${speedTxt}`);
const scoreVisible = await page.isVisible('#hud-score');
check('HUD visible', scoreVisible);

await page.screenshot({ path: path.join(shotDir, '02-flight.png') });

// 4) pause / resume round-trip
await page.keyboard.press('KeyP');
await page.waitForTimeout(400);
const pausedOk = await page.evaluate(() => window.__zephyrState === 'paused');
check('pauses with P', pausedOk);
await page.screenshot({ path: path.join(shotDir, '03-pause.png') });
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);

// 5) new world regeneration
await page.keyboard.press('KeyR');
await page.waitForTimeout(1500);
const seedText = await page.textContent('#seed-line');
check('regenerates world (R)', /seed \d+/.test(seedText ?? ''), (seedText ?? '').trim());

// final flight screenshot of the new world
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(shotDir, '04-new-world.png') });

check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
const seriousErrors = consoleErrors.filter((t) => !/favicon|Autofocus|Download the React DevTools/i.test(t));
check('no console errors', seriousErrors.length === 0, seriousErrors.slice(0, 3).join(' | '));

await browser.close();
await server.close();

console.log(failures === 0 ? '\nSMOKE TEST: ALL GREEN' : `\nSMOKE TEST: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
