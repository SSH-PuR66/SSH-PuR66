import {VEHICLES,STEP_SECONDS,MAX_TICKS,createMatch,stepMatch,exportReplay,replayRecord} from './model.mjs';
import {createScene} from './scene3d.mjs';

const $=selector=>document.querySelector(selector),canvas=$('#arena');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embedded');
let state=createMatch().state,running=false,lastTime=0,accumulator=0,lastEventTick=-1,scene=null,inView=true,frame=0,lastPaint=0,renderFrames=0,frameWindow=0;
const names={cinder:'Armored pickup study',vanta:'Enclosed heavy-truck study',chalk:'Utility-truck study'};
function notice(text,error=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',error);}
function labels(){
  $('#play').textContent=running?'Pause duel Ⅱ':state.status==='finished'?'Replay duel ↺':'Run duel ▶';
  $('#play').setAttribute('aria-pressed',String(running));$('#mode-label').textContent=running?'3D / LIVE':'3D / PAUSED';
  $('#quick-play').textContent=running?'Pause Ⅱ':'Run ▶';$('#quick-play').setAttribute('aria-pressed',String(running));
  $('#step').disabled=running||state.status==='finished';
  $('#arena-state').textContent=state.status==='finished'?'ROUND COMPLETE':running?'MATCH IN PROGRESS':state.tick?'PAUSED / INSPECT THE SCENE':'READY / DRAG TO EXPLORE';
  $('#scene-start').hidden=running||state.tick>0;
}
function pause(message){running=false;lastTime=0;accumulator=0;labels();if(message)notice(message);}
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
  const result=createMatch({seed:Number(raw),pairing:$('#pairing').value});
  if(!result.ok){notice(result.error,true);return false;}
  state=result.state;lastEventTick=-1;renderUI();scene?.update(state,{reduced:reduced.matches});
  notice('Drag to orbit · scroll to zoom. Run the duel, or inspect a single step.');return true;
}
function start(){
  const raw=$('#seed').value.trim();
  if(!/^\d{1,10}$/.test(raw)||Number(raw)!==state.seed||$('#pairing').value!==state.pairing){if(!reset())return;}
  if(state.status==='finished'&&!reset())return;
  running=true;lastTime=0;accumulator=0;labels();notice('Duel running. Change camera, pause to inspect damage, or export the replay.');
}
function toggle(){if(running)pause('Paused. Orbit the scene to inspect the vehicles and damage.');else start();}
function loop(now){
  frame=requestAnimationFrame(loop);
  if(document.hidden||!inView){lastTime=0;return;}
  const delta=lastTime?Math.min((now-lastTime)/1000,.1):0;lastTime=now;
  if(running){
    accumulator+=delta*Number($('#speed').value);
    let changed=false;
    while(accumulator>=STEP_SECONDS&&state.status!=='finished'){state=stepMatch(state);accumulator-=STEP_SECONDS;changed=true;}
    if(changed)renderUI();
    if(state.status==='finished'){pause();notice(`${state.winner===null?'Draw':state.vehicles[state.winner].name+' wins'}. Game outcome recorded; export the replay to verify it.`);}
  }
  if(now-lastPaint>=32){scene?.update(state,{running,delta:Math.min((now-lastPaint)/1000,.1),reduced:reduced.matches});lastPaint=now;renderFrames++;if(now-frameWindow>2000){canvas.dataset.fps=String(Math.round(renderFrames*1000/(now-frameWindow)));renderFrames=0;frameWindow=now;}}
}
$('#play').addEventListener('click',toggle);$('#scene-start').addEventListener('click',start);
$('#quick-play').addEventListener('click',toggle);
$('#step').addEventListener('click',()=>{if(running||state.status==='finished')return;state=stepMatch(state);renderUI();notice(`Tick ${state.tick}. Scene paused for inspection.`);});
$('#reset').addEventListener('click',reset);$('#pairing').addEventListener('change',reset);$('#seed').addEventListener('change',reset);
$('#new-seed').addEventListener('click',()=>{const values=new Uint32Array(1);crypto.getRandomValues(values);$('#seed').value=String(values[0]);reset();});
$('#camera').addEventListener('change',()=>scene?.setCamera($('#camera').value));
canvas.addEventListener('camera-mode-change',event=>{$('#camera').value=event.detail;});
$('#quality').addEventListener('change',()=>scene?.setQuality($('#quality').value));
$('#fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#arena-wrap').requestFullscreen();}catch{notice('Fullscreen is unavailable here. Open the full arena to expand the scene.');}
});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'Exit fullscreen ↙':'Expand ↗';});
canvas.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();toggle();}if(event.code==='ArrowRight'){event.preventDefault();$('#step').click();}if(event.code==='KeyR')reset();});
$('#download').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportReplay(state),null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`monstros-${state.seed}-tick-${state.tick}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice(`Replay exported at tick ${state.tick}.`);
});
$('#import').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;pause();
  if(file.size>262144){notice('Replay files are limited to 256 KiB.',true);return;}
  try{const result=replayRecord(JSON.parse(await file.text()));if(!result.ok){notice(result.error,true);return;}state=result.state;$('#seed').value=state.seed;$('#pairing').value=state.pairing;lastEventTick=-1;renderUI();notice(`Replay verified: ${state.tick} deterministic steps and the saved event history match.`);}catch{notice('This file is not a supported replay JSON document.',true);}
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
  reset();frame=requestAnimationFrame(loop);
  window.addEventListener('pagehide',event=>{pause();cancelAnimationFrame(frame);if(!event.persisted){observer.disconnect();resize.disconnect();scene?.dispose();}});
  window.addEventListener('pageshow',event=>{if(event.persisted){lastTime=0;scene?.resize();frame=requestAnimationFrame(loop);}});
}catch(error){
  $('#scene-start').hidden=true;$('#mode-label').textContent='3D / UNAVAILABLE';notice('This browser could not initialize WebGL 2. Enable graphics acceleration or use a WebGL-capable browser. Sources and replay rules remain available.',true);console.error('3D scene initialization failed:',error);
}
