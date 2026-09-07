import './style.css';
import type { Artwork, Collection, Exhibition, DocumentItem, Institution } from './types';

import { mountImageViewer } from './image-viewer';
import { pageSize, exhibitionWorks, exhibitionDocuments, galleryWorks, findExhibit } from './curation.js';
import { getMediaSupport, mountMedia } from './media';
import { locale, t, languageURL, applyEnglishOverlay, decodeVisit, type Locale, type VisitState } from './locale';

document.documentElement.lang=locale;
document.title=t('FAB DAO 美術館 — 從共同收藏，走向開放的觀看','FAB DAO Museum — A collection held in common');
const languageSwitch=()=>`<div class="language-switch" role="group" aria-label="${t('介面語言','Interface language')}"><button type="button" data-language="zh-TW" lang="zh-TW" aria-pressed="${locale==='zh-TW'}" aria-label="${t('切換至繁體中文','Switch to Traditional Chinese')}">繁中</button><span aria-hidden="true">/</span><button type="button" data-language="en" lang="en" aria-pressed="${locale==='en'}" aria-label="${t('切換至英文','Switch to English')}">EN</button></div>`;

const $ = <T extends HTMLElement = HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
const escapeHTML = (s:unknown) => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const safeURL=(s:unknown)=>{try {const u=new URL(String(s),location.origin);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const icon = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5 13 20 4l15 9M5 16h30M5 35h30M9 19v12m7-12v12m8-12v12m7-12v12" stroke="currentColor" stroke-width="1.5"/></svg>`;
$('#app').innerHTML=`
  <div id="scene"></div><div class="scene-shade"></div>
  <a href="#catalogue" class="skip-link">${t("跳到館藏目錄","Skip to the collection")}</a>
  <header class="masthead"><a class="brand" href="/" aria-label="${t("FAB DAO 美術館首頁","FAB DAO Museum home")}">${icon}<span>FAB DAO<span class="brand-sub">MUSEUM</span></span></a><span class="institution">${t("福爾摩沙藝術銀行美術館","Formosa Art Bank Museum")}</span>
    <nav aria-label="${t("主要導覽","Main navigation")}"><button data-open="map">${t("展間地圖","Gallery map")} <span>↗</span></button><button data-open="catalogue">${t("館藏目錄","Collection")}</button><button data-open="about">${t("關於本館","About")}</button></nav>${languageSwitch()}<span class="open-badge"><i></i> ALWAYS OPEN</span>
  </header>
  <main id="welcome"><div class="edition"><span>INAUGURAL EXHIBITION</span><span>VOL. 01 / 2026</span></div><div class="intro-rule"></div>
    <p class="eyebrow">${t("從共同收藏，走向開放的觀看","Collecting together. Looking with others.")}</p><h1>${t("藝術，如何","How does art")}<br>${t("成為共同的","become a shared")}<br><span>${t("記憶？","memory?")}</span></h1>
    <p class="intro-copy">${t("走進 FAB DAO 的數位收藏。","Step inside the FAB DAO collection.")}<br>${t("在生成、島嶼、行動與記憶之間，","Across generative art, islands, action and memory,")}<br>${t("重新想像藝術如何與公共生活相遇。","explore how art meets public life.")}</p>
    <div class="enter-row"><button id="enter" class="primary" disabled>${t("正在開啟展館","Opening the museum")} <span class="spinner"></span></button><button data-open="catalogue" class="text-link">${t("瀏覽館藏","Browse the collection")} <span>↗</span></button></div>
    <p class="desktop-note"><span>⌨</span> ${t("電腦體驗 · 第一人稱漫遊 · 無需連接錢包","Made for desktop · First-person exploration · No wallet needed")}</p>
  </main>
  <div id="welcome-caption"><span class="tiny">THE COMMONS, COLLECTED.</span><p>${t("從一件作品，","Begin with one work.")}<br>${t("開始一場對話。","Make room for a conversation.")}</p><span class="caption-line"></span><span class="tiny">${t("數位館藏 × 古典空間","Digital art × Classical architecture")}</span></div>
  <div id="welcome-bottom"><span>FOUR GALLERIES. ONE SHARED COLLECTION.</span><div><span>01 — 04</span><span class="line"></span><span>${t("自由入館，慢慢觀看","Come in freely. Take your time.")}</span></div></div>
  <div id="tour-ui" hidden>
    <button id="room-pill" aria-expanded="true" aria-controls="room-card"></button><section id="room-card" class="room-card" aria-label="${t("目前展間","Current gallery")}"><span id="room-number" class="tiny">GALLERY 01 / 04</span><h2 id="room-title"></h2><p id="room-subtitle"></p><button id="room-story">${t("閱讀策展論述","Read the curatorial essay")} <span>↗</span></button><button id="guide-start">${t("從本廳開始導覽","Start this gallery’s tour")} →</button></section>
    <section id="wall-pagination" aria-label="${t("展牆作品分頁","Works on the gallery walls")}"><p id="wall-summary"></p><button id="wall-retry" hidden>${t("重試載入作品","Retry loading works")}</button><div><button id="wall-prev">← ${t("上一批","Previous display")}</button><button id="wall-all">${t("本廳全部作品","All gallery works")}</button><button id="wall-next">${t("下一批","Next display")} →</button></div></section><div id="reticle" aria-hidden="true"></div><button id="inspect-hint" hidden></button>
    <div class="tour-bottom"><div class="movement-hint"><span><kbd>W</kbd><br><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>${t("移動","Move")}<br><small>${t("拖曳滑鼠環視 · 點擊作品觀看","Drag to look around · Click a work to read")}</small></span></div>
      <div class="tour-actions"><button id="quiet-mode">${t("專心觀看","Quiet viewing")}</button><button id="mouse-lock">${t("自由環視","Free look")}</button><button data-open="help" aria-label="${t("操作說明","Controls and help")}">?</button><button data-open="settings" aria-label="${t("畫質設定","Viewing settings")}">⚙</button><button id="pause-tour">${t("暫停","Pause")}</button></div>
    </div><div id="room-pager"><button id="previous-room" aria-label="${t("上一展間","Previous gallery")}">←</button><span id="pager-label"></span><button id="next-room" aria-label="${t("下一展間","Next gallery")}">→</button></div>
    <output id="performance-readout" hidden aria-label="${t("即時效能資訊","Live performance information")}"></output><section id="guide" aria-label="${t("作品導覽","Artwork tour")}" hidden></section><button id="restore-interface" hidden>${t("顯示介面 · H","Show interface · H")}</button><div id="resume-panel" hidden><span class="tiny">TAKE YOUR TIME</span><h2>${t("停留，也是一種觀看。","A pause is part of looking.")}</h2><button id="resume" class="primary">${t("繼續漫遊","Continue exploring")} <span>→</span></button><button data-open="catalogue" class="text-link">${t("開啟館藏目錄","Open the collection")}</button></div>
  </div>
  <dialog id="panel" aria-labelledby="panel-title"><div class="panel-head"><span class="tiny" id="panel-kicker">FAB DAO MUSEUM</span>${languageSwitch()}<button id="close-panel" aria-label="${t("關閉視窗","Close dialog")}">✕</button></div><div id="panel-notice" role="status" aria-live="polite"></div><div id="panel-content"></div></dialog>
  <div id="notice" role="status" aria-live="polite"></div>
`;

let collection:Collection={verifiedAt:'',artworks:[],wallets:[]}, exhibitions:Exhibition[]=[],documents:DocumentItem[]=[],institution:Institution|undefined;
let originalArtworks:Artwork[]=[];
const originalSearch=new Map<string,string>();
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
let resumedVisit:VisitState|null=null;
try{resumedVisit=decodeVisit(sessionStorage.getItem('fab-museum-language-visit'),location.href);sessionStorage.removeItem('fab-museum-language-visit');}catch{}
$('.brand').setAttribute('href',`/?lang=${locale}`);
document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(button=>button.onclick=()=>{
  const next=button.dataset.language as Locale;if(next===locale)return;
  const view=museum?.getState();
  const visit:VisitState={savedAt:Date.now(),path:location.pathname,locale:next,entered,room,pages:[...pages],panel:openPanel,
    selectedId:selectedItem?.id||'',detailOrigin,detailIds:[...detailIds],panelScroll:panel.scrollTop,catalogueTheme,catalogueQuery,catalogueFeatured,
    catalogueScroll:openPanel==='catalogue'?panel.scrollTop:catalogueScroll,catalogueFocus,quiet,manualPause,roomCollapsed:$('#room-card').hidden,
    guideId:route()[guideIndex]?.id||'',showPerformance,...(view?{view:{position:{x:view.position.x,z:view.position.z},yaw:view.yaw,pitch:view.pitch}}:{})};
  try{sessionStorage.setItem('fab-museum-language-visit',JSON.stringify(visit));}catch{}
  try{localStorage.setItem('fab-museum-language',next);}catch{}
  location.assign(languageURL(location.href,next));
});
const roomWorks=(index:number):Artwork[]=>exhibitionWorks(collection.artworks,exhibitions[index]?.theme);
// Source titles determine wall order in both languages; translations are display text.
const wallWorks=(index:number):Artwork[]=>galleryWorks(originalArtworks,exhibitions[index]?.theme).map((art:Artwork)=>collection.artworks.find(item=>item.id===art.id)!);
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
function start(initialRoom=0,announce=true){
  if(!museum||entered)return;entered=true;manualPause=false;$('#welcome').hidden=true;$('#welcome-caption').hidden=true;$('#welcome-bottom').hidden=true;$('#tour-ui').hidden=false;document.body.classList.add('entered');museum.start();if(initialRoom!==0)museum.teleport(initialRoom);updateRoom(initialRoom);collapseRoom(false);
  document.activeElement instanceof HTMLElement&&document.activeElement.blur();if(announce)notify(t('WASD 移動；拖曳滑鼠環視。點「從本廳開始導覽」會帶你正面看畫。',"Use WASD to move and drag to look around. “Start this gallery’s tour” takes you to a clear view of each work."));
}
$('#enter').onclick=()=>start();
$('#mouse-lock').onclick=()=>{museum?.lock();notify(t('滑鼠直接環視，按 Esc 釋放游標。',"Move the mouse to look around. Press Esc to release the pointer."));};
function pause(value:boolean){if(value)focusRequest++;manualPause=value;museum?.setPaused(value||panel.open);$('#resume-panel').hidden=!value;$('#pause-tour').textContent=value?t('繼續',"Continue"):t('暫停',"Pause");}
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
function updateRoom(index:number){room=index;const x=exhibitions[index];if(!x)return;$('#room-number').textContent=`GALLERY 0${index+1} / 04`;$('#room-title').textContent=x.title;$('#room-subtitle').textContent=x.subtitle;$('#room-pill').textContent=`0${index+1}  ${x.title}  ⌄`;$('#pager-label').textContent=`0${index+1} / 04`;$<HTMLButtonElement>('#previous-room').disabled=index===0;$<HTMLButtonElement>('#next-room').disabled=index===3;updateWallPagination();if(museumReady){void ensureRoom(index).catch(error=>{if(!isCancelled(error)&&room===index)notify(t('這一廳作品載入未完成，可按「重試載入作品」。',"This gallery has not finished loading. Select “Retry loading works”."));});if(index<3)void ensureRoom(index+1).catch(()=>{});}}
function stopGuide(){focusRequest++;guideIndex=-1;$('#guide').hidden=true;}
async function goToRoom(index:number){
 if(!museum||!museumReady){notify(t('3D 暫時無法使用，仍可瀏覽館藏。',"The 3D gallery is currently unavailable. You can still browse the collection."));return;}
 const request=++focusRequest;
 try{if(!loadedRooms[index])notify(t('正在準備這一廳作品…',"Preparing this gallery’s works…"));await ensureRoom(index);if(request!==focusRequest)return;if(panel.open)closePanel(false);if(!entered)start();stopGuide();pause(false);museum.teleport(index);updateRoom(index);collapseRoom(false);}
 catch(error){if(request===focusRequest&&!isCancelled(error))notify(t('展牆尚未準備完成，請稍後重試。',"This display is not ready yet. Please try again shortly."));}
}
$('#previous-room').onclick=()=>goToRoom(Math.max(0,room-1));$('#next-room').onclick=()=>goToRoom(Math.min(3,room+1));$('#room-story').onclick=()=>showPanel('story');
$('#inspect-hint').onclick=()=>{if(hoverItem)inspect(hoverItem,'wall');};
$('#guide-start').onclick=()=>void guideTo(route().findIndex(a=>a.theme===exhibitions[room].theme));
function updateWallPagination(){
 const works=wallWorks(room),count=Math.max(1,Math.ceil(works.length/pageSize(room))),start=pages[room]*pageSize(room),end=Math.min(start+pageSize(room),works.length);
 $('#wall-retry').hidden=loadedRooms[room]||pendingRooms[room];
 $('#wall-summary').textContent=pendingRooms[room]?t('正在準備展牆…',"Preparing the display…"):!loadedRooms[room]?t('展牆尚未載入，請重試。',"The display has not loaded. Please retry."):`${t("第 ","Display ")}${pages[room]+1} / ${count}${t(" 批 · 本廳 "," · Gallery total: ")}${works.length}${t(" 件 · 目前 "," works · Showing ")}${start+1}–${end}`;
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
 stopGuide();const request=focusRequest;try{await hangRoom(index,page);if(request===focusRequest){const first=wallWorks(index)[page*pageSize(index)];if(first)await faceItem(first);notify(`${t("已展出本廳第 ","Now showing display ")}${page+1}${t(" 批作品。"," in this gallery.")}`);}}catch(error){if(request===focusRequest&&!isCancelled(error))notify(t('作品載入失敗，原展牆保留。',"The new works could not load. The previous display is still in place."));}
}
$('#wall-retry').onclick=()=>{const index=room;void ensureRoom(index).catch(error=>{if(room===index&&!isCancelled(error))notify(t('作品仍無法載入，可先由館藏目錄閱讀。',"The works still cannot load. You can read them in the collection."));});};
$('#wall-prev').onclick=()=>void changeWall(pages[room]-1);$('#wall-next').onclick=()=>void changeWall(pages[room]+1);
$('#wall-all').onclick=()=>{catalogueTheme=exhibitions[room].theme;catalogueQuery='';catalogueFeatured=false;showPanel('catalogue');};
async function faceItem(item:Artwork|DocumentItem,keepGuide=false){
  if(!museum||!museumReady){notify(t('3D 展館尚未準備完成，可先閱讀作品。',"The 3D gallery is not ready yet. You can read about the work first."));return false;}
  const target='artist' in item?findExhibit(originalArtworks,exhibitions,item.id):(()=>{let index=roomDocs(room).some(d=>d.id===item.id)?room:exhibitions.findIndex((_,i)=>roomDocs(i).some(d=>d.id===item.id));return index<0?null:{room:index,page:pages[index]};})();
  if(!target){notify(t('這件作品尚未取得可上牆的預覽，可由來源觀看完整原作。',"A displayable preview is not available yet. Follow the source to view the original work."));return false;}
  const request=++focusRequest;
  try{
    if(!loadedRooms[target.room]||pages[target.room]!==target.page||pendingRooms[target.room])await hangRoom(target.room,target.page);
    if(request!==focusRequest)return false;
    if(panel.open)closePanel(false);if(!entered)start();pause(false);if(!keepGuide)stopGuide();
    const ok='artist' in item?museum.focusArtwork(item.id):museum.focusDocument(item.id);
    if(!ok){notify(t('作品尚未掛妥，請稍後再試。',"This work is not ready on the wall yet. Please try again shortly."));return false;}
    updateRoom(target.room);collapseRoom();$<HTMLCanvasElement>('#scene canvas')?.focus({preventScroll:true});return true;
  }catch(error){if(request===focusRequest&&!isCancelled(error))notify(t('這組作品尚未載入完成，原展牆保留。請稍後重試。',"This group has not finished loading. The previous display remains in place; please retry shortly."));return false;}
}
async function guideTo(index:number){const works=route();if(index<0||index>=works.length)return;const request=focusRequest+1;if(await faceItem(works[index],true)&&request===focusRequest){guideIndex=index;renderGuide();}}
function renderGuide(){const works=route(),art=works[guideIndex],node=$('#guide');node.hidden=!art;if(!art)return;
  node.innerHTML=`<div class="guide-heading"><span class="tiny">${t("慢看導覽 · ","Slow-looking tour · ")}${guideIndex+1} / ${works.length}</span><button id="end-guide" aria-label="${t("結束導覽","End tour")}">✕</button></div><strong>${escapeHTML(art.title)}</strong><p>${escapeHTML(art.viewingNote||t('在這件作品前停留片刻。',"Take a moment with this work."))}</p><div class="guide-actions"><button id="guide-prev" ${guideIndex===0?'disabled':''}>← ${t("上一件","Previous work")}</button><button id="guide-inspect">${t("細看與閱讀","Look closely and read")}</button><button id="guide-next" ${guideIndex===works.length-1?'disabled':''}>${t("下一件","Next work")} →</button></div>`;
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
  content.innerHTML=`<p class="eyebrow">THE COLLECTION & THE ARCHIVE</p><h2 id="panel-title">${t("館藏目錄","Collection")}</h2><p class="panel-intro">${t("32 件策展精選、136 件可在館內觀看的作品，以及持有紀錄與公開文獻。資料核對於 ","32 curatorial selections, 136 works available in the galleries, plus holdings records and public documents. Sources checked on ")}${escapeHTML(collection.verifiedAt?.slice(0,10)||t('讀取中',"Loading"))}${t("。",".")}</p><div class="catalogue-tools"><label class="search"><span>⌕</span><input id="search-art" type="search" placeholder="${t("搜尋作品、藝術家或鏈別","Search works, artists or chains")}" aria-label="${t("搜尋作品、藝術家或鏈別","Search works, artists or chains")}" value="${escapeHTML(catalogueQuery)}"></label><label class="sr-only" for="theme-filter">${t("展間篩選","Filter by gallery")}</label><select id="theme-filter"><option value="all">${t("所有分類","All categories")}</option>${exhibitions.map(x=>`<option value="${x.theme}" ${x.theme===catalogueTheme?'selected':''}>${escapeHTML(x.title)}</option>`).join('')}<option value="documents" ${catalogueTheme==='documents'?'selected':''}>${t("文獻檔案","Documents")}</option></select></div><label class="check-label"><input id="featured-filter" type="checkbox" ${catalogueFeatured?'checked':''}> ${t("只看首展選件","Inaugural exhibition selections only")}</label><p id="result-count" class="tiny" aria-live="polite"></p><div id="catalogue-grid" class="catalogue-grid"></div><p class="footnote">${t("初步分類不是正式策展或購藏決議。錢包持有不等同經提案購藏；未選入首展的紀錄仍保留供查閱。","Preliminary categories do not establish a curatorial or acquisition decision. Wallet holdings do not prove acquisition through a proposal. Records outside the inaugural selection remain available for research.")}</p>`;
  $<HTMLInputElement>('#search-art').oninput=e=>{catalogueQuery=(e.target as HTMLInputElement).value;renderCatalogue();};$<HTMLSelectElement>('#theme-filter').onchange=e=>{catalogueTheme=(e.target as HTMLSelectElement).value;renderCatalogue();};$<HTMLInputElement>('#featured-filter').onchange=e=>{catalogueFeatured=(e.target as HTMLInputElement).checked;renderCatalogue();};renderCatalogue();
 }else if(name==='artwork'&&selectedItem){renderDetail(selectedItem);
 }else if(name==='map'){
  content.innerHTML=`<p class="eyebrow">FIND YOUR OWN PATH</p><h2 id="panel-title">${t("展間地圖","Gallery map")}</h2><p class="panel-intro">${t("四廳由拱廊串連。可直接抵達展間，或選一件作品開始正面觀看。","Four galleries are connected by archways. Enter any gallery, or choose a work for a clear frontal view.")}</p><div class="floorplan">${exhibitions.map((x,i)=>`<button data-room="${i}" class="map-room ${entered&&room===i?'current':''}"><span class="map-number">0${i+1}</span><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.titleEn)}</small><span class="map-count">${wallWorks(i).length}${t(" 件 · "," works · ")}${Math.ceil(wallWorks(i).length/pageSize(i))}${t(" 批"," displays")}</span><span class="map-enter">${entered&&room===i?t('● 你在這裡',"● You are here"):t('進入展間 →',"Enter gallery →")}</span></button>`).join('')}</div><p class="footnote">${t("入口","Entrance")} → ${exhibitions.map(exhibition=>escapeHTML(exhibition.title)).join(" → ")}</p>${exhibitions.map((x,i)=>`<section class="map-exhibition"><h3>0${i+1} ${escapeHTML(x.title)}</h3><p class="panel-prose">${escapeHTML(x.question||x.subtitle)}</p><button class="text-link" data-guide-room="${i}">${t("從本廳開始導覽","Start this gallery’s tour")} →</button>${artList(roomWorks(i))}</section>`).join('')}`;
  content.querySelectorAll<HTMLElement>('[data-room]').forEach(b=>b.onclick=()=>goToRoom(Number(b.dataset.room)));
  content.querySelectorAll<HTMLElement>('[data-guide-room]').forEach(b=>b.onclick=()=>void guideTo(route().findIndex(a=>a.theme===exhibitions[Number(b.dataset.guideRoom)].theme)));
  content.querySelectorAll<HTMLElement>('[data-id]').forEach(b=>b.onclick=()=>{const a=itemById(b.dataset.id!);if(a)void faceItem(a);});
 }else if(name==='story'){
  const x=exhibitions[room],works=roomWorks(room),maxPage=Math.ceil(wallWorks(room).length/pageSize(room));
  content.innerHTML=`<p class="eyebrow">GALLERY 0${room+1} · ${escapeHTML(x.titleEn)}</p><h2 id="panel-title">${escapeHTML(x.title)}</h2><p class="large-subtitle">${escapeHTML(x.question||x.subtitle)}</p>${prose(x.introduction||x.description)}<div class="room-count"><span>${works.length}${t(" 件策展精選"," curatorial selections")}</span><span>${wallWorks(room).length}${t(" 件可上牆館藏"," works available on the walls")}</span><span>${roomDocs(room).length}${t(" 份關聯文獻"," related documents")}</span></div>${(x.groups||[]).map(g=>`<section class="curatorial-group"><h3>${escapeHTML(g.title)}</h3>${prose(g.description)}${artList(g.artworkIds.map(id=>collection.artworks.find(a=>a.id===id)).filter((a):a is Artwork=>!!a))}</section>`).join('')}${maxPage>1?`<div class="hanging-pages"><label for="hanging-page">${t("展牆段落","Wall display")}</label><select id="hanging-page">${Array.from({length:maxPage},(_,i)=>`<option value="${i}" ${pages[room]===i?'selected':''}>${t("第 ","Display ")}${i+1}${t(" 批 · 第 "," · Works ")}${i*pageSize(room)+1}–${Math.min((i+1)*pageSize(room),wallWorks(room).length)}${t(" 件"," works")}</option>`).join('')}</select></div><p class="footnote">${t("每批先完整載入再換牆，也可直接使用館內左下角的上一批／下一批。精選以外為延伸館藏，分類狀態在作品資料中標示。","Each display loads fully before replacing the previous one. Use Previous display / Next display at the lower left of the gallery. Works outside the selection belong to the extended holdings; their review status appears in each record.")}</p>`:''}<h3>${t("沿著文件閱讀","Follow the documents")}</h3><div class="document-links">${roomDocs(room).map(d=>`<button data-id="${escapeHTML(d.id)}">${escapeHTML(d.title)} ↗</button>`).join('')}</div><blockquote>${escapeHTML(x.transition||'')}</blockquote><div class="source-links">${(x.sourceUrls||[]).map((u,i)=>linked(u,`${t("策展參考 ","Curatorial reference ")}${i+1}`)).join('')}</div><button class="primary" id="story-guide">${t("開始本廳導覽 →","Start this gallery’s tour →")}</button><p class="footnote">${t("策展編輯與原作者自述分別標示。未取得提案或交易佐證的入藏理由，不作推定。","Curatorial interpretation is identified separately from artists’ original statements. Acquisition motives are not inferred without proposal or transaction evidence.")}</p>`;
  bindItems(content,'story');$('#story-guide').onclick=()=>void guideTo(route().findIndex(a=>a.theme===x.theme));
  const select=content.querySelector<HTMLSelectElement>('#hanging-page');if(select)select.onchange=async()=>{const index=room,previous=pages[index],request=focusRequest;select.disabled=true;notify(t('正在準備這一段作品…',"Preparing this group of works…"));try{await hangRoom(index,Number(select.value));if(request===focusRequest){stopGuide();notify(t('展牆已更換，關閉視窗即可觀看。',"The display is ready. Close this dialog to see it."));}}catch{if(request===focusRequest){select.value=String(previous);notify(t('作品載入失敗，原展牆保留。',"The new works could not load. The previous display is still in place."));}}finally{select.disabled=false;}};
 }else if(name==='about'){
  content.innerHTML=`<p class="eyebrow">A MUSEUM HELD IN COMMON</p><h2 id="panel-title">${escapeHTML(institution?.title||t('關於這座美術館',"About this museum"))}</h2><p class="large-subtitle">${escapeHTML(institution?.question||t('誰在收藏，又為誰留下？',"Who collects, and for whom?"))}</p>${prose(institution?.introduction||t('循著 FAB DAO 的館藏與公開文件，觀看數位藝術如何與公共生活相遇。',"Follow FAB DAO’s holdings and public documents to explore how digital art meets public life."))}<div class="about-facts"><div><span>04</span>${t("主題展間","Thematic galleries")}</div><div><span>32</span>${t("首展選件","Inaugural selections")}</div><div><span>${collection.artworks.length}</span>${t("持有紀錄","Holdings records")}</div></div><h3>${t("這裡的「我們」是誰？","Who is “we” here?")}</h3>${prose(institution?.authorship||t('共同收藏的參與者與每位受邀觀看的訪客，並不預設擁有相同立場。',"Participants in collective collecting and the visitors invited to look do not necessarily share the same position."))}<h3>${t("收藏與計畫的時間線","A timeline of collecting and projects")}</h3><ol class="timeline">${(institution?.timeline||[]).map(t=>`<li><time>${escapeHTML(t.date)}</time><h3>${escapeHTML(t.title)}</h3>${prose(t.description)}<div class="document-links">${t.documentIds.map(id=>documents.find(d=>d.id===id)).filter((d):d is DocumentItem=>!!d).map(d=>`<button data-id="${escapeHTML(d.id)}">${escapeHTML(d.title)} ↗</button>`).join('')}</div></li>`).join('')}</ol><h3>${t("來源與收藏邊界","Sources and the scope of this collection")}</h3>${prose(institution?.collectionScope||t('公開索引器快照只用來核對持有，並不推定正式購藏。',"Public indexer snapshots establish holdings; they do not establish formal acquisition decisions."))}<div class="wallet-list"><span>Tezos · fabcollect.tez</span><code>tz1cpZ7eLovJigqcUsfbjmquuezjToZLtGUZ</code><span>${t("Ethereum · 藝術銀行地址","Ethereum · Art Bank address")}</span><code>0x992f0201ff7ee158a8baf638549d0ad1cbcc27ef</code></div><p class="footnote">${t("資料快照：","Data snapshot: ")}${escapeHTML(collection.verifiedAt?.slice(0,10))}${t("。原作與著作權歸藝術家所有。無需登入或連接錢包即可入館。",". Original works and copyrights belong to their artists. No sign-in or wallet connection is required.")}</p><div class="source-links">${linked('https://fabdao.world',t('FAB DAO 官方網站',"FAB DAO website"))}${linked('/data/collection.json',t('館藏來源資料',"Collection source data"))}${linked('/data/documents.json',t('文獻來源清單',"Document sources"))}${linked('/data/institution.json',t('本館編輯與沿革',"Editorial approach and history"))}</div>`;bindItems(content,'about');
 }else if(name==='settings'){
  content.innerHTML=`<p class="eyebrow">MAKE YOURSELF COMFORTABLE</p><h2 id="panel-title">${t("觀看設定","Viewing settings")}</h2><p class="panel-intro">${t("依照電腦效能與操作習慣，調整觀看方式。","Adjust the experience to your computer and how you prefer to navigate.")}</p><label class="settings-label" for="quality">${t("畫質","Graphics quality")}</label><select id="quality"><option value="balanced">${t("均衡 · 光影與流暢度","Balanced · Light and smooth movement")}</option><option value="high">${t("細緻 · 增加環境遮蔽","Detailed · Additional ambient occlusion")}</option><option value="low">${t("流暢 · 降低渲染負擔","Smooth · Lower rendering load")}</option></select><p class="footnote">${fps>0?`${t("上次連續移動：約 ","Last continuous movement: about ")}${fps}${t(" FPS（此裝置估計）。"," FPS (estimated on this device). ")}`:t('連續移動後，可在此查看流暢度估計。',"Move continuously to see a performance estimate here. ")}${t("停下或閱讀作品時，展館會停止重畫以節省資源。","The gallery stops redrawing while you stand still or read, conserving resources.")}</p><h3>${t("滑鼠與視角","Mouse and view controls")}</h3><p class="panel-prose">${t("拖曳像抓住場景：往右拖，景物跟著往右。按「自由環視」後則像第一人稱遊戲：滑鼠往右，視線往右看。Esc 可釋放游標。","Dragging grabs the scene: drag right and the scene follows right. In Free look, moving the mouse right turns your head right, as in a first-person game. Press Esc to release the pointer.")}</p><div class="control-grid"><label for="sensitivity">${t("滑鼠靈敏度","Mouse sensitivity")}<select id="sensitivity"><option value="0.5">${t("較慢 · 0.5×","Slower · 0.5×")}</option><option value="0.75">${t("偏慢 · 0.75×","Slow · 0.75×")}</option><option value="1">${t("標準 · 1×","Standard · 1×")}</option><option value="1.5">${t("偏快 · 1.5×","Fast · 1.5×")}</option><option value="2">${t("較快 · 2×","Faster · 2×")}</option></select></label><label for="vertical-control">${t("上下方向","Vertical direction")}<select id="vertical-control"><option value="normal">${t("標準","Standard")}</option><option value="inverted">${t("反轉上下","Invert vertical look")}</option></select></label></div><label class="check-label"><input id="show-performance" type="checkbox" ${showPerformance?'checked':''}> ${t("顯示即時效能","Show live performance")}</label><details class="diagnostics"><summary>${t("此裝置的渲染資訊","Rendering information for this device")}</summary><pre id="render-stats"></pre></details><h3>${t("依自己的步調觀看","Look at your own pace")}</h3><p class="panel-prose">${t("正面定位採直接抵達，館內沒有頭部晃動。也可留在館藏目錄閱讀；關閉原作會停止其運算與聲音。","Frontal viewing places you directly before the work, without head bobbing. You can also read in the collection. Closing an original work stops its processing and sound.")}</p><button id="setting-quiet" class="text-link">${quiet?t('恢復介面',"Restore the interface"):t('專心觀看 · 暫時隱藏介面',"Quiet viewing · Hide the interface")}</button>`;
  const select=$<HTMLSelectElement>('#quality');select.value=museum?.quality||'balanced';select.onchange=()=>{museum?.setQuality(select.value);try{localStorage.setItem('fab-museum-quality',select.value);}catch{}updatePerformance();};
  $<HTMLSelectElement>('#sensitivity').value=String(controls.sensitivity);$<HTMLSelectElement>('#vertical-control').value=controls.invertY?'inverted':'normal';
  const saveControls=()=>{controls={sensitivity:Number($<HTMLSelectElement>('#sensitivity').value),invertY:$<HTMLSelectElement>('#vertical-control').value==='inverted'};museum?.setControlSettings(controls);try{localStorage.setItem('fab-museum-controls',JSON.stringify(controls));}catch{}};
  $('#sensitivity').onchange=saveControls;$('#vertical-control').onchange=saveControls;
  $('#show-performance').onchange=()=>{showPerformance=$<HTMLInputElement>('#show-performance').checked;$('#performance-readout').hidden=!showPerformance;updatePerformance();};
  $('#setting-quiet').onclick=()=>{closePanel();setQuiet(!quiet);};updatePerformance();
 }else if(name==='help'){
  content.innerHTML=`<p class="eyebrow">A SLOW WALK THROUGH ART</p><h2 id="panel-title">${t("如何逛美術館","How to explore the museum")}</h2><div class="help-list">${[['W A S D',t('前後左右移動',"Move forward, backward, left and right")],[t('拖曳滑鼠',"Drag the mouse"),t('抓住場景拖動；自由環視則像第一人稱遊戲',"Grab and drag the scene; Free look uses first-person controls")],['↑ ↓ ← →',t('前後移動、向左或向右看',"Move forward and backward; look left and right")],['Page Up / Page Down',t('向上或向下看',"Look up or down")],[t('Enter / 點擊作品',"Enter / Click a work"),t('閱讀瞄準的作品或文獻',"Read the work or document you are pointing at")],[t('慢看導覽',"Slow-looking tour"),t('依策展順序，逐件正面抵達',"Face each work in curatorial order")],['H',t('隱藏或恢復介面',"Hide or restore the interface")],['M / Esc',t('開啟地圖／釋放游標或暫停',"Open the map / Release the pointer or pause")]].map(([key,desc])=>`<div><span>${key}</span><p>${desc}</p></div>`).join('')}</div><p class="footnote">${t("讀作品時，方向鍵可平移放大的預覽。所有導覽按鈕可用 Tab 與 Enter 操作。","While reading a work, the arrow keys pan a zoomed preview. All navigation buttons support Tab and Enter.")}</p>`;
 }
}
function renderCatalogue(){
 const q=catalogueQuery.toLocaleLowerCase().trim();const entries:(Artwork|DocumentItem)[]=[...collection.artworks,...documents].filter(a=>(catalogueTheme==='all'||(catalogueTheme==='documents'?!('artist' in a):'artist' in a?a.theme===catalogueTheme:!!exhibitions.find(x=>x.theme===catalogueTheme)?.documentIds?.includes(a.id)))&&(!catalogueFeatured||('artist' in a&&a.featured===true))&&(!q||[a.title,originalSearch.get(a.id),'artist' in a?a.artist:'',a.description||a.summary,'artist' in a?a.chain:'',a.viewingNote,a.curatorialNote].some(v=>String(v||'').toLocaleLowerCase().includes(q))));
 $('#result-count').textContent=`${entries.length}${t(" 件結果"," results")}`;
 $('#catalogue-grid').innerHTML=entries.length?entries.map(a=>`<button class="collection-card" data-id="${escapeHTML(a.id)}"><span class="card-image">${'artist' in a&&a.image?`<img src="${escapeHTML(safeURL(a.image))}" alt="${escapeHTML(a.title)}" loading="lazy" decoding="async">`:`<span class="document-tile">${'artist' in a?t('預覽尚未取得',"Preview not yet available"):'PUBLIC ARCHIVE'}</span>`}</span><span class="card-caption"><span class="card-meta"><span class="card-artist">${escapeHTML('artist' in a?a.artist:a.date)}</span><span class="card-type">${'artist' in a?(a.featured?t('策展精選',"Curatorial selection"):a.themeStatus==='metadata_review'?t('延伸館藏',"Extended holdings"):t('分類待複核',"Category under review")):t('文獻',"Document")}</span></span><span class="card-title">${escapeHTML(a.title)}</span><span class="card-arrow" aria-hidden="true">↗</span></span></button>`).join(''):t('<p class="empty-state">沒有符合的紀錄。可清除搜尋或調整篩選。</p>',"<p class=\"empty-state\">No records match. Clear your search or adjust the filters.</p>");
 bindItems($('#catalogue-grid'),'catalogue',entries.map(a=>a.id));
 $('#catalogue-grid').querySelectorAll<HTMLImageElement>('img').forEach(img=>img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('span'),{className:'document-tile',textContent:t('預覽暫時無法載入',"Preview is temporarily unavailable")}));});
}
function renderDetail(item:Artwork|DocumentItem){
 const art='artist' in item?item as Artwork:null,doc=art?null:item as DocumentItem,support=art?getMediaSupport(art,locale):null;
 const index=detailIds.indexOf(item.id),exhibit=art?findExhibit(originalArtworks,exhibitions,item.id):exhibitions.some(x=>x.documentIds?.includes(item.id));
 $('#panel-kicker').textContent=art?t('COLLECTION / 作品',"COLLECTION / Work"):t('ARCHIVE / 文獻',"ARCHIVE / Document");
 $('#panel-content').innerHTML=`<div class="detail-navigation"><button id="detail-back" class="back-link">← ${detailOrigin==='catalogue'?t('回搜尋結果',"Back to search results"):detailOrigin==='story'?t('回策展論述',"Back to the curatorial essay"):detailOrigin==='about'?t('回關於本館',"Back to About"):detailOrigin==='shared'?t('關閉作品',"Close work"):t('回到剛才的展牆',"Back to the wall")}</button><div><button id="detail-prev" ${index<=0?'disabled':''} aria-label="${t("上一件作品","Previous work")}">← ${t("上一件","Previous work")}</button><button id="detail-next" ${index<0||index>=detailIds.length-1?'disabled':''} aria-label="${t("下一件作品","Next work")}">${t("下一件","Next work")} →</button></div></div><div class="artwork-layout"><div class="detail-media"><div id="media-tabs" class="media-tabs">${art?`<button id="show-preview" aria-pressed="true">${support?.supported?t('預覽影像',"Preview image"):t('作品預覽',"Work preview")}</button>${support?.supported?t('<button id="show-original" aria-pressed="false">觀看原作</button>',"<button id=\"show-original\" aria-pressed=\"false\">View original</button>"):''}`:''}</div><div id="artwork-surface" class="artwork-view"></div><p class="media-caption">${art?`${t("預覽保留原比例。","The preview keeps the original proportions. ")}${support?.supported?t('原作可由上方按鈕開啟。',"Open the original using the button above."):t('完整媒材與原始尺寸請見作品來源。',"See the work’s source for the complete medium and original dimensions.")}`:t('原始文件的策展摘要，完整內容請見來源。',"A curatorial summary of the document. See the source for its full text.")}</p></div><div class="artwork-info"><span class="eyebrow">${escapeHTML(art?.selectedGroupLabel||exhibitions.find(x=>x.theme===item.theme)?.title||t('館藏檔案',"Collection archive"))}</span><h2 id="panel-title">${escapeHTML(item.title)}</h2><p class="artist">${escapeHTML(art?.artist||doc?.credit||t('FAB DAO · 公開文獻',"FAB DAO · Public document"))}</p>${art?`<p class="medium-label">${escapeHTML(art.mediumLabel||art.chain)}${art.suggestedDuration?` · ${escapeHTML(art.suggestedDuration)}`:''}</p>${art.featured?`<div class="viewing-note"><span>${t("先看這裡","Begin by looking here")}</span><p>${escapeHTML(art.viewingNote)}</p></div><p class="panel-prose">${escapeHTML(art.makingNote)}</p><h3>${t("為什麼放在這裡？","Why is it here?")}</h3><p class="panel-prose">${escapeHTML(art.curatorialNote)}</p><p class="editorial-label">${escapeHTML(art.editorialLabel)}</p>`:`<p class="panel-prose">${exhibit?t('這件作品列為延伸館藏，可由展牆分批觀看。',"This work belongs to the extended holdings and appears in rotating wall displays. "):t('這筆紀錄保留於館藏目錄，目前尚未取得有效預覽；可由下方作品來源閱讀。',"This record remains in the collection without a usable preview. Follow the source below to explore the work. ")}${t("主題若標示待複核，僅供檢索，並不代表已有策展或購藏決議。","Categories marked for review support discovery and do not establish a curatorial or acquisition decision.")}</p>`}`:prose(doc?.summary)}<div class="detail-actions">${exhibit?t('<button id="face-work" class="primary">正面觀看這件展品 →</button>',"<button id=\"face-work\" class=\"primary\">Face this exhibit →</button>"):''}<button id="share-work" class="text-link">${t("複製作品連結","Copy work link")}</button></div>${art?.acquisitionStory?acquisitionHTML(art):''}<details class="source-details"><summary>${art?t('原作者說明與來源資料',"Artist’s statement and sources"):t('文獻來源資料',"Document sources")}</summary>${art?`<h3>${t("原作者說明 · metadata 原文","Artist’s statement · Original metadata")}</h3><p class="footnote source-language-note">${t("保留作者原文語言；以下不是本館翻譯。","The artist’s text is shown in its original language, without museum translation.")}</p><p class="original-description" translate="no">${escapeHTML(art.description||t('原始 metadata 未提供說明。',"No description was provided in the original metadata."))}</p><dl><div><dt>${t("網路","Network")}</dt><dd>${escapeHTML(art.chain)}</dd></div><div><dt>Token ID</dt><dd>${escapeHTML(art.tokenId||'—')}</dd></div><div><dt>${t("持有核對","Holdings checked")}</dt><dd>${t("索引器快照 · ","Indexer snapshot · ")}${escapeHTML(collection.verifiedAt?.slice(0,10))}</dd></div><div><dt>${t("分類狀態","Review status")}</dt><dd>${art.featured?t('首展選件',"Inaugural selections"):art.themeStatus==='metadata_review'?t('依作品資料複核',"Reviewed against work metadata"):t('初步歸類，待策展複核',"Preliminary category; curatorial review pending")}</dd></div><div><dt>${t("原作授權","License")}</dt><dd>${escapeHTML(art.license||t('依原作者／來源標示',"As stated by the artist or source"))}</dd></div></dl>`:`<p class="panel-prose">${escapeHTML(doc?.displayLabel||doc?.type)} · ${escapeHTML(doc?.date||t('見原始文件',"See the original document"))}</p>`}<div class="source-links">${linked(art?.sourceUrl||doc?.url,art?t('作品來源',"Work source"):t('閱讀原始文件',"Read the original document"))}${art&&(art.artifactUrl||art.animation)?linked(art.artifactUrl||art.animation,t('完整原作',"Full original work")):''}${art?.contract?linked(art.chain.toLowerCase()==='tezos'?`https://tzkt.io/${art.contract}/tokens/${art.tokenId}`:`https://etherscan.io/token/${art.contract}?a=${art.tokenId}`,t('鏈上紀錄',"On-chain record")):''}</div><p class="footnote">${t("作品權利歸原作者。錢包持有不等同已完成購藏決議或已查明取得方式。","Rights belong to the original artist. A wallet holding does not establish an acquisition decision or explain how the work was acquired.")}</p></details>${doc?linked(doc.url,t('閱讀原始文件',"Read the original document")):''}</div></div>`;
 $('#detail-back').onclick=()=>detailOrigin==='about'?showPanel('about'):returnFromDetail();
 for(const [selector,delta]of [['#detail-prev',-1],['#detail-next',1]]as const)$(selector).onclick=()=>{const next=itemById(detailIds[index+delta]);if(next)inspect(next,detailOrigin,detailIds);};
 const face=document.querySelector<HTMLElement>('#face-work');if(face)face.onclick=()=>void faceItem(item);
 $('#share-work').onclick=async()=>{const url=`${location.origin}/?lang=${locale}#${art?'artwork':'document'}=${encodeURIComponent(item.id)}`;try{await navigator.clipboard.writeText(url);notify(t('作品連結已複製。',"Work link copied."));}catch{const input=document.createElement('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label',t('作品分享連結',"Share link for this work"));$('#share-work').after(input);input.focus();input.select();notify(t('請複製這個作品連結。',"Please copy this work link."));}};
 const surface=$('#artwork-surface');
 function preview(){disposeDetail();surface.replaceChildren();surface.className='artwork-view';if(art?.image){const viewer=mountImageViewer(surface,safeURL(art.image),art.title,locale);detailDispose=()=>viewer.dispose();}else{surface.innerHTML=`<div class="document-cover"><span>FAB DAO<br>PUBLIC ARCHIVE</span><h3>${escapeHTML(item.title)}</h3><span>${escapeHTML(doc?.date||t('預覽尚未取得',"Preview not yet available"))}</span></div>`;}document.querySelector('#show-preview')?.setAttribute('aria-pressed','true');document.querySelector('#show-original')?.setAttribute('aria-pressed','false');}
 preview();const previewButton=document.querySelector<HTMLElement>('#show-preview');if(previewButton)previewButton.onclick=preview;
 const original=document.querySelector<HTMLElement>('#show-original');if(original&&art)original.onclick=()=>{disposeDetail();surface.replaceChildren();surface.className='artwork-view original-surface';const media=mountMedia(surface,art,{locale});detailDispose=()=>media.dispose();original.setAttribute('aria-pressed','true');$('#show-preview').setAttribute('aria-pressed','false');};
}
function acquisitionHTML(art:Artwork){const s=art.acquisitionStory!;return `<details class="acquisition-story"><summary>${escapeHTML(s.title)}</summary><h3>${t("作者／計畫的意圖","Artist’s or project’s intent")}</h3>${prose(s.artistIntent)}<h3>${t("本次選展理由","Reason for this exhibition selection")}</h3>${prose(s.exhibitionReason)}<h3>${t("目前可核對","What can currently be verified")}</h3><ul>${s.verifiedFacts.map(f=>`<li>${escapeHTML(f)}</li>`).join('')}</ul><h3>${t("仍待補齊","Open questions")}</h3><ul>${s.openQuestions.map(f=>`<li>${escapeHTML(f)}</li>`).join('')}</ul><div class="source-links">${s.sourceUrls.map((u,i)=>linked(u,`${t("佐證來源 ","Evidence source ")}${i+1}`)).join('')}</div></details>`;}
function updatePerformance(){
 if(!museum)return;const state=museum.getState();
 const text=`${fps>0?`${t("上次移動 ","Last movement: ")}${fps} FPS`:t('等待連續移動取樣',"Move continuously to collect a sample")} · ${museum.quality==='high'?t('細緻',"Detailed"):museum.quality==='low'?t('流暢',"Smooth"):t('均衡',"Balanced")}\n${JSON.stringify(state.renderStats,null,2)}`;
 if(showPerformance)$('#performance-readout').textContent=`${fps>0?`${t("上次移動 ","Last movement: ")}${fps} FPS`:t('等待取樣',"Awaiting a sample")} · ${museum.quality==='high'?t('細緻',"Detailed"):museum.quality==='low'?t('流暢',"Smooth"):t('均衡',"Balanced")}`;
 const diagnostics=document.querySelector<HTMLElement>('#render-stats');if(diagnostics)diagnostics.textContent=text;
}
setInterval(()=>{if(showPerformance||openPanel==='settings')updatePerformance();},1000);
function readSharedItem(){const match=location.hash.match(/^#(artwork|document)=(.+)$/);if(match){try{const item=itemById(decodeURIComponent(match[2]));if(item)inspect(item,'shared');else notify(t('找不到這筆作品紀錄，可從館藏目錄搜尋。',"This record was not found. Try searching the collection."));}catch{notify(t('作品連結格式無法辨識。',"This work link could not be recognized."));}}else if(location.hash==='#catalogue')showPanel('catalogue');}
window.addEventListener('hashchange',readSharedItem);
async function init(){
 try{
  [collection,exhibitions,documents]=await Promise.all(['/data/collection.json','/data/exhibitions.json','/data/documents.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error(`${t("資料 ","Data ")}${r.status}`);return r.json();})));
  institution=await fetch('/data/institution.json').then(r=>r.ok?r.json():undefined).catch(()=>undefined);
  if(!Array.isArray(collection.artworks)||exhibitions.length!==4)throw Error(t('館藏資料格式錯誤',"Invalid collection data format"));
  originalArtworks=collection.artworks;
  for(const item of [...collection.artworks,...documents])originalSearch.set(item.id,[item.title,'artist' in item?item.artist:'',item.description||item.summary].join(' ').toLocaleLowerCase());
  if(locale==='en'){
    try{
      const response=await fetch('/data/locales/en.json');if(!response.ok)throw Error(`English text ${response.status}`);
      ({collection,exhibitions,documents,institution}=applyEnglishOverlay(collection,exhibitions,documents,institution,await response.json()));
    }catch(error){console.warn('English editorial text could not load',error);notify('English interpretation could not load. Source text remains available; reload to retry.');}
  }
  if(resumedVisit){
    const saved=resumedVisit;room=saved.room;
    for(let i=0;i<4;i++)pages[i]=Math.min(saved.pages[i],Math.max(0,Math.ceil(wallWorks(i).length/pageSize(i))-1));
    catalogueTheme=['all','documents',...exhibitions.map(x=>x.theme)].includes(saved.catalogueTheme)?saved.catalogueTheme:'all';
    catalogueQuery=saved.catalogueQuery;catalogueFeatured=saved.catalogueFeatured;catalogueScroll=saved.catalogueScroll;catalogueFocus=saved.catalogueFocus;
    quiet=saved.quiet;manualPause=saved.manualPause;showPerformance=saved.showPerformance;
    if(saved.panel==='artwork'){
      const item=itemById(saved.selectedId);
      if(item)inspect(item,saved.detailOrigin,saved.detailIds.filter(id=>!!itemById(id)));else showPanel('catalogue');
    }else if(saved.panel)showPanel(saved.panel);
    panel.scrollTop=saved.panelScroll;
  }else{if(openPanel)renderPanel(openPanel);readSharedItem();}
  const {Museum}=await import('./museum');museum=new Museum($('#scene'),exhibitions,locale);
  museum.onRoom=updateRoom;museum.onInspect=item=>inspect(item,'wall');museum.onHover=item=>{hoverItem=item;const button=$('#inspect-hint');button.hidden=!item;button.textContent=item?`${item.title}${t(" · Enter 觀看"," · Enter to read")}`:'';};museum.onMove=()=>collapseRoom();
  museum.onStats=value=>{fps=value;updatePerformance();};museum.onContextLost=()=>{museumReady=false;stopGuide();$('#enter').onclick=()=>showPanel('catalogue');$('#enter').textContent=t('開啟館藏目錄',"Open the collection");showPanel('catalogue');notify(t('3D 顯示已中斷，可繼續使用館藏目錄。',"The 3D display was interrupted. You can continue in the collection."));};
  try{const saved=JSON.parse(localStorage.getItem('fab-museum-controls')||'null');if(saved&&[.5,.75,1,1.5,2].includes(saved.sensitivity)){controls={sensitivity:saved.sensitivity,invertY:!!saved.invertY};museum.setControlSettings(controls);}}catch{}
  try{const value=localStorage.getItem('fab-museum-quality');if(value&&['low','balanced','high'].includes(value))museum.setQuality(value);}catch{}
  // A restored settings panel is first rendered while the Museum instance is
  // still being created. Re-render it after saved engine settings are applied
  // so the controls reflect the actual camera and quality state.
  if(resumedVisit?.panel==='settings'){renderPanel('settings');panel.scrollTop=resumedVisit.panelScroll;}
  const arrival=resumedVisit?.entered?resumedVisit.room:0;
  await ensureRoom(arrival);museumReady=true;if(arrival<3)void ensureRoom(arrival+1).catch(()=>{});
  if(resumedVisit?.entered){
    const saved=resumedVisit;start(saved.room,false);if(saved.view)museum.restoreView(saved.view);updateRoom(saved.room);
    setQuiet(saved.quiet);pause(saved.manualPause);collapseRoom(saved.roomCollapsed);guideIndex=route().findIndex(art=>art.id===saved.guideId);renderGuide();
    $('#performance-readout').hidden=!showPerformance;panel.scrollTop=saved.panelScroll;
  }
  if(panel.open){museum.setPaused(true);$('#close-panel').focus({preventScroll:true});}
  $<HTMLButtonElement>('#enter').disabled=false;$('#enter').innerHTML=t('進入美術館 <span>↗</span>',"Enter the museum <span>↗</span>");
 }catch(error){console.error(error);$('#enter').innerHTML=t('開啟館藏目錄 <span>↗</span>',"Open the collection <span>↗</span>");$<HTMLButtonElement>('#enter').disabled=false;$('#enter').onclick=()=>showPanel('catalogue');document.body.classList.add('no-webgl');notify(t('3D 展館載入未完成，仍可由館藏目錄觀看作品與資料。',"The 3D gallery has not loaded. You can still explore works and documents in the collection."));}
}
void init();
