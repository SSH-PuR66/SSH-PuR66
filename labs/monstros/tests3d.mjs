import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { createTruck, updateTruck } from './trucks3d.mjs';
import { createTerrain, groundHeight, disposeTerrain } from './terrain3d.mjs';
import { COVER, VEHICLES, PAIRINGS, MAX_TICKS, createMatch, stepMatch } from './model.mjs';

// Run with Node: real Three.js geometry and transforms, without a DOM or WebGL mock.
// Browser rendering, CanvasTexture pixels, controls and GPU lifetime need browser QA.
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
const types = Object.keys(VEHICLES);
const close = (actual, expected, epsilon = 1e-8) => assert.ok(
  Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be within ${epsilon} of ${expected}`
);

function materialsOf(object) {
  return object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
}

function resourcesOf(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), instances = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.isInstancedMesh) instances.add(object);
    for (const material of materialsOf(object)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return { geometries, materials, textures, instances };
}

function assertFiniteAssembly(root) {
  root.updateMatrixWorld(true);
  let meshCount = 0, vertexCount = 0, instanceCount = 0;
  const geometries = new Set();
  root.traverse(object => {
    for (const value of object.matrixWorld.elements) assert.ok(Number.isFinite(value), object.name + ': invalid transform');
    if (object.isMesh) meshCount++;
    if (object.geometry) geometries.add(object.geometry);
    if (object.isInstancedMesh) {
      instanceCount += object.count;
      for (const value of object.instanceMatrix.array) assert.ok(Number.isFinite(value), object.name + ': invalid instance matrix');
      if (object.instanceColor) for (const value of object.instanceColor.array) assert.ok(Number.isFinite(value));
    }
    for (const material of materialsOf(object)) {
      for (const channel of ['color', 'emissive']) {
        if (material[channel]) for (const value of material[channel].toArray()) assert.ok(Number.isFinite(value));
      }
      assert.ok(Number.isFinite(material.opacity));
    }
  });
  for (const geometry of geometries) {
    assert.ok(geometry.attributes.position?.count > 0, 'Renderable geometry must have positions');
    vertexCount += geometry.attributes.position.count;
    for (const attribute of Object.values(geometry.attributes)) {
      for (const value of attribute.array) assert.ok(Number.isFinite(value), 'Invalid geometry attribute');
    }
    if (geometry.index) for (const index of geometry.index.array) {
      assert.ok(Number.isInteger(index) && index >= 0 && index < geometry.attributes.position.count, 'Index outside the position buffer');
    }
  }
  return { meshCount, vertexCount, instanceCount };
}

function visualSnapshot(root) {
  const result = [];
  root.traverse(object => result.push({
    name: object.name, position: object.position.toArray(), rotation: object.rotation.toArray(),
    scale: object.scale.toArray(), visible: object.visible,
    materials: materialsOf(object).map(material => ({
      color: material.color?.toArray(), emissive: material.emissive?.toArray(),
      emissiveIntensity: material.emissiveIntensity, opacity: material.opacity,
      visible: material.visible, transparent: material.transparent,
    })),
  }));
  // JSON normalizes the visually equivalent signed zero in Euler components.
  return JSON.stringify(result);
}

function isDescendant(object, ancestor) {
  for (let current = object; current; current = current.parent) if (current === ancestor) return true;
  return false;
}

for (const type of types) {
  check(type + ': finite, bounded truck geometry and effect anchors', () => {
    const truck = createTruck(type);
    assert.ok(truck.isGroup);
    assert.equal(truck.userData.type, type);
    const counts = assertFiniteAssembly(truck);
    // Budget limits guard accidental per-part explosions, not exact implementation counts.
    assert.ok(counts.meshCount > 20 && counts.meshCount <= 180);
    assert.ok(counts.vertexCount > 1000 && counts.vertexCount <= 50000);
    assert.ok(counts.instanceCount <= 1000);
    const bounds = new THREE.Box3().setFromObject(truck), size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x >= 8 && size.x <= 14, 'Truck length must remain in the scene scale');
    assert.ok(size.y >= 3 && size.y <= 7, 'Truck height must remain in the scene scale');
    assert.ok(size.z >= 3 && size.z <= 6, 'Truck width must remain in the scene scale');
    assert.ok(bounds.min.y >= -.2, 'Assembly must not start deeply below its ground origin');
    for (const name of ['turret', 'muzzle', 'smokeAnchor', 'body']) {
      assert.ok(truck.userData[name]?.isObject3D, 'Missing scene anchor: ' + name);
      assert.ok(isDescendant(truck.userData[name], truck), name + ' must belong to this truck');
    }
    assert.ok(isDescendant(truck.userData.muzzle, truck.userData.turret));
    assert.ok(truck.userData.wheels.length >= 4 && truck.userData.wheels.length <= 6);
    assert.ok(truck.userData.damagePanels.length >= 8);
  });

  check(type + ': wreck visibly changes the assembly and full repair restores it exactly', () => {
    const truck = createTruck(type), original = visualSnapshot(truck);
    const originalBodyY = truck.userData.body.position.y;
    updateTruck(truck, { health: 0, roll: -8, steer: .2, recoil: 1, time: 12, moving: true });
    assert.notEqual(visualSnapshot(truck), original);
    assert.equal(truck.userData.health, 0);
    assert.ok(truck.userData.body.position.y < originalBodyY, 'Wreck must visibly settle');
    assert.ok(truck.userData.damagePanels.some(panel => panel.position.distanceTo(panel.userData.basePosition) > .01));
    assert.ok(truck.userData.windows.some(pane => !pane.visible));
    assert.ok(truck.userData.windows.some(pane => pane.userData.cracks.visible));
    assert.ok(truck.userData.lights.every(light => light.material.emissiveIntensity === 0));
    assert.ok(truck.userData.scorches.some(scorch => scorch.material.opacity > .5));
    assertFiniteAssembly(truck);
    updateTruck(truck, { health: 1, roll: 0, steer: 0, recoil: 0, time: 0, moving: false });
    assert.equal(visualSnapshot(truck), original, 'Repair must clear every changed visual state');
  });

  check(type + ': cosmetic updates are idempotent and preserve caller-owned placement', () => {
    const truck = createTruck(type);
    truck.position.set(34.7, .13, 21.8); truck.rotation.set(.025, 1.24, -.018);
    truck.userData.turret.rotation.y = -.72;
    const location = truck.position.toArray(), orientation = truck.rotation.toArray();
    const pose = { health: .27, roll: -11.2, steer: -.19, recoil: .7, time: 9.5, moving: true };
    updateTruck(truck, pose); const once = visualSnapshot(truck);
    for (let repeat = 0; repeat < 5; repeat++) updateTruck(truck, pose);
    assert.equal(visualSnapshot(truck), once);
    assert.deepEqual(truck.position.toArray(), location);
    assert.deepEqual(truck.rotation.toArray(), orientation);
    assert.equal(truck.userData.turret.rotation.y, -.72);
  });

  check(type + ': muzzle and smoke transforms survive translated, rotated and damaged parents', () => {
    const truck = createTruck(type), point = new THREE.Vector3();
    for (const [yaw, health] of [[0, 1], [1.2, .4], [-3.13, 0]]) {
      truck.position.set(73, .16, 42); truck.rotation.set(.03, yaw, -.02);
      truck.userData.turret.rotation.y = -.6 - yaw;
      updateTruck(truck, { health, recoil: .8, time: 4, moving: false }); truck.updateMatrixWorld(true);
      for (const anchor of [truck.userData.muzzle, truck.userData.smokeAnchor]) {
        anchor.getWorldPosition(point);
        assert.ok(point.toArray().every(Number.isFinite));
        assert.ok(point.distanceTo(truck.position) < 9, 'Effect anchor detached from truck');
        const local = truck.userData.turret.worldToLocal(point.clone());
        const restored = truck.userData.turret.localToWorld(local);
        close(restored.distanceTo(point), 0);
      }
    }
  });
}

check('unsupported truck types fail before an assembly is returned', () => {
  for (const type of ['unknown', '__proto__', '', null]) assert.throws(() => createTruck(type), RangeError);
});

check('shared truck geometry and textures are tagged; mutable damage materials remain independent', () => {
  const first = createTruck('cinder'), second = createTruck('vanta');
  const a = resourcesOf(first), b = resourcesOf(second);
  let sharedGeometry = 0, sharedTextures = 0;
  for (const geometry of a.geometries) if (b.geometries.has(geometry)) {
    sharedGeometry++; assert.equal(geometry.userData.shared, true, 'Per-truck cleanup must retain shared geometry');
  }
  for (const texture of a.textures) if (b.textures.has(texture)) {
    sharedTextures++; assert.equal(texture.userData.shared, true, 'Per-truck cleanup must retain shared texture');
  }
  assert.ok(sharedGeometry > 0 && sharedTextures > 0, 'This check must exercise actual shared resources');
  for (const material of a.materials) assert.ok(!b.materials.has(material), 'Damage must not mutate another truck material');
  const before = visualSnapshot(second);
  updateTruck(first, { health: 0, time: 2, moving: true });
  assert.equal(visualSnapshot(second), before, 'Damaging one truck must leave its neighbor unchanged');
});

check('all pairing outcomes can drive the actual cosmetic assemblies without invalid transforms', () => {
  for (const pairing of PAIRINGS) {
    let state = createMatch({ seed: 73, pairing: pairing.id }).state;
    const trucks = state.vehicles.map(vehicle => createTruck(vehicle.type));
    for (let tick = 0; state.status !== 'finished' && tick < MAX_TICKS; tick++) {
      state = stepMatch(state);
      if (state.tick % 20 !== 0 && state.status !== 'finished') continue;
      for (const vehicle of state.vehicles) {
        const truck = trucks[vehicle.id], x = vehicle.x / 10, z = vehicle.y / 10;
        truck.position.set(x, groundHeight(x, z) + truck.userData.baseHeight, z);
        truck.rotation.y = -vehicle.angle;
        updateTruck(truck, { health: vehicle.shield / VEHICLES[vehicle.type].shield, time: state.tick / 30, moving: state.status !== 'finished' });
        assertFiniteAssembly(truck);
      }
    }
    assert.equal(state.status, 'finished');
  }
});

check('headless terrain has finite geometry and bounded rendering complexity', () => {
  assert.equal(typeof document, 'undefined', 'Run this suite in Node without a DOM shim');
  const terrain = createTerrain();
  try {
    assert.ok(terrain.isGroup);
    const counts = assertFiniteAssembly(terrain);
    assert.ok(counts.meshCount <= 64, 'Terrain draw-call budget exceeded');
    assert.ok(counts.vertexCount <= 100000, 'Terrain vertex budget exceeded');
    assert.ok(counts.instanceCount <= 1500, 'Terrain instance budget exceeded');
  } finally { disposeTerrain(terrain); }
});

check('actual terrain cover footprints align with the unmodified model circles', () => {
  const terrain = createTerrain();
  try {
    const expected = COVER.map(cover => ({ x: cover.x / 10, z: cover.y / 10, radius: cover.radius / 10 }));
    assert.deepEqual(terrain.userData.cover, expected);
    terrain.updateMatrixWorld(true);
    const pads = [];
    terrain.traverse(object => { if (object.name === 'cover-footprint') pads.push(object); });
    assert.equal(pads.length, expected.length);
    for (const cover of expected) {
      const pad = pads.find(mesh => Math.abs(mesh.position.x - cover.x) < 1e-6 && Math.abs(mesh.position.z - cover.z) < 1e-6);
      assert.ok(pad, 'Missing cover mesh at model center');
      const bounds = new THREE.Box3().setFromObject(pad), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
      close(center.x, cover.x); close(center.z, cover.z);
      close(size.x, cover.radius * 2, 1e-5); close(size.z, cover.radius * 2, 1e-5);
    }
  } finally { disposeTerrain(terrain); }
});

check('decorative rock and scrub instances remain outside every allowed driving position', () => {
  const terrain = createTerrain(), matrix = new THREE.Matrix4(), position = new THREE.Vector3();
  try {
    for (const name of ['peripheral-stone-field', 'dry-scrub-clusters']) {
      const mesh = terrain.getObjectByName(name);
      assert.ok(mesh?.isInstancedMesh && mesh.count > 0, 'Check must exercise populated scenery');
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
        assert.ok(position.x <= -1 || position.x >= 101 || position.z <= -1 || position.z >= 61,
          `${name} instance ${i} intrudes into the driving area`);
      }
    }
  } finally { disposeTerrain(terrain); }
});

check('terrain reconstruction is deterministic without retained generator state', () => {
  const first = createTerrain(), second = createTerrain();
  try {
    assert.equal(visualSnapshot(first), visualSnapshot(second));
    const a = [], b = [];
    for (const [terrain, output] of [[first, a], [second, b]]) terrain.traverse(object => {
      if (object.isInstancedMesh) output.push([object.name, Array.from(object.instanceMatrix.array), object.instanceColor && Array.from(object.instanceColor.array)]);
      if (object.geometry) output.push([object.name, Array.from(object.geometry.attributes.position.array)]);
    });
    assert.deepEqual(a, b);
  } finally { disposeTerrain(first); disposeTerrain(second); }
});

check('driving elevation stays shallow and continuous, with a finite invalid-input fallback', () => {
  for (let x = 0; x <= 100; x += 2) for (let z = 0; z <= 60; z += 2) {
    const height = groundHeight(x, z);
    assert.ok(Number.isFinite(height) && Math.abs(height) < .3, 'Driving-area height exceeds visual relief budget');
    assert.ok(Math.abs(groundHeight(x + .05, z) - height) < .015, 'Abrupt x slope');
    assert.ok(Math.abs(groundHeight(x, z + .05) - height) < .015, 'Abrupt z slope');
  }
  for (const [x, z] of [[NaN, 0], [0, Infinity], [-Infinity, 0], [undefined, 2]]) assert.equal(groundHeight(x, z), 0);
});

check('terrain cleanup disposes owned resources and instanced buffers once, then is harmless again', () => {
  const terrain = createTerrain(), owner = new THREE.Group(); owner.add(terrain);
  const resources = resourcesOf(terrain), calls = new Map();
  for (const resource of [...resources.geometries, ...resources.materials, ...resources.textures, ...resources.instances]) {
    calls.set(resource, 0);
    resource.addEventListener('dispose', () => calls.set(resource, calls.get(resource) + 1));
  }
  assert.ok(resources.instances.size > 0 && resources.geometries.size > 0);
  disposeTerrain(terrain);
  assert.equal(terrain.parent, null); assert.equal(owner.children.length, 0); assert.equal(terrain.children.length, 0);
  for (const count of calls.values()) assert.equal(count, 1, 'Owned resource must be disposed exactly once');
  disposeTerrain(terrain); disposeTerrain(null);
  for (const count of calls.values()) assert.equal(count, 1, 'Repeated cleanup must not dispose a detached resource again');
});

console.log(JSON.stringify({ checks, status: 'passed', scope: 'Headless Three.js geometry, transforms, cosmetic state, terrain contracts and ownership tags; browser rendering and GPU cleanup are separate checks.' }));
