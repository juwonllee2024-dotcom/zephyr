import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

let server, browser;
const errors = [];
const failedRequests = [];
const cameraRequests = [];
const output = '.artifacts/public-demo';
mkdirSync(output, {recursive:true});
try {
  let url = process.argv[2];
  if (!url) {
    server = await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
    url = server.resolvedUrls.local[0];
  }
  browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)failedRequests.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript(()=>{
    window.__cameraRequests = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = options => {
      window.__cameraRequests.push(options);
      return original(options);
    };
  });
  await page.goto(url,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__zephyrState==='menu',null,{timeout:120000});
  await page.click('#btn-keyboard');
  await page.waitForFunction(()=>window.__zephyrState==='flying');
  const start = await page.evaluate(()=>({pos:[...window.__zephyr.flight.pos],time:window.__zephyr.simTime}));
  await page.keyboard.down('KeyW');
  await page.waitForFunction(t=>window.__zephyr.simTime>t+1,start.time,{timeout:120000});
  await page.keyboard.up('KeyW');
  const end = await page.evaluate(()=>({pos:[...window.__zephyr.flight.pos],speed:window.__zephyr.flight.speed}));
  assert.ok(Math.hypot(...end.pos.map((n,i)=>n-start.pos[i]))>15,'keyboard flight must move the bird');
  assert.ok(end.speed>0);
  await page.keyboard.press('KeyP');
  await page.waitForFunction(()=>window.__zephyrState==='paused');
  const pausedTime = await page.evaluate(()=>window.__zephyr.simTime);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.__zephyr.simTime),pausedTime,'pause must freeze simulation');
  await page.keyboard.press('KeyP');
  await page.waitForFunction(()=>window.__zephyrState==='flying');
  const seed = await page.textContent('#seed-line');
  await page.keyboard.press('KeyR');
  await page.waitForFunction(old=>document.querySelector('#seed-line').textContent!==old && window.__zephyrState==='menu',seed,{timeout:120000});
  await page.click('#btn-keyboard');
  await page.waitForFunction(()=>window.__zephyrState==='flying');
  await page.keyboard.press('KeyP');
  await page.waitForFunction(()=>window.__zephyrState==='paused');
  await page.click('#btn-quit');
  await page.waitForFunction(()=>window.__zephyrState==='menu');
  cameraRequests.push(...await page.evaluate(()=>window.__cameraRequests));
  assert.equal(cameraRequests.length,0,'keyboard mode must never request camera');
  assert.deepEqual(errors,[],'no uncaught browser errors');
  assert.deepEqual(failedRequests,[],'no failing page asset requests');
  await page.screenshot({path:`${output}/verified-menu.png`});
  await page.click('#btn-keyboard');
  await page.waitForFunction(()=>window.__zephyrState==='flying');
  await page.screenshot({path:`${output}/verified-flight.png`});
  console.log(JSON.stringify({url,keyboardFlight:true,pauseResume:true,newWorld:true,quitToMenu:true,cameraRequests:cameraRequests.length,errors,failedRequests,screenshot:`${output}/verified-flight.png`}));
} finally {
  if(browser) await browser.close();
  if(server) await server.close();
}
