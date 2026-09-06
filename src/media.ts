import type { Artwork } from './types';

export type MediaKind = 'interactive' | 'model' | 'video' | 'audio' | 'image' | 'unknown';
export type MediaState = 'idle' | 'loading' | 'open' | 'error' | 'disposed';
export type MediaSupport = {
  supported: boolean;
  kind: MediaKind;
  label: string;
  sourceUrl?: string;
  reason?: string;
  instructions?: string;
};
export type MediaOptions = { onStatus?: (state: MediaState, message: string) => void };
export type MediaHandle = { dispose: () => void; stop: () => void; getState: () => MediaState };

// The initial native-media programme is an explicit allowlist, not a general HTML player.
// Original HTML stays on its publisher's origin in an opaque sandbox. No source is
// rewritten, evaluated in the museum, or fetched before the visitor chooses to start.
const originals: Record<string, { kind: 'interactive' | 'model'; url: string; label: string; instructions: string }> = {
  ethereum_0x70270e65bc37832ef845fa330c2b71501970dab9_81: {
    kind: 'interactive',
    url: 'https://generator.artblocks.io/1/0x70270e65bc37832ef845fa330c2b71501970dab9/81',
    label: '即時生成・聲音',
    instructions: '影像隨運算持續變化。啟動後，點一下作品畫面開啟聲音，再點一下暫停聲音；關閉原作即可停止全部運算與聲音。',
  },
  tezos_KT19FqQ3V6gtkxNnFBhgXRqmMZ2zhiQz7zWa_86: {
    kind: 'interactive',
    url: 'https://ipfs.io/ipfs/bafybeigxp6h5ptxb6ihnfdd6zb2s4hpyzuhzllq4ifizrzuaopi7zeuxvy?iteration=60&seed=ec12ddd8e212bd36ecff435fe3cdd4893f96ef920f7d6a2663b851a936f8866b&seedGlobal=43d909af70f3e9f579cb5a4560a1c8b1&ts=1763290036',
    label: '互動繪圖',
    instructions: '點入作品後拖曳繪圖，按 1–4 選擇曲線、5 選擇準線，H 查看原作說明，R 回到原始狀態。互動完成後使用「關閉原作」返回預覽。',
  },
  tezos_KT1AFq5XorPduoYyWxs5gEyrFK6fVjJVbtCj_25336: {
    kind: 'model',
    url: 'https://ipfs.io/ipfs/QmbBgyhj7A4VhzhmqpfXRGqWBkXVdypicEAZPVToURn8Az',
    label: '3D 原作',
    instructions: '拖曳旋轉、滾輪縮放，也可使用下方按鈕。模型與材質來自原作者 GLB；此處的燈光和背景為本館展示設定。',
  },
};

export function getMediaKind(artwork: Artwork): MediaKind {
  if (originals[artwork.id]) return originals[artwork.id].kind;
  const mime = String(artwork.mediaType || '').toLowerCase();
  if (mime.startsWith('model/')) return 'model';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('html') || mime === 'application/x-directory') return 'interactive';
  if (mime.startsWith('image/')) return 'image';
  return 'unknown';
}

export function getMediaSupport(artwork: Artwork): MediaSupport {
  const original = originals[artwork.id];
  const kind = getMediaKind(artwork);
  if (!original) return { supported: false, kind, label: '作品來源', reason: '這件作品目前保留預覽與原作來源；館內原生展示仍待核對。' };
  if (artwork.artifactUrl !== original.url) {
    return { supported: false, kind, label: original.label, reason: '原作來源與已核對版本不同，暫時保留來源連結。' };
  }
  return { supported: true, kind, label: original.label, sourceUrl: original.url, instructions: original.instructions };
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** The returned handle MUST be disposed before replacing or closing the artwork panel. */
export function mountMedia(container: HTMLElement, artwork: Artwork, options: MediaOptions = {}): MediaHandle {
  const support = getMediaSupport(artwork);
  const root = element('section', 'native-media');
  root.setAttribute('aria-label', `${artwork.title}・原作觀看`);
  const stage = element('div', 'native-media-stage');
  stage.style.cssText = 'position:relative;min-height:300px;aspect-ratio:1/1;overflow:hidden;background:#161914;';
  const controls = element('div', 'native-media-controls');
  const startButton = element('button', 'primary native-media-start', support.kind === 'model' ? '開啟 3D 原作' : '啟動原作');
  startButton.type = 'button';
  const stopButton = element('button', 'native-media-stop', '關閉原作');
  stopButton.type = 'button';
  stopButton.hidden = true;
  const status = element('p', 'native-media-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const instructions = element('p', 'native-media-instructions', support.instructions || support.reason);
  const label = element('p', 'eyebrow', support.label);
  const modelControls = element('div', 'native-model-controls');
  controls.append(startButton, stopButton);
  if (support.sourceUrl) {
    const source = element('a', 'native-media-source', '在新分頁觀看原作 ↗');
    source.href = support.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    controls.append(source);
  }
  root.append(label, stage, controls, modelControls, instructions, status);
  container.replaceChildren(root);

  let state: MediaState = 'idle';
  let generation = 0;
  let cleanupActive = () => {};
  const update = (next: MediaState, message: string) => {
    state = next;
    status.textContent = message;
    options.onStatus?.(state, message);
  };
  const preview = () => {
    stage.replaceChildren();
    if (typeof artwork.image === 'string' && /^\/artworks\/[A-Za-z0-9._-]+$/.test(artwork.image)) {
      const image = element('img', 'native-media-preview');
      image.src = artwork.image;
      image.alt = `${artwork.title}・靜態預覽`;
      image.style.cssText = 'display:block;width:100%;height:100%;position:absolute;inset:0;object-fit:contain;';
      stage.append(image);
    }
  };
  const stop = () => {
    if (state === 'disposed') return;
    generation++;
    cleanupActive();
    cleanupActive = () => {};
    modelControls.replaceChildren();
    preview();
    startButton.hidden = !support.supported;
    startButton.disabled = false;
    stopButton.hidden = true;
    update('idle', support.supported ? '目前顯示靜態預覽。原作已關閉。' : support.reason || '');
  };
  const activate = () => {
    if (!support.supported || !support.sourceUrl || state === 'disposed' || state === 'loading' || state === 'open') return;
    const current = ++generation;
    const isCurrent = () => current === generation && state !== 'disposed';
    stage.replaceChildren();
    startButton.hidden = true;
    stopButton.hidden = false;
    update('loading', '正在開啟原作…');
    if (support.kind === 'interactive') {
      const frame = element('iframe', 'native-media-frame');
      frame.title = `${artwork.title}・互動原作`;
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.setAttribute('allow', 'autoplay; fullscreen');
      frame.referrerPolicy = 'no-referrer';
      frame.allowFullscreen = true;
      frame.style.cssText = 'display:block;width:100%;height:100%;position:absolute;inset:0;border:0;background:#161914;';
      const timer = window.setTimeout(() => {
        if (isCurrent()) status.textContent = '原作由外部來源載入。若畫面仍空白，可用「在新分頁觀看原作」。';
      }, 20000);
      // Cross-origin load cannot establish that the artwork successfully rendered.
      frame.onload = () => {
        if (!isCurrent()) return;
        window.clearTimeout(timer);
        update('open', '原作視窗已開啟。若未顯示作品，請在新分頁觀看原作。');
      };
      frame.onerror = () => {
        if (isCurrent()) update('error', '原作來源暫時無法載入，請改用原作連結。');
      };
      cleanupActive = () => {
        window.clearTimeout(timer);
        frame.onload = null;
        frame.onerror = null;
        frame.remove(); // Removing its browsing context also stops its Web Audio and script execution.
        frame.removeAttribute('src');
      };
      frame.src = support.sourceUrl;
      stage.append(frame);
    } else if (support.kind === 'model') {
      const abort = new AbortController();
      let releaseModel = () => {};
      cleanupActive = () => { abort.abort(); releaseModel(); };
      void createModelViewer(stage, modelControls, abort.signal, isCurrent).then(dispose => {
        if (!isCurrent()) { dispose(); return; }
        releaseModel = dispose;
        update('open', '3D 原作已載入，可旋轉與縮放觀看。');
      }).catch(() => {
        if (!isCurrent()) return;
        releaseModel();
        update('error', '3D 原作暫時無法載入。可以關閉後重試，或在新分頁觀看來源。');
      });
    }
  };
  startButton.addEventListener('click', activate);
  stopButton.addEventListener('click', () => { stop(); startButton.focus(); });
  preview();
  startButton.hidden = !support.supported;
  update('idle', support.supported ? '目前顯示靜態預覽。按下按鈕才會載入原作。' : support.reason || '');
  return {
    stop,
    getState: () => state,
    dispose() {
      if (state === 'disposed') return;
      generation++;
      cleanupActive();
      cleanupActive = () => {};
      root.remove();
      state = 'disposed';
    },
  };
}

async function createModelViewer(stage: HTMLElement, buttons: HTMLElement, signal: AbortSignal, isCurrent: () => boolean): Promise<() => void> {
  const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
    import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js'),
  ]);
  if (!isCurrent()) return () => {};
  const response = await fetch('/media/green-sofa.glb', { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('The original model could not be loaded.');
  const bytes = await response.arrayBuffer();
  if (!isCurrent()) return () => {};
  const manager = new THREE.LoadingManager();
  // The verified GLB is self-contained. Never follow external resources in a model.
  manager.setURLModifier(url => {
    if (/^(blob:|data:image\/)/.test(url)) return url;
    throw new Error('External model resources are not permitted.');
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  canvas.setAttribute('aria-label', '綠沙發 3D 原作，拖曳旋轉、滾輪縮放。也可使用下方按鈕。');
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
    ['向左旋轉', () => rotate(-1)], ['向右旋轉', () => rotate(1)],
    ['放大', () => zoom(.8)], ['縮小', () => zoom(1.25)],
    ['重設視角', () => { camera.position.copy(initialPosition); controls.target.set(0, 0, 0); controls.update(); render(); }],
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
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    buttons.replaceChildren();
  };
}
