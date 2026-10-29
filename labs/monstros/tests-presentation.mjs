import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {createGarage,createDebris,createTracks,createSky,LIGHTING} from './presentation3d.mjs';
let checks=0;
function check(name,run){run();checks++;console.log('PASS '+name);}
function finite(root){root.traverse(o=>{if(o.geometry)for(const attribute of Object.values(o.geometry.attributes))assert.ok(Array.from(attribute.array).every(Number.isFinite));if(o.isInstancedMesh)assert.ok(Array.from(o.instanceMatrix.array).every(Number.isFinite));});}
check('garage stage geometry is finite and starts hidden',()=>{const group=createGarage();assert.equal(group.visible,false);finite(group);assert.equal(group.position.x,50);assert.equal(group.position.z,30);});
check('lighting presets provide finite bounded exposure and intensity',()=>{for(const p of Object.values(LIGHTING)){assert.ok(p.exposure>0&&p.exposure<2);assert.ok(p.power>0&&p.power<6);assert.ok(p.sunPosition.every(Number.isFinite));}});
check('sky is inward-facing and never writes scene depth',()=>{const sky=createSky();assert.equal(sky.material.side,THREE.BackSide);assert.equal(sky.material.depthWrite,false);finite(sky);});
check('fragment pool stays bounded after an impact burst storm',()=>{const scene=new THREE.Scene(),fx=createDebris(scene);for(let t=0;t<1000;t++)fx.burst(50,2,30,t);fx.update(999);assert.ok(fx.mesh.count<=144);assert.ok(fx.mesh.count>0);finite(scene);});
check('fragments expire and rewind cannot display future debris',()=>{const fx=createDebris(new THREE.Scene());fx.burst(2,3,4,100);fx.update(99);assert.equal(fx.mesh.count,0);fx.burst(2,3,4,100);fx.update(180);assert.equal(fx.mesh.count,0);});
check('fragment reset clears immediately without a subsequent frame',()=>{const fx=createDebris(new THREE.Scene());fx.burst(2,3,4,0);fx.update(1);assert.equal(fx.mesh.count,12);fx.reset();assert.equal(fx.mesh.count,0);});
check('wheel trail ring buffer caps rendered tracks at 300',()=>{const scene=new THREE.Scene(),tracks=createTracks(scene);for(let i=0;i<2500;i++)tracks.add(i%100,i%60,.15,i*.1);assert.equal(tracks.mesh.count,300);finite(scene);tracks.reset();assert.equal(tracks.mesh.count,0);tracks.add(10,20,0,1);assert.equal(tracks.mesh.count,2);});
console.log(JSON.stringify({passed:checks,scope:'Real Three.js presentation geometry, bounded effect pools and reset behavior; browser rendering verified separately.'}));
