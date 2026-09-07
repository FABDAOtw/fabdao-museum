import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { moveWithCollision, canStand, roomAt, roomCapacity, artworkSlot, artworkDimensions, roomFurniture, safeViewpoint, EYE_HEIGHT } from './navigation.js';
import { pointerLookDelta, clampSensitivity } from './controls.js';
import { qualityProfile, adjacentRooms, shouldRefreshShadow, shouldDrawFrame } from './performance.js';
import type { Artwork, Exhibition, DocumentItem } from './types';

const cream = 0xd2c4a8, gold = 0xa88345;
const up = new THREE.Vector3(0, 1, 0);
const GREEN_SOFA_ID = 'tezos_KT1AFq5XorPduoYyWxs5gEyrFK6fVjJVbtCj_25336';
type ViewingPoint = { item: Artwork | DocumentItem; room: number; target: THREE.Vector3; normal: THREE.Vector3; distance: number };
function disposeObject(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  group.traverse(object => { if (object instanceof THREE.Mesh) {
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  }});
  textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
  group.clear();return textures;
}
export class Museum {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, .08, 120);
  renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private ao: SSAOPass | null = null;
  keys = new Set<string>();
  active = false;
  paused = false;
  yaw = .18;
  pitch = -.04;
  room = 0;
  quality = 'balanced';
  private last = 0;
  private animationFrame = 0;
  private contextLost = false;
  private needsRender = true;
  private needsShadow = true;
  private hoverDirty = true;
  private lastRaycast = 0;
  private lastShadowZ = NaN;
  private controls = { sensitivity: 1, invertY: false };
  private pointerPosition: { x: number; y: number; id: number } | null = null;
  private dragDistance = 0;
  private architecture: THREE.Group[] = [];
  private roomTargets: THREE.Mesh[][] = [[],[],[],[]];
  private renderStats = { frames: 0, skippedFrames: 0, drawCalls: 0, triangles: 0, frameCpuMs: 0, fps: 0, raycasts: 0, shadowUpdates: 0, sceneTriangles: 0 };
  private elapsed = 0;
  private frameCount = 0;
  private hovered: Artwork | DocumentItem | null = null;
  private targets: THREE.Mesh[] = [];
  private roomVersions = [0,0,0,0];
  private viewPoints = new Map<string, ViewingPoint>();
  private abort = new AbortController();
  private disposed = false;
  private environmentTarget: THREE.WebGLRenderTarget;
  private modelLoader = new GLTFLoader();
  private raycaster = new THREE.Raycaster();
  private drag = false;
  private dragged = false;
  private batch = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private galleries: THREE.Group[] = [];
  private sun: THREE.DirectionalLight;
  private loader = new THREE.TextureLoader();
  onInspect: (item: Artwork | DocumentItem) => void = () => {};
  onRoom: (index: number) => void = () => {};
  onMove: () => void = () => {};
  onHover: (item: Artwork | DocumentItem | null) => void = () => {};
  onStats: (fps: number) => void = () => {};
  onContextLost: () => void = () => {};
  private stone: THREE.MeshStandardMaterial;
  private trim: THREE.MeshStandardMaterial;
  private brass: THREE.MeshStandardMaterial;

  private text(zh:string,en:string){return this.locale==='en'?en:zh;}

  constructor(private container: HTMLElement, private exhibitions: Exhibition[], private locale: 'zh-TW' | 'en' = 'zh-TW') {
    this.render=this.render.bind(this);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(qualityProfile('balanced', devicePixelRatio).pixelRatio);
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.tabIndex=0;
    this.renderer.domElement.setAttribute('aria-label', this.text('可移動的三維美術館。可使用展間地圖與館藏目錄瀏覽。','Walkable 3D museum. You can also use the gallery map and collection catalogue.'));
    container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xddd4bf);
    this.scene.fog = new THREE.Fog(0xd2c7b3, 28, 52);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(envScene, .04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = .38;
    envScene.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe6edee, 0x77654d, 1.15));
    this.sun = new THREE.DirectionalLight(0xffecd0, 2.8);
    this.sun.position.set(-7, 13, 5); this.sun.target.position.set(3, 0, -5);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -16; this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 16; this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.camera.near = .5; this.sun.shadow.camera.far = 48;
    this.sun.shadow.bias = -.0005; this.sun.shadow.normalBias = .025;
    this.scene.add(this.sun, this.sun.target);
    this.stone = new THREE.MeshStandardMaterial({color: cream, roughness:.78, map:this.marbleTexture()});
    this.trim = new THREE.MeshStandardMaterial({color:0xe3d9bf, roughness:.64});
    this.brass = new THREE.MeshStandardMaterial({color:gold, metalness:.72, roughness:.42});
    this.build(); this.flush();
    this.camera.position.set(3.4, 2.15, 8.2);
    this.camera.rotation.order = 'YXZ';
    this.look();
    this.scene.updateMatrixWorld(true);
    this.scene.matrixWorldAutoUpdate=false;
    this.updateVisibility();this.countSceneTriangles();
    this.bind();this.resize();
  }
  private ensureComposer(){
    if(this.composer)return;
    this.composer=new EffectComposer(this.renderer);
    this.composer.renderTarget1.samples=2;this.composer.renderTarget2.samples=2;
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.ao=new SSAOPass(this.scene,this.camera,1,1,8);
    this.ao.kernelRadius=.24;this.ao.minDistance=.002;this.ao.maxDistance=.065;
    this.composer.addPass(this.ao);this.composer.addPass(new OutputPass());
  }
  private disposeComposer(){
    if(!this.composer)return;
    for(const pass of this.composer.passes)pass.dispose();this.composer.dispose();this.composer=null;this.ao=null;
  }
  private requestFrame(){
    if(this.animationFrame||this.disposed||this.contextLost||typeof document==='undefined'||document.hidden||typeof window.requestAnimationFrame!=='function')return;
    this.animationFrame=window.requestAnimationFrame(this.render);
  }
  private invalidate(shadow=false){this.needsRender=true;this.needsShadow=this.needsShadow||shadow;this.requestFrame();}
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
  private flush(parent:THREE.Object3D=this.scene) {
    for(const [material,geometries] of this.batch) {
      const geometry=mergeGeometries(geometries); if(!geometry)continue;
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=!(material instanceof THREE.MeshBasicMaterial);mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;parent.add(mesh);
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
  private build() {
    const darkTile=new THREE.MeshStandardMaterial({color:0xa9aa9d,roughness:.52,metalness:.02,map:this.marbleTexture()});
    const lightTile=new THREE.MeshStandardMaterial({color:0xd3cdbc,roughness:.58,map:this.marbleTexture()});
    const darkWood=new THREE.MeshStandardMaterial({color:0x4f3b2d,roughness:.66});
    const leather=new THREE.MeshStandardMaterial({color:0x555e4f,roughness:.85});
    const glow=new THREE.MeshBasicMaterial({color:0xfff3d7});
    for(let r=0;r<4;r++) {
      const z=-22*r;
      const roomArchitecture=new THREE.Group();roomArchitecture.name=`architecture-${r}`;
      this.architecture.push(roomArchitecture);this.scene.add(roomArchitecture);
      const wall=new THREE.MeshStandardMaterial({color: [0x6f7b77,0x7b8a7c,0x947e69,0x8a8790][r],roughness:.88});
      this.box(18,.2,22,0,-.14,z,this.stone);
      for(let x=0;x<12;x++) for(let zz=0;zz<14;zz++) this.box(1.47,.025,1.54,-8.25+x*1.5,0,z-10.04+zz*1.55,(x+zz)%2?darkTile:lightTile);
      for(const side of [-1,1]) {
        this.box(.55,7,22,side*9,3.5,z,wall);
        this.box(.18,.72,22,side*8.67,.39,z,this.stone);
        for(const [y,h,w] of [[.12,.18,.25],[.78,.1,.28],[.89,.045,.2],[5.95,.16,.4],[6.18,.16,.58],[6.43,.2,.75],[6.62,.1,.83]])this.box(w,h,22,side*(8.75-w/2),y,z);
        this.box(.045,.022,22,side*7.7,.022,z,this.brass);
        for(const az of [-8.4,8.4])this.column(side*6.7,z+az);
        // Raised wall panels and dentil cornice.
        for(const az of [-6.9,-2.3,2.3,6.9]) {
          this.box(.07,.055,3.9,side*8.67,.98,z+az,this.trim);
          this.box(.07,.055,3.9,side*8.67,5.12,z+az,this.trim);
          for(const dz of [-1.95,1.95])this.box(.07,4.14,.055,side*8.67,3.05,z+az+dz,this.trim);
        }
        for(let k=0;k<44;k++)this.box(.22,.17,.17,side*8.37,6.35,z-10.75+k*.5);

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
      // Different furniture and clear floor areas make each gallery legible.
      for(const furniture of roomFurniture(r)) {
        if(furniture.kind==='artwork') continue;
        const table=furniture.kind==='table',height=table?.91:.52;
        this.mesh(new RoundedBoxGeometry(furniture.width,.14,furniture.depth,2,.045),table?darkWood:leather,furniture.x,height,furniture.z);
        for(const dx of [-furniture.width/2+.18,furniture.width/2-.18])for(const dz of [-furniture.depth/2+.16,furniture.depth/2-.16])
          this.box(.12,height-.06,.12,furniture.x+dx,(height-.06)/2,furniture.z+dz,darkWood);
        this.contactShadow(furniture.x,furniture.z,furniture.width+.35,furniture.depth+.4,roomArchitecture);
        if(table) this.label(r===1?this.text('群島閱讀桌  ·  文獻與出版','Archipelago reading table · Documents and publications'):this.text('共同閱讀桌  ·  從文件理解收藏','Shared reading table · Understanding the collection'),furniture.x,.72,furniture.z+furniture.depth/2+.015,0,furniture.width-.3,.15,'#d7c6a3','#4f3b2d',roomArchitecture);
      }
      const fill=new THREE.PointLight(0xffe8c4,34,24,2);fill.position.set(0,5.9,z);roomArchitecture.add(fill);
      for(const side of [-1,1])for(const az of [-4.6,4.6]) {
        this.box(.2,.42,.18,side*8.45,3.45,z+az,this.brass);
        this.box(.44,.06,.15,side*8.23,3.68,z+az,this.brass);
        this.mesh(new THREE.SphereGeometry(.12,12,8),glow,side*8.12,3.95,z+az);
      }
      this.galleries.push(new THREE.Group());this.scene.add(this.galleries[r]);
      this.label(this.exhibitions[r]?.titleEn.toUpperCase()||'FAB DAO',0,6.72,z-10.65,0,4,.23,'#584b36','transparent',roomArchitecture);
      if(r<3)this.arch(z-11);
      this.flush(roomArchitecture);
    }
    this.box(18,7,.4,0,3.5,10.8,this.stone);this.flush(this.architecture[0]);
    this.box(18,7,.4,0,3.5,-77,this.stone);this.flush(this.architecture[3]);
    this.label('F A B   D A O',0,4.3,-76.73,0,6,1.2,'#5c4b31','#d5cbb7',this.architecture[3]);
  }
  private label(text:string,x:number,y:number,z:number,ry:number,w:number,h:number,color:string,bg:string,parent:THREE.Object3D,alwaysOnTop=false) {
    const c=document.createElement('canvas');c.width=1024;c.height=Math.max(64,Math.round(1024*h/w));
    const ctx=c.getContext('2d')!;
    if(bg!=='transparent'){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);}
    ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';const lines=text.split('\n'),lineHeight=c.height/lines.length;
    ctx.font=`${Math.min(64,lineHeight*.52)}px Georgia, "Noto Serif TC", serif`;
    lines.forEach((line,index)=>ctx.fillText(line,512,lineHeight*(index+.5),970));
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,toneMapped:false,depthTest:!alwaysOnTop,depthWrite:!alwaysOnTop});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.position.set(x,y,z);mesh.rotation.y=ry;
    // Artwork plaques intersect the architectural base moulding at the lower edge
    // of the wall. Keep the plaque readable while preserving the moulding everywhere
    // else; this is intentionally limited to labels attached to displayed works.
    if(alwaysOnTop)mesh.renderOrder=20;
    parent.add(mesh);return mesh;
  }
  private contactShadow(x:number,z:number,width:number,depth:number,parent:THREE.Object3D) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const context=canvas.getContext('2d')!,gradient=context.createRadialGradient(64,64,12,64,64,64);
    gradient.addColorStop(0,'rgba(42,34,24,.2)');gradient.addColorStop(.65,'rgba(42,34,24,.12)');gradient.addColorStop(1,'rgba(42,34,24,0)');
    context.fillStyle=gradient;context.fillRect(0,0,128,128);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,toneMapped:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.021,z);parent.add(mesh);
  }
  private async loadTexture(url:string):Promise<THREE.Texture> {
    return new Promise((resolve,reject)=>{
      let finished=false;
      const timer=window.setTimeout(()=>{finished=true;reject(new Error('作品預覽載入逾時'));},20000);
      this.loader.load(url,texture=>{
        if(finished){texture.dispose();return;}
        finished=true;clearTimeout(timer);
        if(this.disposed){texture.dispose();reject(new DOMException('展館已關閉','AbortError'));return;}
        texture.colorSpace=THREE.SRGBColorSpace;
        const original=texture.image as HTMLImageElement;
        texture.userData.sourceWidth=original.width;texture.userData.sourceHeight=original.height;
        // The reading panel uses the full original preview. A wall texture needs fewer texels.
        const largest=Math.max(original.width,original.height);
        if(largest>768){
          const canvas=document.createElement('canvas');canvas.width=Math.round(original.width*768/largest);canvas.height=Math.round(original.height*768/largest);
          const context=canvas.getContext('2d');if(context){context.drawImage(original,0,0,canvas.width,canvas.height);(texture as THREE.Texture<TexImageSource>).image=canvas;texture.needsUpdate=true;}
        }
        texture.anisotropy=Math.min(2,this.renderer.capabilities.getMaxAnisotropy());resolve(texture);
      },undefined,()=>{if(!finished){finished=true;clearTimeout(timer);reject(new Error('作品預覽暫時無法載入'));}});
    });
  }
  private async loadSofa():Promise<THREE.Group|null> {
    return new Promise(resolve=>{
      let finished=false;
      const timer=window.setTimeout(()=>{finished=true;resolve(null);},18000);
      this.modelLoader.load('/media/green-sofa.glb',gltf=>{
        if(finished){disposeObject(gltf.scene);return;}
        finished=true;clearTimeout(timer);
        if(this.disposed){disposeObject(gltf.scene);resolve(null);return;}
        resolve(gltf.scene);
      },undefined,()=>{if(!finished){finished=true;clearTimeout(timer);resolve(null);}});
    });
  }
  private batchGalleryFrames(group:THREE.Group){
    group.updateMatrixWorld(true);
    const batches=new Map<string,{material:THREE.MeshStandardMaterial;meshes:THREE.Mesh[]}>();
    group.traverse(object=>{
      if(!(object instanceof THREE.Mesh)||object.userData.item||!(object.material instanceof THREE.MeshStandardMaterial)||object.material.map)return;
      const material=object.material;
      const key=[material.color.getHex(),material.roughness,material.metalness,object.castShadow,object.receiveShadow].join(':');
      const batch=batches.get(key)||{material,meshes:[]};batch.meshes.push(object);batches.set(key,batch);
    });
    for(const {material,meshes} of batches.values()){
      if(meshes.length<2)continue;
      const geometries=meshes.map(mesh=>{
        let geometry=mesh.geometry.clone();if(geometry.index){const original=geometry;geometry=geometry.toNonIndexed();original.dispose();}
        return geometry.applyMatrix4(mesh.matrixWorld);
      });
      const merged=mergeGeometries(geometries);geometries.forEach(geometry=>geometry.dispose());if(!merged)continue;
      const frameMesh=new THREE.Mesh(merged,material);frameMesh.castShadow=meshes[0].castShadow;frameMesh.receiveShadow=meshes[0].receiveShadow;frameMesh.matrixAutoUpdate=false;group.add(frameMesh);
      const obsoleteMaterials=new Set<THREE.Material>();
      for(const mesh of meshes){if(mesh.material!==material)obsoleteMaterials.add(mesh.material as THREE.Material);mesh.removeFromParent();mesh.geometry.dispose();}
      obsoleteMaterials.forEach(unused=>unused.dispose());
    }
  }
  private updateVisibility(){
    const visible=adjacentRooms(this.room);
    this.galleries.forEach((gallery,index)=>gallery.visible=visible.includes(index));
    this.architecture?.forEach((architecture,index)=>architecture.visible=visible.includes(index));
    this.needsShadow=true;
  }
  private countSceneTriangles(){
    let count=0;this.scene.traverse(object=>{if(object instanceof THREE.Mesh)count+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;});
    if(this.renderStats)this.renderStats.sceneTriangles=count;
  }
  async displayRoom(index:number,artworks:Artwork[],documents:DocumentItem[]):Promise<void> {
    if(this.disposed||!this.galleries[index])throw new Error('展廳不存在');
    const version=++this.roomVersions[index],pieces=artworks.slice(0,roomCapacity(index));
    // Load a complete replacement before removing any currently visible work.
    const textures=await Promise.allSettled(pieces.map(item=>item.image?this.loadTexture(item.image):Promise.resolve(null)));
    const loaded=textures.flatMap(result=>result.status==='fulfilled'&&result.value?[result.value]:[]);
    if(this.disposed||version!==this.roomVersions[index]||textures.some(result=>result.status==='rejected')){
      loaded.forEach(texture=>texture.dispose());
      if(this.disposed||version!==this.roomVersions[index])throw new DOMException('較新的換展已取代本次請求','AbortError');
      throw new Error('部分作品預覽未能載入，保留原展牆，請再試一次。');
    }
    const next=new THREE.Group(),nextTargets:THREE.Mesh[]=[],nextPoints=new Map<string,ViewingPoint>();
    const rz=-index*22;
    try {
      for(let i=0;i<pieces.length;i++) {
        const item=pieces[i],result=textures[i],texture=result.status==='fulfilled'?result.value:null;
        const image=texture?.image as {width:number;height:number}|undefined;
        const {width:w,height:h}=artworkDimensions(Number(texture?.userData.sourceWidth??image?.width??1),Number(texture?.userData.sourceHeight??image?.height??1),index);
        const slot=artworkSlot(index,i),frame=new THREE.Group();
        frame.position.set(slot.x,slot.y,slot.z);frame.rotation.y=slot.rotation;next.add(frame);
        const backing=new THREE.Mesh(new RoundedBoxGeometry(w+.18,h+.18,.105,2,.012),new THREE.MeshStandardMaterial({color:0x3d3122,roughness:.82}));frame.add(backing);
        for(const [extra,depth,width,col] of [[.13,.09,.07,0x987a47],[.025,.13,.022,0xc7ac70]]) {
          const mat=new THREE.MeshStandardMaterial({color:col,metalness:.7,roughness:.4});
          for(const sign of [-1,1]) {
            const horizontal=new THREE.Mesh(new RoundedBoxGeometry(w+extra+width,width,depth,1,.008),mat);
            horizontal.position.set(0,sign*(h+extra)/2,.055);frame.add(horizontal);
            const vertical=new THREE.Mesh(new RoundedBoxGeometry(width,h+extra,depth,1,.008),mat);
            vertical.position.set(sign*(w+extra)/2,0,.055);frame.add(vertical);
          }
        }
        const artMat=new THREE.MeshBasicMaterial({color:texture?0xffffff:0xe6dfce,map:texture,toneMapped:false});
        const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),artMat);plane.position.z=.115;frame.add(plane);
        plane.userData.item=item;nextTargets.push(plane);
        frame.traverse(child=>{if(child instanceof THREE.Mesh){child.castShadow=child!==plane;child.receiveShadow=child!==plane;}});
        if(!texture)this.label(this.text('預覽待補  ·  點擊閱讀來源','Preview pending · Select to read the source'),0,0,.25,0,w,Math.min(h,.4),'#665944','#e6dfce',frame,true);
        const hint=typeof item.wallNote==='string'?item.wallNote:'';
        const credit=`${item.artist}${typeof item.mediumLabel==='string'?`  ·  ${item.mediumLabel}`:''}`;
        this.label([item.title,credit,...(hint?[hint]:[])].join('\n'),0,-h/2-(hint ? .31 : .245),.25,0,Math.max(w,2.45),hint ? .45 : .30,'#343a34','#dfd7c7',frame,true);
        nextPoints.set(`${index}:${item.id}`,{item,room:index,target:new THREE.Vector3(slot.x-slot.side*.115,slot.y,slot.z),normal:new THREE.Vector3(-slot.side,0,0),distance:Math.max(2.7,w*1.25)});
      }
      // Documents are exactly the supplied curatorial selection, including cross-room references.
      const table=roomFurniture(index).find(furniture=>furniture.kind==='table');
      const uniqueDocuments=documents.filter((doc,i)=>documents.findIndex(other=>other.id===doc.id)===i);
      uniqueDocuments.forEach((doc,i)=>{
        const panel=new THREE.Group();next.add(panel);
        let panelWidth:number,panelHeight:number,normal:THREE.Vector3,distance:number;
        if(table) {
          const columns=Math.min(3,Math.max(1,uniqueDocuments.length)),row=Math.floor(i/columns),column=i%columns;
          panelWidth=(table.width-.35)/columns-.09;panelHeight=.8;
          panel.position.set(table.x+(column-(columns-1)/2)*(panelWidth+.09),1.2,table.z+.52-row*.88);
          panel.rotation.x=-Math.PI/3;
          normal=new THREE.Vector3(0,0,1);distance=row===0?2:2.85;
        } else {
          const side=i%2===0?-1:1,row=Math.floor(i/2);
          panelWidth=3.6;panelHeight=.86;
          panel.position.set(side*5.2,1.73+row*1.03,rz-10.48);normal=new THREE.Vector3(0,0,1);distance=2.8;
        }
        const base=new THREE.Mesh(new RoundedBoxGeometry(panelWidth,panelHeight,.055,2,.015),new THREE.MeshStandardMaterial({color:0xddd3bd,roughness:.88}));panel.add(base);
        this.label([doc.title,this.text('文獻  /  點擊閱讀','Document / Select to read'),doc.date||this.text('FAB DAO · 公開檔案','FAB DAO · Public archive')].join('\n'),0,0,.04,0,panelWidth-.1,.65,'#35493b','#e8e0d0',panel);
        const hit=new THREE.Mesh(new THREE.PlaneGeometry(panelWidth,panelHeight),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.z=.055;hit.userData.item=doc;panel.add(hit);nextTargets.push(hit);
        nextPoints.set(`${index}:${doc.id}`,{item:doc,room:index,target:panel.position.clone(),normal,distance});
      });
      const sofa=pieces.find(item=>item.id===GREEN_SOFA_ID);
      if(sofa) {
        const model=await this.loadSofa();
        if(!model){
          if(this.disposed||version!==this.roomVersions[index])throw new DOMException('展館已關閉或換展已更新','AbortError');
          throw new Error('3D 原作暫時無法載入，保留原展牆，請再試一次。');
        }
        if(model) {
          const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
          model.scale.multiplyScalar(Math.min(3.1/Math.max(size.x,size.z,.01),1.9/Math.max(size.y,.01)));
          const scaledBounds=new THREE.Box3().setFromObject(model),center=scaledBounds.getCenter(new THREE.Vector3());
          model.position.sub(new THREE.Vector3(center.x,scaledBounds.min.y,center.z));
          model.position.add(new THREE.Vector3(0,.04,rz+1));next.add(model);
          model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;object.userData.item=sofa;nextTargets.push(object);}});
          this.contactShadow(0,rz+1,3.65,3.65,next);
          this.label(this.text('你的第一個綠沙發  ·  原作 3D 模型','Your First Green Sofa · Original 3D model'),0,.21,rz+2.8,0,3.5,.16,'#444c3d','#dfd7c7',next);
          nextPoints.set(`${index}:${sofa.id}`,{item:sofa,room:index,target:new THREE.Vector3(0,.8,rz+1),normal:new THREE.Vector3(0,0,1),distance:3.4});
        }
      }
      if(this.disposed||version!==this.roomVersions[index])throw new DOMException('較新的換展已取代本次請求','AbortError');
      this.batchGalleryFrames(next);next.updateMatrixWorld(true);
      const previous=this.galleries[index];this.scene.add(next);this.galleries[index]=next;
      this.targets=this.targets.filter(target=>!this.belongsTo(target,previous)).concat(nextTargets);
      this.roomTargets??=[[],[],[],[]];this.roomTargets[index]=nextTargets;
      for(const [id,point] of this.viewPoints)if(point.room===index)this.viewPoints.delete(id);
      for(const [id,point] of nextPoints)this.viewPoints.set(id,point);
      previous.removeFromParent();disposeObject(previous);
      this.hovered=null;this.onHover(null);this.hoverDirty=true;this.updateVisibility();this.countSceneTriangles();this.invalidate(true);
    } catch(error) {const disposedTextures=disposeObject(next);loaded.filter(texture=>!disposedTextures.has(texture)).forEach(texture=>texture.dispose());throw error;}
  }
  private belongsTo(object:THREE.Object3D,parent:THREE.Object3D) {let current:THREE.Object3D|null=object;while(current){if(current===parent)return true;current=current.parent;}return false;}
  private focusItem(id:string,artwork:boolean):boolean {
    const point=this.viewPoints.get(`${this.room}:${id}`)||Array.from(this.viewPoints.values()).find(value=>value.item.id===id);if(!point||('artist' in point.item)!==artwork)return false;
    const position=safeViewpoint(point.target,point.normal,point.distance);if(!position)return false;
    this.keys.clear();this.camera.position.set(position.x,position.y,position.z);
    const direction=point.target.clone().sub(this.camera.position);
    this.yaw=Math.atan2(-direction.x,-direction.z);this.pitch=Math.atan2(direction.y,Math.hypot(direction.x,direction.z));
    this.look();this.setRoom(point.room);this.hovered=point.item;this.onHover(point.item);this.onMove();this.invalidate(true);return true;
  }
  restoreView(view:{position:{x:number;y?:number;z:number};yaw:number;pitch:number}):boolean{
    if(!view?.position||![view.position.x,view.position.z,view.yaw,view.pitch].every(Number.isFinite)||!canStand(view.position.x,view.position.z))return false;
    this.keys.clear();this.camera.position.set(view.position.x,EYE_HEIGHT,view.position.z);this.yaw=view.yaw;this.pitch=THREE.MathUtils.clamp(view.pitch,-1.05,1.05);
    this.look();this.setRoom(roomAt(view.position.z));this.invalidate(true);return true;
  }
  focusArtwork(id:string){return this.focusItem(id,true);}
  focusDocument(id:string){return this.focusItem(id,false);}
  getState(){
    const points=Array.from(this.viewPoints.values()),profile=qualityProfile(this.quality,typeof devicePixelRatio==='number'?devicePixelRatio:1);
    const width=this.renderer?.domElement.width??0,height=this.renderer?.domElement.height??0;
    return Object.freeze({room:this.room,position:Object.freeze({x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z}),yaw:this.yaw,pitch:this.pitch,active:this.active,paused:this.paused,quality:this.quality,
      controls:Object.freeze({...this.controls}),
      displayedArtworkIds:Object.freeze(points.filter(point=>'artist' in point.item).map(point=>point.item.id)),displayedDocumentIds:Object.freeze(points.filter(point=>!('artist' in point.item)).map(point=>point.item.id)),
      sunTargetZ:this.sun.target.position.z,renderedTargets:this.targets.length,
      renderStats:Object.freeze({...this.renderStats,visibleRooms:Object.freeze(adjacentRooms(this.room)),renderMode:profile.renderMode,dpr:this.renderer?.getPixelRatio?.()??profile.pixelRatio,
        aoWidth:this.ao?Math.max(1,Math.floor(width*.5)):0,aoHeight:this.ao?Math.max(1,Math.floor(height*.5)):0,shadowSize:profile.shadows?profile.shadowSize:0,
        drawWidth:width,drawHeight:height,geometries:this.renderer?.info.memory.geometries??0,textures:this.renderer?.info.memory.textures??0,wallTextureLimit:768,idle:!this.animationFrame&&!this.needsRender})});
  }
  setControlSettings(settings:Partial<{sensitivity:number;invertY:boolean}>){
    if(settings.sensitivity!==undefined)this.controls.sensitivity=clampSensitivity(settings.sensitivity);
    if(settings.invertY!==undefined)this.controls.invertY=!!settings.invertY;
  }
  private bind() {
    const options={signal:this.abort.signal};
    window.addEventListener('resize',()=>this.resize(),options);
    window.addEventListener('blur',()=>{this.keys.clear();this.drag=false;this.pointerPosition=null;},options);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.keys.clear();this.drag=false;this.pointerPosition=null;window.cancelAnimationFrame(this.animationFrame);this.animationFrame=0;}
      else this.invalidate();
    },options);
    document.addEventListener('pointerlockchange',()=>{this.keys.clear();this.drag=false;this.dragged=false;this.pointerPosition=null;},options);
    window.addEventListener('keydown',event=> {
      if(!this.active||this.paused||(event.target instanceof Element&&event.target.closest('input,select,textarea,[contenteditable="true"]')))return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','PageUp','PageDown','ShiftLeft','ShiftRight'].includes(event.code)){event.preventDefault();this.keys.add(event.code);this.requestFrame();}
      if(event.code==='Enter'&&this.hovered&&!(event.target instanceof Element&&event.target.closest('button,a'))){event.preventDefault();this.onInspect(this.hovered);}
    },options);
    window.addEventListener('keyup',event=>this.keys.delete(event.code),options);
    this.renderer.domElement.style.touchAction='none';
    this.renderer.domElement.addEventListener('pointerdown',event=>{
      if(!this.active||this.paused||event.button!==0)return;
      this.dragged=false;this.dragDistance=0;
      if(document.pointerLockElement===this.renderer.domElement)return;
      this.drag=true;this.pointerPosition={x:event.clientX,y:event.clientY,id:event.pointerId};this.renderer.domElement.setPointerCapture(event.pointerId);
    },options);
    window.addEventListener('pointerup',()=>{this.drag=false;this.pointerPosition=null;},options);
    this.renderer.domElement.addEventListener('pointercancel',()=>{this.drag=false;this.pointerPosition=null;},options);
    window.addEventListener('pointermove',event=> {
      if(!this.active||this.paused)return;
      const locked=document.pointerLockElement===this.renderer.domElement;
      let dx=0,dy=0;
      if(locked){
        // Absolute coordinates are fixed under Pointer Lock. Relative motion is only used here.
        dx=event.movementX;dy=event.movementY;
      } else if(this.drag&&this.pointerPosition?.id===event.pointerId){
        dx=event.clientX-this.pointerPosition.x;dy=event.clientY-this.pointerPosition.y;
        this.pointerPosition={x:event.clientX,y:event.clientY,id:event.pointerId};
        this.dragDistance+=Math.hypot(dx,dy);if(this.dragDistance>4)this.dragged=true;
      } else return;
      const delta=pointerLookDelta(dx,dy,{mode:locked?'locked':'drag',...this.controls});
      if(!delta.yaw&&!delta.pitch)return;
      this.yaw+=delta.yaw;this.pitch=THREE.MathUtils.clamp(this.pitch+delta.pitch,-1.05,1.05);this.look();this.onMove();
    },options);
    this.renderer.domElement.addEventListener('click',event=>{
      if(!this.active||this.paused||this.dragged)return;
      if(document.pointerLockElement){if(this.hovered)this.onInspect(this.hovered);return;}
      const rect=this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
      const hit=this.raycaster.intersectObjects(this.currentTargets(),false)[0];if(hit&&hit.distance<14)this.onInspect(hit.object.userData.item);
    },options);
    this.renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();this.contextLost=true;window.cancelAnimationFrame(this.animationFrame);this.animationFrame=0;this.onContextLost();
    },options);
  }
  start() {this.active=true;this.paused=false;this.camera.position.set(2.7,EYE_HEIGHT,7.7);this.yaw=.18;this.pitch=0;this.look();this.invalidate(true);}
  setPaused(value:boolean){
    this.paused=value;this.keys.clear();this.drag=false;this.pointerPosition=null;
    if(value&&document.pointerLockElement)void document.exitPointerLock();
    if(!value){this.hoverDirty=true;this.requestFrame();}
  }
  async lock(){try{await this.renderer.domElement.requestPointerLock();}catch{ /* Drag and keyboard remain available. */ }}
  setImmersive(value:boolean){if(value)void this.lock();else if(document.pointerLockElement===this.renderer.domElement)void document.exitPointerLock();}
  teleport(index:number){if(!Number.isInteger(index)||index<0||index>3)return;this.keys.clear();this.camera.position.set(2.7,EYE_HEIGHT,7.7-index*22);this.yaw=.18;this.pitch=0;this.look();this.setRoom(index);this.invalidate(true);}
  setQuality(value:string){
    const profile=qualityProfile(value,devicePixelRatio);this.quality=profile.quality;
    this.renderer.setPixelRatio(profile.pixelRatio);this.renderer.shadowMap.enabled=profile.shadows;
    if(this.sun.shadow.mapSize.x!==profile.shadowSize){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(profile.shadowSize,profile.shadowSize);}
    if(profile.renderMode==='ssao')this.ensureComposer();else this.disposeComposer();
    this.resize();this.invalidate(true);
  }
  private setRoom(index:number){if(index===this.room)return;this.room=index;this.hovered=null;this.onHover(null);this.updateVisibility();this.hoverDirty=true;this.invalidate(true);this.onRoom(index);}
  private look(){this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');this.camera.updateMatrixWorld(true);this.hoverDirty=true;this.invalidate();}
  private currentTargets(){return this.roomTargets?.[this.room]??this.targets.filter(target=>this.belongsTo(target,this.galleries[this.room]));}
  private resize(){
    const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight),ratio=qualityProfile(this.quality,devicePixelRatio).pixelRatio;
    this.renderer.setPixelRatio(ratio);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);
    if(this.composer){this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);this.ao?.setSize(Math.max(1,Math.floor(w*ratio*.5)),Math.max(1,Math.floor(h*ratio*.5)));}
    this.invalidate();
  }
  private render(time:number){
    this.animationFrame=0;
    if(this.disposed||this.contextLost||document.hidden)return;
    const gap=(time-this.last)/1000,dt=Math.min(gap||.016,.05);this.last=time;
    let moving=false;
    if(this.active&&!this.paused){
      const forward=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'));
      const strafe=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA'));
      const turn=Number(this.keys.has('ArrowLeft')||this.keys.has('KeyQ'))-Number(this.keys.has('ArrowRight')||this.keys.has('KeyE'));
      const tilt=Number(this.keys.has('PageUp'))-Number(this.keys.has('PageDown'));
      if(turn||tilt){this.yaw+=turn*dt*1.3;this.pitch=THREE.MathUtils.clamp(this.pitch+tilt*dt*.85,-1.05,1.05);moving=true;}
      if(forward||strafe){
        const len=Math.hypot(forward,strafe),speed=((this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'))?5:2.8)*dt;
        const dx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*strafe)/len*speed,dz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*strafe)/len*speed;
        const next=moveWithCollision(this.camera.position,dx,dz);
        if(next.x!==this.camera.position.x||next.z!==this.camera.position.z){moving=true;this.camera.position.x=next.x;this.camera.position.z=next.z;this.setRoom(roomAt(next.z));}
      }
      if(moving){this.look();this.onMove();}
      if(this.hoverDirty&&time-this.lastRaycast>=80){
        this.lastRaycast=time;this.hoverDirty=false;this.renderStats.raycasts++;
        this.raycaster.setFromCamera(new THREE.Vector2(0,0),this.camera);
        const hit=this.raycaster.intersectObjects(this.currentTargets(),false)[0],item=hit&&hit.distance<10?hit.object.userData.item:null;
        if(item!==this.hovered){this.hovered=item;this.onHover(item);}
      }
    }
    if(shouldDrawFrame({dirty:this.needsRender,hidden:document.hidden,disposed:this.disposed})){
      if(this.renderer.shadowMap.enabled&&shouldRefreshShadow(this.camera.position.z,this.lastShadowZ,this.needsShadow)){
        this.lastShadowZ=this.camera.position.z;this.needsShadow=false;
        const offset=Math.round((this.camera.position.z-7.7)*32)/32;
        this.sun.position.z=5+offset;this.sun.target.position.z=-5+offset;this.sun.updateMatrixWorld(true);this.sun.target.updateMatrixWorld(true);
        this.renderer.shadowMap.needsUpdate=true;this.renderStats.shadowUpdates++;
      }
      this.renderer.info.reset();const started=performance.now();
      if(this.composer&&this.quality==='high')this.composer.render();else this.renderer.render(this.scene,this.camera);
      this.needsRender=false;this.renderStats.frames++;this.renderStats.frameCpuMs=Math.round((performance.now()-started)*100)/100;
      this.renderStats.drawCalls=this.renderer.info.render.calls;this.renderStats.triangles=this.renderer.info.render.triangles;
      // Only contiguous rendered periods contribute to the movement FPS reading.
      if(gap>.25){this.elapsed=0;this.frameCount=0;}
      else {this.elapsed+=gap;this.frameCount++;}
      if(this.active&&!this.paused&&this.elapsed>=1){this.renderStats.fps=Math.round(this.frameCount/this.elapsed);this.onStats(this.renderStats.fps);this.elapsed=0;this.frameCount=0;}
    } else this.renderStats.skippedFrames++;
    const heldMovement=this.active&&!this.paused&&Array.from(this.keys).some(key=>!key.startsWith('Shift'));
    if(heldMovement||(this.active&&!this.paused&&this.hoverDirty))this.requestFrame();
  };
  dispose(){
    if(this.disposed)return;this.disposed=true;this.roomVersions=this.roomVersions.map(version=>version+1);
    this.abort.abort();this.keys.clear();window.cancelAnimationFrame(this.animationFrame);this.animationFrame=0;
    if(document.pointerLockElement===this.renderer.domElement)void document.exitPointerLock();
    this.disposeComposer();disposeObject(this.scene);this.environmentTarget.dispose();
    this.sun.shadow.dispose();this.renderer.dispose();this.renderer.domElement.remove();this.targets=[];this.viewPoints.clear();
  }

}
