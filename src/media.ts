import type { Artwork } from './types';

export type MediaKind = 'interactive' | 'model' | 'video' | 'audio' | 'image' | 'unknown';
export type MediaState = 'idle' | 'loading' | 'embedded' | 'open' | 'error' | 'disposed';
export type MediaLocale = 'zh-TW' | 'en';
export type MediaSupport = { supported:boolean; kind:MediaKind; label:string; sourceUrl?:string; playbackUrl?:string; reason?:string; instructions?:string };
export type MediaOptions = { locale?:MediaLocale; onStatus?:(state:MediaState,message:string)=>void };
export type MediaHandle = { dispose:()=>void; stop:()=>void; getState:()=>MediaState };
const phrase=(locale:MediaLocale,zh:string,en:string)=>locale==='en'?en:zh;
const copy=(locale:MediaLocale)=>({
  original:phrase(locale,'原作觀看','Original artwork'), staticPreview:phrase(locale,'靜態預覽','Static preview'),
  start:phrase(locale,'啟動原作','Start original'), startModel:phrase(locale,'開啟 3D 原作','Open 3D original'),
  stop:phrase(locale,'關閉原作','Close original'), retry:phrase(locale,'重新載入原作','Retry original'),
  blank:phrase(locale,'畫面空白？回到預覽','Blank view? Return to preview'),
  source:phrase(locale,'在新分頁觀看原作 ↗','Open original in a new tab ↗'),
  idle:phrase(locale,'目前顯示靜態預覽。按下按鈕才會載入原作。','Showing a static preview. The original loads only when you start it.'),
  stopped:phrase(locale,'原作已關閉，已回到靜態預覽。','The original has stopped. The static preview is restored.'),
  loading:phrase(locale,'正在載入原作…','Loading the original…'),
  embedded:phrase(locale,'外部原作頁面已開啟。跨站頁面無法自動確認是否成功繪製；若畫面空白，可返回預覽、重試或在新分頁開啟。','The external artwork page has opened. Its rendering cannot be confirmed automatically across origins. If it is blank, return to the preview, retry, or open it in a new tab.'),
  unavailable:phrase(locale,'原作來源暫時無法載入，已恢復預覽。可以重試或使用原作連結。','The original source could not be loaded. The preview is restored; retry or use the original link.'),
  timeout:phrase(locale,'原作載入逾時，已恢復預覽。可以重試或在新分頁觀看。','Loading timed out. The preview is restored; retry or open the original in a new tab.'),
  imageReady:phrase(locale,'原作影像已載入。動態圖片會依原檔播放。','The original image has loaded. Animated images play according to the source file.'),
  playerReady:phrase(locale,'原作播放器已就緒，請按播放開始。','The original media player is ready. Press play to begin.'),
  playing:phrase(locale,'正在播放原作。關閉原作可停止播放。','Playing the original. Close it to stop playback.'),
  modelReady:phrase(locale,'3D 原作已載入，可旋轉與縮放觀看。','The original 3D model is ready to rotate and zoom.'),
  modelUnsupported:phrase(locale,'這份 3D 原作包含尚未支援的外部資源或壓縮格式，已恢復預覽。請由原作來源觀看。','This model uses external resources or compression that the viewer does not yet support. The preview is restored; use the original source.'),
  contextLost:phrase(locale,'此裝置的 3D 顯示已中斷，已恢復預覽。可重試或開啟原作來源。','The device lost its 3D rendering context. The preview is restored; retry or use the original source.'),
});

type Original={kind:'interactive'|'model';url:string;playbackUrl?:string;label:[string,string];instructions:[string,string]};
// Executable works are reviewed by exact token URL, including the token seed.
// They remain cross-origin, in an opaque sandbox; the museum never evaluates their HTML.
const originals:Record<string,Original>={
  ethereum_0x70270e65bc37832ef845fa330c2b71501970dab9_81:{kind:'interactive',url:'https://generator.artblocks.io/1/0x70270e65bc37832ef845fa330c2b71501970dab9/81',label:['即時生成・聲音','Live generation · sound'],instructions:['影像隨運算持續變化。啟動後，點一下作品畫面開啟聲音，再點一下暫停聲音；關閉原作即可停止全部運算與聲音。','The image changes as it runs. Click the artwork to enable sound; click again to pause sound. Closing the original stops its computation and audio.']},
  tezos_KT19FqQ3V6gtkxNnFBhgXRqmMZ2zhiQz7zWa_86:{kind:'interactive',url:'https://ipfs.io/ipfs/bafybeigxp6h5ptxb6ihnfdd6zb2s4hpyzuhzllq4ifizrzuaopi7zeuxvy?iteration=60&seed=ec12ddd8e212bd36ecff435fe3cdd4893f96ef920f7d6a2663b851a936f8866b&seedGlobal=43d909af70f3e9f579cb5a4560a1c8b1&ts=1763290036',playbackUrl:'https://ipfs.filebase.io/ipfs/bafybeigxp6h5ptxb6ihnfdd6zb2s4hpyzuhzllq4ifizrzuaopi7zeuxvy/?iteration=60&seed=ec12ddd8e212bd36ecff435fe3cdd4893f96ef920f7d6a2663b851a936f8866b&seedGlobal=43d909af70f3e9f579cb5a4560a1c8b1&ts=1763290036',label:['互動繪圖','Interactive drawing'],instructions:['點入作品後拖曳繪圖，按 1–4 選擇曲線、5 選擇準線，H 查看說明，R 回到原始狀態。若來源暫時中斷，可返回預覽稍後重試。','Click the artwork and drag to draw. Keys 1–4 select a curve, 5 selects the directrix, H opens help, and R restores the original. If the source is temporarily unavailable, return to the preview and retry later.']},
  tezos_KT1AFq5XorPduoYyWxs5gEyrFK6fVjJVbtCj_25336:{kind:'model',url:'https://ipfs.io/ipfs/QmbBgyhj7A4VhzhmqpfXRGqWBkXVdypicEAZPVToURn8Az',playbackUrl:'/media/green-sofa.glb',label:['3D 原作','Original 3D model'],instructions:['拖曳旋轉、滾輪縮放，也可使用下方按鈕。模型與材質來自原作者 GLB；此處的燈光和背景為本館展示設定。','Drag to rotate or scroll to zoom; buttons are also available. Geometry and materials come from the original GLB. Lighting and background are museum display settings.']},
};
const labels:Record<MediaKind,[string,string]>={interactive:['互動原作','Interactive original'],model:['3D 原作','Original 3D model'],video:['影片原作','Original video'],audio:['聲音原作','Original audio'],image:['原作影像','Original image'],unknown:['作品來源','Artwork source']};
function safeRemote(value:unknown):string|undefined {try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}}
export function nativePlaybackURL(source:string):string {
  const url=new URL(source);
  // CID and path remain unchanged. Pinata serves binary media while ipfs.io is
  // phasing out its sponsored HTTP gateway. Executable HTML never uses this route.
  if(['ipfs.io','ipfs.verse.works'].includes(url.hostname)&&/^\/ipfs\/[A-Za-z0-9]+(?:\/|$)/.test(url.pathname))return `https://gateway.pinata.cloud${url.pathname}${url.search}`;
  return source;
}
export function getMediaKind(artwork:Artwork):MediaKind {
  if(originals[artwork.id])return originals[artwork.id].kind;
  const mime=String(artwork.mediaType||'').toLowerCase();
  if(mime==='model/gltf-binary')return 'model';
  if(mime.startsWith('video/'))return 'video';if(mime.startsWith('audio/'))return 'audio';
  if(mime.includes('html')||mime==='application/x-directory')return 'interactive';
  if(mime.startsWith('image/'))return 'image';return 'unknown';
}
export function getMediaSupport(artwork:Artwork,locale:MediaLocale='zh-TW'):MediaSupport {
  const original=originals[artwork.id],kind=getMediaKind(artwork),label=(original?.label||labels[kind])[locale==='en'?1:0];
  if(original){
    if(artwork.artifactUrl!==original.url)return {supported:false,kind,label,reason:phrase(locale,'原作來源與已核對版本不同，暫時保留來源連結。','The source differs from the reviewed version. Please use the source link.')};
    return {supported:true,kind,label,sourceUrl:original.url,playbackUrl:original.playbackUrl||original.url,instructions:original.instructions[locale==='en'?1:0]};
  }
  const sourceUrl=safeRemote(artwork.artifactUrl);
  if(!sourceUrl||!['image','video','audio','model'].includes(kind))return {supported:false,kind,label,reason:phrase(locale,'館內原生展示尚未核對；可由預覽與作品來源觀看。','Native display has not yet been reviewed. Use the preview and artwork source.')};
  const instructions=kind==='model'?phrase(locale,'拖曳旋轉、滾輪縮放。模型使用原作 GLB；外部模型資源與未支援壓縮會回到預覽。','Drag to rotate and scroll to zoom. This viewer uses the original GLB; external model resources or unsupported compression fall back to the preview.'):kind==='image'?phrase(locale,'顯示原作影像檔；GIF 等動態格式會保留原本的播放形式。','Displays the original image file, preserving animation in formats such as GIF.'):phrase(locale,'載入後請使用播放器開始、暫停與調整音量。關閉原作會停止播放並釋放資源。','Use the player to start, pause, and adjust volume. Closing the original stops playback and releases its resources.');
  return {supported:true,kind,label,sourceUrl,playbackUrl:nativePlaybackURL(sourceUrl),instructions};
}
function element<K extends keyof HTMLElementTagNameMap>(tag:K,className:string,text?:string):HTMLElementTagNameMap[K]{const node=document.createElement(tag);node.className=className;if(text)node.textContent=text;return node;}
export function validateInteractiveResponse(status:number,contentType:string,body:string):void {
  if(status<200||status>=300)throw new Error(`HTTP ${status}`);
  if(!/text\/html|application\/xhtml\+xml/i.test(contentType)||!/<!doctype|<html|<script|<canvas/i.test(body))throw new Error('The source did not return artwork HTML.');
  if(/gatewaychanges\.ipfs\.io|CONTENT_NOT_HOSTED|service worker gateway only|ERR_ID:00023/i.test(body))throw new Error('The gateway returned a service page, not the artwork.');
}
/** Dispose this handle before replacing or closing the artwork panel. */
export function mountMedia(container:HTMLElement,artwork:Artwork,options:MediaOptions={}):MediaHandle {
  const locale=options.locale||'zh-TW',words=copy(locale),support=getMediaSupport(artwork,locale);
  const root=element('section','native-media');root.setAttribute('aria-label',`${artwork.title} · ${words.original}`);
  const stage=element('div','native-media-stage');stage.style.cssText='position:relative;min-height:300px;aspect-ratio:1/1;overflow:hidden;background:#161914;';
  const controls=element('div','native-media-controls'),modelControls=element('div','native-model-controls');
  const startButton=element('button','primary native-media-start',support.kind==='model'?words.startModel:words.start);startButton.type='button';
  const stopButton=element('button','native-media-stop',words.stop);stopButton.type='button';stopButton.hidden=true;
  const blankButton=element('button','native-media-blank',words.blank);blankButton.type='button';blankButton.hidden=true;
  const status=element('p','native-media-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  controls.append(startButton,stopButton,blankButton);
  if(support.sourceUrl){const source=element('a','native-media-source',words.source);source.href=support.kind==='interactive'?support.playbackUrl||support.sourceUrl:support.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';controls.append(source);}
  root.append(element('p','eyebrow',support.label),stage,controls,modelControls,element('p','native-media-instructions',support.instructions||support.reason),status);container.replaceChildren(root);
  let state:MediaState='idle',generation=0,cleanupActive=()=>{};
  const update=(next:MediaState,message:string)=>{state=next;status.textContent=message;options.onStatus?.(next,message);};
  const preview=()=>{
    stage.replaceChildren();
    if(typeof artwork.image==='string'&&/^\/artworks\/[A-Za-z0-9._-]+$/.test(artwork.image)){
      const image=element('img','native-media-preview');image.src=artwork.image;image.alt=`${artwork.title} · ${words.staticPreview}`;image.style.cssText='display:block;width:100%;height:100%;position:absolute;inset:0;object-fit:contain;';stage.append(image);
    }
  };
  const clearActive=()=>{cleanupActive();cleanupActive=()=>{};modelControls.replaceChildren();blankButton.hidden=true;};
  const restore=(next:'idle'|'error',message:string)=>{generation++;clearActive();preview();startButton.hidden=!support.supported;startButton.disabled=false;startButton.textContent=next==='error'?words.retry:support.kind==='model'?words.startModel:words.start;stopButton.hidden=true;update(next,message);};
  const stop=()=>{if(state!=='disposed')restore('idle',support.supported?words.stopped:support.reason||'');};
  const activate=()=>{
    if(!support.supported||!support.playbackUrl||state==='disposed'||state==='loading')return;
    clearActive();const current=++generation,isCurrent=()=>current===generation&&state!=='disposed';
    const abort=new AbortController();let release=()=>{};
    const timer=window.setTimeout(()=>{if(isCurrent())restore('error',words.timeout);},25000);
    cleanupActive=()=>{window.clearTimeout(timer);abort.abort();release();};
    const fail=(message=words.unavailable)=>{if(isCurrent())restore('error',message);};
    const ready=(next:MediaState,message:string)=>{if(isCurrent()){window.clearTimeout(timer);update(next,message);}};
    stage.replaceChildren();startButton.hidden=true;stopButton.hidden=false;update('loading',words.loading);
    if(support.kind==='interactive'){
      // The reviewed sources are explicitly iframe-able. Do not fetch their HTML
      // first: a CORS preflight would reject a valid cross-origin iframe when the
      // publisher does not expose Access-Control-Allow-Origin to the museum.
      const frame=element('iframe','native-media-frame');frame.title=`${artwork.title} · ${words.original}`;
      frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('allow','autoplay; fullscreen');frame.referrerPolicy='no-referrer';frame.allowFullscreen=true;
      frame.style.cssText='display:block;width:100%;height:100%;position:absolute;inset:0;border:0;background:#161914;';
      frame.onload=()=>{if(isCurrent()){ready('embedded',words.embedded);blankButton.hidden=false;startButton.textContent=words.retry;startButton.hidden=false;}};
      frame.onerror=()=>fail();
      release=()=>{frame.onload=null;frame.onerror=null;frame.remove();frame.removeAttribute('src');};
      frame.src=support.playbackUrl!;stage.append(frame);
    } else if(support.kind==='model'){
      void createModelViewer(stage,modelControls,support.playbackUrl,artwork.title,locale,abort.signal,isCurrent,()=>fail(words.contextLost)).then(dispose=>{
        if(!isCurrent()){dispose();return;}release=dispose;ready('open',words.modelReady);
      }).catch(error=>fail(error instanceof UnsupportedModelError?words.modelUnsupported:words.unavailable));
    } else if(support.kind==='image'){
      const image=element('img','native-media-image');image.alt=artwork.title;image.style.cssText='display:block;width:100%;height:100%;position:absolute;inset:0;object-fit:contain;';
      image.onload=()=>{if(image.naturalWidth>0)ready('open',words.imageReady);else fail();};image.onerror=()=>fail();
      release=()=>{image.onload=null;image.onerror=null;image.removeAttribute('src');image.remove();};image.src=support.playbackUrl;stage.append(image);
    } else if(support.kind==='video'||support.kind==='audio'){
      const player=document.createElement(support.kind);player.className='native-media-player';player.controls=true;player.preload='metadata';
      if(support.kind==='video'){(player as HTMLVideoElement).playsInline=true;if(artwork.image)(player as HTMLVideoElement).poster=artwork.image;}
      player.style.cssText=support.kind==='video'?'display:block;width:100%;height:100%;position:absolute;inset:0;object-fit:contain;':'display:block;width:calc(100% - 32px);position:absolute;left:16px;top:45%;';
      player.onloadedmetadata=()=>ready('open',words.playerReady);player.onplaying=()=>ready('open',words.playing);player.onerror=()=>fail();
      release=()=>{player.onloadedmetadata=null;player.onplaying=null;player.onerror=null;player.pause();player.removeAttribute('src');player.load();player.remove();};
      player.src=support.playbackUrl;stage.append(player);player.load();
    }
  };
  startButton.addEventListener('click',activate);stopButton.addEventListener('click',()=>{stop();startButton.focus();});blankButton.addEventListener('click',()=>{restore('error',words.unavailable);startButton.focus();});
  preview();startButton.hidden=!support.supported;update('idle',support.supported?words.idle:support.reason||'');
  return {stop,getState:()=>state,dispose(){if(state==='disposed')return;generation++;clearActive();root.remove();state='disposed';}};
}
class UnsupportedModelError extends Error {}
async function createModelViewer(stage: HTMLElement, buttons: HTMLElement, modelUrl:string, title:string, locale:MediaLocale, signal: AbortSignal, isCurrent: () => boolean, onContextLost:()=>void): Promise<() => void> {
  const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
    import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js'),
  ]);
  if (!isCurrent()) return () => {};
  const response = await fetch(modelUrl, { signal, credentials: 'omit',mode:'cors' });
  if (!response.ok) throw new Error('The original model could not be loaded.');
  if(Number(response.headers.get('content-length'))>25000000)throw new UnsupportedModelError('The original is too large.');
  const bytes = await response.arrayBuffer();
  const view=new DataView(bytes);
  if(bytes.byteLength>25000000||bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)throw new UnsupportedModelError('Invalid original GLB.');
  const jsonLength=view.getUint32(12,true);
  if(jsonLength+20>bytes.byteLength)throw new UnsupportedModelError('Invalid GLB structure.');
  const metadata=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLength)));
  if([...(metadata.buffers||[]),...(metadata.images||[])].some((item:{uri?:string})=>item.uri))throw new UnsupportedModelError('External resources are not supported.');
  if((metadata.extensionsRequired||[]).some((extension:string)=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(extension)))throw new UnsupportedModelError('Unsupported compression.');
  if (!isCurrent()) return () => {};
  const manager = new THREE.LoadingManager();
  // The verified GLB is self-contained. Never follow external resources in a model.
  manager.setURLModifier(url => {
    if (/^(blob:|data:image\/)/.test(url)) return url;
    throw new UnsupportedModelError('External model resources are not permitted.');
  });
  const gltf = await new GLTFLoader(manager).parseAsync(bytes, '');
  const model = gltf.scene;
  const freeObject = () => {
    const textures = new Set<import('three').Texture>();
    const materials = new Set<import('three').Material>();
    const geometries = new Set<import('three').BufferGeometry>();
    model.traverse(object => {
      const mesh = object as import('three').Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    for (const texture of textures) {
      texture.dispose();
      const image = texture.source?.data as { close?: () => void } | undefined;
      if (image && typeof image.close === 'function') image.close();
    }
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
  };
  if (!isCurrent()) { freeObject(); return () => {}; }
  let renderer: import('three').WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
  catch (error) { freeObject(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6e4dd');
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z);
  model.scale.multiplyScalar(scale);
  model.position.sub(center.multiplyScalar(scale));
  scene.add(model, new THREE.HemisphereLight(0xffffff, 0x747b6b, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(3, 5, 4);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  const initialPosition = new THREE.Vector3(2.5, 1.7, 3);
  camera.position.copy(initialPosition);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `${title} · ${phrase(locale,'3D 原作，拖曳旋轉、滾輪縮放。也可使用下方按鈕。','Original 3D model. Drag to rotate, scroll to zoom, or use the buttons below.')}`);
  const lost=(event:Event)=>{event.preventDefault();onContextLost();};canvas.addEventListener('webglcontextlost',lost);
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;';
  stage.append(canvas);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * .95;
  controls.target.set(0, 0, 0);
  controls.update();
  const render = () => {
    if (!isCurrent()) return;
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  controls.addEventListener('change', render);
  const resize = new ResizeObserver(render);
  resize.observe(stage);
  const rotate = (direction: number) => {
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 8);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    render();
  };
  const zoom = (factor: number) => {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
    render();
  };
  const buttonActions: [string, () => void][] = [
    [phrase(locale,'向左旋轉','Rotate left'), () => rotate(-1)], [phrase(locale,'向右旋轉','Rotate right'), () => rotate(1)],
    [phrase(locale,'放大','Zoom in'), () => zoom(.8)], [phrase(locale,'縮小','Zoom out'), () => zoom(1.25)],
    [phrase(locale,'重設視角','Reset view'), () => { camera.position.copy(initialPosition); controls.target.set(0, 0, 0); controls.update(); render(); }],
  ];
  for (const [label, action] of buttonActions) {
    const button = element('button', 'native-model-control', label);
    button.type = 'button';
    button.addEventListener('click', action);
    buttons.append(button);
  }
  render();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    resize.disconnect();
    controls.removeEventListener('change', render);
    controls.dispose();
    freeObject();
    canvas.removeEventListener('webglcontextlost',lost);
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    buttons.replaceChildren();
  };
}
