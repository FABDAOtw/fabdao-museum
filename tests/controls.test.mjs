import test from 'node:test';
import assert from 'node:assert/strict';
import { clampSensitivity, pointerLookDelta } from '../src/controls.js';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should equal ${expected}`);

test('dragging grabs the scene while pointer lock turns the head in the opposite direction', () => {
  assert.deepEqual(pointerLookDelta(50, 25, { mode: 'drag' }), { yaw: .1, pitch: .05 });
  assert.deepEqual(pointerLookDelta(50, 25, { mode: 'locked' }), { yaw: -.1, pitch: -.05 });
  assert.deepEqual(pointerLookDelta(-50, -25, { mode: 'drag' }), { yaw: -.1, pitch: -.05 });
  assert.deepEqual(pointerLookDelta(-50, -25, { mode: 'locked' }), { yaw: .1, pitch: .05 });
});

test('splitting the same relative motion across events does not change the total rotation', () => {
  for (const mode of ['drag', 'locked']) for (const sensitivity of [.25, 1, 2.5]) for (const invertY of [false, true]) {
    const options = { mode, sensitivity, invertY };
    const whole = pointerLookDelta(237, -119, options);
    const events = [[27, -17], [90, -58], [120, -44]].map(([dx, dy]) => pointerLookDelta(dx, dy, options));
    closeTo(events.reduce((sum, event) => sum + event.yaw, 0), whole.yaw);
    closeTo(events.reduce((sum, event) => sum + event.pitch, 0), whole.pitch);
    const highFrequency = pointerLookDelta(237 / 120, -119 / 120, options);
    closeTo(highFrequency.yaw * 120, whole.yaw);
    closeTo(highFrequency.pitch * 120, whole.pitch);
  }
});

test('inverting vertical look leaves horizontal movement unchanged in both modes', () => {
  for (const mode of ['drag', 'locked']) {
    const normal = pointerLookDelta(30, 45, { mode });
    const inverted = pointerLookDelta(30, 45, { mode, invertY: true });
    assert.equal(inverted.yaw, normal.yaw);
    assert.equal(inverted.pitch, -normal.pitch);
  }
});

test('sensitivity remains within a usable range and scales both axes equally', () => {
  assert.equal(clampSensitivity(0), .25);
  assert.equal(clampSensitivity(-5), .25);
  assert.equal(clampSensitivity(5), 2.5);
  assert.equal(clampSensitivity(1.5), 1.5);
  assert.deepEqual(pointerLookDelta(100, -100, { sensitivity: 2 }), { yaw: .4, pitch: -.4 });
});

test('invalid movement and sensitivity values cannot poison camera rotation', () => {
  for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '20']) {
    assert.deepEqual(pointerLookDelta(invalid, invalid), { yaw: 0, pitch: 0 });
    assert.deepEqual(pointerLookDelta(invalid, 10, { mode: 'locked' }), { yaw: 0, pitch: -.02 });
    assert.equal(clampSensitivity(invalid), 1);
    assert.deepEqual(pointerLookDelta(10, 20, { sensitivity: invalid }), { yaw: .02, pitch: .04 });
  }
  assert.deepEqual(pointerLookDelta(0, -0, { mode: 'locked', invertY: true }), { yaw: 0, pitch: 0 });
  assert.deepEqual(pointerLookDelta(10, 20), pointerLookDelta(10, 20, { mode: 'drag', sensitivity: 1 }));
});
