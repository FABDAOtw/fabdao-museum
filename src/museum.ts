import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { moveWithCollision, roomAt } from './navigation.js';
import type { Artwork, Exhibition, DocumentItem } from './types';

const cream = 0xd2c4a8, gold = 0xa88345;
const up = new THREE.Vector3(0, 1, 0);
export class Museum {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, .08, 120);
  renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private ao: SSAOPass;
  keys = new Set<string>();
  active = false;
  paused = false;
  yaw = .18;
  pitch = -.04;
  room = 0;
  quality = 'balanced';
  private last = 0;
  private elapsed = 0;
  private frameCount = 0;
  private hovered: Artwork | DocumentItem | null = null;
  private targets: THREE.Mesh[] = [];
  private roomVersions = [0,0,0,0];
  private raycaster = new THREE.Raycaster();
  private drag = false;
  private dragged = false;
  private batch = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private galleries: THREE.Group[] = [];
  private sun: THREE.DirectionalLight;
  private loader = new THREE.TextureLoader();
  onInspect: (item: Artwork | DocumentItem) => void = () => {};
  onRoom: (index: number) => void = () => {};
  onHover: (item: Artwork | DocumentItem | null) => void = () => {};
  onStats: (fps: number) => void = () => {};
  onContextLost: () => void = () => {};
  private stone: THREE.MeshStandardMaterial;
  private trim: THREE.MeshStandardMaterial;
  private brass: THREE.MeshStandardMaterial;

  constructor(private container: HTMLElement, private exhibitions: Exhibition[]) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', '可移動的三維美術館。可使用展間地圖與館藏目錄瀏覽。');
    container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xddd4bf);
    this.scene.fog = new THREE.Fog(0xd2c7b3, 38, 95);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(envScene, .04).texture;
    this.scene.environmentIntensity = .3;
    envScene.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe6edee, 0x77654d, 1.15));
    this.sun = new THREE.DirectionalLight(0xffecd0, 3.4);
    this.sun.position.set(-7, 13, 5); this.sun.target.position.set(3, 0, -5);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -16; this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 16; this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.camera.near = .5; this.sun.shadow.camera.far = 48;
    this.sun.shadow.bias = -.0005; this.sun.shadow.normalBias = .045;
    this.scene.add(this.sun, this.sun.target);
    this.stone = new THREE.MeshStandardMaterial({color: cream, roughness:.78, map:this.marbleTexture()});
    this.trim = new THREE.MeshStandardMaterial({color:0xe3d9bf, roughness:.64});
    this.brass = new THREE.MeshStandardMaterial({color:gold, metalness:.7, roughness:.35});
    this.build(); this.flush();
    this.camera.position.set(3.4, 2.15, 8.2);
    this.camera.rotation.order = 'YXZ';
    this.look();
    this.composer=new EffectComposer(this.renderer);
    this.composer.renderTarget1.samples=4;this.composer.renderTarget2.samples=4;
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.ao=new SSAOPass(this.scene,this.camera,container.clientWidth,container.clientHeight,16);
    this.ao.kernelRadius=.4;this.ao.minDistance=.001;this.ao.maxDistance=.1;
    this.composer.addPass(this.ao);this.composer.addPass(new OutputPass());
    this.bind(); this.resize();
    this.renderer.setAnimationLoop(this.render);
  }
  private marbleTexture() {
    const c = document.createElement('canvas'); c.width=c.height=512;
    const ctx=c.getContext('2d')!; ctx.fillStyle='#ede9df'; ctx.fillRect(0,0,512,512);
    // Deterministic stone grain is architecture material, never an artwork.
    for(let i=0;i<85;i++) { ctx.beginPath();ctx.strokeStyle=`rgba(100,90,74,${.015+(i%6)*.008})`;ctx.lineWidth=.4+(i%7)*.35;
      for(let j=0;j<=32;j++){const x=j*16,y=(i*13+Math.sin(j*.3+i)*24+j*5)%560; j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke(); }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);return t;
  }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, x:number,y:number,z:number,ry=0) {
    if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromAxisAngle(up,ry),new THREE.Vector3(1,1,1));
    g.applyMatrix4(transform);
    const list=this.batch.get(m)||[];list.push(g);this.batch.set(m,list);
  }
  private box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=this.trim,ry=0) {this.mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,ry);}
  private flush() {
    for(const [material,geometries] of this.batch) {
      const geometry=mergeGeometries(geometries); if(!geometry)continue;
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=!(material instanceof THREE.MeshBasicMaterial);mesh.receiveShadow=true;this.scene.add(mesh);
      geometries.forEach(g=>g.dispose());
    } this.batch.clear();
  }
  private column(x:number,z:number) {
    this.box(1.18,.2,1.18,x,.1,z,this.stone);this.box(1.04,.15,1.04,x,.27,z);
    this.mesh(new THREE.CylinderGeometry(.49,.52,.18,24),this.stone,x,.44,z);
    this.mesh(new THREE.CylinderGeometry(.32,.41,4.6,32),this.stone,x,2.82,z);
    for(let i=0;i<16;i++) {const a=i*Math.PI/8;this.mesh(new THREE.CylinderGeometry(.035,.045,4.45,6),this.trim,x+Math.cos(a)*.355,2.82,z+Math.sin(a)*.355);}
    for(const [y,r,h] of [[5.16,.44,.16],[5.34,.52,.2],[5.52,.6,.16]])this.mesh(new THREE.CylinderGeometry(r,r,h,24),this.stone,x,y,z);
    this.box(1.25,.2,1.25,x,5.68,z);this.box(1.4,.14,1.4,x,5.85,z);
    for(const sx of [-1,1])for(const sz of [-1,1])this.mesh(new THREE.SphereGeometry(.13,8,6),this.stone,x+sx*.39,5.43,z+sz*.39);
  }
  private arch(z:number) {
    for(const side of [-1,1]){
      this.box(6.15,7,.55,side*5.925,3.5,z,this.stone);
      this.box(.35,3.7,.78,side*2.82,1.85,z);
      this.box(.6,.2,.94,side*2.82,3.7,z);
    }
    // Solid spandrel above a true arched opening.
    const shape=new THREE.Shape();shape.moveTo(-2.8,7);shape.lineTo(2.8,7);shape.lineTo(2.8,3.7);
    shape.absarc(0,3.7,2.8,0,Math.PI,false);shape.lineTo(-2.8,7);
    this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.55,bevelEnabled:false,curveSegments:32}),this.stone,0,0,z-.275);
    for(let i=0;i<19;i++) {const a=i*Math.PI/19,b=(i+1)*Math.PI/19;
      const s=new THREE.Shape();s.absarc(0,0,3.07,a,b,false);s.absarc(0,0,2.79,b,a,true);s.closePath();
      this.mesh(new THREE.ExtrudeGeometry(s,{depth:.83,bevelEnabled:false,curveSegments:2}),i%2?this.trim:this.stone,0,3.7,z-.415);
    }
    this.box(.42,.64,1.02,0,6.62,z,this.trim);
  }
  private urn(x:number,z:number) {
    this.box(2.2,.18,2.2,x,.09,z,this.stone);this.box(1.75,.18,1.75,x,.25,z);
    this.box(1.48,1.12,1.48,x,.9,z,this.stone);this.box(1.8,.18,1.8,x,1.53,z);
    const points=[[.0,0],[.43,0],[.44,.13],[.25,.2],[.23,.35],[.54,.58],[.64,.93],[.58,1.2],[.36,1.4],[.35,1.52],[.56,1.59],[.56,1.69],[.4,1.7]].map(p=>new THREE.Vector2(...p as [number,number]));
    this.mesh(new THREE.LatheGeometry(points,32),this.stone,x,1.62,z);
    for(const side of [-1,1]) {const t=new THREE.TorusGeometry(.31,.055,8,24);this.mesh(t,this.brass,x+side*.57,2.7,z);}
  }
  private build() {
    const darkTile=new THREE.MeshStandardMaterial({color:0x485044,roughness:.34,metalness:.1,map:this.marbleTexture()});
    const lightTile=new THREE.MeshStandardMaterial({color:0xded7c3,roughness:.4,map:this.marbleTexture()});
    const darkWood=new THREE.MeshStandardMaterial({color:0x3d3027,roughness:.7});
    const leather=new THREE.MeshStandardMaterial({color:0x43584a,roughness:.75});
    const glow=new THREE.MeshBasicMaterial({color:0xfff3d7});
    for(let r=0;r<4;r++) {
      const z=-22*r;
      const wall=new THREE.MeshStandardMaterial({color: [0x647666,0x637b7b,0x82725d,0x686b84][r],roughness:.88});
      this.box(18,.2,22,0,-.14,z,this.stone);
      for(let x=0;x<12;x++) for(let zz=0;zz<14;zz++) this.box(1.47,.025,1.54,-8.25+x*1.5,0,z-10.04+zz*1.55,(x+zz)%2?darkTile:lightTile);
      for(const side of [-1,1]) {
        this.box(.55,7,22,side*9,3.5,z,wall);
        this.box(.18,1.2,22,side*8.67,.63,z,this.stone);
        for(const [y,h,w] of [[.12,.18,.25],[1.26,.1,.28],[1.4,.06,.2],[5.95,.16,.4],[6.18,.16,.58],[6.43,.2,.75],[6.62,.1,.83]])this.box(w,h,22,side*(8.75-w/2),y,z);
        this.box(.1,.04,22,side*7.7,.032,z,this.brass);
        for(const az of [-8.4,8.4])this.column(side*6.7,z+az);
        // Raised wall panels and dentil cornice.
        for(const az of [-6.9,-2.3,2.3,6.9]) {
          this.box(.07,.055,3.9,side*8.67,1.72,z+az,this.trim);
          this.box(.07,.055,3.9,side*8.67,5.47,z+az,this.trim);
          for(const dz of [-1.95,1.95])this.box(.07,3.75,.055,side*8.67,3.595,z+az+dz,this.trim);
        }
        for(let k=0;k<44;k++)this.box(.22,.17,.17,side*8.37,6.35,z-10.75+k*.5);
        // Reading bench.
        this.box(1,.25,3.3,side*4.2,.71,z+1,leather);
        for(const dz of [-1.35,1.35])for(const dx of [-.34,.34])this.box(.1,.58,.1,side*4.2+dx,.31,z+1+dz,darkWood);
      }
      // Coffered roof with a luminous central clerestory.
      for(let x=0;x<6;x++)for(let zz=0;zz<7;zz++) {
        const cx=-7.5+x*3,cz=z-9.4+zz*3.12;
        const skylight=x===2||x===3;
        this.box(2.85,.12,2.96,cx,7.07,cz,skylight?glow:this.stone);
        this.box(3,.27,.12,cx,6.91,cz-1.5);this.box(.12,.27,3.1,cx-1.5,6.91,cz);
        this.box(2.62,.065,.065,cx,6.88,cz-1.32,this.brass);this.box(.065,.065,2.68,cx-1.31,6.88,cz,this.brass);
        if(!skylight)this.mesh(new THREE.SphereGeometry(.14,8,6),this.trim,cx,6.94,cz);
      }
      this.urn(0,z);
      const fill=new THREE.PointLight(0xffe8c4,34,24,2);fill.position.set(0,5.9,z);this.scene.add(fill);
      for(const side of [-1,1])for(const az of [-4.6,4.6]) {
        this.box(.2,.42,.18,side*8.45,3.45,z+az,this.brass);
        this.box(.44,.06,.15,side*8.23,3.68,z+az,this.brass);
        this.mesh(new THREE.SphereGeometry(.12,12,8),glow,side*8.12,3.95,z+az);
      }
      this.galleries.push(new THREE.Group());this.scene.add(this.galleries[r]);
      this.label(this.exhibitions[r]?.titleEn.toUpperCase()||'FAB DAO',0,6.72,z-10.65,0,4,.23,'#584b36','transparent',this.scene);
      if(r<3)this.arch(z-11);
    }
    this.box(18,7,.4,0,3.5,10.8,this.stone);this.box(18,7,.4,0,3.5,-77,this.stone);
    this.label('F A B   D A O',0,4.3,-76.73,0,6,1.2,'#5c4b31','#d5cbb7',this.scene);
  }
  private label(text:string,x:number,y:number,z:number,ry:number,w:number,h:number,color:string,bg:string,parent:THREE.Object3D) {
    const c=document.createElement('canvas');c.width=1024;c.height=Math.max(64,Math.round(1024*h/w));
    const ctx=c.getContext('2d')!;
    if(bg!=='transparent'){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);}
    ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.min(64,c.height*.48)}px Georgia, "Noto Serif TC", serif`;
    ctx.fillText(text,512,c.height/2,970);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,toneMapped:false});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.position.set(x,y,z);mesh.rotation.y=ry;parent.add(mesh);return mesh;
  }
  displayRoom(index:number,artworks:Artwork[],documents:DocumentItem[]) {
    const group=this.galleries[index];
    const version=++this.roomVersions[index];
    this.hovered=null;this.onHover(null);
    this.targets=this.targets.filter(m=>!group.children.includes(m));
    group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const m=o.material as THREE.MeshBasicMaterial;if(m.map)m.map.dispose();m.dispose();}});group.clear();
    const pieces:Array<Artwork|DocumentItem>=[...artworks.slice(0,8)];
    const rz=-index*22;
    pieces.forEach((item,i)=> {
      const side=i<4?-1:1,z=rz+6.9-(i%4)*4.6,ry=side<0?Math.PI/2:-Math.PI/2;
      const frame=new THREE.Group();frame.position.set(side*8.37,3.65,z);frame.rotation.y=ry;group.add(frame);
      const w=2.8,h=2.6;
      const backing=new THREE.Mesh(new THREE.BoxGeometry(w+.3,h+.3,.12),new THREE.MeshStandardMaterial({color:0x3d3122,roughness:.8}));frame.add(backing);
      for(const [extra,depth,width,col] of [[.28,.13,.11,0xa98749],[.12,.19,.045,0xd3b879],[0,.2,.035,0x8c6834]]) {
        const mat=new THREE.MeshStandardMaterial({color:col,metalness:.65,roughness:.35});
        for(const s of [-1,1]){const b=new THREE.Mesh(new THREE.BoxGeometry(w+extra,width,depth),mat.clone());b.position.set(0,s*(h+extra)/2,.04);frame.add(b);
          const v=new THREE.Mesh(new THREE.BoxGeometry(width,h+extra,depth),mat.clone());v.position.set(s*(w+extra)/2,0,.04);frame.add(v);}
      }
      const artMat=new THREE.MeshBasicMaterial({color:0xeee8d8,toneMapped:false});
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(w-.1,h-.1),artMat);plane.position.set(side*8.22,3.65,z);plane.rotation.y=ry;plane.userData.item=item;group.add(plane);this.targets.push(plane);
      if('image' in item && typeof item.image==='string' && item.image) {
        this.loader.load(item.image,(t)=>{if(version!==this.roomVersions[index]){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;const ratio=t.image.width/t.image.height;
          const ww=ratio>1?w-.12:(h-.12)*ratio,hh=ratio>1?(w-.12)/ratio:h-.12;
          plane.geometry.dispose();plane.geometry=new THREE.PlaneGeometry(ww,hh);artMat.map=t;artMat.color.set(0xffffff);artMat.needsUpdate=true;
        },undefined,()=>{if(version!==this.roomVersions[index])return;this.label('影像暫時無法載入',0,0,.2,0,w-.1,h-.1,'#665944','#e8dfcd',frame);});
      } else {
        const doc=item as DocumentItem;
        this.label('F A B   D A O   /   A R C H I V E',0,.72,.13,0,2.5,.28,'#796448','#e8dfcd',frame);
        this.label(item.title,0,.05,.13,0,2.5,.9,'#3b463c','#e8dfcd',frame);
        this.label(doc.date||'公共文件 · 點擊閱讀',0,-.82,.13,0,2.5,.25,'#796448','#e8dfcd',frame);
      }
      this.label(item.title,side*8.28,1.98,z,ry,3.6,.24,'#3a352c','#e0d5bd',group);
      const artist='artist' in item?String(item.artist):'FAB DAO · 文獻展件';
      this.label(artist,side*8.28,1.76,z,ry,3.6,.16,'#5a5142','#e0d5bd',group);
    });
    // Each room has permanent document panels beside the arch, independent of the art rotation.
    documents.forEach((doc,i)=> {
      const side=i%2===0?-1:1,x=side*5.25,z=rz-10.54,y=4.15-Math.floor(i/2)*1.17;
      const backing=new THREE.Mesh(new THREE.BoxGeometry(3.4,1.05,.10),new THREE.MeshStandardMaterial({color:0xd9ceb5,roughness:.8}));
      backing.position.set(x,y,z);group.add(backing);
      const heading=this.label(doc.title,x,y+.22,z+.07,0,3.15,.25,'#354b3d','#e4dac5',group);
      heading.userData.item=doc;this.targets.push(heading);
      this.label('文獻檔案  /  點擊閱讀',x,y-.03,z+.07,0,3.15,.17,'#8a744e','#e4dac5',group);
      const hit=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.05),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
      hit.position.set(x,y,z+.08);hit.userData.item=doc;group.add(hit);this.targets.push(hit);
    });
  }
  private bind() {
    window.addEventListener('resize',()=>this.resize());
    window.addEventListener('blur',()=>this.keys.clear());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.keys.clear();});
    document.addEventListener('pointerlockchange',()=>this.keys.clear());
    window.addEventListener('keydown',e=> {
      if(!this.active||this.paused||(e.target instanceof Element&&e.target.closest('input,select,textarea,[contenteditable="true"]')))return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}
      if(e.code==='Enter'&&this.hovered&&!(e.target instanceof Element&&e.target.closest('button,a')))this.onInspect(this.hovered);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    this.renderer.domElement.addEventListener('pointerdown',e=>{if(!this.active||this.paused)return;this.drag=true;this.dragged=false;if(e.button===0)this.renderer.domElement.setPointerCapture(e.pointerId);});
    window.addEventListener('pointerup',()=>{this.drag=false;});
    window.addEventListener('mousemove',e=> {
      if(!this.active||this.paused)return;
      if(document.pointerLockElement===this.renderer.domElement||this.drag){
        if(Math.abs(e.movementX)+Math.abs(e.movementY)>2)this.dragged=true;
        this.yaw-=e.movementX*.002;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.002,-1.05,1.05);this.look();
      }
    });
    this.renderer.domElement.addEventListener('click',e=>{
      if(!this.active||this.paused||this.dragged)return;
      if(document.pointerLockElement){if(this.hovered)this.onInspect(this.hovered);return;}
      const rect=this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);
      const hit=this.raycaster.intersectObjects(this.currentTargets())[0];if(hit&&hit.distance<14)this.onInspect(hit.object.userData.item);
    });
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.renderer.setAnimationLoop(null);this.onContextLost();});
  }
  start() {this.active=true;this.camera.position.set(2.7,1.72,7.7);this.yaw=.18;this.pitch=0;this.look();}
  setPaused(value:boolean){this.paused=value;this.keys.clear();if(value&&document.pointerLockElement)document.exitPointerLock();}
  async lock(){try{await this.renderer.domElement.requestPointerLock();}catch{ /* Drag and keyboard remain available. */ }}
  teleport(index:number){this.keys.clear();this.camera.position.set(2.7,1.72,7.7-index*22);this.yaw=.18;this.pitch=0;this.look();this.setRoom(index);}
  setQuality(value:string){this.quality=value;this.renderer.setPixelRatio(Math.min(devicePixelRatio,value==='high'?2:value==='low'?1:1.5));this.renderer.shadowMap.enabled=value!=='low';this.ao.enabled=value!=='low';this.resize();}
  private setRoom(index:number){if(index===this.room)return;this.room=index;this.sun.position.z=5-index*22;this.sun.target.position.z=-5-index*22;this.onRoom(index);}
  private look(){this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');}
  private currentTargets(){return this.targets.filter(t=>t.parent===this.galleries[this.room]);}
  private resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(w,h);}
  private render=(time:number)=>{
    const realDt=(time-this.last)/1000||.016;const dt=Math.min(realDt,.05);this.last=time;
    if(document.hidden)return;
    if(this.active&&!this.paused){
      const forward=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'));
      const strafe=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'));
      this.yaw+=(Number(this.keys.has('ArrowLeft')||this.keys.has('KeyQ'))-Number(this.keys.has('ArrowRight')||this.keys.has('KeyE')))*dt*1.3;
      if(forward||strafe){const len=Math.hypot(forward,strafe),speed=(this.keys.has('ShiftLeft')?5:2.8)*dt;
        const dx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*strafe)/len*speed;
        const dz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*strafe)/len*speed;
        const next=moveWithCollision(this.camera.position,dx,dz);this.camera.position.x=next.x;this.camera.position.z=next.z;this.setRoom(roomAt(next.z));
      }
      this.look();
      this.raycaster.setFromCamera(new THREE.Vector2(0,0),this.camera);
      const hit=this.raycaster.intersectObjects(this.currentTargets())[0];const item=hit&&hit.distance<10?hit.object.userData.item:null;
      if(item!==this.hovered){this.hovered=item;this.onHover(item);}
    }
    this.composer.render();
    this.elapsed+=realDt;this.frameCount++;if(this.elapsed>2){this.onStats(Math.round(this.frameCount/this.elapsed));this.elapsed=0;this.frameCount=0;}
  };
}
