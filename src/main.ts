import './style.css';
import type { Artwork, Collection, Exhibition, DocumentItem, Institution } from './types';

import { mountImageViewer } from './image-viewer';
import { pageSize, exhibitionWorks, exhibitionDocuments, galleryWorks, findExhibit } from './curation.js';
import { getMediaSupport, mountMedia } from './media';

const $ = <T extends HTMLElement = HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const escapeHTML = (s:unknown) => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const safeURL=(s:unknown)=>{try {const u=new URL(String(s),location.origin);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const icon = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 13 20 4l15 9M5 16h30M5 35h30M9 19v12m7-12v12m8-12v12m7-12v12" stroke="currentColor" stroke-width="1.5"/></svg>`;
$('#app').innerHTML=`
  <div id="scene"></div><div class="scene-shade"></div>
  <a href="#catalogue" class="skip-link">跳到館藏目錄</a>
  <header class="masthead"><a class="brand" href="/" aria-label="FAB DAO 美術館首頁">${icon}<span>FAB DAO<span class="brand-sub">MUSEUM</span></span></a><span class="institution">福爾摩沙藝術銀行美術館</span>
    <nav aria-label="主要導覽"><button data-open="map">展間地圖 <span>↗</span></button><button data-open="catalogue">館藏目錄</button><button data-open="about">關於本館</button></nav><span class="open-badge"><i></i> ALWAYS OPEN</span>
  </header>
  <main id="welcome"><div class="edition"><span>INAUGURAL EXHIBITION</span><span>VOL. 01 / 2026</span></div><div class="intro-rule"></div>
    <p class="eyebrow">從共同收藏，走向開放的觀看</p><h1>藝術，如何<br>成為共同的<br><span>記憶？</span></h1>
    <p class="intro-copy">走進 FAB DAO 的數位收藏。<br>在生成、島嶼、行動與記憶之間，<br>重新想像藝術如何與公共生活相遇。</p>
    <div class="enter-row"><button id="enter" class="primary" disabled>正在開啟展館 <span class="spinner"></span></button><button data-open="catalogue" class="text-link">瀏覽館藏 <span>↗</span></button></div>
    <p class="desktop-note"><span>⌨</span> 電腦體驗 · 第一人稱漫遊 · 無需連接錢包</p>
  </main>
  <div id="welcome-caption"><span class="tiny">THE COMMONS, COLLECTED.</span><p>從一件作品，<br>開始一場對話。</p><span class="caption-line"></span><span class="tiny">數位館藏 × 古典空間</span></div>
  <div id="welcome-bottom"><span>FOUR GALLERIES. ONE SHARED COLLECTION.</span><div><span>01 — 04</span><span class="line"></span><span>自由入館，慢慢觀看</span></div></div>
  <div id="tour-ui" hidden>
    <button id="room-pill" aria-expanded="true" aria-controls="room-card"></button><section id="room-card" class="room-card" aria-label="目前展間"><span id="room-number" class="tiny">GALLERY 01 / 04</span><h2 id="room-title"></h2><p id="room-subtitle"></p><button id="room-story">閱讀策展論述 <span>↗</span></button><button id="guide-start">從本廳開始導覽 →</button></section>
    <section id="wall-pagination" aria-label="展牆作品分頁"><p id="wall-summary"></p><button id="wall-retry" hidden>重試載入作品</button><div><button id="wall-prev">← 上一批</button><button id="wall-all">本廳全部作品</button><button id="wall-next">下一批 →</button></div></section><div id="reticle" aria-hidden="true"></div><button id="inspect-hint" hidden></button>
    <div class="tour-bottom"><div class="movement-hint"><span><kbd>W</kbd><br><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>移動<br><small>拖曳滑鼠環視 · 點擊作品觀看</small></span></div>
      <div class="tour-actions"><button id="quiet-mode">專心觀看</button><button id="mouse-lock">自由環視</button><button data-open="help" aria-label="操作說明">?</button><button data-open="settings" aria-label="畫質設定">⚙</button><button id="pause-tour">暫停</button></div>
    </div><div id="room-pager"><button id="previous-room" aria-label="上一展間">←</button><span id="pager-label"></span><button id="next-room" aria-label="下一展間">→</button></div>
    <output id="performance-readout" hidden aria-label="即時效能資訊"></output><section id="guide" aria-label="作品導覽" hidden></section><button id="restore-interface" hidden>顯示介面 · H</button><div id="resume-panel" hidden><span class="tiny">TAKE YOUR TIME</span><h2>停留，也是一種觀看。</h2><button id="resume" class="primary">繼續漫遊 <span>→</span></button><button data-open="catalogue" class="text-link">開啟館藏目錄</button></div>
  </div>
  <dialog id="panel" aria-labelledby="panel-title"><div class="panel-head"><span class="tiny" id="panel-kicker">FAB DAO MUSEUM</span><button id="close-panel" aria-label="關閉視窗">✕</button></div><div id="panel-notice" role="status" aria-live="polite"></div><div id="panel-content"></div></dialog>
  <div id="notice" role="status" aria-live="polite"></div>
`;

let collection:Collection={verifiedAt:'',artworks:[],wallets:[]}, exhibitions:Exhibition[]=[],documents:DocumentItem[]=[],institution:Institution|undefined;
let museum:import('./museum').Museum|undefined;
let museumReady=false;
let entered=false,room=0,lastFocus:HTMLElement|null=null,openPanel='',manualPause=false,quiet=false;
let catalogueTheme='all',catalogueQuery='',catalogueFeatured=false,catalogueScroll=0,catalogueFocus='';
let selectedItem:Artwork|DocumentItem|null=null,hoverItem:Artwork|DocumentItem|null=null;
let detailOrigin='catalogue',detailIds:string[]=[],detailDispose:(()=>void)|undefined;
let showPerformance=false;
let controls={sensitivity:1,invertY:false};
let fps=0,guideIndex=-1,focusRequest=0,noticeTimer=0;
const pendingRooms=[false,false,false,false],loadedRooms=[false,false,false,false],hangingVersions=[0,0,0,0];
const roomJobs:(Promise<void>|undefined)[]=[];
const pages=[0,0,0,0],panel=$<HTMLDialogElement>('#panel');
const roomWorks=(index:number):Artwork[]=>exhibitionWorks(collection.artworks,exhibitions[index]?.theme);
const wallWorks=(index:number):Artwork[]=>galleryWorks(collection.artworks,exhibitions[index]?.theme);
const roomDocs=(index:number):DocumentItem[]=>exhibitionDocuments(documents,exhibitions[index]);
const route=()=>exhibitions.flatMap((_,i)=>roomWorks(i));
const itemById=(id:string)=>collection.artworks.find(a=>a.id===id)||documents.find(d=>d.id===id);
const notify=(s:string)=>{clearTimeout(noticeTimer);$('#notice').textContent=panel.open?'':s;$('#panel-notice').textContent=panel.open?s:'';noticeTimer=window.setTimeout(()=>{$('#notice').textContent='';$('#panel-notice').textContent='';},5500);};
function linked(url:unknown,label:string){const u=safeURL(url);return u?`<a href="${escapeHTML(u)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} ↗</a>`:'';}
const prose=(value:unknown):string=>Array.isArray(value)?value.map(prose).join(''):typeof value==='object'&&value?Object.values(value).map(prose).join(''):`<p class="panel-prose">${escapeHTML(value)}</p>`;
function disposeDetail(){detailDispose?.();detailDispose=undefined;}
function clearShare(){if(location.hash.startsWith('#artwork=')||location.hash.startsWith('#document='))history.replaceState(null,'',location.pathname+location.search);}
function closePanel(cancelPending=true){if(cancelPending)focusRequest++;disposeDetail();panel.close();openPanel='';clearShare();museum?.setPaused(manualPause);if(lastFocus?.isConnected)lastFocus.focus();else $<HTMLCanvasElement>('#scene canvas')?.focus();}
$('#close-panel').onclick=()=>closePanel();
panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
panel.addEventListener('click',e=>{if(e.target===panel){const b=panel.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closePanel();}});
function showPanel(name:string){
  focusRequest++;
  if(!panel.open)lastFocus=document.activeElement as HTMLElement;
  disposeDetail();$('#panel-notice').textContent='';openPanel=name;museum?.setPaused(true);$('#panel-kicker').textContent='FAB DAO MUSEUM';
  panel.className=name==='artwork'?'artwork-panel':name==='catalogue'?'wide-panel':'';
  if(name!=='artwork')clearShare();renderPanel(name);if(!panel.open)panel.showModal();panel.scrollTop=0;$('#close-panel').focus();
}
document.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-open]');if(button)showPanel(button.dataset.open!);});
$('.skip-link').onclick=e=>{e.preventDefault();showPanel('catalogue');};
function collapseRoom(value=true){if($('#room-card').hidden===value)return;$('#room-card').hidden=value;$('#room-pill').setAttribute('aria-expanded',String(!value));}
$('#room-pill').onclick=()=>collapseRoom(!$('#room-card').hidden);
function start(){
  if(!museum||entered)return;entered=true;manualPause=false;$('#welcome').hidden=true;$('#welcome-caption').hidden=true;$('#welcome-bottom').hidden=true;$('#tour-ui').hidden=false;document.body.classList.add('entered');museum.start();updateRoom(0);collapseRoom(false);
  document.activeElement instanceof HTMLElement&&document.activeElement.blur();notify('WASD 移動；拖曳滑鼠環視。點「從本廳開始導覽」會帶你正面看畫。');
}
$('#enter').onclick=start;
$('#mouse-lock').onclick=()=>{museum?.lock();notify('滑鼠直接環視，按 Esc 釋放游標。');};
function pause(value:boolean){if(value)focusRequest++;manualPause=value;museum?.setPaused(value||panel.open);$('#resume-panel').hidden=!value;$('#pause-tour').textContent=value?'繼續':'暫停';}
$('#pause-tour').onclick=()=>pause(!manualPause);$('#resume').onclick=()=>pause(false);
function setQuiet(value:boolean){quiet=value;document.body.classList.toggle('quiet',value);$('#restore-interface').hidden=!value;if(value)collapseRoom();}
$('#quiet-mode').onclick=()=>setQuiet(true);$('#restore-interface').onclick=()=>setQuiet(false);
window.addEventListener('keydown',e=>{
  if(panel.open||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement||(e.target instanceof HTMLElement&&e.target.isContentEditable))return;
  if(e.code==='Escape'&&document.pointerLockElement){document.exitPointerLock();return;}
  if(e.code==='Escape'&&entered){if(quiet)setQuiet(false);else pause(true);}
  if(e.code==='KeyH'&&entered){e.preventDefault();setQuiet(!quiet);}
  if(e.code==='KeyM'){e.preventDefault();showPanel('map');}
});
const isCancelled=(error:unknown)=>error instanceof Error&&error.name==='AbortError';
function updateRoom(index:number){room=index;const x=exhibitions[index];if(!x)return;$('#room-number').textContent=`GALLERY 0${index+1} / 04`;$('#room-title').textContent=x.title;$('#room-subtitle').textContent=x.subtitle;$('#room-pill').textContent=`0${index+1}  ${x.title}  ⌄`;$('#pager-label').textContent=`0${index+1} / 04`;$<HTMLButtonElement>('#previous-room').disabled=index===0;$<HTMLButtonElement>('#next-room').disabled=index===3;updateWallPagination();if(museumReady){void ensureRoom(index).catch(error=>{if(!isCancelled(error)&&room===index)notify('這一廳作品載入未完成，可按「重試載入作品」。');});if(index<3)void ensureRoom(index+1).catch(()=>{});}}
function stopGuide(){focusRequest++;guideIndex=-1;$('#guide').hidden=true;}
async function goToRoom(index:number){
 if(!museum||!museumReady){notify('3D 暫時無法使用，仍可瀏覽館藏。');return;}
 const request=++focusRequest;
 try{if(!loadedRooms[index])notify('正在準備這一廳作品…');await ensureRoom(index);if(request!==focusRequest)return;if(panel.open)closePanel(false);if(!entered)start();stopGuide();pause(false);museum.teleport(index);updateRoom(index);collapseRoom(false);}
 catch(error){if(request===focusRequest&&!isCancelled(error))notify('展牆尚未準備完成，請稍後重試。');}
}
$('#previous-room').onclick=()=>goToRoom(Math.max(0,room-1));$('#next-room').onclick=()=>goToRoom(Math.min(3,room+1));$('#room-story').onclick=()=>showPanel('story');
$('#inspect-hint').onclick=()=>{if(hoverItem)inspect(hoverItem,'wall');};
$('#guide-start').onclick=()=>void guideTo(route().findIndex(a=>a.theme===exhibitions[room].theme));
function updateWallPagination(){
 const works=wallWorks(room),count=Math.max(1,Math.ceil(works.length/pageSize(room))),start=pages[room]*pageSize(room),end=Math.min(start+pageSize(room),works.length);
 $('#wall-retry').hidden=loadedRooms[room]||pendingRooms[room];
 $('#wall-summary').textContent=pendingRooms[room]?'正在準備展牆…':!loadedRooms[room]?'展牆尚未載入，請重試。':`第 ${pages[room]+1} / ${count} 批 · 本廳 ${works.length} 件 · 目前 ${start+1}–${end}`;
 $<HTMLButtonElement>('#wall-prev').disabled=pendingRooms[room]||pages[room]===0;
 $<HTMLButtonElement>('#wall-next').disabled=pendingRooms[room]||pages[room]>=count-1;
}
function hangRoom(index:number,page=pages[index]):Promise<void>{
 if(!museum)return Promise.resolve();
 const engine=museum,size=pageSize(index),version=++hangingVersions[index];pendingRooms[index]=true;if(index===room)updateWallPagination();
 const job=(async()=>{try{await engine.displayRoom(index,wallWorks(index).slice(page*size,page*size+size),roomDocs(index));if(version===hangingVersions[index]){pages[index]=page;loadedRooms[index]=true;}}finally{if(version===hangingVersions[index]){pendingRooms[index]=false;roomJobs[index]=undefined;if(index===room)updateWallPagination();}}})();
 roomJobs[index]=job;return job;
}
async function ensureRoom(index:number){if(pendingRooms[index]&&roomJobs[index])return roomJobs[index];if(!loadedRooms[index])await hangRoom(index);}
async function changeWall(page:number){
 const index=room,max=Math.ceil(wallWorks(index).length/pageSize(index));if(page<0||page>=max||pendingRooms[index])return;
 stopGuide();const request=focusRequest;try{await hangRoom(index,page);if(request===focusRequest){const first=wallWorks(index)[page*pageSize(index)];if(first)await faceItem(first);notify(`已展出本廳第 ${page+1} 批作品。`);}}catch(error){if(request===focusRequest&&!isCancelled(error))notify('作品載入失敗，原展牆保留。');}
}
$('#wall-retry').onclick=()=>{const index=room;void ensureRoom(index).catch(error=>{if(room===index&&!isCancelled(error))notify('作品仍無法載入，可先由館藏目錄閱讀。');});};
$('#wall-prev').onclick=()=>void changeWall(pages[room]-1);$('#wall-next').onclick=()=>void changeWall(pages[room]+1);
$('#wall-all').onclick=()=>{catalogueTheme=exhibitions[room].theme;catalogueQuery='';catalogueFeatured=false;showPanel('catalogue');};
async function faceItem(item:Artwork|DocumentItem,keepGuide=false){
  if(!museum||!museumReady){notify('3D 展館尚未準備完成，可先閱讀作品。');return false;}
  const target='artist' in item?findExhibit(collection.artworks,exhibitions,item.id):(()=>{let index=roomDocs(room).some(d=>d.id===item.id)?room:exhibitions.findIndex((_,i)=>roomDocs(i).some(d=>d.id===item.id));return index<0?null:{room:index,page:pages[index]};})();
  if(!target){notify('這件作品尚未取得可上牆的預覽，可由來源觀看完整原作。');return false;}
  const request=++focusRequest;
  try{
    if(!loadedRooms[target.room]||pages[target.room]!==target.page||pendingRooms[target.room])await hangRoom(target.room,target.page);
    if(request!==focusRequest)return false;
    if(panel.open)closePanel(false);if(!entered)start();pause(false);if(!keepGuide)stopGuide();
    const ok='artist' in item?museum.focusArtwork(item.id):museum.focusDocument(item.id);
    if(!ok){notify('作品尚未掛妥，請稍後再試。');return false;}
    updateRoom(target.room);collapseRoom();$<HTMLCanvasElement>('#scene canvas')?.focus({preventScroll:true});return true;
  }catch(error){if(request===focusRequest&&!isCancelled(error))notify('這組作品尚未載入完成，原展牆保留。請稍後重試。');return false;}
}
async function guideTo(index:number){const works=route();if(index<0||index>=works.length)return;const request=focusRequest+1;if(await faceItem(works[index],true)&&request===focusRequest){guideIndex=index;renderGuide();}}
function renderGuide(){const works=route(),art=works[guideIndex],node=$('#guide');node.hidden=!art;if(!art)return;
  node.innerHTML=`<div class="guide-heading"><span class="tiny">慢看導覽 · ${guideIndex+1} / ${works.length}</span><button id="end-guide" aria-label="結束導覽">✕</button></div><strong>${escapeHTML(art.title)}</strong><p>${escapeHTML(art.viewingNote||'在這件作品前停留片刻。')}</p><div class="guide-actions"><button id="guide-prev" ${guideIndex===0?'disabled':''}>← 上一件</button><button id="guide-inspect">細看與閱讀</button><button id="guide-next" ${guideIndex===works.length-1?'disabled':''}>下一件 →</button></div>`;
  $('#end-guide').onclick=stopGuide;$('#guide-prev').onclick=()=>void guideTo(guideIndex-1);$('#guide-next').onclick=()=>void guideTo(guideIndex+1);$('#guide-inspect').onclick=()=>inspect(art,'guide',works.map(a=>a.id));
}
function inspect(item:Artwork|DocumentItem,origin='catalogue',ids?:string[]){
  if(openPanel==='catalogue'){catalogueScroll=panel.scrollTop;catalogueFocus=item.id;}
  selectedItem=item;detailOrigin=origin;detailIds=ids||('artist' in item?wallWorks(exhibitions.findIndex(x=>x.theme===item.theme)).map(a=>a.id):documents.map(d=>d.id));
  showPanel('artwork');history.replaceState(null,'',`${location.pathname}${location.search}#${'artist' in item?'artwork':'document'}=${encodeURIComponent(item.id)}`);
}
function returnFromDetail(){
  if(detailOrigin==='catalogue'){showPanel('catalogue');panel.scrollTop=catalogueScroll;const b=Array.from(document.querySelectorAll<HTMLElement>('[data-id]')).find(b=>b.dataset.id===catalogueFocus);b?.focus({preventScroll:true});}
  else if(detailOrigin==='story')showPanel('story');else closePanel();
}
function bindItems(container:HTMLElement,origin:string,ids?:string[]){container.querySelectorAll<HTMLElement>('[data-id]').forEach(b=>b.onclick=()=>{const item=itemById(b.dataset.id!);if(item)inspect(item,origin,ids);});}
function artList(works:Artwork[]){return `<ol class="ordered-works">${works.map(a=>`<li><button data-id="${escapeHTML(a.id)}"><span>${escapeHTML(a.title)}</span><small>${escapeHTML(a.artist)}</small></button></li>`).join('')}</ol>`;}
function renderPanel(name:string){
 const content=$('#panel-content');
 if(name==='catalogue'){
  content.innerHTML=`<p class="eyebrow">THE COLLECTION & THE ARCHIVE</p><h2 id="panel-title">館藏目錄</h2><p class="panel-intro">32 件策展精選、136 件可在館內觀看的作品，以及持有紀錄與公開文獻。資料核對於 ${escapeHTML(collection.verifiedAt?.slice(0,10)||'讀取中')}。</p><div class="catalogue-tools"><label class="search"><span>⌕</span><input id="search-art" type="search" placeholder="搜尋作品、藝術家或鏈別" aria-label="搜尋作品、藝術家或鏈別" value="${escapeHTML(catalogueQuery)}"></label><label class="sr-only" for="theme-filter">展間篩選</label><select id="theme-filter"><option value="all">所有分類</option>${exhibitions.map(x=>`<option value="${x.theme}" ${x.theme===catalogueTheme?'selected':''}>${escapeHTML(x.title)}</option>`).join('')}<option value="documents" ${catalogueTheme==='documents'?'selected':''}>文獻檔案</option></select></div><label class="check-label"><input id="featured-filter" type="checkbox" ${catalogueFeatured?'checked':''}> 只看首展選件</label><p id="result-count" class="tiny" aria-live="polite"></p><div id="catalogue-grid" class="catalogue-grid"></div><p class="footnote">初步分類不是正式策展或購藏決議。錢包持有不等同經提案購藏；未選入首展的紀錄仍保留供查閱。</p>`;
  $<HTMLInputElement>('#search-art').oninput=e=>{catalogueQuery=(e.target as HTMLInputElement).value;renderCatalogue();};$<HTMLSelectElement>('#theme-filter').onchange=e=>{catalogueTheme=(e.target as HTMLSelectElement).value;renderCatalogue();};$<HTMLInputElement>('#featured-filter').onchange=e=>{catalogueFeatured=(e.target as HTMLInputElement).checked;renderCatalogue();};renderCatalogue();
 }else if(name==='artwork'&&selectedItem){renderDetail(selectedItem);
 }else if(name==='map'){
  content.innerHTML=`<p class="eyebrow">FIND YOUR OWN PATH</p><h2 id="panel-title">展間地圖</h2><p class="panel-intro">四廳由拱廊串連。可直接抵達展間，或選一件作品開始正面觀看。</p><div class="floorplan">${exhibitions.map((x,i)=>`<button data-room="${i}" class="map-room ${entered&&room===i?'current':''}"><span class="map-number">0${i+1}</span><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.titleEn)}</small><span class="map-count">${wallWorks(i).length} 件 · ${Math.ceil(wallWorks(i).length/pageSize(i))} 批</span><span class="map-enter">${entered&&room===i?'● 你在這裡':'進入展間 →'}</span></button>`).join('')}</div><p class="footnote">入口 → 生成之間 → 群山成島 → 收藏作為行動 → 留白與記憶</p>${exhibitions.map((x,i)=>`<section class="map-exhibition"><h3>0${i+1} ${escapeHTML(x.title)}</h3><p class="panel-prose">${escapeHTML(x.question||x.subtitle)}</p><button class="text-link" data-guide-room="${i}">從本廳開始導覽 →</button>${artList(roomWorks(i))}</section>`).join('')}`;
  content.querySelectorAll<HTMLElement>('[data-room]').forEach(b=>b.onclick=()=>goToRoom(Number(b.dataset.room)));
  content.querySelectorAll<HTMLElement>('[data-guide-room]').forEach(b=>b.onclick=()=>void guideTo(route().findIndex(a=>a.theme===exhibitions[Number(b.dataset.guideRoom)].theme)));
  content.querySelectorAll<HTMLElement>('[data-id]').forEach(b=>b.onclick=()=>{const a=itemById(b.dataset.id!);if(a)void faceItem(a);});
 }else if(name==='story'){
  const x=exhibitions[room],works=roomWorks(room),maxPage=Math.ceil(wallWorks(room).length/pageSize(room));
  content.innerHTML=`<p class="eyebrow">GALLERY 0${room+1} · ${escapeHTML(x.titleEn)}</p><h2 id="panel-title">${escapeHTML(x.title)}</h2><p class="large-subtitle">${escapeHTML(x.question||x.subtitle)}</p>${prose(x.introduction||x.description)}<div class="room-count"><span>${works.length} 件策展精選</span><span>${wallWorks(room).length} 件可上牆館藏</span><span>${roomDocs(room).length} 份關聯文獻</span></div>${(x.groups||[]).map(g=>`<section class="curatorial-group"><h3>${escapeHTML(g.title)}</h3>${prose(g.description)}${artList(g.artworkIds.map(id=>collection.artworks.find(a=>a.id===id)).filter((a):a is Artwork=>!!a))}</section>`).join('')}${maxPage>1?`<div class="hanging-pages"><label for="hanging-page">展牆段落</label><select id="hanging-page">${Array.from({length:maxPage},(_,i)=>`<option value="${i}" ${pages[room]===i?'selected':''}>第 ${i+1} 批 · 第 ${i*pageSize(room)+1}–${Math.min((i+1)*pageSize(room),wallWorks(room).length)} 件</option>`).join('')}</select></div><p class="footnote">每批先完整載入再換牆，也可直接使用館內左下角的上一批／下一批。精選以外為延伸館藏，分類狀態在作品資料中標示。</p>`:''}<h3>沿著文件閱讀</h3><div class="document-links">${roomDocs(room).map(d=>`<button data-id="${escapeHTML(d.id)}">${escapeHTML(d.title)} ↗</button>`).join('')}</div><blockquote>${escapeHTML(x.transition||'')}</blockquote><div class="source-links">${(x.sourceUrls||[]).map((u,i)=>linked(u,`策展參考 ${i+1}`)).join('')}</div><button class="primary" id="story-guide">開始本廳導覽 →</button><p class="footnote">策展編輯與原作者自述分別標示。未取得提案或交易佐證的入藏理由，不作推定。</p>`;
  bindItems(content,'story');$('#story-guide').onclick=()=>void guideTo(route().findIndex(a=>a.theme===x.theme));
  const select=content.querySelector<HTMLSelectElement>('#hanging-page');if(select)select.onchange=async()=>{const index=room,previous=pages[index],request=focusRequest;select.disabled=true;notify('正在準備這一段作品…');try{await hangRoom(index,Number(select.value));if(request===focusRequest){stopGuide();notify('展牆已更換，關閉視窗即可觀看。');}}catch{if(request===focusRequest){select.value=String(previous);notify('作品載入失敗，原展牆保留。');}}finally{select.disabled=false;}};
 }else if(name==='about'){
  content.innerHTML=`<p class="eyebrow">A MUSEUM HELD IN COMMON</p><h2 id="panel-title">${escapeHTML(institution?.title||'關於這座美術館')}</h2><p class="large-subtitle">${escapeHTML(institution?.question||'誰在收藏，又為誰留下？')}</p>${prose(institution?.introduction||'循著 FAB DAO 的館藏與公開文件，觀看數位藝術如何與公共生活相遇。')}<div class="about-facts"><div><span>04</span>主題展間</div><div><span>32</span>首展選件</div><div><span>${collection.artworks.length}</span>持有紀錄</div></div><h3>這裡的「我們」是誰？</h3>${prose(institution?.authorship||'共同收藏的參與者與每位受邀觀看的訪客，並不預設擁有相同立場。')}<h3>收藏與計畫的時間線</h3><ol class="timeline">${(institution?.timeline||[]).map(t=>`<li><time>${escapeHTML(t.date)}</time><h3>${escapeHTML(t.title)}</h3>${prose(t.description)}<div class="document-links">${t.documentIds.map(id=>documents.find(d=>d.id===id)).filter((d):d is DocumentItem=>!!d).map(d=>`<button data-id="${escapeHTML(d.id)}">${escapeHTML(d.title)} ↗</button>`).join('')}</div></li>`).join('')}</ol><h3>來源與收藏邊界</h3>${prose(institution?.collectionScope||'公開索引器快照只用來核對持有，並不推定正式購藏。')}<div class="wallet-list"><span>Tezos · fabcollect.tez</span><code>tz1cpZ7eLovJigqcUsfbjmquuezjToZLtGUZ</code><span>Ethereum · 藝術銀行地址</span><code>0x992f0201ff7ee158a8baf638549d0ad1cbcc27ef</code></div><p class="footnote">資料快照：${escapeHTML(collection.verifiedAt?.slice(0,10))}。原作與著作權歸藝術家所有。無需登入或連接錢包即可入館。</p><div class="source-links">${linked('https://fabdao.world','FAB DAO 官方網站')}${linked('/data/collection.json','館藏來源資料')}${linked('/data/documents.json','文獻來源清單')}${linked('/data/institution.json','本館編輯與沿革')}</div>`;bindItems(content,'about');
 }else if(name==='settings'){
  content.innerHTML=`<p class="eyebrow">MAKE YOURSELF COMFORTABLE</p><h2 id="panel-title">觀看設定</h2><p class="panel-intro">依照電腦效能與操作習慣，調整觀看方式。</p><label class="settings-label" for="quality">畫質</label><select id="quality"><option value="balanced">均衡 · 光影與流暢度</option><option value="high">細緻 · 增加環境遮蔽</option><option value="low">流暢 · 降低渲染負擔</option></select><p class="footnote">${fps>0?`上次連續移動：約 ${fps} FPS（此裝置估計）。`:'連續移動後，可在此查看流暢度估計。'}停下或閱讀作品時，展館會停止重畫以節省資源。</p><h3>滑鼠與視角</h3><p class="panel-prose">拖曳像抓住場景：往右拖，景物跟著往右。按「自由環視」後則像第一人稱遊戲：滑鼠往右，視線往右看。Esc 可釋放游標。</p><div class="control-grid"><label for="sensitivity">滑鼠靈敏度<select id="sensitivity"><option value="0.5">較慢 · 0.5×</option><option value="0.75">偏慢 · 0.75×</option><option value="1">標準 · 1×</option><option value="1.5">偏快 · 1.5×</option><option value="2">較快 · 2×</option></select></label><label for="vertical-control">上下方向<select id="vertical-control"><option value="normal">標準</option><option value="inverted">反轉上下</option></select></label></div><label class="check-label"><input id="show-performance" type="checkbox" ${showPerformance?'checked':''}> 顯示即時效能</label><details class="diagnostics"><summary>此裝置的渲染資訊</summary><pre id="render-stats"></pre></details><h3>依自己的步調觀看</h3><p class="panel-prose">正面定位採直接抵達，館內沒有頭部晃動。也可留在館藏目錄閱讀；關閉原作會停止其運算與聲音。</p><button id="setting-quiet" class="text-link">${quiet?'恢復介面':'專心觀看 · 暫時隱藏介面'}</button>`;
  const select=$<HTMLSelectElement>('#quality');select.value=museum?.quality||'balanced';select.onchange=()=>{museum?.setQuality(select.value);try{localStorage.setItem('fab-museum-quality',select.value);}catch{}updatePerformance();};
  $<HTMLSelectElement>('#sensitivity').value=String(controls.sensitivity);$<HTMLSelectElement>('#vertical-control').value=controls.invertY?'inverted':'normal';
  const saveControls=()=>{controls={sensitivity:Number($<HTMLSelectElement>('#sensitivity').value),invertY:$<HTMLSelectElement>('#vertical-control').value==='inverted'};museum?.setControlSettings(controls);try{localStorage.setItem('fab-museum-controls',JSON.stringify(controls));}catch{}};
  $('#sensitivity').onchange=saveControls;$('#vertical-control').onchange=saveControls;
  $('#show-performance').onchange=()=>{showPerformance=$<HTMLInputElement>('#show-performance').checked;$('#performance-readout').hidden=!showPerformance;updatePerformance();};
  $('#setting-quiet').onclick=()=>{closePanel();setQuiet(!quiet);};updatePerformance();
 }else if(name==='help'){
  content.innerHTML=`<p class="eyebrow">A SLOW WALK THROUGH ART</p><h2 id="panel-title">如何逛美術館</h2><div class="help-list">${[['W A S D','前後左右移動'],['拖曳滑鼠','抓住場景拖動；自由環視則像第一人稱遊戲'],['↑ ↓ ← →','前後移動、向左或向右看'],['Page Up / Page Down','向上或向下看'],['Enter / 點擊作品','閱讀瞄準的作品或文獻'],['慢看導覽','依策展順序，逐件正面抵達'],['H','隱藏或恢復介面'],['M / Esc','開啟地圖／釋放游標或暫停']].map(([key,desc])=>`<div><span>${key}</span><p>${desc}</p></div>`).join('')}</div><p class="footnote">讀作品時，方向鍵可平移放大的預覽。所有導覽按鈕可用 Tab 與 Enter 操作。</p>`;
 }
}
function renderCatalogue(){
 const q=catalogueQuery.toLocaleLowerCase().trim();const entries:(Artwork|DocumentItem)[]=[...collection.artworks,...documents].filter(a=>(catalogueTheme==='all'||(catalogueTheme==='documents'?!('artist' in a):'artist' in a?a.theme===catalogueTheme:!!exhibitions.find(x=>x.theme===catalogueTheme)?.documentIds?.includes(a.id)))&&(!catalogueFeatured||('artist' in a&&a.featured===true))&&(!q||[a.title,'artist' in a?a.artist:'',a.description||a.summary,'artist' in a?a.chain:'',a.viewingNote,a.curatorialNote].some(v=>String(v||'').toLocaleLowerCase().includes(q))));
 $('#result-count').textContent=`${entries.length} 件結果`;
 $('#catalogue-grid').innerHTML=entries.length?entries.map(a=>`<button class="collection-card" data-id="${escapeHTML(a.id)}"><span class="card-image">${'artist' in a&&a.image?`<img src="${escapeHTML(safeURL(a.image))}" alt="${escapeHTML(a.title)}" loading="lazy" decoding="async">`:`<span class="document-tile">${'artist' in a?'預覽尚未取得':'PUBLIC ARCHIVE'}</span>`}</span><span class="card-caption"><span class="card-meta"><span class="card-artist">${escapeHTML('artist' in a?a.artist:a.date)}</span><span class="card-type">${'artist' in a?(a.featured?'策展精選':a.themeStatus==='metadata_review'?'延伸館藏':'分類待複核'):'文獻'}</span></span><span class="card-title">${escapeHTML(a.title)}</span><span class="card-arrow" aria-hidden="true">↗</span></span></button>`).join(''):'<p class="empty-state">沒有符合的紀錄。可清除搜尋或調整篩選。</p>';
 bindItems($('#catalogue-grid'),'catalogue',entries.map(a=>a.id));
 $('#catalogue-grid').querySelectorAll<HTMLImageElement>('img').forEach(img=>img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('span'),{className:'document-tile',textContent:'預覽暫時無法載入'}));});
}
function renderDetail(item:Artwork|DocumentItem){
 const art='artist' in item?item as Artwork:null,doc=art?null:item as DocumentItem,support=art?getMediaSupport(art):null;
 const index=detailIds.indexOf(item.id),exhibit=art?findExhibit(collection.artworks,exhibitions,item.id):exhibitions.some(x=>x.documentIds?.includes(item.id));
 $('#panel-kicker').textContent=art?'COLLECTION / 作品':'ARCHIVE / 文獻';
 $('#panel-content').innerHTML=`<div class="detail-navigation"><button id="detail-back" class="back-link">← ${detailOrigin==='catalogue'?'回搜尋結果':detailOrigin==='story'?'回策展論述':detailOrigin==='about'?'回關於本館':detailOrigin==='shared'?'關閉作品':'回到剛才的展牆'}</button><div><button id="detail-prev" ${index<=0?'disabled':''} aria-label="上一件作品">← 上一件</button><button id="detail-next" ${index<0||index>=detailIds.length-1?'disabled':''} aria-label="下一件作品">下一件 →</button></div></div><div class="artwork-layout"><div class="detail-media"><div id="media-tabs" class="media-tabs">${art?`<button id="show-preview" aria-pressed="true">${support?.supported?'預覽影像':'作品預覽'}</button>${support?.supported?'<button id="show-original" aria-pressed="false">觀看原作</button>':''}`:''}</div><div id="artwork-surface" class="artwork-view"></div><p class="media-caption">${art?`預覽保留原比例。${support?.supported?'原作可由上方按鈕開啟。':'完整媒材與原始尺寸請見作品來源。'}`:'原始文件的策展摘要，完整內容請見來源。'}</p></div><div class="artwork-info"><span class="eyebrow">${escapeHTML(art?.selectedGroupLabel||exhibitions.find(x=>x.theme===item.theme)?.title||'館藏檔案')}</span><h2 id="panel-title">${escapeHTML(item.title)}</h2><p class="artist">${escapeHTML(art?.artist||doc?.credit||'FAB DAO · 公開文獻')}</p>${art?`<p class="medium-label">${escapeHTML(art.mediumLabel||art.chain)}${art.suggestedDuration?` · ${escapeHTML(art.suggestedDuration)}`:''}</p>${art.featured?`<div class="viewing-note"><span>先看這裡</span><p>${escapeHTML(art.viewingNote)}</p></div><p class="panel-prose">${escapeHTML(art.makingNote)}</p><h3>為什麼放在這裡？</h3><p class="panel-prose">${escapeHTML(art.curatorialNote)}</p><p class="editorial-label">${escapeHTML(art.editorialLabel)}</p>`:`<p class="panel-prose">${exhibit?'這件作品列為延伸館藏，可由展牆分批觀看。':'這筆紀錄保留於館藏目錄，目前尚未取得有效預覽；可由下方作品來源閱讀。'}主題若標示待複核，僅供檢索，並不代表已有策展或購藏決議。</p>`}`:prose(doc?.summary)}<div class="detail-actions">${exhibit?'<button id="face-work" class="primary">正面觀看這件展品 →</button>':''}<button id="share-work" class="text-link">複製作品連結</button></div>${art?.acquisitionStory?acquisitionHTML(art):''}<details class="source-details"><summary>${art?'原作者說明與來源資料':'文獻來源資料'}</summary>${art?`<h3>原作者說明 · metadata 原文</h3><p class="original-description">${escapeHTML(art.description||'原始 metadata 未提供說明。')}</p><dl><div><dt>網路</dt><dd>${escapeHTML(art.chain)}</dd></div><div><dt>Token ID</dt><dd>${escapeHTML(art.tokenId||'—')}</dd></div><div><dt>持有核對</dt><dd>索引器快照 · ${escapeHTML(collection.verifiedAt?.slice(0,10))}</dd></div><div><dt>分類狀態</dt><dd>${art.featured?'首展選件':art.themeStatus==='metadata_review'?'依作品資料複核':'初步歸類，待策展複核'}</dd></div><div><dt>原作授權</dt><dd>${escapeHTML(art.license||'依原作者／來源標示')}</dd></div></dl>`:`<p class="panel-prose">${escapeHTML(doc?.displayLabel||doc?.type)} · ${escapeHTML(doc?.date||'見原始文件')}</p>`}<div class="source-links">${linked(art?.sourceUrl||doc?.url,art?'作品來源':'閱讀原始文件')}${art&&(art.artifactUrl||art.animation)?linked(art.artifactUrl||art.animation,'完整原作'):''}${art?.contract?linked(art.chain.toLowerCase()==='tezos'?`https://tzkt.io/${art.contract}/tokens/${art.tokenId}`:`https://etherscan.io/token/${art.contract}?a=${art.tokenId}`,'鏈上紀錄'):''}</div><p class="footnote">作品權利歸原作者。錢包持有不等同已完成購藏決議或已查明取得方式。</p></details>${doc?linked(doc.url,'閱讀原始文件'):''}</div></div>`;
 $('#detail-back').onclick=()=>detailOrigin==='about'?showPanel('about'):returnFromDetail();
 for(const [selector,delta]of [['#detail-prev',-1],['#detail-next',1]]as const)$(selector).onclick=()=>{const next=itemById(detailIds[index+delta]);if(next)inspect(next,detailOrigin,detailIds);};
 const face=document.querySelector<HTMLElement>('#face-work');if(face)face.onclick=()=>void faceItem(item);
 $('#share-work').onclick=async()=>{const url=`${location.origin}/#${art?'artwork':'document'}=${encodeURIComponent(item.id)}`;try{await navigator.clipboard.writeText(url);notify('作品連結已複製。');}catch{const input=document.createElement('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label','作品分享連結');$('#share-work').after(input);input.focus();input.select();notify('請複製這個作品連結。');}};
 const surface=$('#artwork-surface');
 function preview(){disposeDetail();surface.replaceChildren();surface.className='artwork-view';if(art?.image){const viewer=mountImageViewer(surface,safeURL(art.image),art.title);detailDispose=()=>viewer.dispose();}else{surface.innerHTML=`<div class="document-cover"><span>FAB DAO<br>PUBLIC ARCHIVE</span><h3>${escapeHTML(item.title)}</h3><span>${escapeHTML(doc?.date||'預覽尚未取得')}</span></div>`;}document.querySelector('#show-preview')?.setAttribute('aria-pressed','true');document.querySelector('#show-original')?.setAttribute('aria-pressed','false');}
 preview();const previewButton=document.querySelector<HTMLElement>('#show-preview');if(previewButton)previewButton.onclick=preview;
 const original=document.querySelector<HTMLElement>('#show-original');if(original&&art)original.onclick=()=>{disposeDetail();surface.replaceChildren();surface.className='artwork-view original-surface';const media=mountMedia(surface,art);detailDispose=()=>media.dispose();original.setAttribute('aria-pressed','true');$('#show-preview').setAttribute('aria-pressed','false');};
}
function acquisitionHTML(art:Artwork){const s=art.acquisitionStory!;return `<details class="acquisition-story"><summary>${escapeHTML(s.title)}</summary><h3>作者／計畫的意圖</h3>${prose(s.artistIntent)}<h3>本次選展理由</h3>${prose(s.exhibitionReason)}<h3>目前可核對</h3><ul>${s.verifiedFacts.map(f=>`<li>${escapeHTML(f)}</li>`).join('')}</ul><h3>仍待補齊</h3><ul>${s.openQuestions.map(f=>`<li>${escapeHTML(f)}</li>`).join('')}</ul><div class="source-links">${s.sourceUrls.map((u,i)=>linked(u,`佐證來源 ${i+1}`)).join('')}</div></details>`;}
function updatePerformance(){
 if(!museum)return;const state=museum.getState();
 const text=`${fps>0?`上次移動 ${fps} FPS`:'等待連續移動取樣'} · ${museum.quality==='high'?'細緻':museum.quality==='low'?'流暢':'均衡'}\n${JSON.stringify(state.renderStats,null,2)}`;
 if(showPerformance)$('#performance-readout').textContent=`${fps>0?`上次移動 ${fps} FPS`:'等待取樣'} · ${museum.quality==='high'?'細緻':museum.quality==='low'?'流暢':'均衡'}`;
 const diagnostics=document.querySelector<HTMLElement>('#render-stats');if(diagnostics)diagnostics.textContent=text;
}
setInterval(()=>{if(showPerformance||openPanel==='settings')updatePerformance();},1000);
function readSharedItem(){const match=location.hash.match(/^#(artwork|document)=(.+)$/);if(match){try{const item=itemById(decodeURIComponent(match[2]));if(item)inspect(item,'shared');else notify('找不到這筆作品紀錄，可從館藏目錄搜尋。');}catch{notify('作品連結格式無法辨識。');}}else if(location.hash==='#catalogue')showPanel('catalogue');}
window.addEventListener('hashchange',readSharedItem);
async function init(){
 try{
  [collection,exhibitions,documents]=await Promise.all(['/data/collection.json','/data/exhibitions.json','/data/documents.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error(`資料 ${r.status}`);return r.json();})));
  institution=await fetch('/data/institution.json').then(r=>r.ok?r.json():undefined).catch(()=>undefined);
  if(!Array.isArray(collection.artworks)||exhibitions.length!==4)throw Error('館藏資料格式錯誤');if(openPanel)renderPanel(openPanel);readSharedItem();
  const {Museum}=await import('./museum');museum=new Museum($('#scene'),exhibitions);
  museum.onRoom=updateRoom;museum.onInspect=item=>inspect(item,'wall');museum.onHover=item=>{hoverItem=item;const button=$('#inspect-hint');button.hidden=!item;button.textContent=item?`${item.title} · Enter 觀看`:'';};museum.onMove=()=>collapseRoom();
  museum.onStats=value=>{fps=value;updatePerformance();};museum.onContextLost=()=>{museumReady=false;stopGuide();$('#enter').onclick=()=>showPanel('catalogue');$('#enter').textContent='開啟館藏目錄';showPanel('catalogue');notify('3D 顯示已中斷，可繼續使用館藏目錄。');};
  try{const saved=JSON.parse(localStorage.getItem('fab-museum-controls')||'null');if(saved&&[.5,.75,1,1.5,2].includes(saved.sensitivity)){controls={sensitivity:saved.sensitivity,invertY:!!saved.invertY};museum.setControlSettings(controls);}}catch{}
  try{const value=localStorage.getItem('fab-museum-quality');if(value&&['low','balanced','high'].includes(value))museum.setQuality(value);}catch{}
  await ensureRoom(0);museumReady=true;void ensureRoom(1).catch(()=>{});if(panel.open)museum.setPaused(true);
  $<HTMLButtonElement>('#enter').disabled=false;$('#enter').innerHTML='進入美術館 <span>↗</span>';
 }catch(error){console.error(error);$('#enter').innerHTML='開啟館藏目錄 <span>↗</span>';$<HTMLButtonElement>('#enter').disabled=false;$('#enter').onclick=()=>showPanel('catalogue');document.body.classList.add('no-webgl');notify('3D 展館載入未完成，仍可由館藏目錄觀看作品與資料。');}
}
void init();
