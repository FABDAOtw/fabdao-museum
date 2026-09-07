import test from 'node:test';
import assert from 'node:assert/strict';
import { canStand, moveWithCollision, roomAt, artworkSlot, artworkDimensions, roomCapacity, roomFurniture, safeViewpoint, EYE_HEIGHT, ARTWORK_CENTER } from '../src/navigation.js';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} should reach ${expected}`);

test('all four visitor arrival points are clear and identify the correct gallery', () => {
  const arrivals = [
    { room: 0, x: 2.7, z: 7.7 },
    { room: 1, x: 2.7, z: -14.3 },
    { room: 2, x: 2.7, z: -36.3 },
    { room: 3, x: 2.7, z: -58.3 },
  ];
  for (const point of arrivals) {
    assert.equal(canStand(point.x, point.z), true, `gallery ${point.room} arrival is obstructed`);
    assert.equal(roomAt(point.z), point.room);
    const next = moveWithCollision(point, 0, -1);
    closeTo(next.z, point.z - 1);
  }
});

test('visitors can pass each connecting arch in both directions, even after a delayed frame', () => {
  const passages = [[-8, -15], [-30, -37], [-52, -59]];
  for (const [near, far] of passages) {
    for (const [from, to] of [[near, far], [far, near]]) {
      const arrival = moveWithCollision({ x: 0, z: from }, 0, to - from);
      closeTo(arrival.x, 0);
      closeTo(arrival.z, to);
      assert.equal(canStand(arrival.x, arrival.z), true);
    }
  }
});

test('large forward and backward steps cannot tunnel through the solid walls beside arches', () => {
  for (const wall of [-11, -33, -55]) {
    const forward = moveWithCollision({ x: 5.5, z: wall + 3 }, 0, -7);
    assert.ok(forward.z > wall, `walked through wall at ${wall}`);
    assert.equal(canStand(forward.x, forward.z), true);
    const backward = moveWithCollision({ x: 5.5, z: wall - 3 }, 0, 7);
    assert.ok(backward.z < wall, `walked backward through wall at ${wall}`);
    assert.equal(canStand(backward.x, backward.z), true);
  }
});

test('outer walls retain a visitor during large steps, while allowing movement along the wall', () => {
  for (const [start, dx, dz] of [
    [{ x: 7.5, z: 5 }, 100, 0],
    [{ x: -7.5, z: 5 }, -100, 0],
    [{ x: 2.7, z: 8 }, 0, 100],
    [{ x: 2.7, z: -74 }, 0, -100],
  ]) {
    const point = moveWithCollision(start, dx, dz);
    assert.equal(canStand(point.x, point.z), true);
    assert.ok(Math.abs(point.x) < 8.5 && point.z < 10 && point.z > -76);
  }
  const slid = moveWithCollision({ x: 7.5, z: 5 }, 8, 1);
  assert.ok(slid.x < 8.5);
  closeTo(slid.z, 6);
});

test('each gallery furniture and original sofa footprint stop a visitor during a large step', () => {
  for (let room = 0; room < 4; room++) {
    for (const object of roomFurniture(room)) {
      assert.equal(canStand(object.x, object.z), false, `${object.kind} has no collision`);
      const start = { x: object.x + object.width / 2 + .6, z: object.z };
      assert.equal(canStand(start.x, start.z), true);
      const moved = moveWithCollision(start, -object.width - 2, 0);
      assert.ok(moved.x > object.x + object.width / 2, `crossed ${object.kind} in gallery ${room}`);
      assert.equal(canStand(moved.x, moved.z), true);
    }
  }
  const column = moveWithCollision({ x: 6.7, z: 6 }, 0, 5);
  assert.ok(column.z < 7.6, 'crossed the entrance column');
});

test('the former central ornament no longer obstructs the first and last gallery', () => {
  for (const z of [0, -66]) {
    assert.equal(canStand(0, z), true);
    const moved = moveWithCollision({ x: 3, z }, -6, 0);
    closeTo(moved.x, -3);
  }
});

test('every wall work has an unobstructed frontal viewing position at visitor eye height', () => {
  for (let room = 0; room < 4; room++) for (let i = 0; i < roomCapacity(room); i++) {
    const target = artworkSlot(room, i), normal = { x: -target.side, z: 0 };
    const position = safeViewpoint(target, normal, 3.32);
    assert.ok(position, `no viewpoint for gallery ${room} work ${i}`);
    assert.equal(position.y, EYE_HEIGHT);
    assert.equal(canStand(position.x, position.z), true);
    assert.equal(roomAt(position.z), room);
    assert.ok(Math.abs(Math.atan2(target.y-position.y, Math.abs(target.x-position.x))) < .15, 'requires steep upward gaze');
  }
});

test('frames preserve portrait, square and landscape aspect ratios within viewing scale', () => {
  for (let room = 0; room < 4; room++) for (const [width, height] of [[1200, 853], [1020, 1200], [1200, 1200], [2400, 600], [500, 1800]]) {
    const dimensions = artworkDimensions(width, height, room);
    closeTo(dimensions.width / dimensions.height, width / height);
    assert.ok(dimensions.width <= 2.35 && dimensions.height <= 1.8 + 1e-10);
  }
});

test('a ten-work memory gallery gives adjacent works more breathing room than a twelve-work gallery', () => {
  assert.deepEqual([0, 1, 2, 3].map(roomCapacity), [12, 12, 12, 10]);
  assert.ok(Math.abs(artworkSlot(3, 0).z - artworkSlot(3, 2).z) > Math.abs(artworkSlot(0, 0).z - artworkSlot(0, 2).z));
  for (let room = 0; room < 4; room++) {
    assert.equal(artworkSlot(room, 0).side, -1);
    assert.equal(artworkSlot(room, 1).side, 1);
    closeTo(artworkSlot(room, 0).z, -room * 22 + 7.3);
    closeTo(artworkSlot(room, roomCapacity(room) - 1).z, -room * 22 - 7.3);
  }
});

test('full galleries leave visible gaps between neighbouring frames and labels at eye level', () => {
  for (let room = 0; room < 4; room++) {
    const frameWidth = artworkDimensions(4000, 500, room).width + .2;
    for (let index = 0; index < roomCapacity(room); index++) {
      const slot = artworkSlot(room, index);
      closeTo(slot.y, ARTWORK_CENTER);
      if (index < 2) continue;
      const previous = artworkSlot(room, index - 2);
      const spacing = previous.z - slot.z;
      assert.equal(slot.side, previous.side);
      assert.ok(spacing >= 2.7, `gallery ${room} wall is too crowded`);
      assert.ok(spacing - frameWidth >= .3, `gallery ${room} frames overlap`);
      assert.ok(spacing - 2.45 >= .25, `gallery ${room} labels overlap`);
    }
  }
});

test('the tallest wall plaque clears the lower wall plinth', () => {
  const tallest = artworkDimensions(500, 1800, 0);
  const plaqueBottom = ARTWORK_CENTER - tallest.height / 2 - .31 - .45 / 2;
  assert.ok(plaqueBottom > .75, `plaque bottom ${plaqueBottom.toFixed(3)} intersects the .75m plinth`);
});

test('invalid coordinates are not accepted as safe visitor positions', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.equal(canStand(invalid, 5), false);
    assert.equal(canStand(2.7, invalid), false);
  }
});

// This route follows the east aisle and then turns through each arch. It checks
// the combined layout, where individually valid furniture can still block a tour.
test('a continuous route connects all four galleries around the distinct furniture', () => {
  let position = { x: 2.7, z: 7.7 };
  for (let room = 0; room < 4; room++) {
    const waypoints = [{ x: 5.5, z: 7.7-room*22 }, { x: 5.5, z: -8-room*22 }, { x: 0, z: -8-room*22 }];
    if(room<3)waypoints.push({ x: 0, z: 7.7-(room+1)*22 });
    for(const waypoint of waypoints) {
      position = moveWithCollision(position,waypoint.x-position.x,waypoint.z-position.z);
      closeTo(position.x,waypoint.x);closeTo(position.z,waypoint.z);
      assert.equal(canStand(position.x,position.z),true);
    }
  }
});

test('all reading-table documents and the original sofa have reachable focus positions', () => {
  for(const room of [1,2]) {
    const table = roomFurniture(room).find(item=>item.kind==='table');
    for(const row of [0,1])for(const column of [-1,0,1]) {
      const target = {x:table.x+column*1.6,y:1.2,z:table.z+.52-row*.88};
      const position = safeViewpoint(target,{x:0,z:1},row===0?2:2.85);
      assert.ok(position);assert.equal(canStand(position.x,position.z),true);assert.equal(roomAt(position.z),room);
    }
  }
  const sofa=safeViewpoint({x:0,y:.8,z:-43},{x:0,z:1},3.4);
  assert.ok(sofa);assert.equal(canStand(sofa.x,sofa.z),true);
});

// Exercise gallery replacement against Three.js scene objects without creating a
// WebGL renderer. This tests async failure and resource ownership, not visual QA.
const { readFile } = await import('node:fs/promises');
const { default: ts } = await import('typescript');
const THREE = await import('three');
const museumURL = new URL('../src/museum.ts', import.meta.url);
const museumSource = await readFile(museumURL, 'utf8');
const compiledMuseum = ts.transpileModule(museumSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/from '([^']+)'/g, (_match, specifier) => {
  const url = specifier.startsWith('.') ? new URL(specifier, museumURL).href : import.meta.resolve(specifier);
  return `from '${url}'`;
});
const { Museum } = await import(`data:text/javascript;base64,${Buffer.from(compiledMuseum).toString('base64')}`);
function testMuseum() {
  const museum = Object.create(Museum.prototype);
  Object.assign(museum, {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(62, 1, .08, 120), sun: new THREE.DirectionalLight(),
    galleries: Array.from({ length: 4 }, () => new THREE.Group()), roomVersions: [0, 0, 0, 0], viewPoints: new Map(), targets: [],
    disposed: false, hovered: null, room: 0, keys: new Set(), active: true, paused: false, quality: 'balanced',
    onHover() {}, onRoom() {}, onMove() {},
    async loadTexture() { return new THREE.Texture({ width: 1200, height: 853 }); },
    label(text, x, y, z, rotation, width, height, color, background, parent) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial());
      mesh.name = text; mesh.position.set(x, y, z); mesh.rotation.y = rotation; parent.add(mesh); return mesh;
    },
  });
  museum.scene.add(...museum.galleries);
  return museum;
}
const sampleArtwork = id => ({ id, title: id, artist: 'Test Artist', theme: 'generative', image: `/${id}.jpg` });

test('language switching restores a valid view and rejects invalid saved positions', () => {
  const museum = testMuseum();
  const saved = { position: { x: 2.7, y: 100, z: 7.7 - 22 }, yaw: 1.2, pitch: -.3 };
  assert.equal(museum.restoreView(saved), true);
  assert.equal(museum.room, 1);
  assert.equal(museum.camera.position.y, EYE_HEIGHT);
  closeTo(museum.camera.position.x, saved.position.x);
  closeTo(museum.camera.position.z, saved.position.z);
  closeTo(museum.yaw, saved.yaw);
  closeTo(museum.pitch, saved.pitch);
  for (const invalid of [null, { ...saved, yaw: NaN }, { ...saved, position: { x: 999, z: 999 } }]) {
    assert.equal(museum.restoreView(invalid), false);
    assert.equal(museum.room, 1);
    closeTo(museum.yaw, saved.yaw);
  }
});

test('an image failure retains the entire previous gallery and frees successful partial loads', async () => {
  const museum = testMuseum();
  await museum.displayRoom(0, [sampleArtwork('existing')], []);
  const previous = museum.galleries[0], targets = [...museum.targets];
  let disposed = 0;
  museum.loadTexture = async url => {
    if (url.includes('failed')) throw new Error('offline');
    const texture = new THREE.Texture({ width: 400, height: 300 });
    texture.addEventListener('dispose', () => disposed++);return texture;
  };
  await assert.rejects(museum.displayRoom(0, [sampleArtwork('new'), sampleArtwork('failed')], []), /保留原展牆/);
  assert.equal(museum.galleries[0], previous);
  assert.deepEqual(museum.targets, targets);
  assert.deepEqual(museum.getState().displayedArtworkIds, ['existing']);
  assert.equal(disposed, 1);
});

test('a slower stale replacement cannot overwrite a newer completed gallery', async () => {
  const museum = testMuseum();let release, disposed = 0;
  museum.loadTexture = url => url.includes('slow') ? new Promise(resolve => { release = resolve; }) : Promise.resolve(new THREE.Texture({ width: 400, height: 300 }));
  const older = museum.displayRoom(0, [sampleArtwork('slow')], []).catch(error => error);
  await museum.displayRoom(0, [sampleArtwork('latest')], []);
  const texture = new THREE.Texture({ width: 400, height: 300 });texture.addEventListener('dispose', () => disposed++);release(texture);
  const error = await older;
  assert.equal(error.name, 'AbortError');
  assert.deepEqual(museum.getState().displayedArtworkIds, ['latest']);
  assert.equal(disposed, 1);
});

test('a completed replacement frees each previous artwork texture exactly once', async () => {
  const museum = testMuseum();let disposed = 0;
  const texture = new THREE.Texture({ width: 400, height: 300 });texture.addEventListener('dispose', () => disposed++);
  museum.loadTexture = async () => texture;
  await museum.displayRoom(0, [sampleArtwork('old')], []);
  museum.loadTexture = async () => new THREE.Texture({ width: 400, height: 300 });
  await museum.displayRoom(0, [sampleArtwork('new')], []);
  assert.equal(disposed, 1);
  assert.deepEqual(museum.getState().displayedArtworkIds, ['new']);
});

test('all supplied cross-theme documents persist and artwork focus centers a safe eye-level camera', async () => {
  const museum = testMuseum();
  const doc = { id: 'cross-theme', title: 'Shared evidence', theme: 'commons', type: 'document', summary: '', url: 'https://example.com' };
  await museum.displayRoom(0, [sampleArtwork('focus')], [doc]);
  await museum.displayRoom(1, [], [doc]);
  assert.deepEqual(museum.getState().displayedDocumentIds, ['cross-theme', 'cross-theme']);
  assert.equal(museum.focusArtwork('focus'), true);
  const state = museum.getState(), point = museum.viewPoints.get('0:focus');
  assert.equal(state.position.y, EYE_HEIGHT);
  assert.equal(canStand(state.position.x, state.position.z), true);
  const projected = point.target.clone().project(museum.camera);
  closeTo(projected.x, 0);closeTo(projected.y, 0);
  assert.equal(Object.isFrozen(state), true);assert.equal(Object.isFrozen(state.position), true);
  assert.equal(museum.focusArtwork('cross-theme'), false);
  assert.equal(museum.focusDocument('cross-theme'), true);
});

test('a failed original model also retains the prior gallery instead of replacing it with an empty space', async () => {
  const museum = testMuseum();
  await museum.displayRoom(2, [sampleArtwork('previous')], []);
  const previous = museum.galleries[2];museum.loadSofa = async () => null;
  const sofa = sampleArtwork('tezos_KT1AFq5XorPduoYyWxs5gEyrFK6fVjJVbtCj_25336');
  await assert.rejects(museum.displayRoom(2, [sofa], []), /3D 原作/);
  assert.equal(museum.galleries[2], previous);
  assert.deepEqual(museum.getState().displayedArtworkIds, ['previous']);
});

test('late loader callbacks settle and dispose resources after the museum closes', {timeout: 1500}, async () => {
  const previousWindow = globalThis.window;globalThis.window = {setTimeout};
  try {
    const museum = testMuseum();let finishImage, finishModel, imageDisposals = 0, modelDisposals = 0;
    museum.loader = {load(_url, onLoad) {finishImage = onLoad;}};
    museum.modelLoader = {load(_url, onLoad) {finishModel = onLoad;}};
    const image = Museum.prototype.loadTexture.call(museum, '/late.jpg').catch(error => error);
    const model = Museum.prototype.loadSofa.call(museum);
    museum.disposed = true;
    const texture = new THREE.Texture();texture.addEventListener('dispose', () => imageDisposals++);
    const geometry = new THREE.BoxGeometry();geometry.addEventListener('dispose', () => modelDisposals++);
    const group = new THREE.Group();group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    finishImage(texture);finishModel({scene: group});
    assert.equal((await image).name, 'AbortError');assert.equal(await model, null);
    assert.equal(imageDisposals, 1);assert.equal(modelDisposals, 1);
  } finally { globalThis.window = previousWindow; }
});

test('a full twelve-work gallery batches frame hardware and uses one wall label per artwork', async () => {
  const museum=testMuseum();
  await museum.displayRoom(0,Array.from({length:12},(_,i)=>sampleArtwork(`work-${i}`)),[]);
  let meshes=0;museum.galleries[0].traverse(object=>{if(object instanceof THREE.Mesh)meshes++;});
  // Twelve artwork planes + twelve labels + three shared frame materials.
  assert.ok(meshes<=27, `${meshes} unbatched draw objects remain`);
  assert.equal(museum.currentTargets().length,12);
  assert.deepEqual(museum.galleries.map(group=>group.visible),[true,true,false,false]);
});

test('actual render control stops submitting frames when idle or paused and reuses unchanged shadows', () => {
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  globalThis.window={requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};globalThis.document={hidden:false};
  try {
    const museum=testMuseum();let gpuDraws=0;
    Object.assign(museum,{last:0,elapsed:0,frameCount:0,animationFrame:0,needsRender:true,needsShadow:true,hoverDirty:false,lastShadowZ:NaN,
      renderStats:{frames:0,skippedFrames:0,shadowUpdates:0,raycasts:0},onStats:()=>{},
      renderer:{shadowMap:{enabled:true,needsUpdate:false},info:{render:{calls:0,triangles:0},reset(){}},render(){gpuDraws++;}}});
    museum.render(16);assert.equal(gpuDraws,1);assert.equal(museum.renderStats.shadowUpdates,1);
    museum.render(32);assert.equal(gpuDraws,1,'idle resubmitted the scene');
    museum.setPaused(true);museum.render(48);assert.equal(gpuDraws,1,'paused resubmitted the scene');
    museum.yaw+=.1;museum.look();museum.render(64);
    assert.equal(gpuDraws,2);assert.equal(museum.renderStats.shadowUpdates,1,'turning rebuilt the shadow map');
    museum.camera.position.z=.8;museum.look();museum.render(80);
    assert.equal(gpuDraws,3);assert.equal(museum.renderStats.shadowUpdates,2);
    globalThis.document.hidden=true;museum.needsRender=true;museum.render(96);
    assert.equal(gpuDraws,3,'hidden tab submitted a frame');
  } finally {globalThis.window=previousWindow;globalThis.document=previousDocument;}
});
