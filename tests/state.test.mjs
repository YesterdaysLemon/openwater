import test from 'node:test';
import assert from 'node:assert/strict';
import {readState,writeState,sampleWave,presets} from '../src/state.js';
test('shared oceans preserve customized conditions and visibility',()=>{
 const state={...readState(),weather:'storm',view:'sail',wind:21,swell:2.25,sun:12,foam:.65,rain:.32,ship:false};
 const copy=readState(writeState(state));for(const k of ['weather','view','wind','swell','sun','foam','rain','ship'])assert.equal(copy[k],state[k]);
});
test('untrusted URL values cannot create invalid shader inputs',()=>{
 const s=readState('weather=constructor&view=bad&wind=Infinity&swell=-100&sun=NaN&rain=500&foam=nope');
 assert.equal(s.weather,'trade');assert.equal(s.view,'cove');assert.equal(s.wind,12);assert.equal(s.swell,.15);assert.equal(s.sun,35);assert.equal(s.rain,1);assert.equal(s.foam,.45);
});
test('buoyancy is deterministic, bounded, and progresses with time',()=>{
 for(const preset of Object.values(presets))for(let t=0;t<100;t+=.75){const a=sampleWave(5,-12,t,preset.swell,preset.wind);assert.ok(Number.isFinite(a));assert.ok(Math.abs(a)<preset.swell*1.3);assert.equal(a,sampleWave(5,-12,t,preset.swell,preset.wind));}
 assert.notEqual(sampleWave(2,4,0),sampleWave(2,4,1));
});
