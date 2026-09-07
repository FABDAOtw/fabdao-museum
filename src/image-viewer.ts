/** One image surface, with all listeners scoped to its lifetime. */
export function mountImageViewer(container:HTMLElement,url:string,title:string,locale:'zh-TW'|'en'='zh-TW'){
  const t=(zh:string,en:string)=>locale==='en'?en:zh;
  const abort=new AbortController(), signal=abort.signal;
  const stage=document.createElement('div');stage.className='image-stage';stage.tabIndex=0;stage.setAttribute('aria-label',t('作品預覽，可用加減按鈕縮放，放大後拖曳或方向鍵平移','Artwork preview. Zoom with plus and minus; drag or use arrow keys to pan.'));
  const img=new Image();img.alt=title;img.draggable=false;stage.append(img);
  const toolbar=document.createElement('div');toolbar.className='image-tools';
  const status=document.createElement('output');status.setAttribute('aria-live','polite');status.textContent=t('載入預覽','Loading preview');
  let scale=1,x=0,y=0,fitScale=1,disposed=false,drag:{x:number;y:number;tx:number;ty:number}|null=null;
  function paint(){
    const w=stage.clientWidth,h=stage.clientHeight;
    x=Math.max(-Math.max(0,(img.naturalWidth*scale-w)/2),Math.min(Math.max(0,(img.naturalWidth*scale-w)/2),x));
    y=Math.max(-Math.max(0,(img.naturalHeight*scale-h)/2),Math.min(Math.max(0,(img.naturalHeight*scale-h)/2),y));
    img.style.transform=`translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
    status.textContent=`${Math.round(scale*100)}%`;stage.classList.toggle('can-pan',scale>fitScale+.001);
  }
  function fit(){if(!img.naturalWidth)return;fitScale=Math.min((stage.clientWidth-32)/img.naturalWidth,(stage.clientHeight-32)/img.naturalHeight,1);scale=Math.max(.01,fitScale);x=y=0;paint();}
  function zoom(factor:number){scale=Math.max(Math.min(fitScale,.05),Math.min(8,scale*factor));paint();}
  function button(label:string,action:()=>void){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action,{signal});toolbar.append(b);return b;}
  button(t('適合畫面','Fit image'),fit);button('−',()=>zoom(1/1.4)).setAttribute('aria-label',t('縮小作品','Zoom out'));button('＋',()=>zoom(1.4)).setAttribute('aria-label',t('放大作品','Zoom in'));button('100%',()=>{scale=1;paint();});toolbar.append(status);
  const full=button(t('全螢幕','Fullscreen'),()=>{if(document.fullscreenElement===container){void document.exitFullscreen();}else{void container.requestFullscreen?.().catch(()=>{status.textContent=t('此瀏覽器無法開啟全螢幕','Fullscreen is unavailable in this browser.');});}});
  if(!document.fullscreenEnabled)full.hidden=true;
  container.classList.add('image-viewer');container.append(stage,toolbar);
  img.addEventListener('load',()=>{if(!disposed)fit();},{signal});img.addEventListener('error',()=>{status.textContent=t('預覽暫時無法載入，請使用作品來源','The preview could not load. Please use the artwork source.');},{signal});img.src=url;
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,tx:x,ty:y};stage.setPointerCapture(e.pointerId);},{signal});
  stage.addEventListener('pointermove',e=>{if(!drag)return;x=drag.tx+e.clientX-drag.x;y=drag.ty+e.clientY-drag.y;paint();},{signal});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,()=>{drag=null;},{signal});
  stage.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Equal','Minus','Digit0'].includes(e.code)){e.preventDefault();e.stopPropagation();if(e.code==='Equal')zoom(1.4);else if(e.code==='Minus')zoom(1/1.4);else if(e.code==='Digit0')fit();else{x+=e.code==='ArrowLeft'?40:e.code==='ArrowRight'?-40:0;y+=e.code==='ArrowUp'?40:e.code==='ArrowDown'?-40:0;paint();}}},{signal});
  const resize=new ResizeObserver(fit);resize.observe(stage);
  return {dispose(){disposed=true;abort.abort();resize.disconnect();if(document.fullscreenElement===container)void document.exitFullscreen();container.replaceChildren();container.classList.remove('image-viewer');}};
}
