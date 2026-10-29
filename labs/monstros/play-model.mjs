import {ARENA,COVER,VEHICLES,PAIRINGS,STEP_SECONDS} from './model.mjs';

/** Local arcade rules only: game coordinates and invented abilities, not physical data. */
export const PLAY_MAX_TICKS=2400;
const BODY_RADIUS=42,MAX_PULSES=40,MAX_EVENTS=400,MAX_EFFECTS=128;
const INPUT_BITS={fire:1,assist:2,boost:4,brake:8};
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const approach=(a,b,step)=>a+clamp(b-a,-step,step);
const turn=(a,b,step)=>wrap(a+clamp(wrap(b-a),-step,step));
const round=n=>Math.round(n*1000000)/1000000;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const axis=n=>typeof n==='number'&&Number.isFinite(n)?Math.round(clamp(n,-1,1)*1000)||0:0;
const recordObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function inputTuple(value){
  const input=recordObject(value)?value:{};
  let flags=input.assist===false?0:INPUT_BITS.assist;
  for(const key of ['fire','boost','brake'])if(input[key]===true)flags|=INPUT_BITS[key];
  return [1,axis(input.throttle),axis(input.steer),axis(input.aim),flags];
}
function tupleInput(tuple){return {throttle:tuple[1]/1000,steer:tuple[2]/1000,aim:tuple[3]/1000,fire:Boolean(tuple[4]&1),assist:Boolean(tuple[4]&2),boost:Boolean(tuple[4]&4),brake:Boolean(tuple[4]&8)};}
function appendInput(state,tuple){
  const last=state.inputRuns.at(-1);
  if(last&&last.slice(1).every((value,index)=>value===tuple[index+1]))last[0]++;
  else state.inputRuns.push(tuple);
}
function random(state){state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;}
function log(state,type,data={}){state.events.push({tick:state.tick,type,...data});if(state.events.length>MAX_EVENTS)state.events.shift();}
function effect(state,x,y,kind,color){state.effects.push({x,y,tick:state.tick,kind,color});if(state.effects.length>MAX_EFFECTS)state.effects.shift();}

export function createPlayMatch(options={}){
  if(!recordObject(options))return {ok:false,error:'A drive setup must contain a supported pairing and integer seed.'};
  const {seed=73,pairing='cinder-vanta'}=options,pair=PAIRINGS.find(p=>p.id===pairing);
  if(!Number.isInteger(seed)||seed<0||seed>4294967295||!pair)return {ok:false,error:'Choose a whole seed from 0 to 4,294,967,295 and a supported pairing.'};
  const state={schema:'monstros-play-state/v2',seed,pairing,rng:seed,tick:0,status:'ready',winner:null,reason:null,shots:0,hits:0,inputRuns:[],events:[],pulses:[],effects:[],vehicles:pair.vehicles.map((type,id)=>({
    id,type,name:VEHICLES[type].name,x:id?800:200,y:id?370:230,heading:id?Math.PI:0,
    angle:id?Math.atan2(-140,-600):Math.atan2(140,600),speed:0,boost:100,boostLocked:false,boosting:false,
    shield:VEHICLES[type].shield,cooldown:id?48:0,lastHit:-100,lastCollision:-100,
  }))};
  log(state,'ready',{message:`Drive ${state.vehicles[0].name}. Movement, abilities and outcomes use fictional arcade rules.`});
  return {ok:true,state};
}

// Exact segment/circle hit order prevents fast arcade pulses crossing a thin obstacle.
function circleHit(ax,ay,bx,by,cx,cy,radius){
  const dx=bx-ax,dy=by-ay,ox=ax-cx,oy=ay-cy,c=ox*ox+oy*oy-radius*radius;
  if(c<=0)return 0;
  const a=dx*dx+dy*dy;if(a===0)return null;
  const b=2*(ox*dx+oy*dy),discriminant=b*b-4*a*c;if(discriminant<0)return null;
  const t=(-b-Math.sqrt(discriminant))/(2*a);return t>=0&&t<=1?t:null;
}
function clearLine(a,b){return !COVER.some(c=>circleHit(a.x,a.y,b.x,b.y,c.x,c.y,c.radius+6)!==null);}

function constrain(vehicle,state){
  let bumped=false;
  for(let pass=0;pass<2;pass++){
    const x=clamp(vehicle.x,ARENA.inset,ARENA.width-ARENA.inset),y=clamp(vehicle.y,ARENA.inset,ARENA.height-ARENA.inset);
    if(x!==vehicle.x||y!==vehicle.y)bumped=true;vehicle.x=x;vehicle.y=y;
    for(const block of COVER){
      const dx=vehicle.x-block.x,dy=vehicle.y-block.y,d=Math.hypot(dx,dy),min=block.radius+BODY_RADIUS;
      if(d<min){vehicle.x=block.x+(d?dx/d:1)*min;vehicle.y=block.y+(d?dy/d:0)*min;bumped=true;}
    }
  }
  if(bumped){
    if(Math.abs(vehicle.speed)>25&&state.tick-vehicle.lastCollision>12){effect(state,vehicle.x,vehicle.y,'collision','#bcb29a');vehicle.lastCollision=state.tick;}
    vehicle.speed*=.12;
  }
}
function movePlayer(vehicle,input,state){
  const base=VEHICLES[vehicle.type].speed*1.65;
  if(vehicle.boostLocked&&vehicle.boost>=28)vehicle.boostLocked=false;
  vehicle.boosting=input.boost&&input.throttle>.1&&!input.brake&&!vehicle.boostLocked&&vehicle.boost>0;
  vehicle.boost=clamp(vehicle.boost+(vehicle.boosting?-24:13)*STEP_SECONDS,0,100);
  if(vehicle.boost===0)vehicle.boostLocked=true;
  const target=input.brake?0:input.throttle>=0?input.throttle*base*(vehicle.boosting?1.65:1):input.throttle*base*.46;
  const acceleration=input.brake?440:input.throttle?input.throttle*vehicle.speed<0?220:125:62;
  vehicle.speed=approach(vehicle.speed,target,acceleration*STEP_SECONDS);
  if(Math.abs(vehicle.speed)<.01)vehicle.speed=0;
  const speedShare=Math.min(1,Math.abs(vehicle.speed)/45),direction=vehicle.speed<0?-1:1;
  vehicle.heading=wrap(vehicle.heading+input.steer*1.95*speedShare*direction*(vehicle.boosting?.78:1)*STEP_SECONDS);
  vehicle.x+=Math.cos(vehicle.heading)*vehicle.speed*STEP_SECONDS;vehicle.y+=Math.sin(vehicle.heading)*vehicle.speed*STEP_SECONDS;
  constrain(vehicle,state);
  const targetVehicle=state.vehicles[1];
  if(input.aim!==0)vehicle.angle=wrap(vehicle.angle+input.aim*2.7*STEP_SECONDS);
  else if(input.assist)vehicle.angle=turn(vehicle.angle,Math.atan2(targetVehicle.y-vehicle.y,targetVehicle.x-vehicle.x),5*STEP_SECONDS);
}
function moveOpponent(vehicle,state){
  const target=state.vehicles[0],dx=target.x-vehicle.x,dy=target.y-vehicle.y,d=Math.max(1,Math.hypot(dx,dy));
  const side=((Math.floor(state.tick/210)+(state.seed&1))%2)?1:-1;
  const visible=clearLine(vehicle,target),advance=d>370?.95:d<230?-.7:.05,strife=visible?.5:1.15;
  let vx=dx/d*advance-dy/d*side*strife,vy=dy/d*advance+dx/d*side*strife;
  for(const block of COVER){const bx=vehicle.x-block.x,by=vehicle.y-block.y,bd=Math.max(1,Math.hypot(bx,by));if(bd<block.radius+120){const force=(block.radius+120-bd)/50;vx+=bx/bd*force;vy+=by/bd*force;}}
  const margin=115;
  if(vehicle.x<margin)vx+=(margin-vehicle.x)/60;if(vehicle.x>ARENA.width-margin)vx-=(vehicle.x-(ARENA.width-margin))/60;
  if(vehicle.y<margin)vy+=(margin-vehicle.y)/60;if(vehicle.y>ARENA.height-margin)vy-=(vehicle.y-(ARENA.height-margin))/60;
  const wanted=Math.atan2(vy,vx),bend=Math.abs(wrap(wanted-vehicle.heading));
  vehicle.heading=turn(vehicle.heading,wanted,2.2*STEP_SECONDS);
  vehicle.speed=approach(vehicle.speed,VEHICLES[vehicle.type].speed*(bend>1.3?.42:1.2),85*STEP_SECONDS);
  vehicle.x+=Math.cos(vehicle.heading)*vehicle.speed*STEP_SECONDS;vehicle.y+=Math.sin(vehicle.heading)*vehicle.speed*STEP_SECONDS;
  constrain(vehicle,state);vehicle.angle=turn(vehicle.angle,Math.atan2(target.y-vehicle.y,target.x-vehicle.x),2.6*STEP_SECONDS);
}
function separateVehicles(state){
  const [a,b]=state.vehicles,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=BODY_RADIUS*2;
  if(d>=min)return;
  const nx=d?dx/d:1,ny=d?dy/d:0,push=(min-d)/2;
  a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;a.speed*=.25;b.speed*=.25;
  constrain(a,state);constrain(b,state);
}
function shoot(vehicle,state,wanted){
  vehicle.cooldown=Math.max(0,vehicle.cooldown-1);
  if(!wanted||vehicle.shield===0||vehicle.cooldown>0||state.pulses.length>=MAX_PULSES)return;
  const spec=VEHICLES[vehicle.type],angle=vehicle.angle+(random(state)-.5)*(vehicle.id?.17:.025),power=spec.pulse+Math.floor(random(state)*4);
  state.pulses.push({id:state.shots++,owner:vehicle.id,x:vehicle.x+Math.cos(angle)*43,y:vehicle.y+Math.sin(angle)*43,vx:Math.cos(angle)*460,vy:Math.sin(angle)*460,age:0,power:vehicle.id?Math.max(4,Math.round(power*.56)):power});
  vehicle.cooldown=vehicle.id?Math.round(spec.cooldown*1.7):spec.cooldown;
  log(state,'pulse',{vehicle:vehicle.name,message:`${vehicle.name} emits an arcade pulse.`});
}
function advancePulses(state){
  const remaining=[];
  for(const pulse of state.pulses){
    const ax=pulse.x,ay=pulse.y,bx=ax+pulse.vx*STEP_SECONDS,by=ay+pulse.vy*STEP_SECONDS;
    pulse.age++;if(pulse.age>70)continue;
    let earliest=2,coverHit=false;
    for(const block of COVER){const t=circleHit(ax,ay,bx,by,block.x,block.y,block.radius+4);if(t!==null&&t<earliest){earliest=t;coverHit=true;}}
    const target=state.vehicles[1-pulse.owner],targetT=circleHit(ax,ay,bx,by,target.x,target.y,35);
    if(targetT!==null&&targetT<earliest){earliest=targetT;coverHit=false;}
    if(earliest<=1){
      const x=ax+(bx-ax)*earliest,y=ay+(by-ay)*earliest;
      if(coverHit)effect(state,x,y,'cover','#8c8170');
      else {target.shield=Math.max(0,target.shield-pulse.power);target.lastHit=state.tick;state.hits++;effect(state,x,y,'hit',VEHICLES[target.type].color);log(state,'impact',{vehicle:target.name,amount:pulse.power,shield:target.shield,message:`${target.name}: −${pulse.power} hull; ${target.shield} remains.`});}
      continue;
    }
    pulse.x=bx;pulse.y=by;if(bx>=0&&by>=0&&bx<=ARENA.width&&by<=ARENA.height)remaining.push(pulse);
  }
  state.pulses=remaining;
}
function finish(state,reason){
  const shares=state.vehicles.map(v=>v.shield/VEHICLES[v.type].shield);
  state.status='finished';state.reason=reason;state.winner=Math.abs(shares[0]-shares[1])<1e-8?null:shares[0]>shares[1]?0:1;
  for(const v of state.vehicles){v.speed=0;v.boosting=false;}
  log(state,'finish',{winner:state.winner,reason,message:state.winner===null?'Draw. Equal hull share remains.':`${state.vehicles[state.winner].name} takes the round.`});
}

/** One fixed step; caller-owned state, input, and prior replay runs remain unchanged. */
export function stepPlayMatch(input,controls={}){
  if(!input||input.schema!=='monstros-play-state/v2'||input.status==='finished')return input;
  const state={...input,vehicles:input.vehicles.map(v=>({...v})),events:input.events.map(e=>({...e})),pulses:input.pulses.map(p=>({...p})),effects:input.effects.filter(e=>input.tick+1-e.tick<18).map(e=>({...e})),inputRuns:input.inputRuns.map(run=>run.slice())};
  const tuple=inputTuple(controls),canonical=tupleInput(tuple);appendInput(state,tuple);state.tick++;state.status='running';
  movePlayer(state.vehicles[0],canonical,state);moveOpponent(state.vehicles[1],state);separateVehicles(state);
  shoot(state.vehicles[0],state,canonical.fire);
  const enemy=state.vehicles[1],player=state.vehicles[0],aimError=Math.abs(wrap(Math.atan2(player.y-enemy.y,player.x-enemy.x)-enemy.angle));
  shoot(enemy,state,distance(enemy,player)<720&&aimError<.24&&clearLine(enemy,player));
  advancePulses(state);
  if(state.vehicles.some(v=>v.shield===0))finish(state,'hull depleted');else if(state.tick>=PLAY_MAX_TICKS)finish(state,'80-second limit');
  return state;
}

function snapshot(state){
  return {tick:state.tick,status:state.status,winner:state.winner,reason:state.reason,rng:state.rng,shots:state.shots,hits:state.hits,vehicles:state.vehicles.map(v=>({id:v.id,type:v.type,x:round(v.x),y:round(v.y),heading:round(v.heading),angle:round(v.angle),speed:round(v.speed),boost:round(v.boost),boostLocked:v.boostLocked,boosting:v.boosting,shield:v.shield,cooldown:v.cooldown,lastHit:v.lastHit})),pulses:state.pulses.map(p=>({...p,x:round(p.x),y:round(p.y),vx:round(p.vx),vy:round(p.vy)}))};
}
export function exportPlayReplay(state){
  return {schema:'monstros-play-replay/v2',engine:'monstros-drive/v2',scope:'Recorded inputs in a fictional deterministic arcade game; no physical or tactical calibration.',seed:state.seed,pairing:state.pairing,ticks:state.tick,inputRuns:state.inputRuns.map(run=>run.slice()),result:snapshot(state),events:state.events.map(e=>({...e}))};
}
export function replayPlayRecord(record){
  const invalid=error=>({ok:false,error});
  if(!recordObject(record)||record.schema!=='monstros-play-replay/v2'||record.engine!=='monstros-drive/v2'||!Number.isInteger(record.ticks)||record.ticks<0||record.ticks>PLAY_MAX_TICKS||!Array.isArray(record.inputRuns)||record.inputRuns.length>PLAY_MAX_TICKS||!Array.isArray(record.events)||record.events.length>MAX_EVENTS||!recordObject(record.result)||record.result.tick!==record.ticks)return invalid('Unsupported or out-of-bounds driving replay.');
  let total=0,previous=null;
  for(const run of record.inputRuns){
    if(!Array.isArray(run)||run.length!==5||!run.every(Number.isInteger)||run[0]<1||run[0]>PLAY_MAX_TICKS||run.slice(1,4).some(v=>v< -1000||v>1000)||run[4]<0||run[4]>15)return invalid('A recorded driving input is invalid.');
    if(previous&&previous.slice(1).every((value,i)=>value===run[i+1]))return invalid('Adjacent identical input runs must be combined.');
    total+=run[0];if(total>PLAY_MAX_TICKS)return invalid('Driving input history exceeds the match limit.');previous=run;
  }
  if(total!==record.ticks)return invalid('Driving input history and replay tick count disagree.');
  let resultText,eventText;
  try {resultText=JSON.stringify(record.result);eventText=JSON.stringify(record.events);if(resultText.length>24000||eventText.length>100000)return invalid('Recorded output exceeds the replay size limit.');}catch{return invalid('Recorded output must be finite JSON data.');}
  const setup=createPlayMatch({seed:record.seed,pairing:record.pairing});if(!setup.ok)return setup;
  let state=setup.state;
  for(const run of record.inputRuns){const controls=tupleInput(run);for(let i=0;i<run[0];i++){if(state.status==='finished')return invalid('Driving replay advances past the completed round.');state=stepPlayMatch(state,controls);}}
  if(JSON.stringify(snapshot(state))!==resultText||JSON.stringify(state.events)!==eventText)return invalid('Driving inputs do not reproduce the recorded result and event history.');
  return {ok:true,state};
}
