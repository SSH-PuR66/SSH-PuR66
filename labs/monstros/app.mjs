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
// The camera and materials describe an illustrated scene, not vehicle physics.
const materials={
  cinder:{top:'#85826b',side:'#4d5144',edge:'#a5a18a',rust:'#80583d',stripe:'#a64c3c',label:'Armored pickup silhouette'},
  vanta:{top:'#596052',side:'#333c34',edge:'#838a72',rust:'#786044',stripe:'#c0ad75',label:'Armored cargo-truck silhouette'},
  chalk:{top:'#8b8f88',side:'#505953',edge:'#b6b8a9',rust:'#7d6551',stripe:'#8eaaa3',label:'Enclosed utility-truck silhouette'}
};
const project=(x,y,z=0)=>[40+x*.92+(y-300)*.055,62+y*.79-z];
const worldLine=(x1,y1,x2,y2,color,width=1,z=0)=>{const a=project(x1,y1,z),b=project(x2,y2,z);line(...a,...b,color,width);};
function localPoint(vehicle,x,y,z=0){const c=Math.cos(vehicle.angle),s=Math.sin(vehicle.angle);return project(vehicle.x+x*c-y*s,vehicle.y+x*s+y*c,z);}
function surface(vehicle,points,z,fill,stroke){polygon(points.map(p=>localPoint(vehicle,p[0],p[1],z)),fill,stroke,.8);}
function localLine(vehicle,a,b,color,width=1){line(...localPoint(vehicle,...a),...localPoint(vehicle,...b),color,width);}
function prism(vehicle,points,bottom,top,roof,side,edge){
  const faces=points.map((p,i)=>{const q=points[(i+1)%points.length],a=localPoint(vehicle,...p,bottom),b=localPoint(vehicle,...q,bottom),c=localPoint(vehicle,...q,top),d=localPoint(vehicle,...p,top);return {points:[a,b,c,d],depth:(a[1]+b[1])/2,index:i};}).sort((a,b)=>a.depth-b.depth);
  for(const face of faces)polygon(face.points,face.index%2?side:'#3e433a',edge,.65);
  surface(vehicle,points,top,roof,edge);
}
const rect=(x1,y1,x2,y2)=>[[x1,y1],[x2,y1],[x2,y2],[x1,y2]];
let scenery=null,trailTick=-1,trailIdentity='',trails=[];
function rememberTracks(){
  const identity=`${state.seed}/${state.pairing}`;
  if(state.tick<trailTick||identity!==trailIdentity){trails=[];trailTick=-1;trailIdentity=identity;}
  if(state.tick===trailTick)return;
  trailTick=state.tick;
  for(const v of state.vehicles)trails.push({x:v.x,y:v.y,angle:v.angle,tick:state.tick,id:v.id});
  trails=trails.filter(p=>state.tick-p.tick<165).slice(-330);
}
function yard(){
  const ground=context.createLinearGradient(0,0,1000,600);ground.addColorStop(0,'#43483c');ground.addColorStop(.45,'#625e4b');ground.addColorStop(1,'#77674e');context.fillStyle=ground;context.fillRect(0,0,1000,600);
  polygon([project(12,10),project(990,10),project(990,590),project(12,590)],'#66614f','#292e2a');
  for(const patch of [[[20,35],[400,35],[360,285],[45,300]],[[415,30],[970,30],[955,255],[433,258]],[[60,330],[490,315],[460,570],[20,580]],[[540,305],[970,278],[980,590],[520,560]]])polygon(patch.map(p=>project(...p)),'#696450','#504f40');
  for(let i=0;i<500;i++){
    const x=(i*137.331)%1000,y=(i*73.193)%600,p=project(x,y);
    context.fillStyle=i%3?'#252c2317':'#e0cf9d20';context.fillRect(p[0],p[1],1+(i%4),.6+(i%2));
  }
  for(const crack of [[[30,270],[110,278],[140,265],[210,285]],[[610,530],[640,492],[625,468],[650,441]],[[724,35],[704,82],[720,130]],[[200,590],[248,535],[255,498]]])for(let i=1;i<crack.length;i++)worldLine(...crack[i-1],...crack[i],'#383e3370',1.2);
  // Faded loading-bay paint and old wheel marks anchor the scale of the yard.
  for(const x of [90,135,180,770,815,860])worldLine(x,80,x,200,'#c4bb8965',3);
  worldLine(80,200,210,200,'#c4bb8965',3);worldLine(758,200,890,200,'#c4bb8965',3);
  for(let i=0;i<7;i++){worldLine(120+i*8,565,170+i*8,510,'#272f2726',3);worldLine(660+i*7,72,850+i*7,400,'#272f2714',2);}
  for(const block of COVER){const p=project(block.x+25,block.y+27);context.save();context.translate(...p);context.scale(1,.55);context.fillStyle='#151c1b43';context.beginPath();context.ellipse(0,0,block.radius*1.3,block.radius,0,0,Math.PI*2);context.fill();context.restore();}
  const wall={x:500,y:4,angle:0};prism(wall,rect(-493,-9,493,10),0,37,'#4e5147','#333a34','#72715b');
  for(let x=18;x<990;x+=16)worldLine(x,11,x,11,'#222e2b',1,34);
  for(const [x,number] of [[180,'01'],[500,'02'],[820,'03']]){
    const p=project(x,12,30);context.fillStyle='#202b29';context.fillRect(p[0]-63,p[1],126,28);for(let slat=0;slat<7;slat++)line(p[0]-61,p[1]+4+slat*3.3,p[0]+61,p[1]+4+slat*3.3,'#596151',.7);context.fillStyle='#aaa483';context.font='10px Arial';context.textAlign='center';context.fillText(number,p[0],p[1]-8);
  }
  const stripe=[project(20,565),project(980,565),project(980,580),project(20,580)];polygon(stripe,'#b8a36945');
  for(let x=25;x<980;x+=35)worldLine(x,580,x+18,565,'#353c3180',8);
  context.textAlign='left';context.font='bold 17px Arial';context.fillStyle='#c1b08750';const mark=project(80,390);context.save();context.translate(...mark);context.transform(1,0,.07,.79,0,0);context.fillText('KEEP CLEAR',0,0);context.restore();
  const vignette=context.createRadialGradient(500,300,170,500,300,610);vignette.addColorStop(0,'#111b1600');vignette.addColorStop(1,'#111b168c');context.fillStyle=vignette;context.fillRect(0,0,1000,600);
}
function cover(block,index){
  const v={x:block.x,y:block.y,angle:index?-.1:.05},r=block.radius;
  if(index===0){
    prism(v,rect(-r*.93,-r*.68,r*.93,r*.68),0,36,'#736449','#493f30','#a28d62');
    for(let x=-r*.8;x<r*.8;x+=9)localLine(v,[x,-r*.65,36],[x,r*.65,36],'#4d4537',1.6);
    for(let x=-r*.8;x<r*.8;x+=14)localLine(v,[x,r*.68,6],[x,r*.68,34],'#8b7853',1.8);
    localLine(v,[-r*.9,0,37],[r*.9,0,37],'#b5a071',1);
    surface(v,rect(17,-10,38,8),37,'#3c4035','#a3936e');
  }else{
    prism(v,rect(-r*.8,-r*.8,r*.8,r*.8),0,22,'#92917c','#5e6254','#bbb39a');
    for(const x of [-12,8])localLine(v,[x,-r*.8,23],[x,r*.8,23],'#545b4d',2);
    prism(v,rect(-r*.6,-r*.6,r*.35,r*.4),22,32,'#6a715e','#4b5146','#9b9b7e');
  }
}
function truck(vehicle){
  const m=materials[vehicle.type],spec=VEHICLES[vehicle.type],cargo=vehicle.type==='vanta',closed=vehicle.type==='chalk',dead=vehicle.shield===0;
  const wheelX=cargo?[-54,-29,41]:[-41,37];
  const shadow=rect(cargo?-81:-72,-35,72,35).map(([x,y])=>{const p=localPoint(vehicle,x+19,y+16,0);return p;});polygon(shadow,'#11171370');
  context.save();context.globalAlpha=dead?.7:1;
  for(const y of [-28,28])for(const x of wheelX){
    prism(vehicle,rect(x-10,y-6,x+10,y+6),2,17,'#202622','#101715','#3b4137');
    for(let tread=-7;tread<=7;tread+=4)localLine(vehicle,[x+tread,y-5,17],[x+tread,y+5,17],'#53584b',1.3);
  }
  prism(vehicle,rect(cargo?-74:-65,-24,64,24),7,15,'#4b5041','#252e28','#777761');
  if(cargo){
    prism(vehicle,[[-73,-26],[7,-26],[14,-19],[14,19],[7,26],[-73,26]],15,44,m.top,m.side,m.edge);
    for(let x=-63;x<7;x+=14){localLine(vehicle,[x,-26,16],[x,-26,43],m.edge,1);localLine(vehicle,[x,26,16],[x,26,43],m.edge,1);localLine(vehicle,[x,-25,44],[x,25,44],'#353f33',1);}
    surface(vehicle,rect(-67,-20,-25,20),45,'#66705b','#929b7d');
    surface(vehicle,rect(-20,-17,6,17),45,'#475543','#899275');
    prism(vehicle,rect(13,-23,43,23),15,35,m.top,m.side,m.edge);
  }else if(closed){
    prism(vehicle,[[-62,-24],[17,-24],[30,-16],[30,16],[17,24],[-62,24]],15,36,m.top,m.side,m.edge);
    for(const x of [-46,-17,11]){localLine(vehicle,[x,-24,18],[x,-24,35],'#404c46');localLine(vehicle,[x,24,18],[x,24,35],'#404c46');}
    surface(vehicle,rect(-55,-17,-23,17),37,'#78827a','#c1c6b2');surface(vehicle,rect(-16,-16,15,16),37,'#535f59','#afb7a5');
  }else{
    prism(vehicle,rect(-64,-23,-14,23),15,22,m.top,m.side,m.edge);
    surface(vehicle,rect(-57,-17,-20,17),23,'#323c32','#a39d7d');
    for(let x=-52;x<-21;x+=7)localLine(vehicle,[x,-15,23],[x,15,23],'#68705a',1);
    prism(vehicle,rect(-64,-25,-14,-20),20,29,m.top,m.side,m.edge);prism(vehicle,rect(-64,20,-14,25),20,29,m.top,m.side,m.edge);
    prism(vehicle,[[-11,-24],[18,-24],[30,-16],[30,16],[18,24],[-11,24]],15,38,m.top,m.side,m.edge);
    surface(vehicle,rect(-7,-17,15,17),39,'#7d8168','#b0ae8a');
  }
  const windshieldX=cargo?43:28,roof=cargo?35:closed?36:38;
  polygon([localPoint(vehicle,windshieldX-8,-18,roof),localPoint(vehicle,windshieldX-8,18,roof),localPoint(vehicle,windshieldX+2,18,23),localPoint(vehicle,windshieldX+2,-18,23)],'#152c2b','#9caaa0');
  localLine(vehicle,[windshieldX-8,0,roof],[windshieldX+2,0,23],'#69786b',1.4);
  localLine(vehicle,[windshieldX-5,-16,roof-3],[windshieldX-5,-4,roof-3],'#b0c6b65e',1.2);
  prism(vehicle,[[windshieldX+1,-20],[59,-19],[66,-12],[66,12],[59,19],[windshieldX+1,20]],14,23,m.top,m.side,m.edge);
  for(let y=-14;y<=14;y+=5)localLine(vehicle,[65,y,14],[65,y,22],'#1f2a23',2);
  prism(vehicle,rect(65,-29,71,29),9,16,'#88866d','#404b3e','#b3aa89');
  localLine(vehicle,[72,-24,15],[72,24,15],'#c2b698',1.3);
  for(const y of [-20,20]){
    polygon([localPoint(vehicle,65,y-4,18),localPoint(vehicle,65,y+4,18),localPoint(vehicle,65,y+4,22),localPoint(vehicle,65,y-4,22)],dead?'#6d6d51':'#e5d3a0','#b1ad8a');
    localLine(vehicle,[10,y>0?26:-26,25],[16,y>0?32:-32,29],'#252d27',2);
  }
  // An unanimated roof fixture is visual detail only; it has no aiming or performance model.
  const mount=cargo?-30:closed?-22:-35,mountZ=cargo?47:closed?39:25;
  prism(vehicle,rect(mount-6,-7,mount+7,7),mountZ,mountZ+8,'#4f5949','#2d392e','#8a947b');
  localLine(vehicle,[mount,-1,mountZ+10],[mount+23,-1,mountZ+10],'#283b31',3);
  localLine(vehicle,[mount+23,-1,mountZ+10],[mount+29,-1,mountZ+10],'#18271f',2);
  // Small plate joints, paint chips and a restrained identification stripe.
  for(const y of [-24,24])for(const x of [-56,-34,-15,14,48]){const p=localPoint(vehicle,x,y,cargo&&x<10?40:20);circle(...p,1.15,m.edge);}
  for(const [x,y,z] of [[-50,13,cargo?45:23],[-24,-17,cargo?45:23],[39,12,24],[8,-19,closed?37:39]])localLine(vehicle,[x,y,z],[x+8,y+1,z],m.rust,1.7);
  localLine(vehicle,[-52,26,cargo?31:24],[-29,26,cargo?31:24],m.stripe,3);
  localLine(vehicle,[-51,-26,cargo?31:24],[-28,-26,cargo?31:24],m.stripe,3);
  if(state.tick-vehicle.lastHit<3){context.globalAlpha=.25;surface(vehicle,rect(-55,-24,58,24),25,'#f9e2a3');}
  context.restore();
  const label=project(vehicle.x,vehicle.y,80),ratio=vehicle.shield/spec.shield;
  context.fillStyle='#111b19aa';context.fillRect(label[0]-34,label[1]-12,68,22);context.fillStyle='#dddbc2';context.font='bold 9px Arial';context.textAlign='center';context.fillText(vehicle.name.toUpperCase(),label[0],label[1]-1);
  context.fillStyle='#303c32';context.fillRect(label[0]-29,label[1]+5,58,3);context.fillStyle=m.stripe;context.fillRect(label[0]-29,label[1]+5,58*ratio,3);
}
function dustAndTracks(){
  for(let i=2;i<trails.length;i++){
    const p=trails[i],previous=trails[i-2],age=state.tick-p.tick;if(previous.id!==p.id||age<0)continue;
    const alpha=Math.max(0,1-age/165)*.2;
    for(const side of [-23,23]){const a=project(p.x-Math.sin(p.angle)*side,p.y+Math.cos(p.angle)*side),b=project(previous.x-Math.sin(previous.angle)*side,previous.y+Math.cos(previous.angle)*side);line(...a,...b,`rgba(31,35,25,${alpha})`,2.7);}
    if(i%4===0&&age<55){const s=project(p.x-Math.cos(p.angle)*40,p.y-Math.sin(p.angle)*40,3);context.save();context.translate(...s);context.scale(1,.48);const haze=context.createRadialGradient(0,0,0,0,0,7+age*.55);haze.addColorStop(0,`rgba(187,167,122,${.13*(1-age/55)})`);haze.addColorStop(1,'rgba(187,167,122,0)');context.fillStyle=haze;context.beginPath();context.arc(0,0,7+age*.55,0,Math.PI*2);context.fill();context.restore();}
  }
}
function draw(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  if(canvas.width!==ARENA.width*dpr){canvas.width=ARENA.width*dpr;canvas.height=ARENA.height*dpr;}
  context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,ARENA.width,ARENA.height);
  if(!scenery){yard();scenery=document.createElement('canvas');scenery.width=1000;scenery.height=600;scenery.getContext('2d').drawImage(canvas,0,0,canvas.width,canvas.height,0,0,1000,600);}else context.drawImage(scenery,0,0);
  rememberTracks();dustAndTracks();
  const items=[...COVER.map((b,i)=>({y:b.y,draw:()=>cover(b,i)})),...state.vehicles.map(v=>({y:v.y,draw:()=>truck(v)}))].sort((a,b)=>a.y-b.y);
  for(const item of items)item.draw();
  for(const pulse of state.pulses){
    const p=project(pulse.x,pulse.y,20),tail=project(pulse.x-pulse.vx*.045,pulse.y-pulse.vy*.045,20);
    line(...tail,...p,'#bd875b66',4);line(...tail,...p,'#ffe2a9',1.3);circle(...p,1.8,'#fff0c2');
  }
  for(const effect of state.effects){
    const age=state.tick-effect.tick,p=project(effect.x,effect.y,15),opacity=Math.max(0,1-age/18);context.globalAlpha=opacity;
    const glow=context.createRadialGradient(p[0],p[1],0,p[0],p[1],10+age*1.6);glow.addColorStop(0,age<4?'#ffdfa4b0':'#bfac7e65');glow.addColorStop(1,'#b3a17500');context.fillStyle=glow;context.fillRect(p[0]-45,p[1]-45,90,90);
    for(let i=0;i<7;i++){const a=i*Math.PI/3.5+effect.tick,r=5+age*1.4;line(p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r*.7,p[0]+Math.cos(a)*(r+7),p[1]+Math.sin(a)*(r+7)*.7,'#f6c16d',1.3);}
  }
  context.globalAlpha=1;
  if(state.status==='finished'){
    context.fillStyle='#17221fe8';context.fillRect(308,239,384,119);context.strokeStyle='#8c9276';context.lineWidth=1;context.strokeRect(308,239,384,119);
    context.textAlign='center';context.font='9px Consolas, monospace';context.fillStyle='#b9baa0';context.fillText('ROUND COMPLETE',500,265);
    context.font='bold 29px Georgia, serif';context.fillStyle='#e9e3ca';context.fillText(state.winner===null?'Draw':state.vehicles[state.winner].name+' wins',500,306);
    context.font='10px Consolas, monospace';context.fillStyle='#b9baa0';context.fillText('SEED '+state.seed+' · '+state.tick+' TICKS',500,335);
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
    card.querySelector('.vehicle-type').textContent=materials[vehicle.type].label;
    const study={cinder:'PICKUP STUDY',vanta:'HEAVY TRUCK STUDY',chalk:'UTILITY TRUCK STUDY'}[vehicle.type];
    card.querySelector('.eyebrow').textContent=`${String(vehicle.id+1).padStart(2,'0')} / ${study}`;
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
