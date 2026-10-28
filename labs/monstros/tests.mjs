import assert from 'node:assert/strict';
import {ARENA,COVER,VEHICLES,PAIRINGS,MAX_TICKS,createMatch,stepMatch,snapshotMatch,exportReplay,replayRecord} from './model.mjs';
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function finish(seed,pairing='cinder-vanta'){
  let state=createMatch({seed,pairing}).state;
  for(let tick=0;state.status!=='finished'&&tick<MAX_TICKS;tick++)state=stepMatch(state);
  return state;
}
check('same setup produces identical complete states and event histories',()=>assert.deepEqual(finish(73),finish(73)));
check('a transition does not mutate its input',()=>{const state=createMatch().state;const original=structuredClone(state);const next=stepMatch(state);assert.deepEqual(state,original);assert.notEqual(next,state);assert.equal(next.tick,1);});
check('every pairing reaches a finite, bounded result over diverse seeds',()=>{
  for(const pairing of PAIRINGS)for(const seed of [0,1,73,999,4294967295]){
    const state=finish(seed,pairing.id);assert.equal(state.status,'finished');assert.ok(state.tick<=MAX_TICKS);assert.ok(state.hits>0);
    assert.ok(state.pulses.length<=40);assert.ok(state.events.length<=400);
    for(const v of state.vehicles){assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));assert.ok(v.x>=ARENA.inset&&v.x<=ARENA.width-ARENA.inset);assert.ok(v.y>=ARENA.inset&&v.y<=ARENA.height-ARENA.inset);assert.ok(v.shield>=0&&v.shield<=VEHICLES[v.type].shield);for(const cover of COVER)assert.ok(Math.hypot(v.x-cover.x,v.y-cover.y)>=cover.radius+36.99);}
  }
});
check('finished matches stop advancing',()=>{const state=finish(1);assert.equal(stepMatch(state),state);});
check('recreating the setup resets time, shield, pulses and ledger',()=>{const original=createMatch({seed:999,pairing:'chalk-cinder'}).state;finish(999,'chalk-cinder');const reset=createMatch({seed:999,pairing:'chalk-cinder'}).state;assert.deepEqual(reset,original);assert.equal(reset.tick,0);assert.equal(reset.pulses.length,0);assert.equal(reset.events.length,1);});
check('zero seed is valid; unsupported setup values fail without a state',()=>{assert.equal(createMatch({seed:0}).ok,true);for(const seed of [-1,1.5,Infinity,NaN,'73',4294967296]){const result=createMatch({seed});assert.equal(result.ok,false);assert.equal(result.state,undefined);}assert.equal(createMatch({pairing:'unknown'}).ok,false);});
check('complete export can be independently replayed',()=>{const state=finish(73);const result=replayRecord(JSON.parse(JSON.stringify(exportReplay(state))));assert.equal(result.ok,true);assert.deepEqual(result.state,state);});
check('a paused partial match can also be replayed',()=>{let state=createMatch({seed:2,pairing:'vanta-chalk'}).state;for(let i=0;i<123;i++)state=stepMatch(state);const result=replayRecord(exportReplay(state));assert.equal(result.ok,true);assert.deepEqual(result.state,state);});
check('tampered replay results are rejected',()=>{const record=exportReplay(finish(73));record.result.vehicles[0].shield++;assert.equal(replayRecord(record).ok,false);});
check('tampered event history is rejected',()=>{const record=exportReplay(finish(73));record.events[0].message='invented';assert.equal(replayRecord(record).ok,false);});
check('terminal tick padding is rejected even when the finished transition is a no-op',()=>{const record=exportReplay(finish(73));record.ticks++;assert.equal(replayRecord(record).ok,false);record.result.tick=record.ticks;assert.equal(replayRecord(record).ok,false);});
check('unbounded or unsupported replay documents fail before replay',()=>{for(const record of [null,{},[],{schema:'monstros-replay/v1',engine:'unknown',ticks:MAX_TICKS+1,events:[]},{schema:'monstros-replay/v1',engine:'monstros-arena/v1',ticks:MAX_TICKS+1,events:[]}])assert.equal(replayRecord(record).ok,false);});
check('export does not retain mutable event references',()=>{const state=createMatch().state;const record=exportReplay(state);record.events[0].message='changed';assert.notEqual(state.events[0].message,'changed');});
check('changing the seed changes an observed match trace',()=>assert.notDeepEqual(snapshotMatch(finish(73)),snapshotMatch(finish(74))));
console.log(JSON.stringify({checks,status:'passed',scope:'Fictional deterministic engine; no real-world vehicle or combat predictions.'}));
