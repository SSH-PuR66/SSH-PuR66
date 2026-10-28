import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createTruck,updateTruck} from './trucks3d.mjs';
import {createTerrain,groundHeight} from './terrain3d.mjs';
import {VEHICLES} from './model.mjs';

const clamp=THREE.MathUtils.clamp;
const lerp=THREE.MathUtils.lerp;
const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

function particleTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,1,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(.35,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);
}

export function createScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bbad95');scene.fog=new THREE.FogExp2('#b9ab92',.0048);
  const camera=new THREE.PerspectiveCamera(43,1,.15,550);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;
  controls.minDistance=13;controls.maxDistance=135;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.17;
  controls.target.set(50,2,30);camera.position.set(92,30,91);controls.update();
  const sky=new THREE.HemisphereLight('#e3ebef','#76624b',2.4);scene.add(sky);
  const sun=new THREE.DirectionalLight('#ffdfae',3.8);sun.position.set(-45,90,-20);sun.target.position.set(50,0,30);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-90,right:90,top:75,bottom:-75,near:1,far:250});
  sun.shadow.bias=-.0003;sun.shadow.normalBias=.07;sun.shadow.radius=3;
  scene.add(sun,sun.target,new THREE.AmbientLight('#d4bfa2',.32));
  const terrain=createTerrain();scene.add(terrain);
  const trucks=new Map(),previous=new Map(),flashes=new Map(),muzzleHeights=new Map(),contactShadows=new Map();
  const poolTexture=particleTexture(),particles=[];
  const pools={};
  for(const [kind,size,color,opacity] of [['dust',2.8,'#bba47d',.4],['smoke',3.1,'#3b3934',.6],['spark',.25,'#ffbe69',1]]){
    const positions=new Float32Array(600*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setDrawRange(0,0);
    const material=new THREE.PointsMaterial({map:poolTexture,size,color,transparent:true,opacity,depthWrite:false,blending:kind==='spark'?THREE.AdditiveBlending:THREE.NormalBlending});
    const points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);pools[kind]={positions,geometry,points};
  }
  const tracerGeometry=new THREE.BufferGeometry();tracerGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(40*6),3));
  const tracers=new THREE.LineSegments(tracerGeometry,new THREE.LineBasicMaterial({color:'#ffce84',transparent:true,opacity:.95}));tracers.frustumCulled=false;scene.add(tracers);
  const scarGroup=new THREE.Group();scene.add(scarGroup);
  let scars=[],lastTick=-1,identity='',cameraMode='cinematic',quality='auto',disposed=false;
  const desired=new THREE.Vector3(),target=new THREE.Vector3(),muzzlePosition=new THREE.Vector3();
  let cameraSnap=true,shake=0,inspecting=false;
  controls.addEventListener('start',()=>{cameraMode='orbit';inspecting=true;canvas.dispatchEvent(new CustomEvent('camera-mode-change',{detail:'orbit'}));});
  controls.addEventListener('end',()=>{inspecting=false;});
  function resetCosmetics(){particles.length=0;previous.clear();lastTick=-1;shake=0;for(const scar of scars){scarGroup.remove(scar);scar.geometry.dispose();scar.material.dispose();}scars=[];}
  function ensureTrucks(state){
    const key=`${state.seed}/${state.pairing}`;
    if(key!==identity||state.tick<lastTick){resetCosmetics();identity=key;cameraSnap=true;}
    for(const vehicle of state.vehicles){
      let truck=trucks.get(vehicle.id);
      if(truck?.userData.type!==vehicle.type){
        if(truck){scene.remove(truck);disposeObject(truck);}
        truck=createTruck(vehicle.type);truck.userData.type=vehicle.type;scene.add(truck);trucks.set(vehicle.id,truck);
        if(!contactShadows.has(vehicle.id)){const contact=new THREE.Group();const disc=new THREE.Mesh(new THREE.PlaneGeometry(12,5.6),new THREE.MeshBasicMaterial({map:poolTexture,color:'#19170f',transparent:true,opacity:.48,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));disc.rotation.x=-Math.PI/2;contact.add(disc);scene.add(contact);contactShadows.set(vehicle.id,contact);}
        const flash=new THREE.Mesh(new THREE.ConeGeometry(.44,1.9,6),new THREE.MeshBasicMaterial({color:'#ffe2a1',transparent:true,opacity:.95,depthWrite:false}));
        flash.rotation.z=-Math.PI/2;flash.position.x=.9;flash.visible=false;
        const socket=new THREE.Group();truck.userData.turret.add(socket);socket.add(flash);flashes.set(vehicle.id,{flash,socket});
      }
    }
  }
  function addParticle(kind,x,y,z,tick,seed){
    if(particles.length>=600)particles.shift();
    particles.push({kind,x,y,z,born:tick,life:kind==='spark'?12:kind==='smoke'?65:36,vx:(noise(seed)-.5)*(kind==='spark'?5:1.8),vz:(noise(seed+3)-.5)*2.2,vy:kind==='spark'?2+noise(seed+8)*5:kind==='smoke'?3.2:1.2});
  }
  function addScar(x,z,tick){
    const scar=new THREE.Mesh(new THREE.CircleGeometry(.4+noise(tick)*.6,9),new THREE.MeshBasicMaterial({color:'#3f3529',transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
    scar.rotation.x=-Math.PI/2;scar.position.set(x,groundHeight(x,z)+.025,z);scarGroup.add(scar);scars.push(scar);
    if(scars.length>32){const old=scars.shift();scarGroup.remove(old);old.geometry.dispose();old.material.dispose();}
  }
  function update(state,{running=false,delta=.016,reduced=false}={}){
    if(disposed)return;
    ensureTrucks(state);const fresh=state.tick!==lastTick;
    for(const vehicle of state.vehicles){
      const truck=trucks.get(vehicle.id),x=vehicle.x/10,z=vehicle.y/10,health=vehicle.shield/VEHICLES[vehicle.type].shield;
      const old=previous.get(vehicle.id)||{x,z,yaw:-vehicle.angle,roll:0};
      const dx=x-old.x,dz=z-old.z,speed=Math.hypot(dx,dz),heading=speed>.001?Math.atan2(-dz,dx):old.yaw;
      const yaw=fresh?turn(old.yaw,heading,.18):old.yaw;
      truck.position.set(x,groundHeight(x,z)+(truck.userData.baseHeight||0),z);truck.rotation.y=yaw;
      const contact=contactShadows.get(vehicle.id);contact.position.set(x,groundHeight(x,z)+.04,z);contact.rotation.y=yaw;
      truck.rotation.z=clamp((groundHeight(x+.8,z)-groundHeight(x-.8,z))/.8,-.05,.05);
      truck.rotation.x=clamp((groundHeight(x,z+.8)-groundHeight(x,z-.8))/.8,-.05,.05);
      truck.userData.turret.rotation.y=-vehicle.angle-yaw;
      const firing=state.events.some(event=>event.type==='pulse'&&event.vehicle===vehicle.name&&state.tick-event.tick<3);
      updateTruck(truck,{health,roll:-(old.roll+speed/.9),steer:clamp(Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw)),-.25,.25),recoil:firing?1:0,time:state.tick/30,moving:running&&health>0});
      truck.updateMatrixWorld(true);
      const flash=flashes.get(vehicle.id);truck.userData.muzzle.getWorldPosition(muzzlePosition);muzzleHeights.set(vehicle.id,muzzlePosition.y);flash.socket.position.copy(truck.userData.turret.worldToLocal(muzzlePosition.clone()));flash.flash.visible=firing&&state.status!=='finished';
      if(fresh){
        if(speed>.008&&state.tick%2===0)for(let p=0;p<3;p++)addParticle('dust',x-Math.cos(yaw)*4,groundHeight(x,z)+.4,z+Math.sin(yaw)*4,state.tick,state.tick*6+p+vehicle.id*17);
        if(health<.62&&(state.tick%3===0||state.status==='finished')){truck.userData.smokeAnchor.getWorldPosition(muzzlePosition);for(let p=0;p<(health===0?6:2);p++)addParticle('smoke',muzzlePosition.x+(noise(p+7)-.5),muzzlePosition.y+p*.7,muzzlePosition.z+(noise(p+2)-.5),state.tick,state.tick+p+vehicle.id*13);}
        previous.set(vehicle.id,{x,z,yaw,roll:old.roll+speed/.9});
      }
    }
    if(fresh){
      for(const effect of state.effects.filter(e=>e.tick>lastTick)){
        const x=effect.x/10,z=effect.y/10,y=groundHeight(x,z)+1.7;
        for(let p=0;p<15;p++)addParticle(p<9?'spark':'dust',x,y,z,state.tick,state.tick*19+p);
        addScar(x,z,state.tick);if(effect.kind==='hit')shake=reduced?0:.16;
      }
    }
    for(const [kind,pool] of Object.entries(pools)){
      let count=0;
      for(const p of particles){const age=state.tick-p.born;if(p.kind!==kind||age>=p.life)continue;const a=age/30;pool.positions[count*3]=p.x+p.vx*a;pool.positions[count*3+1]=p.y+p.vy*a-(kind==='spark'?3*a*a:0);pool.positions[count*3+2]=p.z+p.vz*a;count++;}
      pool.geometry.setDrawRange(0,count);pool.geometry.attributes.position.needsUpdate=true;
    }
    if(fresh)for(let i=particles.length-1;i>=0;i--)if(state.tick-particles[i].born>=particles[i].life)particles.splice(i,1);
    let lineIndex=0;const linePositions=tracerGeometry.attributes.position.array;
    for(const pulse of state.pulses){const x=pulse.x/10,z=pulse.y/10,owner=state.vehicles[pulse.owner],other=state.vehicles[1-pulse.owner];const progress=clamp(Math.hypot(pulse.x-owner.x,pulse.y-owner.y)/Math.max(1,Math.hypot(other.x-owner.x,other.y-owner.y)),0,1);const y=lerp(muzzleHeights.get(pulse.owner)||3,groundHeight(other.x/10,other.y/10)+2.7,progress);linePositions.set([x-pulse.vx/10*.045,y,z-pulse.vy/10*.045,x,y,z],lineIndex*6);lineIndex++;}
    tracerGeometry.setDrawRange(0,lineIndex*2);tracerGeometry.attributes.position.needsUpdate=true;
    const a=state.vehicles[0],b=state.vehicles[1];
    if(cameraMode==='cinematic'){
      target.set((a.x+b.x)/20,2,(a.y+b.y)/20);
      const separation=Math.hypot(a.x-b.x,a.y-b.y)/10,portraitScale=Math.max(1,1.2/camera.aspect),distance=clamp(separation*.8+22,44,68)*portraitScale;
      const angle=.82+(reduced?0:Math.sin(state.tick*.0015)*.13);
      desired.set(target.x+Math.sin(angle)*distance,(25+separation*.08)*portraitScale,target.z+Math.cos(angle)*distance);
    }else if(cameraMode==='cinder'||cameraMode==='vanta'){
      const chosen=state.vehicles[cameraMode==='cinder'?0:1],truck=trucks.get(chosen.id),yaw=truck.rotation.y;
      target.set(truck.position.x,2.6+groundHeight(truck.position.x,truck.position.z),truck.position.z);
      desired.set(target.x-Math.cos(yaw)*17+Math.sin(yaw)*8,target.y+7,target.z+Math.sin(yaw)*17+Math.cos(yaw)*8);
    }
    if(cameraMode!=='orbit'&&!inspecting){
      const blend=cameraSnap?1:1-Math.exp(-delta*3.4);controls.target.lerp(target,blend);camera.position.lerp(desired,blend);cameraSnap=false;
      if(shake>0){camera.position.x+=Math.sin(state.tick*8)*shake;camera.position.y+=Math.cos(state.tick*7)*shake;shake*=.75;}
    }
    controls.update();renderer.render(scene,camera);lastTick=state.tick;
    canvas.dataset.renderer='webgl-3d';canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);
  }
  function resize(){const box=canvas.parentElement.getBoundingClientRect();renderer.setSize(Math.max(1,box.width),Math.max(1,box.height),false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();}
  function setCamera(mode){cameraMode=mode;cameraSnap=true;}
  function setQuality(value){quality=value;const low=value==='low'||(value==='auto'&&innerWidth<700);renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=!low;resize();}
  function dispose(){disposed=true;controls.dispose();disposeObject(scene,true);poolTexture.dispose();renderer.dispose();}
  setQuality(quality);resize();
  return {update,resize,setCamera,setQuality,dispose};
}
function disposeObject(object,includeShared=false){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  object.traverse(child=>{if(child.isInstancedMesh)child.dispose();if(child.geometry)geometries.add(child.geometry);for(const material of child.material?Array.isArray(child.material)?child.material:[child.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
  for(const value of [...geometries,...materials,...textures])if(includeShared||!value.userData?.shared)value.dispose();
}
