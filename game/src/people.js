// people.js — the crowd of Solmar Bay and Jace Marlowe himself. Pedestrians are simple
// box figures that walk the sidewalks, run from danger, and get knocked down (never
// killed) when a car hits them. The player gets a more detailed figure so he reads
// as the hero on screen.

SB.makePersonMesh = function makePersonMesh(shirtColour, skinColour, isPlayer) {
  const THREE = window.THREE;
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColour });
  const skin = new THREE.MeshLambertMaterial({ color: skinColour || 0xc98e6a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.34), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.26), pants);
  legL.position.set(-0.16, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  if (isPlayer) {
    // Jace: a navy jacket over a white shirt, so he stands out in the crowd.
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.84, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x1e2a44 }));
    jacket.position.y = 1.05;
    g.add(jacket);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: 0x1e2a44 }));
    cap.position.y = 1.88;
    g.add(cap);
  }
  g.userData.parts = { legL, legR, armL, armR };
  return g;
};

// One pedestrian: a name, a walk target, and a state (walk / flee / down).
SB.createPedestrian = function createPedestrian(scene, city, rand) {
  const mesh = SB.makePersonMesh(SB.pick(rand, SB.PEOPLE.shirts), 0xc98e6a, false);
  scene.add(mesh);
  const road = SB.pick(rand, city.roadCenters);
  const along = (rand() * 2 - 1) * city.bounds;
  const onX = rand() < 0.5;
  const ped = {
    mesh,
    kind: 'ped',
    name: SB.pick(rand, SB.PEOPLE.names),
    x: onX ? along : road + 6,
    z: onX ? road + 6 : along,
    heading: rand() * Math.PI * 2,
    speed: 0,
    state: 'walk',
    stateTime: 0,
    targetX: 0,
    targetZ: 0,
    walkPhase: rand() * 10,
  };
  SB.pickNewTarget(ped, city, rand);
  ped.mesh.userData.target = ped;
  ped.mesh.position.set(ped.x, 0, ped.z);
  return ped;
};

SB.pickNewTarget = function pickNewTarget(ped, city, rand) {
  const road = SB.pick(rand, city.roadCenters);
  const along = (rand() * 2 - 1) * city.bounds;
  const side = rand() < 0.5 ? -6 : 6;
  if (rand() < 0.5) {
    ped.targetX = along;
    ped.targetZ = road + side;
  } else {
    ped.targetX = road + side;
    ped.targetZ = along;
  }
};

// Walk, flee, or lie down: one pedestrian's frame.
SB.updatePedestrian = function updatePedestrian(ped, dt, city, danger, rand) {
  ped.stateTime += dt;
  let speed = SB.PEOPLE.walkSpeed;
  let tx = ped.targetX;
  let tz = ped.targetZ;
  if (ped.state === 'down') {
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.3;
    if (ped.stateTime > 2.5) {
      ped.state = 'flee';
      ped.stateTime = 0;
      ped.mesh.rotation.x = 0;
      ped.mesh.position.y = 0;
    }
    return;
  }
  if (danger && SB.distance2d(ped.x, ped.z, danger.x, danger.z) < danger.radius) {
    ped.state = 'flee';
    ped.stateTime = 0;
  }
  if (ped.state === 'flee') {
    speed = SB.PEOPLE.runSpeed;
    if (danger) {
      const d = Math.max(SB.distance2d(ped.x, ped.z, danger.x, danger.z), 0.01);
      tx = ped.x + ((ped.x - danger.x) / d) * 20;
      tz = ped.z + ((ped.z - danger.z) / d) * 20;
    }
    if (ped.stateTime > 3) { ped.state = 'walk'; ped.stateTime = 0; }
  }
  const dx = tx - ped.x;
  const dz = tz - ped.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 1.5 && ped.state === 'walk') {
    SB.pickNewTarget(ped, city, rand);
    return;
  }
  const wantHeading = Math.atan2(dx, dz);
  ped.heading = SB.angleLerp(ped.heading, wantHeading, dt * 6);
  ped.speed = speed;
  const nx = ped.x + Math.sin(ped.heading) * speed * dt;
  const nz = ped.z + Math.cos(ped.heading) * speed * dt;
  const hit = SB.resolveCollisions(city, nx, nz, 0.5);
  ped.x = SB.clamp(hit.x, -city.bounds, city.bounds);
  ped.z = SB.clamp(hit.z, -city.bounds, city.bounds);
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.heading;
  // Walk cycle: legs and arms swing opposite each other.
  ped.walkPhase += dt * speed * 2.4;
  const swing = Math.sin(ped.walkPhase) * 0.5;
  const parts = ped.mesh.userData.parts;
  parts.legL.rotation.x = swing;
  parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.8;
  parts.armR.rotation.x = swing * 0.8;
};

// Knock a pedestrian down: they lie still, then get up and run.
SB.knockDown = function knockDown(ped) {
  if (ped.state === 'down') return;
  ped.state = 'down';
  ped.stateTime = 0;
  ped.speed = 0;
};

// The crowd for the whole city.
SB.spawnPedestrians = function spawnPedestrians(scene, city, rand, count) {
  const peds = [];
  for (let i = 0; i < count; i++) peds.push(SB.createPedestrian(scene, city, rand));
  return peds;
};
