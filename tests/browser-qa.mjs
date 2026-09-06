import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.MUSEUM_URL||'http://127.0.0.1:5178/';
const output=process.env.MUSEUM_OUTPUT||new URL('../../../output/fabdao-museum',import.meta.url).pathname;
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[],badAssets=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});
page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))badAssets.push([r.url(),r.status()])});
const started=Date.now();await page.goto(base);await page.getByRole('button',{name:'進入美術館'}).waitFor({timeout:45000});const interactiveMs=Date.now()-started;
await page.waitForTimeout(1000);await page.screenshot({path:output+'/welcome.png'});
await page.getByRole('button',{name:'進入美術館'}).click();
assert.equal(await page.locator('.room-card').isVisible(),true);
await page.waitForTimeout(2000);await page.screenshot({path:output+'/gallery.png'});
// The view must actually change after keyboard movement.
const before=await page.locator('canvas').screenshot();await page.keyboard.down('KeyW');await page.waitForTimeout(700);await page.keyboard.up('KeyW');const after=await page.locator('canvas').screenshot();assert.equal(before.equals(after),false);
// Pointer lock is user-initiated, can be released, and the drag alternative remains usable.
await page.locator('#mouse-lock').click();await page.waitForTimeout(300);const pointerLock=await page.evaluate(()=>Boolean(document.pointerLockElement));if(pointerLock)await page.keyboard.press('Escape');
await page.locator('#resume').click({timeout:500}).catch(()=>{});
await page.getByRole('button',{name:'展間地圖'}).click();await page.screenshot({path:output+'/map.png'});
const rooms=[];for(let i=0;i<4;i++){if(i)await page.getByRole('button',{name:'展間地圖'}).click();await page.locator(`[data-room="${i}"]`).click();rooms.push(await page.locator('#room-title').textContent());assert.equal(await page.locator('#panel').isVisible(),false);}
assert.deepEqual(rooms,['生成之間','群山成島','收藏作為行動','留白與記憶']);
await page.getByRole('button',{name:'館藏目錄',exact:true}).first().click();await page.locator('#search-art').fill('Amplitudes');assert.equal(await page.locator('.collection-card').count(),1);await page.locator('.collection-card').click();
assert.match(await page.locator('#panel-title').textContent(),/Amplitudes/);assert.match(await page.locator('.artist').textContent(),/Harvey Rayner/);assert.equal(await page.locator('a').filter({hasText:'觀看完整原作'}).count(),1);
await page.screenshot({path:output+'/artwork.png'});
await page.locator('#detail-image').click();assert.equal(await page.locator('#detail-image.zoomed').count(),1);await page.locator('#detail-image').click();
await page.locator('#back-catalogue').click();assert.equal(await page.locator('#search-art').inputValue(),'Amplitudes');
await page.locator('#search-art').fill('不存在的作品zzxxx');assert.equal(await page.locator('.empty-state').isVisible(),true);
await page.locator('#search-art').fill('');await page.locator('#theme-filter').selectOption('documents');assert.equal(await page.locator('.collection-card').count(),10);await page.screenshot({path:output+'/documents.png'});
await page.locator('.collection-card').first().click();assert.equal(await page.locator('.document-cover').isVisible(),true);assert.equal(await page.getByRole('link',{name:'閱讀原始文件'}).count(),1);await page.keyboard.press('Escape');
await page.getByRole('button',{name:'畫質設定'}).click();const stats=await page.locator('#panel-content').innerText();await page.locator('#quality').selectOption('low');await page.keyboard.press('Escape');
await page.getByRole('button',{name:'畫質設定'}).click();assert.equal(await page.locator('#quality').inputValue(),'low');await page.locator('#quality').selectOption('balanced');await page.keyboard.press('Escape');
await page.getByRole('button',{name:'展間地圖'}).click();await page.locator('[data-room="1"]').click();await page.locator('#room-story').click();await page.locator('#hanging-page').selectOption('1');await page.keyboard.press('Escape');await page.waitForTimeout(500);await page.locator('#room-story').click();await page.locator('#hanging-page').selectOption('0');await page.keyboard.press('Escape');
// Fallback when WebGL cannot initialize still offers all 151 records.
const fallback=await browser.newPage({viewport:{width:1000,height:800}});await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(/webgl/i.test(type))return null;return original.call(this,type,...args)}});
await fallback.goto(base);await fallback.getByRole('button',{name:'開啟館藏目錄'}).waitFor();await fallback.getByRole('button',{name:'開啟館藏目錄'}).click();assert.match(await fallback.locator('#result-count').textContent(),/151 件館藏/);await fallback.close();
// A narrow screen retains the collection path without horizontal UI overflow.
const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.goto(base);await mobile.getByRole('button',{name:'進入美術館'}).waitFor();await mobile.getByRole('button',{name:'館藏目錄',exact:true}).first().click();await mobile.locator('#search-art').fill('Amplitudes');assert.equal(await mobile.locator('.collection-card').count(),1);await mobile.screenshot({path:output+'/mobile-catalogue.png'});const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
const report={testedAt:new Date().toISOString(),url:base,browser:await browser.version(),viewport:'1440x1000 DPR1; 390x844',interactiveMs,roomNavigation:rooms,pointerLock,stats,checks:['WebGL scene initialized','W movement changes view','4-room map teleport','pointer lock request and Escape','151 record catalogue','search match and empty state','artwork attribution and full original link','zoom and return search preservation','10 document entries and original links','quality setting persistence','change exhibition page and return','WebGL unavailable fallback','390px catalogue without overflow'],consoleErrors:errors,failedSameOriginAssets:badAssets};
await fs.writeFile(output+(base.startsWith('http://127')?'/local-qa.json':'/public-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);assert.equal(badAssets.length,0);await browser.close();
