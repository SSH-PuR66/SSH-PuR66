import * as THREE from './vendor/three.module.js';

// Visual assemblies use arbitrary scene units. No physical performance is inferred.
const UNIT_BOX = new THREE.BoxGeometry(1,1,1);
UNIT_BOX.userData.shared=true;
const PALETTES = {
  cinder:{paint:0x717365,edge:0x92917b,dark:0x434b40,accent:0x805247,label:'Armored civilian pickup'},
  vanta:{paint:0x525e4c,edge:0x7d846c,dark:0x323f33,accent:0x9a8b5e,label:'Armored cargo-truck silhouette'},
  chalk:{paint:0x858b83,edge:0xa6aa9b,dark:0x4b5852,accent:0x647b74,label:'Enclosed utility-truck silhouette'}
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function surfaceTexture(kind){
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const grain=noise(x,y),patch=noise(Math.floor(x/9),Math.floor(y/15));
    let r,g,b;
    if(kind==='rubber'){const v=88+grain*42+(x%17<2?30:0);r=v;g=v+4;b=v;}
    else {const v=174+grain*49+(Math.sin(x*.12+y*.04)*7),rust=patch>.72&&noise(x*.19,y*.08)>.42;r=rust?v*.86:v;g=rust?v*.64:v;b=rust?v*.43:v*.96;if(x%39===0&&y%8<5){r*=.65;g*=.64;b*=.58;}}
    const i=(y*size+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.userData.shared=true;
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
const STEEL_TEXTURE=surfaceTexture('steel'),RUBBER_TEXTURE=surfaceTexture('rubber');
function makeMaterials(palette){
  const steel=(color,roughness=.84)=>new THREE.MeshStandardMaterial({color,map:STEEL_TEXTURE,bumpMap:STEEL_TEXTURE,bumpScale:.035,roughness,metalness:.55});
  return {
    paint:steel(palette.paint),edge:steel(palette.edge,.75),dark:steel(palette.dark),accent:steel(palette.accent),
    frame:steel(0x2d342f,.92),bare:steel(0x858775,.66),rust:steel(0x6b4732,.96),
    rubber:new THREE.MeshStandardMaterial({color:0x151a17,map:RUBBER_TEXTURE,roughness:1,metalness:0}),
    glass:new THREE.MeshStandardMaterial({color:0x334e51,roughness:.24,metalness:.38,transparent:true,opacity:.82,depthWrite:false}),
    black:new THREE.MeshStandardMaterial({color:0x111b18,roughness:.9,metalness:.25}),
    lamp:new THREE.MeshStandardMaterial({color:0xd3cba5,roughness:.3,metalness:.25,emissive:0xe9d49b,emissiveIntensity:.4}),
    amber:new THREE.MeshStandardMaterial({color:0xaa6d2d,roughness:.45,emissive:0x7b4318,emissiveIntensity:.35}),
    red:new THREE.MeshStandardMaterial({color:0x792a22,roughness:.4,emissive:0x7b291b,emissiveIntensity:.2})
  };
}
function mesh(parent,geometry,material,name){
  const value=new THREE.Mesh(geometry,material);value.name=name||'';value.castShadow=true;value.receiveShadow=true;parent.add(value);return value;
}
function box(parent,size,position,material,name,rotation){
  const item=mesh(parent,UNIT_BOX,material,name);item.scale.set(...size);item.position.set(...position);if(rotation)item.rotation.set(...rotation);return item;
}
function cylinder(parent,radius,length,position,material,axis='y',segments=12){
  const item=mesh(parent,new THREE.CylinderGeometry(radius,radius,length,segments),material);
  item.position.set(...position);if(axis==='x')item.rotation.z=Math.PI/2;if(axis==='z')item.rotation.x=Math.PI/2;return item;
}
function profile(parent,points,width,material,name){
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,curveSegments:1,steps:1});geometry.translate(0,0,-width/2);
  return mesh(parent,geometry,material,name);
}
function quadGeometry(points){
  const geometry=new THREE.BufferGeometry(),vertices=[];
  for(const i of [0,1,2,0,2,3])vertices.push(...points[i]);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2));geometry.computeVertexNormals();return geometry;
}
function panel(parent,points,material,name,damagePanels,axis='x'){
  // A seam edge is the pivot, so progressive damage opens a panel from its seam.
  const origin=new THREE.Vector3(...points[0]),relative=points.map(p=>[p[0]-origin.x,p[1]-origin.y,p[2]-origin.z]);
  const mat=material.clone();mat.side=THREE.DoubleSide;
  const value=mesh(parent,quadGeometry(relative),mat,name);value.position.copy(origin);
  value.userData.basePosition=value.position.clone();value.userData.baseRotation=value.rotation.clone();value.userData.damageAxis=axis;
  value.userData.baseColor=mat.color.clone();value.userData.damageOrder=damagePanels.length;damagePanels.push(value);return value;
}
function segmentLines(parent,segments,color=0x242f27){
  const geometry=new THREE.BufferGeometry().setFromPoints(segments.flatMap(p=>p.map(v=>new THREE.Vector3(...v))));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));parent.add(lines);return lines;
}
function boltBatch(parent,positions,material){
  const bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.049,.042,6),material,positions.length),dummy=new THREE.Object3D();
  for(let i=0;i<positions.length;i++){const [x,y,z,axis='z']=positions[i];dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);if(axis==='z')dummy.rotation.x=Math.PI/2;if(axis==='x')dummy.rotation.z=Math.PI/2;dummy.updateMatrix();bolts.setMatrixAt(i,dummy.matrix);}
  bolts.instanceMatrix.needsUpdate=true;bolts.castShadow=true;bolts.receiveShadow=true;bolts.name='Repeated plate fasteners';parent.add(bolts);return bolts;
}
function batchStaticBoxes(parent){
  // Keep animated assemblies separate while combining fixed rails and fittings.
  const batches=new Map();
  for(const child of [...parent.children]){
    if(child.isGroup)batchStaticBoxes(child);
    if(!child.isMesh||child.geometry!==UNIT_BOX)continue;
    const group=batches.get(child.material)||[];group.push(child);batches.set(child.material,group);
  }
  for(const [material,parts] of batches){
    if(parts.length<3)continue;
    const batch=new THREE.InstancedMesh(UNIT_BOX,material,parts.length);
    parts.forEach((part,index)=>{part.updateMatrix();batch.setMatrixAt(index,part.matrix);parent.remove(part);});
    batch.instanceMatrix.needsUpdate=true;batch.castShadow=true;batch.receiveShadow=true;
    batch.name='Fixed body fittings';batch.userData.parts=parts.map(part=>part.name);parent.add(batch);
  }
}
function wheel(parent,x,z,radius,materials,front){
  const carrier=new THREE.Group();carrier.position.set(x,radius,z);carrier.name=front?'Steered front wheel':'Rear wheel';parent.add(carrier);
  const spin=new THREE.Group();carrier.add(spin);carrier.userData.spin=spin;carrier.userData.front=front;carrier.userData.basePosition=carrier.position.clone();
  cylinder(spin,radius,.58,[0,0,0],materials.rubber,'z',24);
  for(const side of [-1,1]){
    const bead=mesh(spin,new THREE.TorusGeometry(radius*.83,radius*.11,6,24),materials.rubber);bead.position.z=side*.285;
    cylinder(spin,radius*.49,.035,[0,0,side*.316],materials.bare,'z',16);
    cylinder(spin,radius*.25,.055,[0,0,side*.35],materials.frame,'z',10);
  }
  const treadGeometry=new THREE.BoxGeometry(.23,.12,.62),treads=new THREE.InstancedMesh(treadGeometry,materials.rubber,28),dummy=new THREE.Object3D();
  for(let i=0;i<28;i++){const a=i*Math.PI*2/28;dummy.position.set(Math.cos(a)*(radius+.01),Math.sin(a)*(radius+.01),0);dummy.rotation.set(0,0,a+Math.PI/2);dummy.updateMatrix();treads.setMatrixAt(i,dummy.matrix);}
  treads.castShadow=true;treads.receiveShadow=true;spin.add(treads);
  const nuts=[];for(const side of [-1,1])for(let i=0;i<8;i++){const a=i*Math.PI/4;nuts.push([Math.cos(a)*radius*.36,Math.sin(a)*radius*.36,side*.347,'z']);}boltBatch(spin,nuts,materials.bare);
  return carrier;
}
function fender(parent,x,z,radius,material){
  const outer=radius+0.23,inner=radius+.1,shape=new THREE.Shape();
  shape.moveTo(outer,0);shape.absarc(0,0,outer,0,Math.PI,false);shape.lineTo(-inner,0);shape.absarc(0,0,inner,Math.PI,0,true);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.34,bevelEnabled:false,curveSegments:14,steps:1});geometry.translate(0,0,-.17);
  const item=mesh(parent,geometry,material,'Wheel arch');item.position.set(x,radius,z);return item;
}
function windowPane(parent,points,materials,windows,name){
  const value=mesh(parent,quadGeometry(points),materials.glass.clone(),name);value.material.side=THREE.DoubleSide;value.castShadow=false;windows.push(value);
  const center=points.reduce((sum,p)=>sum.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(.25),lines=[];
  for(const point of [points[0],points[2],points[3]])lines.push([center.toArray(),point]);
  const cracks=segmentLines(parent,lines,0xa5b8a6);cracks.visible=false;value.userData.cracks=cracks;return value;
}
function buildTurret(parent,materials,y,damagePanels){
  const turret=new THREE.Group();turret.name='Fictional roof prop pivot';turret.position.set(-.75,y,0);parent.add(turret);
  cylinder(turret,.6,.18,[0,.09,0],materials.dark,'y',16);
  cylinder(turret,.43,.22,[0,.28,0],materials.frame,'y',12);
  const recoilGroup=new THREE.Group();recoilGroup.position.set(.05,.5,0);turret.add(recoilGroup);
  box(recoilGroup,[.9,.27,.34],[.05,0,0],materials.frame,'Fictional equipment housing');
  cylinder(recoilGroup,.085,1.5,[1.1,.02,0],materials.dark,'x',10);
  cylinder(recoilGroup,.11,.22,[1.85,.02,0],materials.black,'x',10);
  box(recoilGroup,[.16,.16,.5],[.37,.09,0],materials.bare);
  for(const side of [-1,1])panel(turret,[[-.35,.22,side*.56],[.75,.22,side*.56],[.57,.98,side*.47],[-.35,.87,side*.47]],materials.paint,'Roof prop side shield',damagePanels,'x');
  panel(turret,[[.69,.22,-.55],[.69,.22,.55],[.56,.91,.46],[.56,.91,-.46]],materials.paint,'Roof prop front panel',damagePanels,'z');
  const muzzle=new THREE.Object3D();muzzle.name='Fictional effect origin';muzzle.position.set(1.99,.02,0);muzzle.rotation.y=Math.PI/2;recoilGroup.add(muzzle);
  turret.userData.recoilGroup=recoilGroup;return {turret,muzzle};
}

export function createTruck(type='cinder'){
  if(!Object.hasOwn(PALETTES,type))throw new RangeError('Unsupported truck type.');
  const palette=PALETTES[type],materials=makeMaterials(palette),truck=new THREE.Group();truck.name=`${type} / ${palette.label}`;
  const body=new THREE.Group();body.name='Sprung armored body';truck.add(body);
  const wheels=[],damagePanels=[],windows=[],lights=[],scorches=[],bolts=[],cargo=type==='vanta',closed=type==='chalk';
  const rear=cargo?-5.6:-4.9,front=5.15,width=cargo?3.75:3.5,radius=cargo?1.02:.96;
  const axles=cargo?[3.45,-2.8,-4.5]:[3.25,-3.25];
  for(const x of axles){
    cylinder(truck,.13,width+.35,[x,radius,0],materials.frame,'z',10);
    for(const z of [-(width/2+.03),width/2+.03])wheels.push(wheel(truck,x,z,radius,materials,x>0));
  }
  for(const z of [-.85,.85])box(body,[front-rear,.22,.22],[(front+rear)/2,1.08,z],materials.frame,'Longitudinal chassis rail');
  for(const x of [-3.7,-1.4,1.1,3.6])box(body,[.19,.18,2.15],[x,1.08,0],materials.frame);
  box(body,[front-rear-.2,.45,width-.4],[(front+rear)/2,1.53,0],materials.dark,'Sill and underbody');
  for(const z of [-width/2,width/2]){
    box(body,[3,.1,.4],[.15,1.14,z],materials.frame,'Running step');
    for(const x of axles)fender(body,x,z,radius,materials.paint);
  }

  // Civilian cab proportions remain legible beneath the added plates.
  profile(body,[[-.6,1.65],[-.6,2.95],[.25,3.83],[1.8,3.83],[2.8,2.7],[2.8,1.65]],3.34,materials.paint,'Armored civilian cab');
  profile(body,[[2.72,1.6],[2.72,2.7],[4.75,2.47],[5.18,2.12],[5.18,1.6]],3.38,materials.paint,'Sloped hood');
  const hood=panel(body,[[2.72,2.725,-1.68],[4.77,2.495,-1.68],[4.77,2.495,1.68],[2.72,2.725,1.68]],materials.paint,'Overlaid hood plate',damagePanels,'z');
  hood.userData.damageStrength=.55;
  for(const side of [-1,1]){
    const z=side*1.684;
    panel(body,[[-.53,1.73,z],[2.5,1.73,z],[2.5,2.55,z],[-.53,2.95,z]],materials.dark,'Cab door lower plating',damagePanels,'x');
    windowPane(body,[[-.23,3.03,z*1.005],[.35,3.66,z*1.005],[1.58,3.66,z*1.005],[2.23,2.96,z*1.005]],materials,windows,'Cab side glass');
    box(body,[.55,.11,.08],[1.87,2.56,z+side*.05],materials.bare,'Door handle');
    for(const x of [-.42,2.39])for(const y of [1.85,2.2,2.57])bolts.push([x,y,z+side*.035,'z']);
    box(body,[.11,.23,.13],[-.55,2.25,z+side*.06],materials.bare,'Door hinge');
    box(body,[.11,.23,.13],[-.55,2.74,z+side*.06],materials.bare,'Door hinge');
    box(body,[.09,.12,.45],[2.05,2.9,side*1.86],materials.frame,'Mirror arm');
    box(body,[.32,.42,.15],[2.04,3.06,side*2.08],materials.dark,'Mirror housing');
    box(body,[.24,.32,.025],[2.04,3.06,side*2.165],materials.glass,'Mirror glass');
    panel(body,[[1.96,2.59,z],[4.83,2.28,z],[4.83,2.4,z+side*.11],[2.01,2.72,z+side*.11]],materials.edge,'Front quarter rail',damagePanels,'x');
  }
  const left=[[[1.84,3.77,-1.48],[1.84,3.77,-.08],[2.68,2.82,-.08],[2.68,2.82,-1.48]],[[1.84,3.77,.08],[1.84,3.77,1.48],[2.68,2.82,1.48],[2.68,2.82,.08]]];
  for(const points of left)windowPane(body,points,materials,windows,'Sloped windscreen');
  // Windshield overplate and short observation slots follow the reference's visual language.
  panel(body,[[1.8,3.8,-1.68],[1.8,3.8,1.68],[2.19,3.3,1.68],[2.19,3.3,-1.68]],materials.dark,'Windscreen upper overplate',damagePanels,'z');
  for(const z of [-.91,.91])box(body,[.1,.1,.62],[2.17,3.25,z],materials.edge,'Observation slot rim',[0,0,.58]);
  const roof=panel(body,[[.19,3.855,-1.56],[1.78,3.855,-1.56],[1.78,3.855,1.56],[.19,3.855,1.56]],materials.paint,'Cab roof plate',damagePanels,'z');roof.userData.damageStrength=.35;

  if(cargo){
    profile(body,[[rear,1.72],[rear,3.6],[rear+.55,4.37],[-.72,4.37],[-.6,3.45],[-.6,1.72]],3.67,materials.dark,'Raised cargo body');
    for(const side of [-1,1]){
      const z=side*1.87;
      for(let i=0;i<4;i++){
        const x=rear+i*1.2;
        panel(body,[[x,1.82,z],[x+1.14,1.82,z],[x+1.14,3.7,z],[x,3.7,z]],i%2?materials.paint:materials.dark,'Separate cargo wall plate',damagePanels,'x');
        for(const y of [1.97,2.8,3.55])for(const bx of [x+.12,x+1.02])bolts.push([bx,y,z+side*.03,'z']);
        box(body,[.095,2.1,.12],[x+1.17,2.79,z+side*.09],materials.edge,'Cargo upright');
      }
      panel(body,[[rear+.5,4.4,side*1.33],[-.74,4.4,side*1.33],[-.74,3.7,z],[rear+.04,3.7,z]],materials.paint,'Sloped cargo shoulder',damagePanels,'x');
    }
    panel(body,[[rear+.55,4.405,-1.34],[-.74,4.405,-1.34],[-.74,4.405,1.34],[rear+.55,4.405,1.34]],materials.paint,'Cargo roof',damagePanels,'z');
    for(const side of [-1,1])box(body,[.13,2.2,1.65],[rear-.07,2.8,side*.85],materials.paint,'Rear cargo door');
    for(const z of [-1.37,0,1.37])box(body,[.15,2.36,.095],[rear-.16,2.85,z],materials.bare,'Rear door bar');
  }else if(closed){
    profile(body,[[rear,1.7],[rear,3.12],[-4.26,3.88],[-.69,3.88],[-.59,3.13],[-.59,1.7]],3.52,materials.dark,'Enclosed rear body');
    for(const side of [-1,1]){
      for(let i=0;i<3;i++){
        const x=rear+.08+i*1.39;
        panel(body,[[x,1.82,side*1.79],[x+1.33,1.82,side*1.79],[x+1.33,3.05,side*1.79],[x,3.05,side*1.79]],materials.paint,'Utility side plate',damagePanels,'x');
        for(const bx of [x+.13,x+1.2])for(const y of [1.98,2.86])bolts.push([bx,y,side*1.825,'z']);
      }
      panel(body,[[rear+.62,3.91,side*1.19],[-.71,3.91,side*1.19],[-.62,3.07,side*1.79],[rear+.03,3.07,side*1.79]],materials.paint,'Utility sloped shoulder',damagePanels,'x');
      windowPane(body,[[-3.87,3.2,side*1.68],[-2.97,3.2,side*1.68],[-3.04,3.45,side*1.5],[-3.8,3.45,side*1.5]],materials,windows,'Rear observation glass');
    }
    panel(body,[[-4.26,3.925,-1.19],[-.7,3.925,-1.19],[-.7,3.925,1.19],[-4.26,3.925,1.19]],materials.paint,'Utility roof',damagePanels,'z');
    box(body,[.13,1.76,2.64],[rear-.04,2.58,0],materials.paint,'Rear utility door');
  }else{
    // The photographed pickup's broad, tapered rear shell is kept visually distinct from the cab.
    box(body,[4.17,.22,3.56],[-2.72,1.94,0],materials.frame,'Pickup bed floor');
    for(const side of [-1,1]){
      panel(body,[[-4.86,1.83,side*1.91],[-.65,1.83,side*1.91],[-.65,3.55,side*1.39],[-4.28,3.2,side*1.29]],materials.paint,'Pickup sloped armored shell',damagePanels,'x');
      panel(body,[[-4.83,1.78,side*1.94],[-.68,1.78,side*1.94],[-.68,2.12,side*1.94],[-4.83,2.12,side*1.94]],materials.dark,'Lower shell skirt',damagePanels,'x');
      for(let x=-4.4;x<-.6;x+=.79)for(const y of [2.03,2.56])bolts.push([x,y,side*(y>2.1?1.68:1.88),'z']);
      for(const x of [-3.88,-2.6,-1.32])box(body,[.15,.76,.1],[x,2.73,side*1.62],materials.edge,'External shell strap',[side*.28,0,0]);
    }
    panel(body,[[-4.28,3.22,-1.3],[-.65,3.575,-1.4],[-.65,3.575,1.4],[-4.28,3.22,1.3]],materials.dark,'Pickup armored bed roof',damagePanels,'z');
    panel(body,[[-4.89,1.8,-1.9],[-4.89,1.8,1.9],[-4.29,3.21,1.29],[-4.29,3.21,-1.29]],materials.paint,'Sloped rear closure',damagePanels,'z');
  }

  // A large welded guard, grille openings and actual lamps preserve the truck front.
  box(body,[.16,1.04,2.9],[5.2,1.98,0],materials.black,'Recessed grille');
  for(let z=-1.2;z<=1.2;z+=.3)box(body,[.19,.72,.075],[5.31,1.95,z],materials.bare,'Grille bar');
  for(const z of [-1.46,1.46]){
    const lamp=box(body,[.19,.62,.55],[5.31,2.06,z],materials.lamp.clone(),'Headlamp');lights.push(lamp);
    const amber=box(body,[.2,.22,.27],[5.32,2.28,z+(z>0?.3:-.3)],materials.amber.clone(),'Marker lamp');lights.push(amber);
  }
  for(const y of [1.03,1.45,2.41])box(body,[.28,.18,4.06],[5.56,y,0],materials.frame,'Welded bumper rail');
  for(const z of [-1.93,-.86,.86,1.93])box(body,[.28,1.55,.15],[5.56,1.72,z],materials.bare,'Guard upright');
  for(const z of [-1.95,1.95])box(body,[.72,.15,.18],[5.19,1.04,z],materials.frame,'Guard return');
  box(body,[.3,.3,1.1],[5.6,.89,0],materials.dark,'Lower central bumper');
  for(const z of [-1.15,1.15]){const light=box(body,[.13,.34,.26],[rear-.1,1.61,z],materials.red.clone(),'Tail lamp');lights.push(light);}
  for(const z of [-1.65,1.65])box(body,[.15,.7,.78],[rear+.3,.7,z],materials.rubber,'Rear mudflap');
  for(const z of [-1.4,1.4])cylinder(body,.07,1.5,[-3.3,1.25,z],materials.rust,'x',8);
  for(const x of [3.2,4.3])for(const z of [-1.47,1.47])bolts.push([x,2.64-(x-2.7)*.11,z,'y']);
  boltBatch(body,bolts,materials.bare);
  segmentLines(body,[[[2.73,2.74,-1.7],[4.77,2.51,-1.7]],[[2.73,2.74,1.7],[4.77,2.51,1.7]],[[-.61,1.7,-1.7],[-.61,2.96,-1.7]],[[-.61,1.7,1.7],[-.61,2.96,1.7]]]);

  const turretHeight=cargo?4.43:closed?3.95:3.62,{turret,muzzle}=buildTurret(body,materials,turretHeight,damagePanels);
  const smokeAnchor=new THREE.Object3D();smokeAnchor.name='Engine smoke origin';smokeAnchor.position.set(3.5,2.9,0);body.add(smokeAnchor);
  for(const [x,y,z,size] of [[3.6,2.63,.3,.68],[-2.5,cargo?4.45:closed?3.94:3.42,.2,.92],[1.0,3.88,-.3,.55]]){
    const scorch=mesh(body,new THREE.CircleGeometry(size,12),new THREE.MeshStandardMaterial({color:0x101915,roughness:1,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),'Progressive scorch');scorch.position.set(x,y+.03,z);scorch.rotation.x=-Math.PI/2;scorches.push(scorch);
  }
  const damageMaterials=[...Object.values(materials)].filter(m=>!m.transparent&&!['rubber','lamp','amber','red'].includes(Object.keys(materials).find(k=>materials[k]===m)));
  for(const material of damageMaterials)material.userData.baseColor=material.color.clone();
  batchStaticBoxes(body);
  truck.userData={type,label:palette.label,wheels,turret,muzzle,damagePanels,smokeAnchor,baseHeight:.07,body,materials,damageMaterials,windows,lights,scorches,visualOnly:true};
  for(const light of lights){light.userData.baseColor=light.material.color.clone();light.userData.baseEmissive=light.material.emissiveIntensity;}
  updateTruck(truck,{health:1,roll:0,steer:0,recoil:0,time:0,moving:false});
  return truck;
}

/** Idempotent cosmetic state. Parent owns truck position/yaw and turret yaw. */
export function updateTruck(truck,{health=1,roll=0,steer=0,recoil=0,time=0,moving=false}={}){
  const data=truck.userData,h=clamp(health,0,1),damage=1-h,t=Number.isFinite(time)?time:0;
  const wreck=h===0,smokeShade=new THREE.Color(0x18221a);
  for(const material of data.damageMaterials)material.color.copy(material.userData.baseColor).lerp(smokeShade,damage*.58);
  for(const panel of data.damagePanels){
    const order=panel.userData.damageOrder,threshold=.21+(order%6)*.085,amount=clamp((damage-threshold)/(1-threshold),0,1),strength=panel.userData.damageStrength??1;
    panel.position.copy(panel.userData.basePosition);panel.rotation.copy(panel.userData.baseRotation);panel.scale.set(1,1,1);
    const direction=panel.userData.basePosition.z>=0?1:-1;
    panel.rotation[panel.userData.damageAxis]=direction*amount*(.12+(order%4)*.08)*strength;
    if(wreck&&order%4===1){panel.rotation[panel.userData.damageAxis]+=direction*.43*strength;panel.position.y-=.15;}
    panel.position.y-=amount*.06;panel.scale.y=1-amount*.07;
    panel.material.color.copy(panel.userData.baseColor).lerp(smokeShade,damage*(.4+(order%3)*.09));
  }
  for(let i=0;i<data.wheels.length;i++){
    const carrier=data.wheels[i];carrier.position.copy(carrier.userData.basePosition);
    carrier.rotation.y=carrier.userData.front?clamp(steer,-.45,.45):0;
    carrier.rotation.x=wreck&&i===1?.28:0;
    carrier.userData.spin.rotation.z=Number.isFinite(roll)?roll:0;
    if(wreck&&i===1)carrier.position.y-=.13;
  }
  data.body.position.y=wreck?-.22:Math.sin(t*8.8)*(moving?.026:0)*(1+damage);
  data.body.rotation.x=clamp(steer,-.45,.45)*(moving?-.045:0)+(wreck?.045:0);
  data.body.rotation.z=wreck?-.025:Math.sin(t*6.7)*(moving?.006:0);
  data.turret.userData.recoilGroup.position.x=.05-clamp(recoil,0,1)*.19;
  data.turret.rotation.z=wreck?.14:damage*.035;
  for(let i=0;i<data.windows.length;i++){
    const pane=data.windows[i];pane.material.opacity=h<.15?.25:.82-damage*.17;
    pane.visible=!(wreck&&i%3===1);pane.userData.cracks.visible=damage>.43+(i%3)*.08;
  }
  for(let i=0;i<data.lights.length;i++){
    const light=data.lights[i],failed=damage>.45+(i%3)*.16;
    light.material.emissiveIntensity=failed?0:light.userData.baseEmissive*(.7+h*.3);
    light.material.color.copy(light.userData.baseColor).lerp(smokeShade,failed?.85:damage*.3);
  }
  for(let i=0;i<data.scorches.length;i++)data.scorches[i].material.opacity=clamp((damage-.22-i*.1)*1.35,0,.86);
  truck.userData.health=h;
}
