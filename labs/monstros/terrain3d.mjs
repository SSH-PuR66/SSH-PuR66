import * as THREE from './vendor/three.module.js';

// Decorative scenery in game coordinates. No dimensions model a real site.
const FIELD = Object.freeze({ x: 50, z: 30, width: 200, depth: 140 });
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function hash(x, z) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const tx = smooth(x - ix), tz = smooth(z - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

/** Small visual elevation only; arcade movement continues on its original plane. */
export function groundHeight(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  const broad = Math.sin(x * .077 + .7) * Math.cos(z * .105) * .115;
  const fine = Math.sin(x * .27 - z * .13) * .025 + Math.cos(z * .31) * .018;
  const road = (Math.hypot((x - 50) / 35.3, (z - 30) / 19.8) - 1) * 19.8;
  const rut = Math.exp(-(((road - .57) / .3) ** 2)) + Math.exp(-(((road + .57) / .3) ** 2));
  const edge = smooth(Math.max(Math.abs(x - 50) - 52, Math.abs(z - 30) - 33) / 24);
  return broad + fine - .065 * rut + edge * (noise(x * .075, z * .075) * 1.9 - .38);
}

function canvasTexture(width, height, paint) {
  // Headless geometry inspection needs no Canvas or WebGL shim.
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  paint(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function dirtTexture() {
  return canvasTexture(2048, 1434, (ctx, width, height) => {
    const random = seeded(0x6d6f6e73);
    const pixels = ctx.createImageData(width, height);
    for (let py = 0; py < height; py++) {
      const z = py / height * FIELD.depth - 40;
      for (let px = 0; px < width; px++) {
        const x = px / width * FIELD.width - 50;
        const variation = (noise(x * .075, z * .075) - .5) * 27
          + (noise(x * .55, z * .55) - .5) * 15 + (random() - .5) * 24;
        const grain = random() > .993 ? -34 : 0;
        const i = (py * width + px) * 4;
        pixels.data[i] = clamp(167 + variation + grain, 0, 255);
        pixels.data[i + 1] = clamp(141 + variation * .91 + grain, 0, 255);
        pixels.data[i + 2] = clamp(104 + variation * .76 + grain, 0, 255);
        pixels.data[i + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const sx = width / FIELD.width, sz = height / FIELD.depth;
    const point = (x, z) => [(x + 50) * sx, (z + 40) * sz];
    ctx.save(); ctx.scale(sx, sz); ctx.translate(50, 40);
    // Broad, irregular compacted soil is under the finer paired wheel marks.
    ctx.strokeStyle = 'rgba(91,75,54,.15)'; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.ellipse(50, 30, 35.3, 19.8, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(194,172,129,.24)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(50, 30, 35.3, 19.8, 0, 0, TAU); ctx.stroke();
    for (const offset of [-.57, .57]) {
      ctx.strokeStyle = 'rgba(79,65,48,.27)'; ctx.lineWidth = .4;
      ctx.beginPath(); ctx.ellipse(50, 30, 35.3 + offset * 1.78, 19.8 + offset, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(218,192,147,.22)'; ctx.lineWidth = .13;
      ctx.beginPath(); ctx.ellipse(50, 30, 35.3 + offset * 1.78 + .26, 19.8 + offset + .15, 0, 0, TAU); ctx.stroke();
    }
    // Older diagonal tracks interrupt the oval, keeping the yard from looking printed.
    for (const offset of [-.6, .6]) {
      ctx.strokeStyle = 'rgba(91,75,55,.16)'; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.moveTo(-27, 43 + offset);
      ctx.bezierCurveTo(15, 48 + offset, 69, 7 + offset, 121, 10 + offset); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(55,48,37,.16)'; ctx.lineWidth = 1.3;
    for (let step = 0; step < 380; step++) {
      const angle = step / 380 * TAU;
      if (random() < .19) continue;
      for (const offset of [-.57, .57]) {
        const x = 50 + Math.cos(angle) * (35.3 + offset * 1.78);
        const z = 30 + Math.sin(angle) * (19.8 + offset);
        const [ax, az] = point(x - Math.cos(angle) * .2, z - Math.sin(angle) * .2);
        const [bx, bz] = point(x + Math.cos(angle) * .2, z + Math.sin(angle) * .2);
        ctx.beginPath(); ctx.moveTo(ax, az); ctx.lineTo(bx, bz); ctx.stroke();
      }
    }
    // Small gravel highlights, eroded washes, and faded aggregate patches.
    for (let i = 0; i < 16000; i++) {
      const x = random() * width, y = random() * height, r = .3 + random() * 1.3;
      ctx.fillStyle = i % 3 ? 'rgba(220,201,164,.18)' : 'rgba(67,62,48,.18)';
      ctx.fillRect(x, y, r * 1.7, r);
    }
  });
}

function weatheredMetalTexture() {
  return canvasTexture(256, 256, (ctx, width, height) => {
    const random = seeded(0x72757374);
    ctx.fillStyle = '#a0937d'; ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 5500; i++) {
      const x = random() * width, y = random() * height;
      ctx.fillStyle = i % 4 ? `rgba(61,54,43,${.03 + random() * .14})` : `rgba(121,67,37,${.04 + random() * .23})`;
      ctx.fillRect(x, y, .4 + random() * 4, .6 + random() * 16);
    }
    for (let x = 0; x < width; x += 16) {
      ctx.fillStyle = 'rgba(35,32,26,.22)'; ctx.fillRect(x, 0, 2, height);
      ctx.fillStyle = 'rgba(234,218,180,.19)'; ctx.fillRect(x + 3, 0, 2, height);
    }
  });
}

function markMesh(mesh, name, cast = true) {
  mesh.name = name; mesh.castShadow = cast; mesh.receiveShadow = true;
  return mesh;
}

function box(parent, geometry, material, name, x, y, z, width, height, depth, rotation = 0) {
  const mesh = markMesh(new THREE.Mesh(geometry, material), name);
  mesh.position.set(x, y, z); mesh.scale.set(width, height, depth); mesh.rotation.y = rotation;
  parent.add(mesh); return mesh;
}

function instances(parent, geometry, material, name, records) {
  if (!records.length) return null;
  const mesh = markMesh(new THREE.InstancedMesh(geometry, material, records.length), name);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), tint = new THREE.Color();
  for (let i = 0; i < records.length; i++) {
    const r = records[i]; position.set(r.x, r.y, r.z); scale.set(r.sx, r.sy, r.sz);
    rotation.setFromEuler(new THREE.Euler(r.rx || 0, r.ry || 0, r.rz || 0));
    matrix.compose(position, rotation, scale); mesh.setMatrixAt(i, matrix);
    tint.set(r.color || '#ffffff'); mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere(); parent.add(mesh); return mesh;
}

function ridge(parent, material, x, z, width, depth, height, phase, angle = 0) {
  const geometry = new THREE.PlaneGeometry(width, depth, 60, 20);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position, colors = new Float32Array(p.count * 3);
  const color = new THREE.Color(), pale = new THREE.Color('#b39a78'), dark = new THREE.Color('#81735f');
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / width + .5, v = p.getZ(i) / depth + .5;
    const envelope = Math.sin(Math.PI * u) ** .65;
    const spine = Math.max(0, 1 - Math.abs(v - .47) * 2) ** 1.25;
    const crest = .55 + noise(u * 8 + phase, phase) * .7;
    const erosion = Math.sin(u * 64 + v * 7 + phase) * .12 + noise(u * 31, v * 13) * .16;
    const y = envelope * spine * height * (crest + erosion);
    p.setY(i, y - .55);
    color.copy(dark).lerp(pale, clamp(.27 + y / height * .5 + noise(u * 35, v * 20) * .2, 0, 1));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = markMesh(new THREE.Mesh(geometry, material), 'eroded-distant-ridge', false);
  mesh.position.set(x, 0, z); mesh.rotation.y = angle; parent.add(mesh);
}

function scrubGeometry() {
  const vertices=[],uvs=[];
  for(let stem=0;stem<18;stem++){
    const angle=stem*2.39996,dx=Math.cos(angle),dz=Math.sin(angle),h=.32+(stem%5)*.12,bend=.22+(stem%3)*.12;
    const at=(t,side)=>{const spread=.028*(1-t)+.003;return [dx*(t*t*bend)+dz*spread*side,h*(Math.sin(t*1.3)),-dx*spread*side+dz*t*t*bend];};
    for(let j=0;j<4;j++){const t=j/4,u=(j+1)/4;for(const [p,v] of [[at(t,-1),[0,t]],[at(t,1),[1,t]],[at(u,-1),[0,u]],[at(t,1),[1,t]],[at(u,1),[1,u]],[at(u,-1),[0,u]]]){vertices.push(...p);uvs.push(...v);}}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();return geometry;
}

/** Creates an owned, static scene group. Lighting, fog and camera belong to the caller. */
export function createTerrain() {
  const group = new THREE.Group(); group.name = 'monstros-desert-yard';
  group.userData.scope = 'Original decorative landscape; fictional game coordinates.';
  const random = seeded(0x74657272);
  const dirt = dirtTexture(), metal = weatheredMetalTexture();
  const materials = {
    earth: new THREE.MeshStandardMaterial({ color: dirt ? '#ffffff' : '#a98e68', map: dirt, bumpMap: dirt, bumpScale: .07, roughness: 1, vertexColors: true }),
    farEarth: new THREE.MeshStandardMaterial({ color: '#aa9473', roughness: 1 }),
    ridge: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ color: '#a89a81', roughness: 1, flatShading: true }),
    scrub: new THREE.MeshStandardMaterial({ color: '#a39365', roughness: 1, side: THREE.DoubleSide }),
    concrete: new THREE.MeshStandardMaterial({ color: '#aaa08a', roughness: .96 }),
    steel: new THREE.MeshStandardMaterial({ color: '#878577', map: metal, roughness: .84, metalness: .18 }),
    rust: new THREE.MeshStandardMaterial({ color: '#8f664c', map: metal, roughness: .91, metalness: .13 }),
    container: new THREE.MeshStandardMaterial({ color: '#788176', map: metal, roughness: .93, metalness: .1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#393a32', roughness: .96 }),
    roof: new THREE.MeshStandardMaterial({ color: '#8f8c7b', map: metal, roughness: .76, metalness: .2, side: THREE.DoubleSide }),
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const ground = new THREE.PlaneGeometry(FIELD.width, FIELD.depth, 200, 140);
  ground.rotateX(-Math.PI / 2);
  const p = ground.attributes.position, colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + FIELD.x, z = p.getZ(i) + FIELD.z;
    p.setY(i, groundHeight(x, z));
    const v = .86 + noise(x * .11, z * .11) * .14;
    colors.set([v, v * .986, v * .95], i * 3);
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3)); ground.computeVertexNormals();
  const groundMesh = markMesh(new THREE.Mesh(ground, materials.earth), 'mottled-dirt-and-paired-ruts', false);
  groundMesh.position.set(FIELD.x, 0, FIELD.z); group.add(groundMesh);
  const horizon = markMesh(new THREE.Mesh(new THREE.PlaneGeometry(620, 440), materials.farEarth), 'distant-earth', false);
  horizon.rotation.x = -Math.PI / 2; horizon.position.set(50, -1, 30); group.add(horizon);
  ridge(group, materials.ridge, 40, -64, 230, 55, 23, 2.8);
  ridge(group, materials.ridge, 156, 28, 185, 52, 19, 6.4, Math.PI / 2);
  ridge(group, materials.ridge, -67, 25, 180, 57, 17, 9.2, Math.PI / 2);
  ridge(group, materials.ridge, 43, 115, 220, 55, 13, 12.6);

  // The three footprints correspond to the arcade model's circles exactly.
  const padGeometry = new THREE.CylinderGeometry(1, 1, 1, 48);
  const tankGeometry = new THREE.CylinderGeometry(1, 1, 1, 40);
  const coverCenters = [[50, 30, 5.4], [30, 15.5, 3], [70, 44.5, 3]];
  group.userData.cover = coverCenters.map(([x, z, radius]) => ({ x, z, radius }));
  for (const [x, z, radius] of coverCenters) {
    const pad = markMesh(new THREE.Mesh(padGeometry, materials.concrete), 'cover-footprint');
    pad.position.set(x, groundHeight(x, z) + .035, z); pad.scale.set(radius, .18, radius); group.add(pad);
  }
  const tankBase = groundHeight(50, 30) + .13;
  const tank = markMesh(new THREE.Mesh(tankGeometry, materials.rust), 'central-weathered-cistern');
  tank.position.set(50, tankBase + 2.2, 30); tank.scale.set(4.88, 4.4, 4.88); group.add(tank);
  const ringGeometry = new THREE.TorusGeometry(4.91, .055, 5, 48);
  for (const y of [.3, 2.1, 4.25]) {
    const ring = markMesh(new THREE.Mesh(ringGeometry, materials.dark), 'cistern-weld-band');
    ring.rotation.x = Math.PI / 2; ring.position.set(50, tankBase + y, 30); group.add(ring);
  }
  const hatch = markMesh(new THREE.Mesh(tankGeometry, materials.steel), 'cistern-top-hatch');
  hatch.position.set(50.6, tankBase + 4.5, 29.2); hatch.scale.set(.7, .18, .7); group.add(hatch);
  const stack = [];
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 3 - (layer === 2 ? 1 : 0); i++) {
      stack.push({ x: 30 + (i - (layer === 2 ? .5 : 1)) * 1.35, y: groundHeight(30, 15.5) + .52 + layer * .8,
        z: 15.5 + (layer % 2 ? -.55 : .3), sx: 1.3, sy: .78, sz: 2.35, ry: (random() - .5) * .14, color: ['#d1c8b0', '#b1ab99', '#c1b6a2'][i] });
    }
  }
  instances(group, cube, materials.concrete, 'stacked-concrete-cover', stack);
  const sideTank = markMesh(new THREE.Mesh(tankGeometry, materials.steel), 'small-weathered-silo');
  sideTank.position.set(70, groundHeight(70, 44.5) + 1.65, 44.5); sideTank.scale.set(2.72, 3.2, 2.72); group.add(sideTank);
  const cap = markMesh(new THREE.Mesh(new THREE.ConeGeometry(2.76, .48, 32), materials.rust), 'small-silo-cap');
  cap.position.set(70, groundHeight(70, 44.5) + 3.48, 44.5); group.add(cap);

  const stones = [], plants = [];
  for (let i = 0; i < 270; i++) {
    const x = -38 + random() * 177, z = -32 + random() * 125;
    // Keep decorative obstacles out of every possible in-bounds driving position.
    if (x > -1 && x < 101 && z > -1 && z < 61) continue;
    const size = .22 + random() ** 2 * 1.25;
    stones.push({ x, y: groundHeight(x, z) + size * .23, z, sx: size * 1.3, sy: size * .62, sz: size,
      rx: random() * .5, ry: random() * TAU, rz: random() * .3, color: ['#cdc2a3', '#a99c85', '#8e8471'][i % 3] });
  }
  for (let i = 0; i < 340; i++) {
    const x = -34 + random() * 168, z = -28 + random() * 116;
    if (x > -1 && x < 101 && z > -1 && z < 61) continue;
    if (noise(x * .12, z * .12) < .38) continue;
    const size = .45 + random() * 1.4;
    plants.push({ x, y: groundHeight(x, z) - .02, z, sx: size, sy: size * (.8 + random() * .5), sz: size,
      ry: random() * TAU, color: ['#9e9a6c', '#b5a879', '#857e58', '#c3b887'][i % 4] });
  }
  instances(group, new THREE.IcosahedronGeometry(1, 1), materials.rock, 'peripheral-stone-field', stones);
  instances(group, scrubGeometry(), materials.scrub, 'dry-scrub-clusters', plants);

  // A low industrial edge gives the scene an identifiable place and scale.
  const shedX = -17, shedZ = 16, shedY = groundHeight(shedX, shedZ);
  box(group, cube, materials.concrete, 'shed-concrete-plinth', shedX, shedY + .2, shedZ, 18.5, .4, 25);
  box(group, cube, materials.steel, 'shed-rear-wall', shedX - 8.7, shedY + 3.2, shedZ, .3, 6.2, 24);
  box(group, cube, materials.steel, 'shed-north-wall', shedX, shedY + 3.2, shedZ - 11.9, 17.7, 6.2, .25);
  box(group, cube, materials.steel, 'shed-south-wall', shedX, shedY + 3.2, shedZ + 11.9, 17.7, 6.2, .25);
  box(group, cube, materials.dark, 'shed-open-interior', shedX - 7.9, shedY + 2.65, shedZ, .2, 4.9, 21);
  const roof = box(group, cube, materials.roof, 'sloping-corrugated-shed-roof', shedX, shedY + 6.6, shedZ, 19.7, .22, 26.2);
  roof.rotation.z = -.065;
  const posts = [];
  for (const z of [shedZ - 11.5, shedZ - 4, shedZ + 4, shedZ + 11.5]) {
    posts.push({ x: shedX + 8.65, y: shedY + 3.25, z, sx: .23, sy: 6.5, sz: .23 });
  }
  instances(group, cube, materials.dark, 'shed-uprights', posts);

  const containers = [[16, -12, 0], [38, -15, -.08]];
  const ribs = [], locks = [];
  for (const [x, z, rotation] of containers) {
    const base = groundHeight(x, z) + .12;
    const container = new THREE.Group(); container.name = 'weathered-cargo-container';
    container.position.set(x, base, z); container.rotation.y = rotation; group.add(container);
    box(container, cube, materials.container, 'container-body', 0, 1.75, 0, 14.5, 3.5, 5.4);
    box(container, cube, materials.rust, 'container-roof', 0, 3.55, 0, 14.65, .12, 5.55);
    for (let n = 0; n < 29; n++) {
      for (const side of [-1, 1]) {
        const localX = -7.1 + n * .5, localZ = side * 2.73;
        ribs.push({ x: x + Math.cos(rotation) * localX + Math.sin(rotation) * localZ,
          y: base + 1.76, z: z - Math.sin(rotation) * localX + Math.cos(rotation) * localZ,
          sx: .055, sy: 3.3, sz: .055, ry: rotation });
      }
    }
    for (const offset of [-1.35, 1.35]) {
      locks.push({ x: x + Math.cos(rotation) * 7.3 + Math.sin(rotation) * offset,
        y: base + 1.7, z: z - Math.sin(rotation) * 7.3 + Math.cos(rotation) * offset,
        sx: .08, sy: 3.1, sz: .08, ry: rotation });
    }
  }
  instances(group, cube, materials.steel, 'container-corrugation-ribs', ribs);
  instances(group, cube, materials.dark, 'container-locking-bars', locks);

  const fencePosts = [], fenceRails = [], wireVertices = [];
  const fenceRuns = [[-2, -5, 107, -5], [107, -5, 107, 75]];
  for (const [ax, az, bx, bz] of fenceRuns) {
    const length = Math.hypot(bx - ax, bz - az), count = Math.ceil(length / 5);
    const dx = (bx - ax) / length, dz = (bz - az) / length;
    const angle = -Math.atan2(dz, dx);
    for (let n = 0; n <= count; n++) {
      const t = n / count, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      fencePosts.push({ x, y: groundHeight(x, z) + 1.4, z, sx: .13, sy: 2.8, sz: .13 });
      if (n === count) continue;
      const mx = x + (bx - ax) / count / 2, mz = z + (bz - az) / count / 2;
      for (const h of [.55, 2.55]) fenceRails.push({ x: mx, y: groundHeight(mx, mz) + h, z: mz, sx: length / count, sy: .055, sz: .055, ry: angle });
    }
    for (let along = 0; along < length; along += .9) {
      for (const slope of [-1, 1]) {
        const end = clamp(along + slope * 2.15, 0, length);
        const x1 = ax + dx * along, z1 = az + dz * along, x2 = ax + dx * end, z2 = az + dz * end;
        wireVertices.push(x1, groundHeight(x1, z1) + .4, z1, x2, groundHeight(x2, z2) + 2.55, z2);
      }
    }
  }
  instances(group, cube, materials.steel, 'peripheral-fence-posts', fencePosts);
  instances(group, cube, materials.steel, 'peripheral-fence-rails', fenceRails);
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wireVertices, 3));
  const wire = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({ color: '#817e6b', transparent: true, opacity: .27, depthWrite: false }));
  wire.name = 'fine-fence-wire'; group.add(wire);

  const barriers = [];
  for (let i = 0; i < 9; i++) {
    const x = 4 + i * 5.2, z = 68.5;
    barriers.push({ x, y: groundHeight(x, z) + .62, z, sx: 4.7, sy: 1.24, sz: .95, ry: (random() - .5) * .03,
      color: i % 3 ? '#c2b9a2' : '#aba38f' });
  }
  instances(group, cube, materials.concrete, 'yard-edge-concrete-blocks', barriers);
  const drums = [];
  for (let i = 0; i < 10; i++) {
    const x = -10.2 - Math.floor(i / 5) * 1.25, z = 23 + (i % 5) * 1.15;
    drums.push({ x, y: groundHeight(x, z) + .72, z, sx: .48, sy: 1.4, sz: .48,
      color: i % 3 ? '#908774' : '#a27b58' });
  }
  instances(group, new THREE.CylinderGeometry(1, 1, 1, 12), materials.rust, 'shed-stored-drums', drums);
  group.userData.staticMeshBudget = 'Instanced gravel, scrub, ribs, fence, drums and concrete; four distant ridge meshes.';
  return group;
}

/** Optional owner cleanup; shared resources are disposed once and no scene globals change. */
export function disposeTerrain(group) {
  if (!group?.traverse) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(object => {
    if (object.isInstancedMesh && typeof object.dispose === 'function') object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  group.removeFromParent(); group.clear();
}
