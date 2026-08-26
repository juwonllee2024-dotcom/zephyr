// Quick probe: load the game, dump console errors and boot state.
import { preview } from 'vite';
import { chromium } from 'playwright';

const server = await preview({ root: process.cwd(), preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));
await page.goto(server.resolvedUrls.local[0], { waitUntil: 'load' });
await page.waitForTimeout(9000);
console.log('state =', await page.evaluate(() => window.__zephyrState));
console.log('loading-text =', await page.evaluate(() => document.getElementById('loading-text')?.textContent));
await browser.close();
await server.close();
process.exit(0);
