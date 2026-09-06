export const ROOM_LENGTH = 22;
export const ROOM_COUNT = 4;
export function roomAt(z) { return Math.max(0, Math.min(3, Math.floor((11 - z) / ROOM_LENGTH))); }
export function canStand(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 8.05 || z > 9 || z < -75) return false;
  for (const boundary of [-11, -33, -55]) if (Math.abs(z - boundary) < .65 && Math.abs(x) > 2.15) return false;
  for (let room = 0; room < ROOM_COUNT; room++) {
    const rz = -room * ROOM_LENGTH;
    // Pedestal and benches occupy actual floor space.
    if (Math.abs(x) < 1.5 && Math.abs(z - rz) < 1.5) return false;
    for (const bx of [-4.2, 4.2]) if (Math.abs(x - bx) < .9 && Math.abs(z - (rz + 1)) < 2.05) return false;
    for (const cx of [-6.7, 6.7]) for (const cz of [-8.4, 8.4]) if (Math.hypot(x - cx, z - (rz + cz)) < .95) return false;
  }
  return true;
}
export function moveWithCollision(position, dx, dz) {
  // Substeps prevent tunneling through a wall after a delayed frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
  let {x, z} = position;
  for (let i = 0; i < steps; i++) {
    if (canStand(x + dx / steps, z)) x += dx / steps;
    if (canStand(x, z + dz / steps)) z += dz / steps;
  }
  return {x, z};
}
