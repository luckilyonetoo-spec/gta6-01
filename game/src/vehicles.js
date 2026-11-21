// vehicles.js — cars: the box-built models, arcade driving physics, and the traffic
// that fills Solmar Bay's roads. Every car is a THREE.Group of boxes and cylinders, so
// the game needs no model files.

SB.CAR_LENGTH = 4.4;
SB.CAR_WIDTH = 2.0;

// Build one car's mesh, facing local +Z. Police cars get a light bar and a badge colour.
SB.makeCarMesh = function makeCarMesh(model, colour, isPolice) {
  const THREE = window.THREE;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colour });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9cc4d8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(SB.CAR_WIDTH, 0.75, SB.CAR_LENGTH), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(SB.CAR_WIDTH - 0.3, 0.65, 2.0), glassMat);
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(SB.CAR_WIDTH - 0.2, 0.12, 0.9), bodyMat);
  hood.position.set(0, 0.95, 1.75);
  g.add(hood);
  // Headlights and taillights: small bright boxes, so cars read at a glance.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0x555533 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc22a2a, emissive: 0x330000 });
  for (const s of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    head.position.set(s, 0.6, SB.CAR_LENGTH / 2 + 0.02);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(s, 0.6, -SB.CAR_LENGTH / 2 - 0.02);
    g.add(tail);
  }
  if (isPolice) {
    const barMat = new THREE.MeshLambertMaterial({ color: 0x2244cc, emissive: 0x112266 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), barMat);
    bar.position.set(0, 1.62, -0.2);
    g.add(bar);
    const redMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x330000 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42), redMat);
    red.position.set(-0.32, 1.62, -0.2);
    g.add(red);
  }
  // Wheels: dark cylinders that spin with the car's speed.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    g.add(wheel);
    wheels.push(wheel);
  }
  g.userData.wheels = wheels;
  return g;
};

// One car in the world: mesh plus the numbers the physics reads.
SB.createCar = function createCar(scene, model, colour, isPolice, x, z, heading) {
  const mesh = SB.makeCarMesh(model, colour, isPolice);
  scene.add(mesh);
  const car = {
    mesh,
    kind: isPolice ? 'policecar' : 'car',
    model,
    colour,
    isPolice: !!isPolice,
    x, z,
    heading: heading || 0,
    speed: 0,
    steer: 0,
    parked: false, // a parked car never moves on its own — until someone steals it
    // Traffic state: which road axis it follows, which way, and its cruise speed.
    axis: 'x',
    dir: 1,
    cruise: 8 + Math.random() * 4,
    stuck: 0,
    occupant: null, // the pedestrian driving it, if it is a traffic car
  };
  mesh.userData.target = car;
  SB.syncCar(car);
  return car;
};

SB.syncCar = function syncCar(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * 0.016 / 0.38;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
};

// --- The player's car: arcade handling --------------------------------------
// W/S accelerate and brake/reverse, A/D steer (less at speed, reversed in reverse),
// Space is the handbrake. Buildings stop the car; other cars push it.
SB.drivePlayerCar = function drivePlayerCar(car, input, dt, city, others, audio) {
  const m = car.model;
  const forward = input.held('KeyW') ? 1 : 0;
  const back = input.held('KeyS') ? 1 : 0;
  const left = input.held('KeyA') ? 1 : 0;
  const right = input.held('KeyD') ? 1 : 0;
  const handbrake = input.held('Space');

  if (forward) car.speed += m.accel * dt;
  if (back) {
    if (car.speed > 0.5) car.speed -= m.accel * 1.6 * dt; // brake
    else car.speed -= m.accel * 0.6 * dt; // reverse
  }
  if (!forward && !back) car.speed -= Math.sign(car.speed) * 6 * dt; // coast
  if (handbrake) car.speed -= Math.sign(car.speed) * 22 * dt;
  car.speed = SB.clamp(car.speed, -m.top * 0.45, m.top);

  const speedFactor = SB.clamp(Math.abs(car.speed) / 12, 0, 1);
  const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
  car.steer = SB.lerp(car.steer, steerTarget * (1 - speedFactor * 0.45), dt * 8);
  const reversing = car.speed < -0.5;
  car.heading += car.steer * m.grip * 0.42 * dt * (reversing ? -1 : 1) * (handbrake ? 1.5 : 1);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = SB.resolveCollisions(city, nx, nz, 2.1);
  if (hit.pushed) {
    if (Math.abs(car.speed) > 8 && audio) audio.crash();
    car.speed *= 0.45;
  }
  car.x = SB.clamp(hit.x, -city.bounds, city.bounds);
  car.z = SB.clamp(hit.z, -city.bounds, city.bounds);

  // Nudge away from other cars instead of passing through them.
  for (const o of others) {
    if (o === car) continue;
    const d = SB.distance2d(car.x, car.z, o.x, o.z);
    if (d < 4.2 && d > 0.01) {
      const push = (4.2 - d) * 0.5;
      const dx = (car.x - o.x) / d;
      const dz = (car.z - o.z) / d;
      car.x += dx * push;
      car.z += dz * push;
      car.speed *= 0.85;
    }
  }
  SB.syncCar(car);
  if (audio) audio.setEngine(Math.abs(car.speed), m.top);
};

// --- Traffic: cars that follow the road grid ---------------------------------
// A traffic car drives along one road in one direction, in the right-hand lane, and at
// each crossing it sometimes turns onto the cross road. It slows for the car ahead.
SB.updateTrafficCar = function updateTrafficCar(car, dt, city, others) {
  // A parked car stays where it is; it only moves when the player drives it.
  if (car.parked) {
    SB.syncCar(car);
    return;
  }
  const lane = 3.5;
  // Where the car should be laterally: the right-hand lane of its road.
  let targetX = car.x;
  let targetZ = car.z;
  if (car.axis === 'x') {
    targetZ = SB.nearestRoad(city, car.z) + (car.dir > 0 ? -lane : lane);
    targetX = car.x + car.dir * car.cruise * dt;
  } else {
    targetX = SB.nearestRoad(city, car.x) + (car.dir > 0 ? lane : -lane);
    targetZ = car.z + car.dir * car.cruise * dt;
  }
  // Slow down for the car ahead on the same road.
  let slow = 1;
  for (const o of others) {
    if (o === car) continue;
    const dx = o.x - car.x;
    const dz = o.z - car.z;
    const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
    const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
    if (ahead > 0 && ahead < 9 && side < 3) { slow = 0.25; break; }
  }
  const step = car.cruise * slow * dt;
  if (car.axis === 'x') targetX = car.x + car.dir * step;
  else targetZ = car.z + car.dir * step;

  // At a crossing, sometimes turn onto the other road.
  const along = car.axis === 'x' ? targetX : targetZ;
  const cross = car.axis === 'x' ? targetZ : targetX;
  const nearestCross = SB.nearestRoad(city, along);
  if (Math.abs(along - nearestCross) < 1.2 && Math.random() < 0.012) {
    car.axis = car.axis === 'x' ? 'z' : 'x';
    car.dir = Math.random() < 0.5 ? 1 : -1;
  }
  car.x = targetX;
  car.z = targetZ;
  // Wrap around the city edge instead of driving into the sea.
  if (car.x > city.bounds) car.x = -city.bounds;
  if (car.x < -city.bounds) car.x = city.bounds;
  if (car.z > city.bounds) car.z = -city.bounds;
  if (car.z < -city.bounds) car.z = city.bounds;
  const wantHeading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  car.heading = SB.angleLerp(car.heading, wantHeading, dt * 4);
  car.speed = car.cruise * slow;
  SB.syncCar(car);
};

// Put traffic on the roads: each car starts on a random road, in a random direction.
SB.spawnTraffic = function spawnTraffic(scene, city, rand) {
  const cars = [];
  for (let i = 0; i < SB.CARS.trafficCount; i++) {
    const model = SB.pick(rand, SB.CARS.models);
    const road = SB.pick(rand, city.roadCenters);
    const axis = rand() < 0.5 ? 'x' : 'z';
    const dir = rand() < 0.5 ? 1 : -1;
    const along = (rand() * 2 - 1) * city.bounds;
    const x = axis === 'x' ? along : road;
    const z = axis === 'x' ? road : along;
    const car = SB.createCar(scene, model, model.colour, false, x, z, 0);
    car.axis = axis;
    car.dir = dir;
    car.cruise = 7 + rand() * 5;
    cars.push(car);
  }
  return cars;
};

// Parked cars at the kerb: the easy steal. A player on foot cannot catch a car
// doing 8 units a second, so the city keeps some cars standing still — ten of
// them, spread along the roads, nose to the kerb. A spot is only taken when the
// car's whole footprint clears every building: a car half-buried in a wall looks
// broken, and a player teleported beside it would be pushed out of steal range.
SB.spawnParkedCars = function spawnParkedCars(scene, city, rand) {
  function spotClear(x, z, axis) {
    // The car is 4.4 long along its road axis and 2 wide; keep half a unit
    // of air around it so neither the car nor a player beside it clips a wall.
    const hl = 2.2 + 0.5;
    const hw = 1.0 + 0.5;
    const minX = x - (axis === 'x' ? hl : hw);
    const maxX = x + (axis === 'x' ? hl : hw);
    const minZ = z - (axis === 'x' ? hw : hl);
    const maxZ = z + (axis === 'x' ? hw : hl);
    for (const c of city.colliders) {
      if (minX < c.maxX && maxX > c.minX && minZ < c.maxZ && maxZ > c.minZ) return false;
    }
    return true;
  }
  const cars = [];
  for (let i = 0; i < 10; i++) {
    const model = SB.pick(rand, SB.CARS.models);
    let x = 0;
    let z = 0;
    let axis = 'x';
    let heading = 0;
    let placed = false;
    for (let tries = 0; tries < 40 && !placed; tries++) {
      const road = SB.pick(rand, city.roadCenters);
      axis = rand() < 0.5 ? 'x' : 'z';
      const along = -220 + i * 48 + rand() * 20;
      const side = (rand() < 0.5 ? -1 : 1) * 8.2; // just off the road, on the kerb
      x = axis === 'x' ? along : road + side;
      z = axis === 'x' ? road + side : along;
      heading = axis === 'x' ? (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rand() < 0.5 ? 0 : Math.PI);
      placed = spotClear(x, z, axis);
    }
    const car = SB.createCar(scene, model, model.colour, false, x, z, heading);
    car.parked = true;
    car.cruise = 0;
    cars.push(car);
  }
  return cars;
};
