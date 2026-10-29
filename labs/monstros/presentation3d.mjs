import * as THREE from './vendor/three.module.js';

// Presentation has no write path into the fixed-step game state.
export const LIGHTING = Object.freeze({
  amber: {sky:'#526f87',horizon:'#cfb38b',fog:'#b8a284',sun:'#ffe0a2',power:4.1,exposure:1.02,sunPosition:[-55,60,-34]},
  dusk: {sky:'#182a4f',horizon:'#d19479',fog:'#7c797b',sun:'#ffb079',power:3.8,exposure:1.17,sunPosition:[-75,23,-52]},
  overcast: {sky:'#677681',horizon:'#c7c8bb',fog:'#a5aaa4',sun:'#e1eced',power:2.1,exposure:1.14,sunPosition:[-22,75,20]},
});

export function createSky(){
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{zenith:{value:new THREE.Color(LIGHTING.amber.sky)},horizon:{value:new THREE.Color(LIGHTING.amber.horizon)}},
    vertexShader:'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec3 vDirection;uniform vec3 zenith;uniform vec3 horizon;void main(){float h=clamp(normalize(vDirection).y*1.8,0.0,1.0);gl_FragColor=vec4(mix(horizon,zenith,pow(h,.55)),1.0);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
      .replace(';#include',';\n#include')});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(240,32,16),material);mesh.position.set(50,0,30);mesh.renderOrder=-10;mesh.name='atmospheric-gradient-sky';return mesh;
}

export function createGarage(){
  const group=new THREE.Group();group.name='vehicle-inspection-stage';group.position.set(50,0,30);
  const graphite=new THREE.MeshStandardMaterial({color:'#222929',roughness:.79,metalness:.2});
  const edge=new THREE.MeshStandardMaterial({color:'#58605b',roughness:.54,metalness:.6});
  const glow=new THREE.MeshBasicMaterial({color:'#efd2a0'});
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(9,9.12,.24,96),graphite);disc.position.y=-.14;disc.receiveShadow=true;group.add(disc);
  for(const radius of [8.6,9.03]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,6,96),glow);ring.rotation.x=-Math.PI/2;ring.position.y=.005;group.add(ring);}
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(450,450),new THREE.MeshStandardMaterial({color:'#303632',roughness:.94}));floor.rotation.x=-Math.PI/2;floor.position.y=-.29;floor.receiveShadow=true;group.add(floor);
  // Radial machining marks and lit uprights establish scale without a stock grid.
  const linePositions=[];
  for(let i=0;i<72;i++){const a=i*Math.PI/36;linePositions.push(Math.cos(a)*8,.004,Math.sin(a)*8,Math.cos(a)*(i%6?8.35:8.55),.004,Math.sin(a)*(i%6?8.35:8.55));}
  const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));group.add(new THREE.LineSegments(lines,new THREE.LineBasicMaterial({color:'#929181'})));
  for(const x of [-14,14]){const frame=new THREE.Mesh(new THREE.BoxGeometry(.34,9,.34),edge);frame.position.set(x,4.2,-10);group.add(frame);const bar=new THREE.Mesh(new THREE.BoxGeometry(.1,7,.12),glow);bar.position.set(x,4.7,-9.8);group.add(bar);}
  const fill=new THREE.PointLight('#c2deeb',55,32,2);fill.position.set(6,8,7);group.add(fill);
  const rim=new THREE.PointLight('#ffcf9a',65,35,2);rim.position.set(-8,6,-7);group.add(rim);
  group.visible=false;return group;
}

export function createDebris(scene){
  const geometry=new THREE.TetrahedronGeometry(.13,0),material=new THREE.MeshStandardMaterial({color:'#b7aa8a',roughness:.9});
  const mesh=new THREE.InstancedMesh(geometry,material,144);mesh.name='impact-fragments';mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=true;scene.add(mesh);
  const dummy=new THREE.Object3D(),pieces=[];
  const n=v=>{const a=Math.sin(v*45.12)*16745.7;return a-Math.floor(a);};
  function burst(x,y,z,tick){for(let i=0;i<12;i++){const key=tick*12+i;pieces.push({x,y,z,tick,dx:(n(key)-.5)*8,dy:2+n(key+8)*6,dz:(n(key+3)-.5)*8,spin:n(key+9)*10,scale:.5+n(key+11)*1.3});}if(pieces.length>144)pieces.splice(0,pieces.length-144);}
  function update(tick){let count=0;for(let i=pieces.length-1;i>=0;i--){const p=pieces[i],age=(tick-p.tick)/30;if(age>1.7||age<0){pieces.splice(i,1);continue;}dummy.position.set(p.x+p.dx*age,Math.max(.04,p.y+p.dy*age-7.5*age*age),p.z+p.dz*age);dummy.rotation.set(age*p.spin,p.spin+age*4,age*3);dummy.scale.setScalar(p.scale*Math.min(1,(1.7-age)*2));dummy.updateMatrix();mesh.setMatrixAt(count++,dummy.matrix);}mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
  return {mesh,burst,update,reset(){pieces.length=0;mesh.count=0;}};
}

export function createTracks(scene){
  const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(.34,.7),new THREE.MeshBasicMaterial({color:'#52442f',transparent:true,opacity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),300);
  mesh.name='persistent-wheel-trails';mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);
  let cursor=0;const dummy=new THREE.Object3D();
  return {mesh,add(x,z,y,yaw){for(const side of [-1,1]){dummy.position.set(x+Math.sin(yaw)*side*1.63,y+.022,z+Math.cos(yaw)*side*1.63);dummy.rotation.set(-Math.PI/2,0,yaw-Math.PI/2);dummy.updateMatrix();mesh.setMatrixAt(cursor,dummy.matrix);cursor=(cursor+1)%300;mesh.count=Math.min(300,mesh.count+1);}mesh.instanceMatrix.needsUpdate=true;},reset(){cursor=0;mesh.count=0;}};
}
