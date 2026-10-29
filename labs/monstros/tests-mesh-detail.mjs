import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {createTruck,updateTruck} from './trucks3d.mjs';

let checks=0;
const check=(name,run)=>{run();checks++;console.log('PASS '+name);};
const metrics=[];

for(const type of ['cinder','vanta','chalk']){
  check(type+': shaped body sections expose correctly oriented outer faces',()=>{
    const truck=createTruck(type),hood=truck.getObjectByName('Compound sloping hood and quarters'),cab=truck.getObjectByName('Sculpted tapered civilian cab');
    assert.equal(hood.userData.sculptedSections,4);assert.equal(cab.userData.sculptedSections,4);
    const rings=new Map(),positions=hood.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const x=positions.getX(i),zs=rings.get(x)||[];zs.push(positions.getZ(i));rings.set(x,zs);}
    const widths=[...rings.values()].map(zs=>Math.max(...zs)-Math.min(...zs));
    assert.ok(Math.max(...widths)-Math.min(...widths)>.3,'Hood cross sections must change width, not extrude one side profile');
    truck.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(10,1.9,0),new THREE.Vector3(-1,0,0));
    const hit=ray.intersectObject(hood,false)[0];assert.ok(hit&&hit.point.x>5,'Front surface must face outward');
  });
  check(type+': every damage plate is a closed solid and dent repair restores exact vertices',()=>{
    const truck=createTruck(type),before=truck.userData.damagePanels.map(panel=>Array.from(panel.geometry.attributes.position.array));
    for(const panel of truck.userData.damagePanels){
      const geometry=panel.geometry,edges=new Map(),indices=geometry.index.array;
      assert.notEqual(geometry.attributes.position.array,geometry.userData.basePositions,'Repair coordinates must not alias mutable positions');
      for(let i=0;i<indices.length;i+=3)for(const [a,b] of [[indices[i],indices[i+1]],[indices[i+1],indices[i+2]],[indices[i+2],indices[i]]]){const key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);}
      assert.ok([...edges.values()].every(count=>count===2),'Open or multiply joined plate edge');
    }
    updateTruck(truck,{health:0});
    assert.ok(truck.userData.damagePanels.some((panel,index)=>Array.from(panel.geometry.attributes.position.array).some((value,i)=>value!==before[index][i])),'Wreck must change surface geometry, not only the object transform');
    const damaged=truck.userData.damagePanels.map(panel=>Array.from(panel.geometry.attributes.position.array));
    updateTruck(truck,{health:0});
    truck.userData.damagePanels.forEach((panel,index)=>assert.deepEqual(Array.from(panel.geometry.attributes.position.array),damaged[index],'Repeated damage must not accumulate vertex drift'));
    updateTruck(truck,{health:1});
    truck.userData.damagePanels.forEach((panel,index)=>assert.deepEqual(Array.from(panel.geometry.attributes.position.array),before[index],'Repair must restore the undented mesh'));
  });
  check(type+': rounded tires, staggered tread and fine assemblies stay within render budgets',()=>{
    const truck=createTruck(type),geometries=new Set();let meshes=0,instances=0,triangles=0;
    for(const wheel of truck.userData.wheels){
      const tire=wheel.getObjectByName('Rounded tire carcass'),tread=wheel.getObjectByName('Interlocking tire tread blocks');
      assert.equal(tire.geometry.type,'LatheGeometry');assert.ok(tire.geometry.parameters.points.length>=10);
      assert.equal(tread.count,72);
      const a=new THREE.Matrix4(),b=new THREE.Matrix4();tread.getMatrixAt(0,a);tread.getMatrixAt(1,b);assert.notDeepEqual(a.elements,b.elements);
    }
    truck.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);}if(object.isInstancedMesh)instances+=object.count;});
    const vertices=[...geometries].reduce((sum,geometry)=>sum+geometry.attributes.position.count,0);
    assert.ok(meshes<=180);assert.ok(instances<=1000);assert.ok(vertices<=50000);assert.ok(triangles<=50000);
    metrics.push({type,meshes,instances,vertices,triangles});
  });
}
console.log(JSON.stringify({checks,status:'passed',metrics,scope:'Mesh cross sections, face orientation, closed plate topology, non-accumulating vertex damage and rendering budgets.'}));
