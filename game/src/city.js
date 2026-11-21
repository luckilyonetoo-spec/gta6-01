// city.js — builds Solmar Bay in 3D: the ground, the road grid, the blocks of buildings,
// the park, the palms, the lamps and the sea. Everything is procedural geometry with
// runtime-painted canvas textures, so the game ships no image files at all.
// Static geometry is merged per material into a handful of meshes, so even a software
// renderer keeps up. Returns the colliders (building footprints) and the road layout
// the other files need.

SB.createCity = function createCity(scene, rand) {
  const THREE = window.THREE;
  const P = SB.PALETTE;
  const C = SB.CITY;
  const pitch = C.block + C.road; // 58: distance between neighbouring block centres
  const half = (C.blocks - 1) / 2; // block index -4..4
  const colliders = [];
  const roadCenters = [];
  for (let i = 0; i <= C.blocks; i++) roadCenters.push(-half * pitch - C.block / 2 - C.road / 2 + i * pitch);
  // roadCenters: -261, -203, -145, -87, -29, 29, 87, 145, 203, 261
  const extent = roadCenters[roadCenters.length - 1] + C.road / 2; // 268

  // --- Lights and sky -------------------------------------------------------
  scene.background = new THREE.Color(P.sky);
  scene.fog = new THREE.Fog(P.sky, 260, 620);
  const sun = new THREE.DirectionalLight(P.sun, 1.15);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75));
  // The shadow camera follows the player; main.js moves it every frame.
  const city = { colliders, roadCenters, extent, sun, bounds: extent - 6 };

  // --- Runtime-painted textures ---------------------------------------------
  function canvasTexture(w, h, draw, repeatX, repeatY) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 1, repeatY || 1);
    tex.anisotropy = 4;
    return tex;
  }
  // Asphalt with a dashed centre line, repeated along each road's length.
  const roadTex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#2e2d2b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8d2c4';
    g.fillRect(20, h / 2 - 2, 60, 4);
    g.fillRect(148, h / 2 - 2, 60, 4);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }, 40, 1);
  // Building faces: a grid of windows on white, tinted by each material's colour.
  const windowTex = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#20242c';
    for (let y = 14; y < h - 14; y += 26) {
      for (let x = 12; x < w - 12; x += 22) {
        g.fillStyle = Math.random() < 0.25 ? '#7fb2d9' : '#20242c';
        g.fillRect(x, y, 12, 16);
      }
    }
  });

  // --- Geometry merging -------------------------------------------------------
  // Static pieces sharing a material are merged into one mesh: hundreds of boxes
  // become a few dozen draw calls, which is what keeps the game playable.
  const buckets = new Map(); // material -> array of transformed geometries
  function pushGeo(mat, geo) {
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(geo);
  }
  function pushBox(mat, w, h, d, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    pushGeo(mat, g);
  }
  function pushCylinder(mat, rt, rb, h, seg, x, y, z) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    g.translate(x, y, z);
    pushGeo(mat, g);
  }
  function pushSphere(mat, r, ws, hs, x, y, z, sy) {
    const g = new THREE.SphereGeometry(r, ws, hs);
    if (sy !== undefined) g.scale(1, sy, 1);
    g.translate(x, y, z);
    pushGeo(mat, g);
  }
  function mergeGeos(geos) {
    let vCount = 0;
    let iCount = 0;
    for (const g of geos) {
      vCount += g.attributes.position.count;
      iCount += g.index.count;
    }
    const pos = new Float32Array(vCount * 3);
    const nor = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    const idx = new Uint32Array(iCount);
    let vo = 0;
    let io = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      const gi = g.index.array;
      for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
      vo += g.attributes.position.count;
      io += gi.length;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    merged.setIndex(new THREE.BufferAttribute(idx, 1));
    return merged;
  }
  function flushBuckets(castShadow) {
    for (const [mat, geos] of buckets) {
      const mesh = new THREE.Mesh(mergeGeos(geos), mat);
      mesh.castShadow = !!castShadow;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    buckets.clear();
  }

  const buildingMats = P.buildings.map((col) => new THREE.MeshLambertMaterial({ color: col, map: windowTex }));
  const glassMats = P.glass.map((col) => new THREE.MeshLambertMaterial({ color: col, map: windowTex }));
  const roofMats = P.roofs.map((col) => new THREE.MeshLambertMaterial({ color: col }));
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: P.sidewalk });
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });

  // --- Ground, sea and sand ---------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(C.ground, C.ground),
    new THREE.MeshLambertMaterial({ color: 0x77716a }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // The sea south of the city, with a sand strip the ring road runs along.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(C.ground, 220),
    new THREE.MeshLambertMaterial({ color: 0x2f7fb8 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.05, extent + 100);
  scene.add(sea);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(C.ground, 26),
    new THREE.MeshLambertMaterial({ color: 0xe0c98f }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, extent + 6);
  sand.receiveShadow = true;
  scene.add(sand);

  // --- Roads ------------------------------------------------------------------
  const roadGeoX = new THREE.PlaneGeometry(C.ground, C.road);
  roadGeoX.rotateX(-Math.PI / 2);
  const roadGeoZ = new THREE.PlaneGeometry(C.ground, C.road);
  roadGeoZ.rotateX(-Math.PI / 2);
  roadGeoZ.rotateY(Math.PI / 2);
  for (const c of roadCenters) {
    const gx = roadGeoX.clone();
    gx.translate(0, 0.02, c);
    pushGeo(roadMat, gx);
    const gz = roadGeoZ.clone();
    gz.translate(c, 0.02, 0);
    pushGeo(roadMat, gz);
  }

  // --- Buildings --------------------------------------------------------------
  function addBuilding(cx, cz, w, d, h, mat) {
    pushBox(mat, w, h, d, cx, h / 2, cz);
    pushBox(SB.pick(rand, roofMats), w * 0.92, 0.8, d * 0.92, cx, h + 0.4, cz);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }

  // One block = four lots; downtown blocks (near the middle) grow taller.
  for (let bi = 0; bi < C.blocks; bi++) {
    for (let bj = 0; bj < C.blocks; bj++) {
      const cx = (bi - half) * pitch;
      const cz = (bj - half) * pitch;
      // The middle block is the park, not buildings.
      if (bi === 4 && bj === 4) continue;
      pushBox(sidewalkMat, C.block, 0.2, C.block, cx, 0.03, cz);
      const downtown = Math.max(0, 3 - (Math.abs(bi - 4) + Math.abs(bj - 4)));
      const lots = [[-11, -11], [11, -11], [-11, 11], [11, 11]];
      for (const [ox, oz] of lots) {
        if (rand() < 0.22) continue; // an empty lot: a parking patch or a yard
        const w = 14 + rand() * 6;
        const d = 14 + rand() * 6;
        const h = 7 + rand() * (10 + downtown * 9);
        const glass = rand() < 0.3 && h > 18;
        addBuilding(cx + ox, cz + oz, w, d, h, glass ? SB.pick(rand, glassMats) : SB.pick(rand, buildingMats));
      }
    }
  }

  // --- The park in the middle: lawn, a fountain and shade trees --------------
  pushBox(new THREE.MeshLambertMaterial({ color: 0x6fa05a }), C.block, 0.2, C.block, 0, 0.03, 0);
  pushCylinder(new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }), 5, 5.6, 1.2, 20, 0, 0.6, 0);
  pushCylinder(new THREE.MeshLambertMaterial({ color: 0x3f9fd9 }), 4.4, 4.4, 0.3, 20, 0, 1.2, 0);
  colliders.push({ minX: -5.6, maxX: 5.6, minZ: -5.6, maxZ: 5.6 });

  // --- Palms and lamps along the roads ----------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: P.palmTrunk });
  const canopyMat = new THREE.MeshLambertMaterial({ color: P.palmLeaf });
  const lampMat = new THREE.MeshLambertMaterial({ color: P.lamp });
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
  for (const c of roadCenters) {
    for (let t = -240; t <= 240; t += 48) {
      if (rand() < 0.45) {
        pushCylinder(trunkMat, 0.25, 0.4, 5, 6, c + 8.5, 2.5, t + (rand() * 8 - 4));
        pushSphere(canopyMat, 2.2, 8, 6, c + 8.5, 5.4, t + (rand() * 8 - 4), 0.55);
      }
      if (rand() < 0.35) {
        pushCylinder(lampMat, 0.12, 0.12, 6, 6, c - 8.5, 3, t + 24);
        pushSphere(lampHeadMat, 0.4, 8, 6, c - 8.5, 6.2, t + 24);
      }
    }
  }
  // A row of palms along the beach.
  for (let x = -240; x <= 240; x += 32) {
    pushCylinder(trunkMat, 0.25, 0.4, 5, 6, x, 2.5, extent + 2);
    pushSphere(canopyMat, 2.2, 8, 6, x, 5.4, extent + 2, 0.55);
  }

  flushBuckets(true);

  // --- Where the city lets the player stand -----------------------------------
  city.spawn = { x: 14, z: 14 };
  return city;
};

// Push a circle (x, z, radius) out of every building collider it overlaps.
// Returns true when a push happened. Used by the player, cars and pedestrians.
SB.resolveCollisions = function resolveCollisions(city, x, z, radius) {
  let pushed = false;
  for (const c of city.colliders) {
    const nx = SB.clamp(x, c.minX, c.maxX);
    const nz = SB.clamp(z, c.minZ, c.maxZ);
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        // Dead centre of a building: push out along the shortest side.
        const left = x - c.minX;
        const right = c.maxX - x;
        const top = z - c.minZ;
        const bottom = c.maxZ - z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = c.minX - radius;
        else if (m === right) x = c.maxX + radius;
        else if (m === top) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
      pushed = true;
    }
  }
  return { x, z, pushed };
};

// The nearest road centre to a coordinate, on one axis.
SB.nearestRoad = function nearestRoad(city, v) {
  let best = city.roadCenters[0];
  let bd = Math.abs(v - best);
  for (const c of city.roadCenters) {
    const d = Math.abs(v - c);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
};
