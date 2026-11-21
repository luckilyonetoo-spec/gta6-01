// police.js — the wanted level and the Solmar PD. Crimes raise the stars; police cars
// chase and ram, and on-foot officers run the player down and make the arrest. Lay low
// with no crime and no officer nearby and the heat cools off, one star at a time.

SB.createPolice = function createPolice(scene, city) {
  return {
    scene,
    city,
    wanted: 0,
    decayTimer: 0,
    cars: [], // police cars in pursuit
    cops: [], // officers on foot
    arrestTimer: 0,
    hitCooldown: 0,
    spawnTimer: 0,
  };
};

// A crime the police noticed: raise the wanted level and reset the cool-down clock.
// A fresh crime also dispatches the police at once (spawnTimer = 0): the chase must
// start on the next update, not up to a whole spawn cycle later — on slow machines
// the simulation runs behind real time, and a delayed dispatch looks like no police.
SB.addWanted = function addWanted(police, stars) {
  if (stars <= 0) return;
  police.wanted = SB.clamp(police.wanted + stars, 0, SB.GAME.wantedMax);
  police.decayTimer = 0;
  police.spawnTimer = 0;
};

// Remove a police car from the world.
function removePoliceCar(police, car) {
  police.scene.remove(car.mesh);
  const i = police.cars.indexOf(car);
  if (i >= 0) police.cars.splice(i, 1);
}
function removeCop(police, cop) {
  police.scene.remove(cop.mesh);
  const i = police.cops.indexOf(cop);
  if (i >= 0) police.cops.splice(i, 1);
}

// Spawn a police car on a road near the player.
function spawnPoliceCar(police, px, pz, rand) {
  const road = SB.pick(rand, police.city.roadCenters);
  const along = SB.clamp(px + (rand() * 2 - 1) * 70, -police.city.bounds, police.city.bounds);
  const onX = rand() < 0.5;
  const car = SB.createCar(police.scene, SB.CARS.policeModel, SB.CARS.policeModel.colour, true,
    onX ? along : road, onX ? road : along, 0);
  car.cruise = 0;
  car.stuck = 0;
  car.reverse = 0;
  police.cars.push(car);
  return car;
}

// Spawn an officer on foot near the player.
function spawnCop(police, px, pz, rand) {
  const mesh = SB.makePersonMesh(0x1c2f4a, 0xc98e6a, false);
  police.scene.add(mesh);
  const road = SB.pick(rand, police.city.roadCenters);
  const along = SB.clamp(px + (rand() * 2 - 1) * 50, -police.city.bounds, police.city.bounds);
  const onX = rand() < 0.5;
  const cop = {
    mesh,
    kind: 'cop',
    name: 'Officer',
    x: onX ? along : road + 6,
    z: onX ? road + 6 : along,
    heading: 0,
    health: 100,
    walkPhase: rand() * 10,
  };
  mesh.userData.target = cop;
  mesh.position.set(cop.x, 0, cop.z);
  police.cops.push(cop);
  return cop;
}

// One frame of the whole wanted system.
SB.updatePolice = function updatePolice(police, dt, player, cars, audio, rand, onBusted, onPlayerHit) {
  police.hitCooldown = Math.max(0, police.hitCooldown - dt);
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;

  // How many police cars and officers the wanted level calls for.
  const wantCars = police.wanted >= 1 ? Math.min(police.wanted, 3) : 0;
  const wantCops = police.wanted >= 2 ? Math.min(police.wanted - 1, 2) : 0;
  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0) {
    police.spawnTimer = 1.5;
    while (police.cars.length < wantCars) spawnPoliceCar(police, px, pz, rand);
    while (police.cops.length < wantCops) spawnCop(police, px, pz, rand);
  }
  while (police.cars.length > wantCars) removePoliceCar(police, police.cars[police.cars.length - 1]);
  while (police.cops.length > wantCops) removeCop(police, police.cops[police.cops.length - 1]);

  // Police cars: steer at the player and ram. Buildings slow them, not stop them.
  for (const car of police.cars) {
    const dx = px - car.x;
    const dz = pz - car.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const wantHeading = Math.atan2(dx, dz);
    if (car.reverse > 0) {
      car.reverse -= dt;
      car.speed = -8;
      car.heading += 1.2 * dt;
    } else {
      car.heading = SB.angleLerp(car.heading, wantHeading, dt * 2.2);
      const targetSpeed = dist > 8 ? SB.CARS.policeModel.top : 20;
      car.speed = SB.lerp(car.speed, targetSpeed, dt * 0.8);
    }
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const hit = SB.resolveCollisions(police.city, nx, nz, 2.1);
    if (hit.pushed) {
      car.speed *= 0.4;
      car.stuck += dt;
      if (car.stuck > 1.2) { car.reverse = 0.8; car.stuck = 0; }
    } else {
      car.stuck = 0;
    }
    car.x = SB.clamp(hit.x, -police.city.bounds, police.city.bounds);
    car.z = SB.clamp(hit.z, -police.city.bounds, police.city.bounds);
    // Push traffic and the player's car out of the way.
    for (const o of cars) {
      if (o === car || o.isPolice) continue;
      const d = SB.distance2d(car.x, car.z, o.x, o.z);
      if (d < 4.2 && d > 0.01) {
        const push = (4.2 - d) * 0.5;
        o.x += ((o.x - car.x) / d) * push;
        o.z += ((o.z - car.z) / d) * push;
        SB.syncCar(o);
      }
    }
    SB.syncCar(car);
    // A police car that reaches the player on foot hurts him and shoves him.
    if (!player.inCar && dist < 2.6 && police.hitCooldown <= 0) {
      police.hitCooldown = 1.0;
      onPlayerHit(20, car);
    }
  }

  // Officers on foot: run at the player; standing close long enough makes the arrest.
  let nearestCop = Infinity;
  for (const cop of police.cops) {
    const dx = player.x - cop.x;
    const dz = player.z - cop.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    nearestCop = Math.min(nearestCop, dist);
    const wantHeading = Math.atan2(dx, dz);
    cop.heading = SB.angleLerp(cop.heading, wantHeading, dt * 5);
    const speed = player.inCar ? SB.PEOPLE.runSpeed : SB.PEOPLE.runSpeed * 0.95;
    const nx = cop.x + Math.sin(cop.heading) * speed * dt;
    const nz = cop.z + Math.cos(cop.heading) * speed * dt;
    const hit = SB.resolveCollisions(police.city, nx, nz, 0.5);
    cop.x = hit.x;
    cop.z = hit.z;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    cop.walkPhase += dt * speed * 2.4;
    const swing = Math.sin(cop.walkPhase) * 0.5;
    const parts = cop.mesh.userData.parts;
    parts.legL.rotation.x = swing;
    parts.legR.rotation.x = -swing;
  }
  if (!player.inCar && nearestCop < 2.2) {
    police.arrestTimer += dt;
    if (police.arrestTimer >= SB.GAME.bustedSeconds) {
      police.arrestTimer = 0;
      onBusted();
    }
  } else {
    police.arrestTimer = 0;
  }

  // Cool down: no crime and no police close by, and one star fades away.
  const nearestPolice = Math.min(
    police.cars.reduce((m, c) => Math.min(m, SB.distance2d(c.x, c.z, px, pz)), Infinity),
    police.cops.reduce((m, c) => Math.min(m, SB.distance2d(c.x, c.z, px, pz)), Infinity)
  );
  if (police.wanted > 0) {
    police.decayTimer += dt;
    if (police.decayTimer > SB.GAME.wantedDecaySeconds && nearestPolice > 45) {
      police.wanted -= 1;
      police.decayTimer = 0;
    }
  } else {
    police.decayTimer = 0;
  }
};

// A cop the player shot: remove him from the chase.
SB.removeCop = function removeCop(police, cop) {
  removeCop(police, cop);
};
