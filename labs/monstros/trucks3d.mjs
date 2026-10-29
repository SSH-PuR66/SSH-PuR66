import * as THREE from './vendor/three.module.js';

// Visual assemblies use arbitrary scene units. No physical performance is inferred.
const UNIT_BOX = new THREE.BoxGeometry(1,1,1);
UNIT_BOX.userData.shared=true;
const GEOMETRY_CACHE=new Map();
function sharedGeometry(key,build){if(!GEOMETRY_CACHE.has(key)){const value=build();value.userData.shared=true;GEOMETRY_CACHE.set(key,value);}return GEOMETRY_CACHE.get(key);}
const PALETTES = {
  cinder:{paint:0x717365,edge:0x92917b,dark:0x434b40,accent:0x805247,label:'Armored civilian pickup'},
  vanta:{paint:0x525e4c,edge:0x7d846c,dark:0x323f33,accent:0x9a8b5e,label:'Armored cargo-truck silhouette'},
  chalk:{paint:0x858b83,edge:0xa6aa9b,dark:0x4b5852,accent:0x647b74,label:'Enclosed utility-truck silhouette'}
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function surfaceTexture(kind){
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const grain=noise(x,y),patch=noise(Math.floor(x/9),Math.floor(y/15));
    let r,g,b;
    if(kind==='rubber'){const v=88+grain*42+(x%17<2?30:0);r=v;g=v+4;b=v;}
    else {const v=177+grain*42+(Math.sin(x*.062+y*.031)*12),rust=patch>.77&&noise(x*.11,y*.06)>.42;r=rust?v*.83:v;g=rust?v*.61:v;b=rust?v*.41:v*.96;if((x%71<2&&y%15<11)||(y%89===1&&x%21<16)){r*=.61;g*=.59;b*=.52;}const streak=Math.max(0,Math.sin(x*.18)*Math.cos(y*.011))*.12;r*=1-streak;g*=1-streak;b*=1-streak;}
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
  const item=mesh(parent,sharedGeometry(`cylinder-${radius}-${length}-${segments}`,()=>new THREE.CylinderGeometry(radius,radius,length,segments)),material);
  item.position.set(...position);if(axis==='x')item.rotation.z=Math.PI/2;if(axis==='z')item.rotation.x=Math.PI/2;return item;
}
function profile(parent,points,width,material,name){
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geometry=sharedGeometry('profile-'+JSON.stringify([points,width]),()=>{const value=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.02,width-.05),bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,curveSegments:1,steps:1});value.translate(0,0,-width/2+.025);return value;});
  return mesh(parent,geometry,material,name);
}
function loftBody(parent,sections,material,name){
  // Chamfered rings give the cab shoulders and hood a changing cross-section.
  const rings=sections.map(([x,bottom,belt,top,width,inset=.17])=>[
    [x,bottom,-width+.08],[x,bottom+.08,-width],[x,belt,-width],
    [x,top,-width+inset],[x,top,width-inset],[x,belt,width],
    [x,bottom+.08,width],[x,bottom,width-.08]
  ]),vertices=[],uv=[];
  const face=(a,b,c,d)=>{for(const p of [a,b,c,a,c,d]){vertices.push(...p);uv.push(p[0]*.36,p[1]*.3+p[2]*.16);}};
  for(let s=0;s<rings.length-1;s++)for(let i=0;i<8;i++)face(rings[s][i],rings[s][(i+1)%8],rings[s+1][(i+1)%8],rings[s+1][i]);
  for(const [ring,reverse] of [[rings[0],true],[rings.at(-1),false]])for(let i=1;i<7;i++){const tri=reverse?[ring[0],ring[i+1],ring[i]]:[ring[0],ring[i],ring[i+1]];for(const p of tri){vertices.push(...p);uv.push(p[2]*.3,p[1]*.3);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  const item=mesh(parent,geometry,material,name);item.userData.sculptedSections=sections.length;return item;
}
function tubeBetween(parent,a,b,radius,material,name){
  const direction=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),item=mesh(parent,sharedGeometry('tube-'+radius,()=>new THREE.CylinderGeometry(radius,radius,1,8)),material,name);
  item.position.copy(new THREE.Vector3(...a).addScaledVector(direction,.5));item.scale.y=direction.length();item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return item;
}
function quadGeometry(points){
  const geometry=new THREE.BufferGeometry(),vertices=[];
  for(const i of [0,1,2,0,2,3])vertices.push(...points[i]);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,0,1,1,0,1],2));geometry.computeVertexNormals();return geometry;
}
function plateGeometry(points){
  const geometry=new THREE.BufferGeometry(),vertices=[],uv=[],indices=[],segments=4,side=segments+1;
  const p=points.map(point=>new THREE.Vector3(...point)),normal=p[1].clone().sub(p[0]).cross(p[3].clone().sub(p[0])).normalize();
  for(const depth of [.018,-.035])for(let y=0;y<=segments;y++)for(let x=0;x<=segments;x++){
    const u=x/segments,v=y/segments,low=p[0].clone().lerp(p[1],u),high=p[3].clone().lerp(p[2],u),position=low.lerp(high,v).addScaledVector(normal,depth);
    vertices.push(...position);uv.push(u,v);
  }
  for(let y=0;y<segments;y++)for(let x=0;x<segments;x++){
    const a=y*side+x,b=a+1,c=b+side,d=a+side,offset=side*side;
    indices.push(a,b,c,a,c,d,a+offset,c+offset,b+offset,a+offset,d+offset,c+offset);
  }
  const border=[];for(let x=0;x<=segments;x++)border.push(x);for(let y=1;y<=segments;y++)border.push(y*side+segments);for(let x=segments-1;x>=0;x--)border.push(segments*side+x);for(let y=segments-1;y>0;y--)border.push(y*side);
  for(let i=0;i<border.length;i++){const a=border[i],b=border[(i+1)%border.length],offset=side*side;indices.push(a,a+offset,b+offset,a,b+offset,b);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.userData.basePositions=new Float32Array(vertices);geometry.userData.plateNormal=normal;geometry.userData.damage=0;
  return geometry;
}
function panel(parent,points,material,name,damagePanels,axis='x'){
  // A seam edge is the pivot, so progressive damage opens a panel from its seam.
  const origin=new THREE.Vector3(...points[0]),relative=points.map(p=>[p[0]-origin.x,p[1]-origin.y,p[2]-origin.z]);
  const mat=material.clone();mat.side=THREE.DoubleSide;
  const value=mesh(parent,plateGeometry(relative),mat,name);value.position.copy(origin);
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
function batchRepeatedMeshes(parent){
  const groups=new Map();
  for(const child of [...parent.children]){
    if(!child.isMesh||child.isInstancedMesh||child.userData.basePosition)continue;
    const key=child.geometry.uuid+'/'+child.material.uuid,parts=groups.get(key)||[];parts.push(child);groups.set(key,parts);
  }
  for(const parts of groups.values())if(parts.length>1){
    const batch=new THREE.InstancedMesh(parts[0].geometry,parts[0].material,parts.length);batch.name=parts[0].name+' assembly';batch.userData.parts=parts.map(part=>part.name);
    parts.forEach((part,i)=>{part.updateMatrix();batch.setMatrixAt(i,part.matrix);parent.remove(part);});batch.castShadow=true;batch.receiveShadow=true;batch.instanceMatrix.needsUpdate=true;parent.add(batch);
  }
}
function wheel(parent,x,z,radius,materials,front){
  const carrier=new THREE.Group();carrier.position.set(x,radius,z);carrier.name=front?'Steered front wheel':'Rear wheel';parent.add(carrier);
  const spin=new THREE.Group();carrier.add(spin);carrier.userData.spin=spin;carrier.userData.front=front;carrier.userData.basePosition=carrier.position.clone();
  const tireProfile=[ [.48,-.285],[.63,-.335],[.81,-.347],[.95,-.275],[.99,-.16],[1,0],[.99,.16],[.95,.275],[.81,.347],[.63,.335],[.48,.285] ].map(([r,y])=>new THREE.Vector2(r*radius,y));
  const tire=mesh(spin,sharedGeometry('tire-'+radius,()=>new THREE.LatheGeometry(tireProfile,36)),materials.rubber,'Rounded tire carcass');tire.rotation.x=Math.PI/2;
  for(const side of [-1,1]){
    const bead=mesh(spin,sharedGeometry('sidewall-'+radius,()=>new THREE.TorusGeometry(radius*.72,.018,4,36)),materials.rubber,'Raised sidewall seam');bead.position.z=side*.348;
    const rim=mesh(spin,sharedGeometry('wheel-rim-'+radius,()=>new THREE.TorusGeometry(radius*.475,.043,6,24)),materials.bare,'Rolled wheel rim');rim.position.z=side*.321;
    cylinder(spin,radius*.455,.045,[0,0,side*.291],materials.dark,'z',24);
    cylinder(spin,radius*.255,.1,[0,0,side*.337],materials.bare,'z',12);
    const hub=mesh(spin,sharedGeometry('hub-'+radius,()=>new THREE.CylinderGeometry(radius*.14,radius*.2,.1,8)),materials.frame,'Recessed axle hub');hub.rotation.x=Math.PI/2;hub.position.z=side*.41;
  }
  const treadGeometry=sharedGeometry('tread-chevron',()=>new THREE.BoxGeometry(.20,.065,.235)),treads=new THREE.InstancedMesh(treadGeometry,materials.rubber,72),dummy=new THREE.Object3D();
  for(let i=0;i<36;i++)for(const [j,side] of [-1,1].entries()){const a=(i+(side>0?.2:0))*Math.PI*2/36;dummy.position.set(Math.cos(a)*(radius-.005),Math.sin(a)*(radius-.005),side*.145);dummy.rotation.set(0,side*.44,a+Math.PI/2);dummy.updateMatrix();treads.setMatrixAt(i*2+j,dummy.matrix);}
  treads.name='Interlocking tire tread blocks';
  treads.castShadow=true;treads.receiveShadow=true;spin.add(treads);
  const holes=new THREE.InstancedMesh(sharedGeometry('rim-vents',()=>new THREE.CylinderGeometry(.055,.055,.012,8)),materials.black,16);
  for(const [sideIndex,side] of [-1,1].entries())for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;dummy.position.set(Math.cos(a)*radius*.36,Math.sin(a)*radius*.36,side*.32);dummy.rotation.set(Math.PI/2,0,0);dummy.updateMatrix();holes.setMatrixAt(sideIndex*8+i,dummy.matrix);}holes.name='Wheel ventilation recesses';spin.add(holes);
  const nuts=[];for(const side of [-1,1])for(let i=0;i<8;i++){const a=i*Math.PI/4;nuts.push([Math.cos(a)*radius*.36,Math.sin(a)*radius*.36,side*.347,'z']);}boltBatch(spin,nuts,materials.bare);
  batchRepeatedMeshes(spin);
  return carrier;
}
function fender(parent,x,z,radius,material){
  const outer=radius+0.23,inner=radius+.1,shape=new THREE.Shape();
  shape.moveTo(outer,0);shape.absarc(0,0,outer,0,Math.PI,false);shape.lineTo(-inner,0);shape.absarc(0,0,inner,Math.PI,0,true);shape.closePath();
  const geometry=sharedGeometry('fender-'+radius,()=>{const value=new THREE.ExtrudeGeometry(shape,{depth:.29,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,curveSegments:18,steps:1});value.translate(0,0,-.145);return value;});
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
    const differential=mesh(truck,sharedGeometry('differential',()=>new THREE.IcosahedronGeometry(.34,1)),materials.frame,'Axle differential');differential.position.set(x,radius,0);differential.scale.set(1,.82,1.1);
    for(const z of [-(width/2+.03),width/2+.03])wheels.push(wheel(truck,x,z,radius,materials,x>0));
  }
  for(const z of [-.85,.85])box(body,[front-rear,.22,.22],[(front+rear)/2,1.08,z],materials.frame,'Longitudinal chassis rail');
  for(const x of [-3.7,-1.4,1.1,3.6])box(body,[.19,.18,2.15],[x,1.08,0],materials.frame);
  box(body,[front-rear-.2,.21,width-.4],[(front+rear)/2,1.49,0],materials.dark,'Sill and underbody');
  tubeBetween(body,[axles.at(-1),.98,0],[axles[0],.98,0],.085,materials.bare,'Exposed prop shaft');
  for(const x of axles)for(const z of [-.95,.95]){
    for(let layer=0;layer<3;layer++){
      const span=.95-layer*.16;
      profile(body,[[-span,1.24],[0,1.10-layer*.045],[span,1.24],[span,1.28],[0,1.15-layer*.045],[-span,1.28]],.12,materials.frame,'Layered leaf spring');
      const spring=body.children.at(-1);spring.position.set(x,0,z);
    }
    tubeBetween(body,[x-.31,radius-.03,z],[x+.11,1.52,z],.07,materials.bare,'Angled suspension damper');
  }
  for(const z of [-width/2,width/2]){
    box(body,[3,.1,.4],[.15,1.14,z],materials.frame,'Running step');
    for(const x of axles)fender(body,x,z,radius,materials.paint);
  }

  // Civilian cab proportions remain legible beneath the added plates.
  loftBody(body,[[-.62,1.63,2.85,2.99,1.65,.08],[.23,1.63,2.96,3.82,1.68,.19],[1.75,1.63,2.96,3.82,1.68,.19],[2.78,1.63,2.57,2.73,1.60,.12]],materials.paint,'Sculpted tapered civilian cab');
  loftBody(body,[[2.70,1.61,2.42,2.70,1.66,.16],[3.18,1.61,2.42,2.69,1.69,.15],[4.72,1.61,2.19,2.46,1.64,.13],[5.18,1.61,1.99,2.12,1.48,.12]],materials.paint,'Compound sloping hood and quarters');
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
  for(const side of [-1,1]){
    const z=side*1.73;
    tubeBetween(body,[-.38,2.98,z],[.31,3.72,side*1.52],.025,materials.edge,'Cab window weatherstrip');
    tubeBetween(body,[.31,3.72,side*1.52],[1.66,3.72,side*1.52],.025,materials.edge,'Cab roof drip rail');
    tubeBetween(body,[1.66,3.72,side*1.52],[2.35,2.94,z],.025,materials.edge,'Sloping window pillar');
    tubeBetween(body,[2.49,2.97,side*.18],[2.16,3.32,side*.75],.024,materials.black,'Windshield wiper');
    box(body,[.68,.16,.07],[3.81,2.20,side*1.69],materials.dark,'Recessed quarter panel vent');
    for(let vent=0;vent<5;vent++)box(body,[.045,.13,.09],[3.55+vent*.13,2.20,side*1.72],materials.edge,'Quarter vent slat');
    for(const x of [.18,1.07])box(body,[.65,.035,.32],[x,1.21,side*1.75],materials.bare,'Step tread insert');
    tubeBetween(body,[-.48,2.3,side*1.79],[-.48,2.73,side*1.79],.035,materials.bare,'External grab handle');
    for(const y of [2.3,2.73])tubeBetween(body,[-.48,y,side*1.70],[-.48,y,side*1.79],.035,materials.bare,'Handle return');
    if(cargo){
      for(let rib=0;rib<11;rib++)box(body,[.052,1.34,.06],[rear+.3+rib*.41,2.75,side*1.91],materials.edge,'Shallow cargo corrugation');
      tubeBetween(body,[-.73,1.23,side*1.27],[-.73,4.45,side*1.27],.095,materials.rust,'External exhaust stack');
      cylinder(body,.14,.18,[-.73,4.48,side*1.27],materials.frame,'y',10);
    }else{
      const slot=box(body,[.64,.14,.055],[-2.65,2.91,side*(closed?1.79:1.58)],materials.black,'Inset dark shell detail');slot.rotation.x=side*(closed?0:.30);
      box(body,[.7,.05,.065],[-2.65,2.82,side*(closed?1.81:1.61)],materials.edge,'Inset lower seam');
    }
    box(body,[.07,.09,.49],[5.43,2.05,side*1.46],materials.dark,'Headlamp lens divider');
  }
  // Dense small fittings are instanced after construction, preserving the larger silhouettes.
  const doorX=rear-.16;
  for(const z of [-.63,.63]){
    tubeBetween(body,[doorX,2.13,z],[doorX,2.53,z],.035,materials.bare,'Rear door pull');
    for(const y of [2.13,2.53])tubeBetween(body,[rear-.04,y,z],[doorX,y,z],.035,materials.bare,'Rear handle mount');
  }
  const seamSegments=[];
  for(const side of [-1,1]){
    seamSegments.push([[-.53,1.76,side*1.733],[2.42,1.76,side*1.733]],[[2.42,1.76,side*1.733],[2.42,2.57,side*1.733]]);
    for(let i=0;i<10;i++){const x=2.83+i*.19;seamSegments.push([[x,2.71-(x-2.72)*.112,side*1.57],[x+.09,2.70-(x-2.72)*.112,side*1.57]]);}
  }
  segmentLines(body,seamSegments,0x252b22);
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
  batchRepeatedMeshes(body);
  batchRepeatedMeshes(truck);
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
    if(panel.geometry.userData.damage!==amount){
      const geometry=panel.geometry,base=geometry.userData.basePositions,normal=geometry.userData.plateNormal,position=geometry.attributes.position,uv=geometry.attributes.uv;
      for(let i=0;i<position.count;i++){
        const u=uv.getX(i),v=uv.getY(i),distance=(u-(.3+(order%3)*.2))**2+(v-.55)**2;
        const dent=Math.exp(-distance*24)*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*amount*(.2+(order%4)*.04);
        position.setXYZ(i,base[i*3]-normal.x*dent,base[i*3+1]-normal.y*dent,base[i*3+2]-normal.z*dent);
      }
      position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData.damage=amount;
    }
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
