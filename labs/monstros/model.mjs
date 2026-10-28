/** Fictional arcade units. These numbers have no physical or tactical meaning. */
export const STEP_SECONDS = 1 / 30;
export const MAX_TICKS = 2400;
export const ARENA = Object.freeze({width:1000,height:600,inset:48});
export const COVER = Object.freeze([
  Object.freeze({x:500,y:300,radius:54}),
  Object.freeze({x:300,y:155,radius:30}),
  Object.freeze({x:700,y:445,radius:30})
]);
export const VEHICLES = Object.freeze({
  cinder:Object.freeze({name:'Cinder',color:'#ef4c58',shield:100,speed:72,cooldown:27,pulse:13,shape:'wedge'}),
  vanta:Object.freeze({name:'Vanta',color:'#d5be81',shield:116,speed:61,cooldown:34,pulse:16,shape:'box'}),
  chalk:Object.freeze({name:'Chalk',color:'#a5d8d8',shield:88,speed:83,cooldown:23,pulse:11,shape:'split'})
});
export const PAIRINGS = Object.freeze([
  Object.freeze({id:'cinder-vanta',label:'Cinder / Vanta',vehicles:Object.freeze(['cinder','vanta'])}),
  Object.freeze({id:'vanta-chalk',label:'Vanta / Chalk',vehicles:Object.freeze(['vanta','chalk'])}),
  Object.freeze({id:'chalk-cinder',label:'Chalk / Cinder',vehicles:Object.freeze(['chalk','cinder'])})
]);
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const round = value => Math.round(value * 1000) / 1000;
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function random(state) {
  state.rng = (Math.imul(state.rng,1664525)+1013904223) >>> 0;
  return state.rng / 4294967296;
}
function log(state,type,data={}) {
  state.events.push({tick:state.tick,type,...data});
  // The match has a fixed duration; keep the transcript bounded as well.
  if (state.events.length > 400) state.events.shift();
}
export function createMatch({seed=73,pairing='cinder-vanta'}={}) {
  const pair=PAIRINGS.find(p=>p.id===pairing);
  if(!Number.isInteger(seed)||seed<0||seed>4294967295||!pair) return {ok:false,error:'Choose a whole seed from 0 to 4,294,967,295 and a supported pairing.'};
  const state={schema:'monstros-state/v1',seed,pairing,rng:seed,tick:0,status:'ready',winner:null,reason:null,shots:0,hits:0,events:[],pulses:[],effects:[],vehicles:pair.vehicles.map((type,index)=>({id:index,type,name:VEHICLES[type].name,x:index?800:200,y:index?370:230,angle:index?Math.PI:0,shield:VEHICLES[type].shield,cooldown:index?24:16,lastHit:-100}))};
  log(state,'ready',{message:'Fictional arcade rules. Both vehicles start at full shield.'});
  return {ok:true,state};
}
function finish(state,reason) {
  state.status='finished'; state.reason=reason;
  const [a,b]=state.vehicles;
  const left=a.shield/VEHICLES[a.type].shield,right=b.shield/VEHICLES[b.type].shield;
  state.winner=Math.abs(left-right)<0.000001?null:left>right?a.id:b.id;
  log(state,'finish',{winner:state.winner,reason,message:state.winner===null?'Draw. Equal shield share remains.':`${state.vehicles[state.winner].name} takes the round.`});
}
/** Pure fixed-step transition: calling it does not modify the supplied state. */
export function stepMatch(input) {
  if(!input||input.schema!=='monstros-state/v1'||input.status==='finished') return input;
  const state=structuredClone(input);
  state.status='running'; state.tick++;
  state.effects=state.effects.filter(effect=>state.tick-effect.tick<18);
  for(const vehicle of state.vehicles) {
    const target=state.vehicles[1-vehicle.id], spec=VEHICLES[vehicle.type];
    const dx=target.x-vehicle.x,dy=target.y-vehicle.y,d=Math.max(1,Math.hypot(dx,dy));
    const orbit=vehicle.id===0?1:-1;
    const advance=d>340?0.75:d<240?-0.55:0;
    let vx=(dx/d*advance-dy/d*orbit*0.7),vy=(dy/d*advance+dx/d*orbit*0.7);
    for(const block of COVER) {
      const bx=vehicle.x-block.x,by=vehicle.y-block.y,bd=Math.max(1,Math.hypot(bx,by));
      if(bd<block.radius+94){const repel=(block.radius+94-bd)/45;vx+=bx/bd*repel;vy+=by/bd*repel;}
    }
    const magnitude=Math.max(1,Math.hypot(vx,vy));
    vehicle.x=clamp(vehicle.x+vx/magnitude*spec.speed*STEP_SECONDS,ARENA.inset,ARENA.width-ARENA.inset);
    vehicle.y=clamp(vehicle.y+vy/magnitude*spec.speed*STEP_SECONDS,ARENA.inset,ARENA.height-ARENA.inset);
    for(const block of COVER) {
      const bx=vehicle.x-block.x,by=vehicle.y-block.y,bd=Math.hypot(bx,by),min=block.radius+37;
      if(bd<min){vehicle.x=block.x+(bd?bx/bd:1)*min;vehicle.y=block.y+(bd?by/bd:0)*min;}
    }
    vehicle.angle=Math.atan2(target.y-vehicle.y,target.x-vehicle.x);
    vehicle.cooldown--;
    if(vehicle.cooldown<=0&&distance(vehicle,target)<620&&state.pulses.length<40){
      const angle=vehicle.angle+(random(state)-0.5)*0.11;
      state.pulses.push({id:state.shots++,owner:vehicle.id,x:vehicle.x+Math.cos(angle)*40,y:vehicle.y+Math.sin(angle)*40,vx:Math.cos(angle)*440,vy:Math.sin(angle)*440,age:0,power:spec.pulse+Math.floor(random(state)*5)});
      vehicle.cooldown=spec.cooldown;
      log(state,'pulse',{vehicle:vehicle.name,message:`${vehicle.name} emits an arcade pulse.`});
    }
  }
  const remaining=[];
  for(const pulse of state.pulses){
    pulse.x+=pulse.vx*STEP_SECONDS; pulse.y+=pulse.vy*STEP_SECONDS; pulse.age++;
    if(pulse.age>70||pulse.x<0||pulse.y<0||pulse.x>ARENA.width||pulse.y>ARENA.height) continue;
    const obstacle=COVER.find(block=>distance(pulse,block)<block.radius+4);
    const target=state.vehicles[1-pulse.owner];
    if(obstacle){state.effects.push({x:pulse.x,y:pulse.y,tick:state.tick,color:'#77736c',kind:'cover'});continue;}
    if(distance(pulse,target)<35){
      target.shield=Math.max(0,target.shield-pulse.power);target.lastHit=state.tick;state.hits++;
      state.effects.push({x:pulse.x,y:pulse.y,tick:state.tick,color:VEHICLES[target.type].color,kind:'hit'});
      log(state,'impact',{vehicle:target.name,amount:pulse.power,shield:target.shield,message:`${target.name}: −${pulse.power} shield; ${target.shield} remains.`});
    } else remaining.push(pulse);
  }
  state.pulses=remaining;
  if(state.vehicles.some(v=>v.shield===0))finish(state,'shield depleted');
  else if(state.tick>=MAX_TICKS)finish(state,'80-second limit');
  return state;
}
export function snapshotMatch(state){
  return {tick:state.tick,status:state.status,winner:state.winner,reason:state.reason,shots:state.shots,hits:state.hits,vehicles:state.vehicles.map(v=>({id:v.id,type:v.type,x:round(v.x),y:round(v.y),shield:v.shield}))};
}
export function exportReplay(state){
  return {schema:'monstros-replay/v1',engine:'monstros-arena/v1',scope:'Fictional deterministic arcade simulation; not real vehicle or combat evidence.',seed:state.seed,pairing:state.pairing,ticks:state.tick,result:snapshotMatch(state),events:structuredClone(state.events)};
}
export function replayRecord(record){
  if(!record||record.schema!=='monstros-replay/v1'||record.engine!=='monstros-arena/v1'||!Number.isInteger(record.ticks)||record.ticks<0||record.ticks>MAX_TICKS||!Array.isArray(record.events)||record.events.length>400) return {ok:false,error:'Unsupported or out-of-bounds replay.'};
  if(record.result?.tick!==record.ticks)return {ok:false,error:'Replay tick count and recorded result disagree.'};
  const setup=createMatch({seed:record.seed,pairing:record.pairing});
  if(!setup.ok)return setup;
  let state=setup.state;
  for(let tick=0;tick<record.ticks;tick++)state=stepMatch(state);
  if(state.tick!==record.ticks)return {ok:false,error:'Replay advances beyond the terminal match tick.'};
  if(JSON.stringify(snapshotMatch(state))!==JSON.stringify(record.result)||JSON.stringify(state.events)!==JSON.stringify(record.events))return {ok:false,error:'The replay does not match this engine’s deterministic result.'};
  return {ok:true,state};
}
