import {ARENA,COVER,VEHICLES,PAIRINGS,STEP_SECONDS,MAX_TICKS,createMatch,stepMatch,exportReplay,replayRecord} from './model.mjs';

const $=selector=>document.querySelector(selector);
const canvas=$('#arena'),context=canvas.getContext('2d');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const embedded=new URLSearchParams(location.search).get('embed')==='1';
if(embedded)document.body.classList.add('embedded');
let state=createMatch().state,running=false,frame=0,lastTime=0,accumulator=0,lastEventTick=-1;

function notice(text,error=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',error);}
function labelControls(){
  $('#play').textContent=running?'Pause duel Ⅱ':state.status==='finished'?'Replay duel ↺':'Run duel ▶';
  $('#play').setAttribute('aria-pressed',String(running));
  $('#mode-label').textContent=running?'LOCAL / RUNNING':'LOCAL / PAUSED';
  $('#step').disabled=running||state.status==='finished';
}
function pause(message){running=false;cancelAnimationFrame(frame);lastTime=0;accumulator=0;labelControls();if(message)notice(message);}
function reset(){
  pause();
  const raw=$('#seed').value.trim();
  if(!/^\d{1,10}$/.test(raw)){notice('Enter a whole-number seed between 0 and 4,294,967,295.',true);return false;}
  const result=createMatch({seed:Number(raw),pairing:$('#pairing').value});
  if(!result.ok){notice(result.error,true);return false;}
  pause();state=result.state;lastEventTick=-1;labelControls();render();
  notice(reduced.matches?'Reduced motion is enabled. Step through the match, or explicitly choose Run duel.':'Ready. Run the duel or inspect one simulation step at a time.');
  return true;
}
function start(){
  const raw=$('#seed').value.trim();
  if(!/^\d{1,10}$/.test(raw)||Number(raw)!==state.seed||$('#pairing').value!==state.pairing){if(!reset())return;}
  if(state.status==='finished'&&!reset())return;
  running=true;lastTime=0;accumulator=0;labelControls();notice('Running a local fictional match. Pause at any time; export preserves the current state.');
  frame=requestAnimationFrame(loop);
}
function toggle(){if(running)pause('Paused. The seed, event history, and simulation state are retained.');else start();}
function loop(now){
  if(!running)return;
  if(lastTime)accumulator+=Math.min((now-lastTime)/1000,0.1)*Number($('#speed').value);
  lastTime=now;
  while(accumulator>=STEP_SECONDS&&state.status!=='finished'){state=stepMatch(state);accumulator-=STEP_SECONDS;}
  render();
  if(state.status==='finished'){pause();notice(`${winnerText()} ${state.reason}. Export the replay to inspect or verify the result.`);return;}
  frame=requestAnimationFrame(loop);
}
function winnerText(){return state.winner===null?'The round is a draw.':`${state.vehicles[state.winner].name} wins this fictional round.`;}
function polygon(points,fill,stroke,line=1){context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();context.fillStyle=fill;context.fill();if(stroke){context.strokeStyle=stroke;context.lineWidth=line;context.stroke();}}
function line(x1,y1,x2,y2,color,width=1){context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.strokeStyle=color;context.lineWidth=width;context.stroke();}
function circle(x,y,r,color,stroke){context.beginPath();context.arc(x,y,r,0,Math.PI*2);if(color){context.fillStyle=color;context.fill();}if(stroke){context.strokeStyle=stroke;context.lineWidth=1;context.stroke();}}
function truck(vehicle){
  const spec=VEHICLES[vehicle.type],dead=vehicle.shield===0;
  context.save();context.translate(vehicle.x,vehicle.y);context.rotate(vehicle.angle);
  context.globalAlpha=dead?0.45:1;
  for(const y of [-32,20])for(const x of [-41,-9,23]){
    context.fillStyle='#07090a';context.fillRect(x,y,21,12);
    for(let tread=0;tread<5;tread++)line(x+3+tread*3,y+1,x+3+tread*3,y+11,'#45494a');
  }
  polygon([[-54,-27],[22,-27],[56,-13],[62,0],[56,13],[22,27],[-54,27]],'#090c0e',null);
  const outline=spec.shape==='wedge'?[[-51,-23],[22,-23],[56,0],[22,23],[-51,23]]:spec.shape==='box'?[[-51,-24],[36,-24],[52,-14],[52,14],[36,24],[-51,24]]:[[-51,-23],[33,-23],[55,-10],[42,0],[55,10],[33,23],[-51,23]];
  polygon(outline,dead?'#2b3031':'#292d30',spec.color,2);
  polygon([[-45,-19],[-18,-19],[-18,19],[-45,19]],dead?'#343437':spec.color+'55',spec.color+'aa');
  polygon([[-13,-18],[18,-18],[29,-9],[29,9],[18,18],[-13,18]],'#44474a',spec.color+'bb');
  polygon([[20,-15],[33,-12],[39,-5],[27,-7]],'#0c171b','#a3bfbd');
  polygon([[20,15],[33,12],[39,5],[27,7]],'#0c171b','#a3bfbd');
  line(-42,-12,-24,-12,'#bab6a4');line(-42,12,-24,12,'#bab6a4');line(-41,0,-24,0,spec.color);
  polygon([[-9,-10],[14,-10],[21,0],[14,10],[-9,10]],'#181c20',spec.color);
  circle(5,0,5,spec.color+'66',spec.color);
  line(12,0,45,0,spec.color,3);line(45,-6,45,6,spec.color,2);
  for(const y of [-20,17]){context.fillStyle=dead?'#554d3e':'#ffe8b8';context.fillRect(37,y,7,3);}
  for(const x of [-46,-20,8,29])for(const y of [-21,21])circle(x,y,1.4,'#d3c9b5');
  if(state.tick-vehicle.lastHit<5){context.globalAlpha=.25;polygon(outline,'#fff7dc',null);}
  context.restore();
  const ratio=vehicle.shield/spec.shield;
  context.fillStyle='#303b3e';context.fillRect(vehicle.x-35,vehicle.y-54,70,4);
  context.fillStyle=spec.color;context.fillRect(vehicle.x-35,vehicle.y-54,70*ratio,4);
  context.font='10px Consolas, monospace';context.textAlign='center';context.fillStyle=spec.color;
  context.fillText(vehicle.name.toUpperCase(),vehicle.x,vehicle.y-63);
}
function draw(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  if(canvas.width!==ARENA.width*dpr){canvas.width=ARENA.width*dpr;canvas.height=ARENA.height*dpr;}
  context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,ARENA.width,ARENA.height);
  context.fillStyle='#111619';context.fillRect(0,0,1000,600);
  for(let x=40;x<1000;x+=40)line(x,40,x,560,'#20282b');
  for(let y=40;y<600;y+=40)line(40,y,960,y,'#20282b');
  for(let x=80;x<960;x+=80)for(let y=80;y<560;y+=80){line(x-3,y,x+3,y,'#384144');line(x,y-3,x,y+3,'#384144');}
  context.strokeStyle='#56605d';context.lineWidth=1;context.strokeRect(40,40,920,520);
  context.setLineDash([6,10]);circle(500,300,190,null,'#344044');line(500,40,500,560,'#394648');context.setLineDash([]);
  context.font='10px Consolas, monospace';context.fillStyle='#667273';context.textAlign='left';context.fillText('A / CINDER FIELD',59,64);context.textAlign='right';context.fillText('B / MIRROR FIELD',941,536);
  for(const block of COVER){
    context.save();context.translate(block.x,block.y);context.rotate(Math.PI/4);
    const r=block.radius*.86;polygon([[-r,-r],[r,-r],[r,r],[-r,r]],'#20292c','#5b6461');
    line(-r+7,-r+7,r-7,r-7,'#414d4f');line(-r+7,r-7,r-7,-r+7,'#414d4f');
    context.strokeStyle='#827c67';context.strokeRect(-r+5,-r+5,r*2-10,r*2-10);context.restore();
    circle(block.x,block.y,block.radius+8,null,'#273337');
  }
  for(const pulse of state.pulses){
    const color=VEHICLES[state.vehicles[pulse.owner].type].color;
    line(pulse.x-pulse.vx*.05,pulse.y-pulse.vy*.05,pulse.x,pulse.y,color+'55',5);
    line(pulse.x-pulse.vx*.025,pulse.y-pulse.vy*.025,pulse.x,pulse.y,color,2);
    circle(pulse.x,pulse.y,3,'#fff0ce');
  }
  for(const vehicle of state.vehicles)truck(vehicle);
  for(const effect of state.effects){
    const age=state.tick-effect.tick;context.globalAlpha=Math.max(0,1-age/18);
    circle(effect.x,effect.y,4+age*1.6,null,effect.color);
    for(let i=0;i<6;i++){const a=i*Math.PI/3+effect.tick;line(effect.x+Math.cos(a)*(4+age),effect.y+Math.sin(a)*(4+age),effect.x+Math.cos(a)*(10+age*2),effect.y+Math.sin(a)*(10+age*2),effect.color,1.5);}
  }
  context.globalAlpha=1;
  if(state.status==='finished'){
    context.fillStyle='#0b1016bd';context.fillRect(290,236,420,126);
    context.strokeStyle='#7a6a59';context.strokeRect(290,236,420,126);
    context.textAlign='center';context.font='10px Consolas, monospace';context.fillStyle='#c4b59b';context.fillText('ROUND COMPLETE / FICTIONAL RESULT',500,264);
    context.font='bold 31px Arial, sans-serif';context.fillStyle='#eee5d1';context.fillText(state.winner===null?'DRAW':state.vehicles[state.winner].name.toUpperCase()+' WINS',500,307);
    context.font='10px Consolas, monospace';context.fillStyle='#c4b59b';context.fillText('SEED '+state.seed+' / '+state.tick+' TICKS',500,340);
  }
}
function render(){
  draw();$('#tick').textContent=`TICK ${String(state.tick).padStart(4,'0')} / ${MAX_TICKS}`;
  $('#clock').textContent=(state.tick*STEP_SECONDS).toFixed(2).padStart(5,'0')+'s';
  $('#arena-state').textContent=state.status==='finished'?'ROUND COMPLETE':running?'MATCH IN PROGRESS':state.tick?'PAUSED / STATE RETAINED':'READY / RUN THE DUEL';
  for(const vehicle of state.vehicles){
    const card=$(`#vehicle-${vehicle.id}`),spec=VEHICLES[vehicle.type];card.style.setProperty('--vehicle-color',spec.color);card.style.borderColor=spec.color;
    card.querySelector('h3').textContent=spec.name;card.querySelector('.shield strong').textContent=`${vehicle.shield} / ${spec.shield}`;
    const meter=card.querySelector('meter');meter.max=spec.shield;meter.value=vehicle.shield;meter.textContent=String(vehicle.shield);meter.setAttribute('aria-label',spec.name+' shield');
    card.querySelector('.vehicle-type').textContent=spec.shape+' silhouette / arcade pulse';
  }
  $('#shots').textContent=String(state.shots);$('#hits').textContent=String(state.hits);
  $('#result').textContent=state.status==='finished'?(state.winner===null?'DRAW':state.vehicles[state.winner].name.toUpperCase()+' WINS'):state.tick?'ROUND IN PROGRESS':'MATCH READY';
  const latest=state.events.at(-1)?.tick;
  if(latest!==lastEventTick){
    lastEventTick=latest;const list=$('#events');list.replaceChildren();
    for(const event of state.events.slice(-8).reverse()){
      const item=document.createElement('li');for(const value of [String(event.tick).padStart(4,'0'),event.type,event.message]){const span=document.createElement('span');span.textContent=value;item.append(span);}list.append(item);
    }
  }
}
$('#play').addEventListener('click',toggle);
$('#step').addEventListener('click',()=>{if(running||state.status==='finished')return;state=stepMatch(state);render();labelControls();notice(state.status==='finished'?winnerText():`Advanced to tick ${state.tick}. No animation is running.`);});
$('#reset').addEventListener('click',reset);
$('#pairing').addEventListener('change',reset);
$('#seed').addEventListener('change',reset);
$('#new-seed').addEventListener('click',()=>{const values=new Uint32Array(1);crypto.getRandomValues(values);$('#seed').value=String(values[0]);reset();});
canvas.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();toggle();}if(event.code==='ArrowRight'){event.preventDefault();$('#step').click();}if(event.code==='KeyR'){event.preventDefault();reset();}});
$('#download').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportReplay(state),null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`monstros-${state.seed}-tick-${state.tick}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notice(`Replay exported at tick ${state.tick}. Import it to recompute and verify the recorded result.`);
});
$('#import').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  pause();if(file.size>262144){notice('Replay files are limited to 256 KiB.',true);return;}
  try{
    const result=replayRecord(JSON.parse(await file.text()));if(!result.ok){notice(result.error,true);return;}
    state=result.state;$('#seed').value=String(state.seed);$('#pairing').value=state.pairing;lastEventTick=-1;render();labelControls();notice(`Replay verified: ${state.tick} deterministic steps and the saved event history match.`);
  }catch{notice('This file is not a supported replay JSON document.',true);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause('Paused because the page became hidden. Resume when ready.');});
reduced.addEventListener('change',()=>{if(reduced.matches&&running)pause('Reduced motion enabled. Continue with individual steps or explicitly resume.');});
window.addEventListener('resize',()=>{if(!running)render();});
if(context){
  for(const element of document.querySelectorAll('button,input,select'))element.disabled=false;
  // SVG elements do not reflect HTMLElement.hidden into an attribute.
  $('#poster').setAttribute('hidden','');reset();
}else notice('Canvas is unavailable in this browser. The source and rules remain accessible.',true);
