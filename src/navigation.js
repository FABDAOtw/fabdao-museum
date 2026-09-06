export const ROOM_LENGTH = 22;
export const ROOM_COUNT = 4;
export const EYE_HEIGHT = 1.72;
export const ARTWORK_CENTER = 2.02;
export const roomCapacity = index => index === 3 ? 6 : 8;
export function roomAt(z) { return Math.max(0, Math.min(3, Math.floor((11 - z) / ROOM_LENGTH))); }

// Shared by the architecture and collision model. These are museum furniture,
// separate from the original Green Sofa artwork installed in gallery three.
export function roomFurniture(room) {
  const z = -room * ROOM_LENGTH;
  if (room === 0) return [
    { kind: 'bench', x: 0, z: z + 4.5, width: 3.2, depth: .85 },
    { kind: 'bench', x: 0, z: z - 4.5, width: 3.2, depth: .85 },
  ];
  if (room === 1) return [
    { kind: 'table', x: -2.7, z: z - 1, width: 4.4, depth: 2.3 },
    { kind: 'bench', x: 3.1, z: z - 3.7, width: 3.2, depth: .85 },
  ];
  if (room === 2) return [
    { kind: 'artwork', x: 0, z: z + 1, width: 3.4, depth: 3.4 },
    { kind: 'table', x: 0, z: z - 4.5, width: 5.4, depth: 2.1 },
  ];
  return [
    { kind: 'bench', x: -2.7, z: z - 2.8, width: 1.4, depth: .85 },
    { kind: 'bench', x: 2.7, z: z - 2.8, width: 1.4, depth: .85 },
  ];
}

export function artworkSlot(room, index) {
  const capacity = roomCapacity(room), rows = capacity / 2;
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2);
  const z = -room * ROOM_LENGTH + (rows === 3 ? 6.8 - row * 6.8 : 7.1 - row * 4.7);
  return { x: side * 8.65, y: ARTWORK_CENTER, z, rotation: side < 0 ? Math.PI / 2 : -Math.PI / 2, side };
}
export function artworkDimensions(width, height) {
  const ratio = Number.isFinite(width / height) && width > 0 && height > 0 ? width / height : 1;
  const w = Math.min(2.65, 1.95 * ratio);
  return { width: w, height: w / ratio };
}
export function canStand(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 8.05 || z > 9 || z < -75) return false;
  for (const boundary of [-11, -33, -55]) if (Math.abs(z - boundary) < .65 && Math.abs(x) > 2.15) return false;
  for (let room = 0; room < ROOM_COUNT; room++) {
    const rz = -room * ROOM_LENGTH;
    for (const object of roomFurniture(room)) {
      if (Math.abs(x - object.x) < object.width / 2 + .35 && Math.abs(z - object.z) < object.depth / 2 + .35) return false;
    }
    for (const cx of [-6.7, 6.7]) for (const cz of [-8.4, 8.4]) if (Math.hypot(x - cx, z - (rz + cz)) < .95) return false;
  }
  return true;
}
export function safeViewpoint(target, normal, distance = 3) {
  for (const offset of [0, .4, -.4, .8, -.8, 1.2, -1.2]) {
    for (const step of [0, .4, -.4, .8, -.8]) {
      const x = target.x + normal.x * (distance + step) + normal.z * offset;
      const z = target.z + normal.z * (distance + step) - normal.x * offset;
      if (canStand(x, z)) return { x, y: EYE_HEIGHT, z };
    }
  }
  return null;
}
export function moveWithCollision(position, dx, dz) {
  if (![position.x, position.z, dx, dz].every(Number.isFinite)) return { x: position.x, z: position.z };
  // Substeps prevent tunneling through a wall after a delayed frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
  let { x, z } = position;
  for (let i = 0; i < steps; i++) {
    if (canStand(x + dx / steps, z)) x += dx / steps;
    if (canStand(x, z + dz / steps)) z += dz / steps;
  }
  return { x, z };
}
