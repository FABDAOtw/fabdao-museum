export function qualityProfile(value = 'balanced', deviceRatio = 1) {
  const quality = ['low', 'balanced', 'high'].includes(value) ? value : 'balanced';
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  return Object.freeze({
    quality,
    pixelRatio: Math.min(ratio, quality === 'high' ? 1.5 : quality === 'balanced' ? 1.25 : 1),
    renderMode: quality === 'high' ? 'ssao' : 'direct',
    aoScale: quality === 'high' ? .5 : 0,
    samples: quality === 'high' ? 2 : 0,
    shadows: quality !== 'low',
    shadowSize: quality === 'high' ? 2048 : 1024,
  });
}

// An adjacent gallery remains available through each arch. Far gallery artwork,
// furniture and lights can be removed from the render list as one group.
export function adjacentRooms(room, count = 4) {
  return Array.from({ length: count }, (_, index) => index).filter(index => Math.abs(index - room) <= 1);
}

export function shouldRefreshShadow(z, previousZ, dirty = false) {
  return dirty || !Number.isFinite(previousZ) || Math.abs(z - previousZ) >= .75;
}

export function shouldDrawFrame({ dirty, hidden, disposed }) {
  return !!dirty && !hidden && !disposed;
}
