import test from 'node:test';
import assert from 'node:assert/strict';
import { canStand, moveWithCollision, roomAt } from '../src/navigation.js';

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

test('pedestal, reading bench, and column stop a visitor rather than being crossed in one step', () => {
  const pedestal = moveWithCollision({ x: 3, z: 0 }, -6, 0);
  assert.ok(pedestal.x > 1.4, 'crossed the central pedestal');
  const bench = moveWithCollision({ x: 4.2, z: 4 }, 0, -6);
  assert.ok(bench.z > 3, 'crossed the reading bench');
  const column = moveWithCollision({ x: 6.7, z: 6 }, 0, 5);
  assert.ok(column.z < 7.6, 'crossed the entrance column');
  for (const point of [pedestal, bench, column]) assert.equal(canStand(point.x, point.z), true);
});

test('invalid coordinates are not accepted as safe visitor positions', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.equal(canStand(invalid, 5), false);
    assert.equal(canStand(2.7, invalid), false);
  }
});
