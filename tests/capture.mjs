import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:"chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:5178/');
await page.getByRole('button',{name:'進入美術館'}).waitFor({timeout:30000});
await page.waitForTimeout(2000);await page.screenshot({path:new URL('../../../output/fabdao-museum/welcome.png',import.meta.url).pathname});
await page.getByRole('button',{name:'進入美術館'}).click();await page.waitForTimeout(1000);await page.screenshot({path:new URL('../../../output/fabdao-museum/gallery.png',import.meta.url).pathname});
console.log(JSON.stringify({errors},null,2));await browser.close();
