import {VEHICLES,STEP_SECONDS,MAX_TICKS,createMatch,stepMatch,exportReplay,replayRecord} from './model.mjs';
import {createScene} from './scene3d.mjs';
import {createAudio} from './audio3d.mjs';
import {createControls} from './input3d.mjs';
import {createPlayMatch,stepPlayMatch,exportPlayReplay,replayPlayRecord} from './play-model.mjs';

const $=selector=>document.querySelector(selector),canvas=$('#arena');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embedded');
let state=createPlayMatch().state,running=false,lastTime=0,accumulator=0,lastEventTick=-1,scene=null,inView=true,frame=0,lastPaint=0,renderFrames=0,frameWindow=0;
let garageView=true,mode='drive';
const audio=createAudio();let soundEnabled=false;
const controls=createControls({canvas,root:$('#arena-wrap'),isActive:()=>mode==='drive'&&!garageView,onPause:()=>toggle(),onRestart:()=>reset(),onFocusLoss:()=>{if(running)pause('Paused when focus left the game. Resume to drive.');}});
const names={cinder:'Armored pickup study',vanta:'Enclosed heavy-truck study',chalk:'Utility-truck study'};
function notice(text,error=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',error);}
function labels(){
  $('#play').textContent=running?'Pause Ⅱ':state.status==='finished'?'Play again ↺':mode==='drive'?'Drive & fight ▶':'Watch duel ▶';
  $('#play').setAttribute('aria-pressed',String(running));$('#mode-label').textContent=running?'3D / LIVE':'3D / PAUSED';
  $('#quick-play').textContent=running?'Pause Ⅱ':'Run ▶';$('#quick-play').setAttribute('aria-pressed',String(running));
  $('#step').disabled=garageView||running||state.status==='finished';
  $('#arena-state').textContent=state.status==='finished'?'ROUND COMPLETE':running?(mode==='drive'?'YOU ARE DRIVING / P TO PAUSE':'WATCHING THE DUEL'):state.tick?'PAUSED / INSPECT THE SCENE':'READY / TAKE THE WHEEL';
  $('#scene-start').textContent=garageView||mode==='drive'?'Drive & fight ▶':'Watch the duel ▶';
  $('#scene-start').hidden=garageView?false:running||state.tick>0;
  if(garageView){$('#mode-label').textContent='GARAGE / INTERACTIVE';$('#arena-state').textContent=Number($('#damage').value)?'DAMAGE STUDY':'DRAG TO INSPECT';$('#tick').textContent='ORIGINAL MESH / '+$('#garage-vehicle').value.toUpperCase();$('#clock').textContent='360° / INSPECTION';}
  $('#drive-hud').hidden=garageView||mode!=='drive';$('#driving-guide').hidden=garageView||mode!=='drive';
  $('#touch-controls').hidden=garageView||mode!=='drive'||!$('#touch-toggle').checked;
  $('#round-result').hidden=garageView||mode!=='drive'||state.status!=='finished';
  $('#speed').disabled=mode==='drive';
  $('#drive-pause').textContent=running?'Pause Ⅱ':'Resume ▶';$('#drive-pause').hidden=state.status==='finished'||(!running&&state.tick===0);
  $('#camera').disabled=garageView||(mode==='drive'&&running);
  scene?.setPlaying(running&&mode==='drive'&&!garageView);
}
function setView(view,{selectGarage=true}={}){
  const next=view===true?'garage':view===false?mode:view,garage=next==='garage';
  if(selectGarage&&garageView&&next==='drive')$('#pairing').value={cinder:'cinder-vanta',vanta:'vanta-chalk',chalk:'chalk-cinder'}[$('#garage-vehicle').value];
  const changed=!garage&&(mode!==next||state.pairing!==$('#pairing').value);
  if(!garage)mode=next;garageView=garage;pause();
  $('#arena-wrap').classList.toggle('garage-view',garage);$('#garage-controls').hidden=!garage;
  for(const button of document.querySelectorAll('[data-scene-view]'))button.setAttribute('aria-pressed',String(button.dataset.sceneView===(garage?'garage':mode)));
  scene?.setGarage(garage?$('#garage-vehicle').value:null,1-Number($('#damage').value)/100);
  if(changed)reset();
  if(!garage){$('#camera').value=mode==='drive'?'driver':'action';scene?.setCamera($('#camera').value);}
  $('#camera').disabled=garage;$('#step').disabled=garage||running||state.status==='finished';
  renderUI();scene?.update(state,{reduced:reduced.matches});
}
function pause(message){running=false;lastTime=0;accumulator=0;controls.release();audio.quiet();labels();if(message)notice(message);}
function advance(){state=mode==='drive'?stepPlayMatch(state,controls.snapshot($('#aim-assist').checked)):stepMatch(state);}
function renderUI(){
  $('#tick').textContent=`TICK ${String(state.tick).padStart(4,'0')} / ${MAX_TICKS}`;
  $('#clock').textContent=(state.tick*STEP_SECONDS).toFixed(2).padStart(5,'0')+'s';labels();
  for(const vehicle of state.vehicles){
    const card=$(`#vehicle-${vehicle.id}`),spec=VEHICLES[vehicle.type];card.style.setProperty('--vehicle-color',spec.color);card.style.borderColor=spec.color;
    card.querySelector('h3').textContent=spec.name;card.querySelector('.shield strong').textContent=`${vehicle.shield} / ${spec.shield}`;
    const meter=card.querySelector('meter');meter.max=spec.shield;meter.value=vehicle.shield;meter.textContent=String(vehicle.shield);meter.setAttribute('aria-label',spec.name+' hull integrity');
    card.querySelector('.vehicle-type').textContent=names[vehicle.type];card.querySelector('.eyebrow').textContent=`0${vehicle.id+1} / ${names[vehicle.type].toUpperCase()}`;
    $(`#camera option[value="${vehicle.id?'vanta':'cinder'}"]`).textContent='Follow '+spec.name;
  }
  $('#shots').textContent=state.shots;$('#hits').textContent=state.hits;$('#result').textContent=state.status==='finished'?(state.winner===null?'DRAW':state.vehicles[state.winner].name.toUpperCase()+' WINS'):state.tick?'ROUND IN PROGRESS':'MATCH READY';
  const human=state.vehicles[0],enemy=state.vehicles[1];
  $('#drive-speed').textContent=String(Math.round(Math.abs(human.speed||0)));$('#drive-gear').textContent=(human.speed||0)<-1?'REV':(human.speed||0)>1?'FWD':'IDLE';
  $('#drive-hull').textContent=human.shield;$('#boost-value').textContent=Math.round(human.boost??100)+'%';$('#boost-fill').style.width=(human.boost??100)+'%';
  $('#aim-state').textContent=$('#aim-assist').checked?'AIM ASSIST':'Q / E — AIM';
  $('#map-player').setAttribute('transform',`translate(${human.x/10} ${human.y/10}) rotate(${(human.heading||0)*180/Math.PI})`);
  $('#map-rival').setAttribute('cx',enemy.x/10);$('#map-rival').setAttribute('cy',enemy.y/10);
  canvas.dataset.playerX=human.x.toFixed(2);canvas.dataset.playerY=human.y.toFixed(2);canvas.dataset.playerHeading=String(human.heading??0);canvas.dataset.playerSpeed=String(human.speed??0);canvas.dataset.shots=String(state.shots);canvas.dataset.mode=mode;canvas.dataset.tick=String(state.tick);
  $('#round-title').textContent=state.winner===null?'Dead heat.':state.winner===0?'You took the yard.':human.shield===0?'Your truck is down.':'The rival took the yard.';
  $('#round-detail').textContent=`${(state.tick*STEP_SECONDS).toFixed(1)}s · ${state.hits} impacts · ${human.shield} hull remaining`;
  if(state.events.at(-1)?.tick!==lastEventTick){
    lastEventTick=state.events.at(-1)?.tick;const list=$('#events');list.replaceChildren();
    for(const event of state.events.slice(-8).reverse()){
      const item=document.createElement('li');for(const value of [String(event.tick).padStart(4,'0'),event.type,event.message.replaceAll('shield','hull')]){const span=document.createElement('span');span.textContent=value;item.append(span);}list.append(item);
    }
  }
}
function reset(){
  pause();const raw=$('#seed').value.trim();
  if(!/^\d{1,10}$/.test(raw)){notice('Enter a whole-number seed between 0 and 4,294,967,295.',true);return false;}
  const result=(mode==='drive'?createPlayMatch:createMatch)({seed:Number(raw),pairing:$('#pairing').value});
  if(!result.ok){notice(result.error,true);return false;}
  state=result.state;lastEventTick=-1;renderUI();scene?.update(state,{reduced:reduced.matches});
  notice(mode==='drive'?'Ready. W/S drive, A/D steer, Space fire, Shift boost, X brake, P pause.':'Ready to watch the seeded duel.');return true;
}
function start(){
  if(garageView){const type=$('#garage-vehicle').value;$('#pairing').value={cinder:'cinder-vanta',vanta:'vanta-chalk',chalk:'chalk-cinder'}[type];setView('drive');}
  const raw=$('#seed').value.trim();
  if(!/^\d{1,10}$/.test(raw)||Number(raw)!==state.seed||$('#pairing').value!==state.pairing){if(!reset())return;}
  if(state.status==='finished'&&!reset())return;
  if(mode==='drive'){$('#camera').value='driver';scene?.setCamera('driver');}
  running=true;lastTime=0;accumulator=0;labels();canvas.focus({preventScroll:true});notice(mode==='drive'?'You control the first truck. W/S drive · A/D steer · Space fire · Shift boost · X brake · P pause.':'Watching the duel. Change camera, pause to inspect damage, or export the replay.');
}
function toggle(){if(running)pause('Paused. Orbit the scene to inspect the vehicles and damage.');else start();}
function loop(now){
  frame=requestAnimationFrame(loop);
  if(document.hidden||!inView){lastTime=0;return;}
  const delta=lastTime?Math.min((now-lastTime)/1000,.1):0;lastTime=now;
  if(running){
    accumulator+=delta*(mode==='drive'?1:Number($('#speed').value));
    let changed=false;
    while(accumulator>=STEP_SECONDS&&state.status!=='finished'){advance();accumulator-=STEP_SECONDS;changed=true;}
    if(changed)renderUI();
    if(state.status==='finished'){pause();notice(`${state.winner===null?'Draw':state.vehicles[state.winner].name+' wins'}. Game outcome recorded; export the replay to verify it.`);}
  }
  if(now-lastPaint>=32){scene?.update(state,{running,delta:Math.min((now-lastPaint)/1000,.1),reduced:reduced.matches});audio.update(state,running&&!garageView);lastPaint=now;renderFrames++;if(now-frameWindow>2000){canvas.dataset.fps=String(Math.round(renderFrames*1000/(now-frameWindow)));renderFrames=0;frameWindow=now;}}
}
$('#play').addEventListener('click',toggle);$('#scene-start').addEventListener('click',start);
$('#quick-play').addEventListener('click',toggle);
$('#drive-pause').addEventListener('click',toggle);
$('#step').addEventListener('click',()=>{if(running||state.status==='finished')return;advance();renderUI();notice(`Tick ${state.tick}. Scene paused for inspection.`);});
$('#reset').addEventListener('click',reset);$('#pairing').addEventListener('change',reset);$('#seed').addEventListener('change',reset);
$('#new-seed').addEventListener('click',()=>{const values=new Uint32Array(1);crypto.getRandomValues(values);$('#seed').value=String(values[0]);reset();});
$('#camera').addEventListener('change',()=>scene?.setCamera($('#camera').value));
canvas.addEventListener('camera-mode-change',event=>{$('#camera').value=event.detail;});
$('#quality').addEventListener('change',()=>scene?.setQuality($('#quality').value));
$('#lighting').addEventListener('change',()=>scene?.setLighting($('#lighting').value));
$('#sound').addEventListener('click',async()=>{try{soundEnabled=await audio.setEnabled(!soundEnabled);$('#sound').textContent=soundEnabled?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(soundEnabled));}catch{notice('Sound is unavailable in this browser. Visual playback is ready.',true);}});
for(const button of document.querySelectorAll('[data-scene-view]'))button.addEventListener('click',()=>setView(button.dataset.sceneView));
$('#touch-toggle').addEventListener('change',labels);$('#aim-assist').addEventListener('change',renderUI);
$('#play-again').addEventListener('click',()=>{if(reset())start();});
$('#garage-vehicle').addEventListener('change',()=>{scene?.setGarage($('#garage-vehicle').value,1-Number($('#damage').value)/100);labels();});
$('#damage').addEventListener('input',()=>{const value=Number($('#damage').value);$('#damage-value').textContent=value+'%';scene?.setDamage(1-value/100);labels();});
function closeExpanded(){ $('#arena-wrap').classList.remove('expanded');document.body.classList.remove('scene-expanded');$('#fullscreen').textContent='Expand ↗';scene?.resize(); }
$('#fullscreen').addEventListener('click',async()=>{
  if($('#arena-wrap').classList.contains('expanded')){closeExpanded();return;}
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#arena-wrap').requestFullscreen();}catch{$('#arena-wrap').classList.add('expanded');document.body.classList.add('scene-expanded');$('#fullscreen').textContent='Exit expanded view ↙';scene?.resize();}
});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'Exit fullscreen ↙':'Expand ↗';});
document.addEventListener('keydown',event=>{if(event.code==='Escape'&&$('#arena-wrap').classList.contains('expanded'))closeExpanded();});
canvas.addEventListener('keydown',event=>{if(mode==='drive'&&!garageView)return;if(event.code==='Space'){event.preventDefault();toggle();}if(event.code==='ArrowRight'){event.preventDefault();$('#step').click();}if(event.code==='KeyR')reset();});
$('#download').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(mode==='drive'?exportPlayReplay(state):exportReplay(state),null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`monstros-${state.seed}-tick-${state.tick}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice(`Replay exported at tick ${state.tick}.`);
});
$('#import').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;pause();
  if(file.size>262144){notice('Replay files are limited to 256 KiB.',true);return;}
  try{const record=JSON.parse(await file.text()),watch=record.schema==='monstros-replay/v1';const result=(watch?replayRecord:replayPlayRecord)(record);if(!result.ok){notice(result.error,true);return;}mode=watch?'watch':'drive';state=result.state;$('#seed').value=state.seed;$('#pairing').value=state.pairing;lastEventTick=-1;setView(false,{selectGarage:false});notice(`Replay verified: ${state.tick} deterministic steps and the saved event history match.`);}catch{notice('This file is not a supported replay JSON document.',true);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause('Paused while the page is hidden.');});
reduced.addEventListener('change',()=>{if(reduced.matches&&running)pause('Reduced motion enabled. Use Step to inspect the scene.');});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();pause('The graphics context was interrupted. Waiting for the browser to restore it.');});
canvas.addEventListener('webglcontextrestored',()=>{scene?.resize();notice('Graphics restored. Resume the duel when ready.');});
const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(!inView&&running)pause('Paused while the arena is off screen.');},{rootMargin:'160px'});observer.observe(canvas);
try{
  scene=createScene(canvas);$('#poster').setAttribute('hidden','');
  for(const element of document.querySelectorAll('button,input,select'))element.disabled=false;
  const resize=new ResizeObserver(()=>scene?.resize());resize.observe($('#arena-frame'));
  $('#touch-toggle').checked=matchMedia('(pointer: coarse)').matches||innerWidth<700;
  reset();frame=requestAnimationFrame(loop);
  const params=new URLSearchParams(location.search);setView(params.has('play')?'drive':params.has('duel')?'watch':'garage');
  window.addEventListener('pagehide',event=>{pause();cancelAnimationFrame(frame);if(!event.persisted){observer.disconnect();resize.disconnect();scene?.dispose();audio.dispose();controls.dispose();}});
  window.addEventListener('pageshow',event=>{if(event.persisted){lastTime=0;scene?.resize();frame=requestAnimationFrame(loop);}});
}catch(error){
  $('#scene-start').hidden=true;$('#mode-label').textContent='3D / UNAVAILABLE';notice('This browser could not initialize WebGL 2. Enable graphics acceleration or use a WebGL-capable browser. Sources and replay rules remain available.',true);console.error('3D scene initialization failed:',error);
}
