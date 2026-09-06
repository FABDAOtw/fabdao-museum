import test from 'node:test';
import assert from 'node:assert/strict';
import { qualityProfile, adjacentRooms, shouldRefreshShadow, shouldDrawFrame } from '../src/performance.js';

test('balanced quality stays within the pixel budget and avoids a second scene-render pass', () => {
  for(const ratio of [1, 1.5, 2, 3]) {
    const balanced=qualityProfile('balanced',ratio);
    assert.equal(balanced.renderMode,'direct');assert.equal(balanced.aoScale,0);
    assert.ok(balanced.pixelRatio<=1.25);assert.equal(balanced.shadows,true);
  }
  const high=qualityProfile('high',2);
  assert.equal(high.renderMode,'ssao');assert.equal(high.aoScale,.5);
  assert.equal(high.samples,2);assert.equal(high.shadowSize,2048);
  assert.equal(qualityProfile('low',2).shadows,false);
});

test('only the current and adjacent galleries enter the visible set', () => {
  assert.deepEqual(adjacentRooms(0),[0,1]);assert.deepEqual(adjacentRooms(1),[0,1,2]);
  assert.deepEqual(adjacentRooms(2),[1,2,3]);assert.deepEqual(adjacentRooms(3),[2,3]);
});

test('turning in place and small steps reuse the shadow map, while changing exhibits invalidates it', () => {
  assert.equal(shouldRefreshShadow(4,4,false),false);
  assert.equal(shouldRefreshShadow(4.5,4,false),false);
  assert.equal(shouldRefreshShadow(4.8,4,false),true);
  assert.equal(shouldRefreshShadow(4,4,true),true);
});

test('a static or hidden gallery never submits an unchanged GPU frame', () => {
  assert.equal(shouldDrawFrame({dirty:false,hidden:false,disposed:false}),false);
  assert.equal(shouldDrawFrame({dirty:true,hidden:true,disposed:false}),false);
  assert.equal(shouldDrawFrame({dirty:true,hidden:false,disposed:true}),false);
  assert.equal(shouldDrawFrame({dirty:true,hidden:false,disposed:false}),true);
});
