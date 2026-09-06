import './style.css';
import type { Artwork, Collection, Exhibition, DocumentItem } from './types';

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
    <p class="eyebrow">一座由我們共同收藏的美術館</p><h1>讓藝術，<br>成為我們的<br><span>共同記憶。</span></h1>
    <p class="intro-copy">走進 FAB DAO 的數位收藏。<br>在生成、島嶼、行動與記憶之間，<br>重新想像藝術如何與公共生活相遇。</p>
    <div class="enter-row"><button id="enter" class="primary" disabled>正在開啟展館 <span class="spinner"></span></button><button data-open="catalogue" class="text-link">瀏覽館藏 <span>↗</span></button></div>
    <p class="desktop-note"><span>⌨</span> 電腦體驗 · 第一人稱漫遊 · 無需連接錢包</p>
  </main>
  <div id="welcome-caption"><span class="tiny">THE COMMONS, COLLECTED.</span><p>從一件作品，<br>走向一個共同體。</p><span class="caption-line"></span><span class="tiny">數位館藏 × 古典空間</span></div>
  <div id="welcome-bottom"><span>FOUR GALLERIES. ONE SHARED COLLECTION.</span><div><span>01 — 04</span><span class="line"></span><span>自由入館，慢慢觀看</span></div></div>
  <div id="tour-ui" hidden>
    <section class="room-card" aria-label="目前展間"><span id="room-number" class="tiny">GALLERY 01 / 04</span><h2 id="room-title"></h2><p id="room-subtitle"></p><button id="room-story">閱讀策展論述 <span>↗</span></button></section>
    <div id="reticle" aria-hidden="true"></div><button id="inspect-hint" hidden></button>
    <div class="tour-bottom"><div class="movement-hint"><span><kbd>W</kbd><br><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>移動<br><small>拖曳滑鼠環視 · 點擊作品觀看</small></span></div>
      <div class="tour-actions"><button id="mouse-lock">自由環視</button><button data-open="help" aria-label="操作說明">?</button><button data-open="settings" aria-label="畫質設定">⚙</button><button id="pause-tour">暫停</button></div>
    </div><div id="room-pager"><button id="previous-room" aria-label="上一展間">←</button><span id="pager-label"></span><button id="next-room" aria-label="下一展間">→</button></div>
    <div id="resume-panel" hidden><span class="tiny">TAKE YOUR TIME</span><h2>停留，也是一種觀看。</h2><button id="resume" class="primary">繼續漫遊 <span>→</span></button><button data-open="catalogue" class="text-link">開啟館藏目錄</button></div>
  </div>
  <dialog id="panel" aria-labelledby="panel-title"><div class="panel-head"><span class="tiny" id="panel-kicker">FAB DAO MUSEUM</span><button id="close-panel" aria-label="關閉視窗">✕</button></div><div id="panel-content"></div></dialog>
  <div id="notice" role="status" aria-live="polite"></div>
`;

let collection:Collection={verifiedAt:'',artworks:[],wallets:[]}, exhibitions:Exhibition[]=[],documents:DocumentItem[]=[];
let museum:import('./museum').Museum | undefined;
let entered=false,room=0,lastFocus:HTMLElement|null=null,openPanel='',manualPause=false;
let catalogueTheme='all',catalogueQuery='';
let selectedItem:Artwork|DocumentItem|null=null;
let fps=0;
const pages=[0,0,0,0];
const roomWorks=(index:number)=>collection.artworks.filter(a=>a.theme===exhibitions[index].theme);
const displayWorks=(index:number)=>roomWorks(index).filter(a=>typeof a.image==='string' && a.image.startsWith('/artworks/') && a.mediaStatus!=='unavailable').sort((a,b)=>Number(!!b.featured)-Number(!!a.featured)||(Number(a.curatorialOrder??999)-Number(b.curatorialOrder??999)));
const notify=(s:string)=>{$('#notice').textContent=s;setTimeout(()=>{$('#notice').textContent='';},5000);};
const panel=$<HTMLDialogElement>('#panel');
function closePanel(){panel.close();openPanel='';museum?.setPaused(manualPause);lastFocus?.focus();}
$('#close-panel').addEventListener('click',closePanel);
panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
panel.addEventListener('click',e=>{if(e.target===panel){const b=panel.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closePanel();}});
function showPanel(name:string){
  if(!panel.open)lastFocus=document.activeElement as HTMLElement;openPanel=name;museum?.setPaused(true);$('#panel-kicker').textContent='FAB DAO MUSEUM';
  panel.className=name==='artwork'?'artwork-panel':name==='catalogue'?'wide-panel':'';
  renderPanel(name);if(!panel.open)panel.showModal();$('#close-panel').focus();
}
document.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-open]');if(button)showPanel(button.dataset.open!);});
$('.skip-link').addEventListener('click',e=>{e.preventDefault();showPanel('catalogue');});
function start(){
  if(!museum)return;entered=true;manualPause=false;$('#welcome').hidden=true;$('#welcome-caption').hidden=true;$('#welcome-bottom').hidden=true;$('#tour-ui').hidden=false;document.body.classList.add('entered');museum.start();updateRoom(0);
  document.activeElement instanceof HTMLElement&&document.activeElement.blur();
  notify('WASD 移動；拖曳滑鼠環視。也可用方向鍵與 Enter 看作品。');
}
$('#enter').addEventListener('click',start);
$('#mouse-lock').addEventListener('click',()=>{museum?.lock();notify('滑鼠直接環視，按 Esc 釋放游標。');});
function pause(value:boolean){manualPause=value;museum?.setPaused(value);$('#resume-panel').hidden=!value;$('#pause-tour').textContent=value?'繼續':'暫停';}
$('#pause-tour').addEventListener('click',()=>pause(!manualPause));$('#resume').addEventListener('click',()=>pause(false));
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&document.pointerLockElement){document.exitPointerLock();return;}if(e.code==='Escape'&&entered&&!panel.open&&!document.pointerLockElement)pause(true);if(e.code==='KeyM'&&!panel.open&&!(e.target instanceof HTMLInputElement)){e.preventDefault();showPanel('map');}});
function updateRoom(index:number){room=index;const x=exhibitions[index];$('#room-number').textContent=`GALLERY 0${index+1} / 04`;$('#room-title').textContent=x.title;$('#room-subtitle').textContent=x.subtitle;$('#pager-label').textContent=`0${index+1} / 04`;$<HTMLButtonElement>('#previous-room').disabled=index===0;$<HTMLButtonElement>('#next-room').disabled=index===3;}
function goToRoom(index:number){if(!museum){notify('3D 展館暫時無法使用，仍可瀏覽館藏。');return;}if(panel.open)closePanel();if(!entered)start();pause(false);museum.teleport(index);updateRoom(index);}
$('#previous-room').addEventListener('click',()=>goToRoom(Math.max(0,room-1)));$('#next-room').addEventListener('click',()=>goToRoom(Math.min(3,room+1)));
$('#room-story').addEventListener('click',()=>showPanel('story'));
$('#inspect-hint').addEventListener('click',()=>{if(selectedItem)inspect(selectedItem);});
function inspect(item:Artwork|DocumentItem){selectedItem=item;showPanel('artwork');}
function linked(url:unknown,label:string){const u=safeURL(url);return u?`<a href="${escapeHTML(u)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} <span>↗</span></a>`:'';}
function renderPanel(name:string){
  const content=$('#panel-content');
  if(name==='map'){
    content.innerHTML=`<p class="eyebrow">FIND YOUR OWN PATH</p><h2 id="panel-title">展間地圖</h2><p class="panel-intro">四個展間，四種觀看的方式。點選展間，即可抵達。</p><div class="floorplan">${exhibitions.map((x,i)=>`<button data-room="${i}" class="map-room ${room===i?'current':''}"><span class="map-number">0${i+1}</span><div class="map-columns"><i></i><i></i><i></i><i></i></div><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.titleEn)}</small>${entered&&room===i?'<span class="you-are-here">● 你在這裡</span>':'<span class="map-enter">進入展間 →</span>'}</button>`).join('')}</div><p class="footnote">入口 → 生成之間 → 群山成島 → 收藏作為行動 → 留白與記憶<br>各廳以拱廊相連，也可以直接步行抵達。</p>`;
    content.querySelectorAll<HTMLElement>('[data-room]').forEach(b=>b.onclick=()=>goToRoom(Number(b.dataset.room)));
  }else if(name==='catalogue'){
    content.innerHTML=`<p class="eyebrow">THE COLLECTION & THE ARCHIVE</p><h2 id="panel-title">館藏目錄</h2><p class="panel-intro">作品，以及讓作品被收藏的故事。資料核對於 ${escapeHTML(collection.verifiedAt?.slice(0,10)||'讀取中')}。</p><div class="catalogue-tools"><label class="search"><span>⌕</span><input id="search-art" type="search" placeholder="搜尋作品、藝術家或鏈別" aria-label="搜尋作品、藝術家或鏈別" value="${escapeHTML(catalogueQuery)}"></label><label class="sr-only" for="theme-filter">展間篩選</label><select id="theme-filter"><option value="all">所有展間</option>${exhibitions.map(x=>`<option value="${x.theme}" ${x.theme===catalogueTheme?'selected':''}>${escapeHTML(x.title)}</option>`).join('')}<option value="documents" ${catalogueTheme==='documents'?'selected':''}>文獻檔案</option></select></div><p id="result-count" class="tiny" aria-live="polite"></p><div id="catalogue-grid" class="catalogue-grid"></div><p class="footnote">錢包可能收到未經提案的轉入作品；「錢包持有」不等同正式決選購藏。策展分類為本館編輯詮釋。原作與著作權歸各藝術家所有。</p>`;
    $<HTMLInputElement>('#search-art').oninput=e=>{catalogueQuery=(e.target as HTMLInputElement).value;renderCatalogue();};
    $<HTMLSelectElement>('#theme-filter').onchange=e=>{catalogueTheme=(e.target as HTMLSelectElement).value;renderCatalogue();};renderCatalogue();
  }else if(name==='artwork'&&selectedItem){
    const item=selectedItem,isArt='artist' in item;
    $('#panel-kicker').textContent=isArt?'COLLECTION / 作品':'ARCHIVE / 文獻';
    const art=item as Artwork,doc=item as DocumentItem;
    content.innerHTML=`<div class="artwork-layout"><div class="artwork-view">${isArt&&art.image?`<img src="${escapeHTML(safeURL(art.image))}" alt="${escapeHTML(art.title)}" id="detail-image">`:`<div class="document-cover"><span>FAB DAO<br>PUBLIC ARCHIVE</span><h3>${escapeHTML(item.title)}</h3><span>${escapeHTML(doc.date||art.chain||'DOCUMENT')}</span></div>`}</div><div class="artwork-info"><button id="back-catalogue" class="back-link">← 回館藏目錄</button><span class="eyebrow">${escapeHTML(exhibitions.find(x=>x.theme===item.theme)?.title||'館藏檔案')}</span><h2 id="panel-title">${escapeHTML(item.title)}</h2><p class="artist">${escapeHTML(isArt?art.artist:doc.credit||'FAB DAO · 文獻展件')}</p><p class="work-description">${escapeHTML(isArt?art.description?.replace(/^#{1,6}\s*\.\s*#*$/gm,'').replace(/^#{1,6}\s*(.*?)\s*#*$/gm,'$1')||'原始 metadata 未提供作品說明。可由下方原作連結進一步觀看。':doc.summary)}</p><dl>${isArt?`<div><dt>網路</dt><dd>${escapeHTML(art.chain)}</dd></div><div><dt>Token ID</dt><dd>${escapeHTML(art.tokenId||'—')}</dd></div><div><dt>持有核對</dt><dd>${art.ownershipStatus==='verified_owned'||art.ownershipStatus==='currently_held'?'館藏錢包持有（索引器快照）':escapeHTML(art.ownershipStatus||'待核對')}</dd></div><div><dt>策展分類</dt><dd>${art.themeStatus==='curated'?'首展選件':art.themeStatus==='metadata_review'?'依作品資料複核':'初步歸類，待策展複核'}</dd></div><div><dt>原作授權</dt><dd>${escapeHTML(art.license||'依原作者／作品來源標示')}</dd></div><div><dt>資料日期</dt><dd>${escapeHTML(collection.verifiedAt?.slice(0,10))}</dd></div>`:`<div><dt>文獻類型</dt><dd>${escapeHTML(doc.displayLabel||doc.type)}</dd></div><div><dt>資料時間</dt><dd>${escapeHTML(doc.date||'見來源')}</dd></div>`}</dl><div class="source-links">${linked(isArt?art.sourceUrl:doc.url,isArt?'前往作品來源':'閱讀原始文件')}${isArt&&(art.artifactUrl||art.animation)?linked(art.artifactUrl||art.animation,'觀看完整原作'):''}${isArt&&art.contract?linked(art.chain.toLowerCase()==='tezos'?`https://tzkt.io/${art.contract}/tokens/${art.tokenId}`:`https://etherscan.io/token/${art.contract}?a=${art.tokenId}`,'鏈上紀錄'):''}</div>${isArt?'<p class="footnote">展牆使用原作預覽；動態、3D 或互動作品請由原作連結觀看完整形式。圖片保留原比例，未重新繪製。</p>':'<p class="footnote">本館摘要為策展編輯，請以連結中的原始文件為準。</p>'}</div></div>`;
    $('#back-catalogue').onclick=()=>showPanel('catalogue');
    const img=content.querySelector<HTMLImageElement>('img');if(img){img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label','放大或縮小作品預覽');const zoom=()=>{img.classList.toggle('zoomed');img.setAttribute('aria-pressed',String(img.classList.contains('zoomed')));};img.onclick=zoom;img.onkeydown=e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();zoom();}};}if(img)img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('p'),{className:'media-fallback',textContent:'此作品的預覽暫時無法載入。請由作品來源觀看原作。'}));};
  }else if(name==='story'){
    const x=exhibitions[room],works=displayWorks(room),maxPage=Math.max(1,Math.ceil(works.length/8));
    content.innerHTML=`<p class="eyebrow">GALLERY 0${room+1} · ${escapeHTML(x.titleEn)}</p><h2 id="panel-title">${escapeHTML(x.title)}</h2><p class="large-subtitle">${escapeHTML(x.subtitle)}</p><p class="panel-prose">${escapeHTML(x.description)}</p><div class="room-count"><span>${roomWorks(room).length} 件館藏紀錄</span><span>${documents.filter(d=>d.theme===x.theme).length} 份文獻</span></div>${works.length>8?`<div class="hanging-pages"><label for="hanging-page">更換本廳展牆選件</label><select id="hanging-page">${Array.from({length:maxPage},(_,i)=>`<option value="${i}" ${pages[room]===i?'selected':''}>第 ${i+1} 組 / 共 ${maxPage} 組</option>`).join('')}</select></div>`:''}<div class="source-links">${(x.sourceUrls||[]).slice(0,3).map((u,i)=>linked(u,`策展參考 ${i+1}`)).join('')}</div><button class="primary" id="browse-room">瀏覽本廳館藏 <span>→</span></button><p class="footnote">策展論述是對公開資料的編輯詮釋；作品入藏理由若未取得提案佐證，不作推定。</p>`;
    $('#browse-room').onclick=()=>{catalogueTheme=x.theme;catalogueQuery='';showPanel('catalogue');};
    const select=content.querySelector<HTMLSelectElement>('#hanging-page');if(select)select.onchange=()=>{pages[room]=Number(select.value);hangRoom(room);notify('本廳展牆已更換選件。');};
  }else if(name==='about'){
    content.innerHTML=`<p class="eyebrow">A MUSEUM HELD IN COMMON</p><h2 id="panel-title">關於這座美術館</h2><p class="large-subtitle">收藏不只是擁有，<br>也是一起決定什麼值得留下。</p><p class="panel-prose">FAB DAO（福爾摩沙藝術銀行）將數位藝術、公共行動與共同治理放進同一場實驗。這座虛擬美術館循著收藏與文件，從生成藝術的形式，走向島嶼的想像，再進入共同決策與公共記憶。</p><p class="panel-prose">本次開館展以四個展間組織館藏。空間採古典柱廊、拱門與天光，讓數位作品能被停留、觀看與閱讀。無需登入或連接錢包，任何人都可以入館。</p><div class="about-facts"><div><span>04</span>主題展間</div><div><span>${collection.artworks.length}</span>館藏紀錄</div><div><span>${documents.length}</span>公開文獻</div></div><h3>來源與收藏邊界</h3><p class="panel-prose">館藏來自 Tezos 的 fabcollect.tez 與使用者提供的 Ethereum 藝術銀行地址，依公開索引器核對持有。收藏錢包與治理公庫分開記錄。Project %、藝術種子基金、白紙基金等計畫文獻獨立標示，不把整個發行系列當成本館持有作品。</p><div class="wallet-list"><span>Tezos · fabcollect.tez</span><code>tz1cpZ7eLovJigqcUsfbjmquuezjToZLtGUZ</code><span>Ethereum · 使用者提供並核對持有</span><code>0x992f0201ff7ee158a8baf638549d0ad1cbcc27ef</code></div><p class="footnote">本版為 ${escapeHTML(collection.verifiedAt?.slice(0,10))} 的資料快照。尚未完整重建歷史轉出、提案與決選關係。藝術品影像及原作權利歸原作者；本館摘要與展間配置為策展編輯。</p><div class="source-links">${linked('https://fabdao.world','FAB DAO 官方網站')}${linked('/data/collection.json','下載館藏來源資料')}${linked('/data/documents.json','文獻來源清單')}</div>`;
  }else if(name==='settings'){
    content.innerHTML=`<p class="eyebrow">MAKE YOURSELF COMFORTABLE</p><h2 id="panel-title">觀看設定</h2><p class="panel-intro">依照電腦效能，選擇適合的畫質。</p><label class="settings-label" for="quality">畫質</label><select id="quality"><option value="balanced">均衡 · 標準陰影</option><option value="high">細緻 · 提升畫面解析度</option><option value="low">流暢 · 關閉即時陰影</option></select><p class="footnote">環境光與作品仍會保留。若移動不順，請選擇「流暢」。<br>目前渲染：約 ${fps} FPS（此裝置的即時估計值）。</p><h3>舒適導覽</h3><p class="panel-prose">館內移動不加入頭部晃動。你也可以使用展間地圖直接抵達，或由館藏目錄靜態閱讀所有作品。</p>`;
    const select=$<HTMLSelectElement>('#quality');select.value=museum?.quality||'balanced';select.onchange=()=>{museum?.setQuality(select.value);try{localStorage.setItem('fab-museum-quality',select.value);}catch{}};
  }else if(name==='help'){
    content.innerHTML=`<p class="eyebrow">A SLOW WALK THROUGH ART</p><h2 id="panel-title">如何逛美術館</h2><div class="help-list"><div><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><p>前後左右移動</p></div><div><span>拖曳滑鼠</span><p>環視空間；點「自由環視」可鎖定游標</p></div><div><span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></span><p>前進、後退、向左或向右看</p></div><div><span>點擊作品 / <kbd>Enter</kbd></span><p>開啟作品、作者與來源</p></div><div><span><kbd>Esc</kbd></span><p>關閉視窗、釋放滑鼠或暫停</p></div><div><span><kbd>M</kbd></span><p>開啟展間地圖，一鍵抵達</p></div></div><p class="footnote">手機或不適合 3D 的裝置，建議使用「館藏目錄」。藝術觀看不需要特定操作方式。</p>`;
  }
}
function renderCatalogue(){
  const q=catalogueQuery.trim().toLocaleLowerCase();
  const works=collection.artworks.filter(a=>(catalogueTheme==='all'||a.theme===catalogueTheme)&&`${a.title} ${a.artist} ${a.chain}`.toLocaleLowerCase().includes(q));
  const docs=documents.filter(d=>(catalogueTheme==='all'||catalogueTheme==='documents'||d.theme===catalogueTheme)&&`${d.title} ${d.summary}`.toLocaleLowerCase().includes(q));
  const entries:Array<Artwork|DocumentItem>=[...works,...docs];
  $('#result-count').textContent=`${works.length} 件館藏 · ${docs.length} 份文獻`;
  $('#catalogue-grid').innerHTML=entries.length?entries.map((item,i)=>{const art=item as Artwork;return `<button class="collection-card" data-item="${i}"><div class="card-image">${art.image?`<img loading="lazy" src="${escapeHTML(safeURL(art.image))}" alt="${escapeHTML(art.title)}">`:`<span class="document-tile">${'artist' in item?'COLLECTION<br>預覽待補':'FAB DAO<br>PUBLIC ARCHIVE'}</span>`}<span class="card-type">${'artist' in item?escapeHTML(art.chain):'文獻'}</span></div><div class="card-caption"><span>${escapeHTML('artist' in item?art.artist:'FAB DAO · 公開文件')}</span><h3>${escapeHTML(item.title)}</h3><span class="card-arrow">↗</span></div></button>`;}).join(''):`<p class="empty-state">沒有符合的作品。試試其他作品名稱、作者或展間。</p>`;
  $('#catalogue-grid').querySelectorAll<HTMLElement>('[data-item]').forEach(b=>b.onclick=()=>inspect(entries[Number(b.dataset.item)]));
  $('#catalogue-grid').querySelectorAll<HTMLImageElement>('img').forEach(img=>img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('span'),{className:'document-tile',textContent:'預覽暫時無法載入'}));});
}
function hangRoom(index:number){museum?.displayRoom(index,displayWorks(index).slice(pages[index]*8,pages[index]*8+8),documents.filter(d=>d.theme===exhibitions[index].theme));}
async function init(){
  try{
    const responses=await Promise.all(['/data/collection.json','/data/exhibitions.json','/data/documents.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error(`資料 ${r.status}`);return r.json();})));
    [collection,exhibitions,documents]=responses;
    if(openPanel)renderPanel(openPanel);
    if(!Array.isArray(collection.artworks)||exhibitions.length!==4)throw Error('館藏資料格式錯誤');
    // Archive is usable before the 3D engine is loaded, and remains usable on a WebGL failure.
    const {Museum}=await import('./museum');
    museum=new Museum($('#scene'),exhibitions);for(let i=0;i<4;i++)hangRoom(i);
    museum.onRoom=updateRoom;museum.onInspect=inspect;museum.onHover=item=>{selectedItem=item;const button=$('#inspect-hint');button.hidden=!item;button.textContent=item?`${item.title} · Enter 觀看`:'';};
    museum.onStats=value=>{fps=value;};museum.onContextLost=()=>{notify('3D 顯示已中斷，可繼續使用館藏目錄。');showPanel('catalogue');};
    try{const value=localStorage.getItem('fab-museum-quality');if(value&&['low','balanced','high'].includes(value))museum.setQuality(value);}catch{}
    $<HTMLButtonElement>('#enter').disabled=false;$('#enter').innerHTML='進入美術館 <span>↗</span>';
    if(location.hash==='#catalogue')showPanel('catalogue');
  }catch(error){console.error(error);$('#enter').innerHTML='開啟館藏目錄 <span>↗</span>';$<HTMLButtonElement>('#enter').disabled=false;$('#enter').onclick=()=>showPanel('catalogue');document.body.classList.add('no-webgl');notify('3D 展館載入未完成，仍可由館藏目錄觀看作品與資料。');}
}
init();
