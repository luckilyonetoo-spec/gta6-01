// player.js — Jace Marlowe on foot: walking, sprinting, stealing cars, and the chase
// camera that follows him (and his car). The camera orbits with the mouse and never
// hides inside a building.

SB.createPlayer = function createPlayer(scene, x, z) {
  const mesh = SB.makePersonMesh(0xffffff, 0xc98e6a, true);
  scene.add(mesh);
  const player = {
    mesh,
    x, z,
    heading: 0,
    health: SB.GAME.playerHealth,
    ammo: SB.GAME.pistolMag,
    inCar: null,
    stealTarget: null,
    stealProgress: 0,
    walkPhase: 0,
    // Camera orbit: yaw around the player, pitch above the horizon, distance behind.
    camYaw: Math.PI,
    camPitch: 0.38,
    camDist: 8,
    dead: false,
  };
  mesh.position.set(x, 0, z);
  return player;
};

// The nearest stealable car within reach, or null.
SB.nearestCar = function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bd = maxDist;
  for (const car of cars) {
    const d = SB.distance2d(x, z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
};

// One frame on foot. Returns a prompt string for the HUD, or null.
SB.updatePlayerOnFoot = function updatePlayerOnFoot(player, input, dt, city, cars, audio, onSteal) {
  const delta = input.takeMouseDelta();
  player.camYaw -= delta.x * 0.004;
  player.camPitch = SB.clamp(player.camPitch + delta.y * 0.003, 0.12, 0.9);

  const fwd = { x: Math.sin(player.camYaw), z: Math.cos(player.camYaw) };
  const right = { x: Math.cos(player.camYaw), z: -Math.sin(player.camYaw) };
  let mx = 0;
  let mz = 0;
  if (input.held('KeyW')) { mx += fwd.x; mz += fwd.z; }
  if (input.held('KeyS')) { mx -= fwd.x; mz -= fwd.z; }
  if (input.held('KeyD')) { mx += right.x; mz += right.z; }
  if (input.held('KeyA')) { mx -= right.x; mz -= right.z; }
  const moving = mx !== 0 || mz !== 0;
  const sprint = input.held('ShiftLeft') || input.held('ShiftRight');
  const speed = sprint ? SB.GAME.playerSprint : SB.GAME.playerWalk;
  if (moving) {
    const len = Math.sqrt(mx * mx + mz * mz);
    mx /= len;
    mz /= len;
    player.heading = SB.angleLerp(player.heading, Math.atan2(mx, mz), dt * 10);
    const nx = player.x + mx * speed * dt;
    const nz = player.z + mz * speed * dt;
    const hit = SB.resolveCollisions(city, nx, nz, 0.6);
    player.x = SB.clamp(hit.x, -city.bounds, city.bounds);
    player.z = SB.clamp(hit.z, -city.bounds, city.bounds);
    player.walkPhase += dt * speed * 1.6;
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  const swing = moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  const parts = player.mesh.userData.parts;
  parts.legL.rotation.x = swing;
  parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.7;
  parts.armR.rotation.x = swing * 0.7;

  // Stealing: hold E beside a car. The driver (if the car had one) runs off.
  const near = SB.nearestCar(cars, player.x, player.z, 3.4);
  if (near && input.held('KeyE')) {
    player.stealTarget = near;
    player.stealProgress += dt / SB.GAME.stealTime;
    if (player.stealProgress >= 1) {
      player.stealProgress = 0;
      player.stealTarget = null;
      if (audio) audio.steal();
      onSteal(near);
      return null;
    }
    return 'Stealing… ' + Math.round(player.stealProgress * 100) + '%';
  }
  player.stealTarget = null;
  player.stealProgress = 0;
  if (near) return 'Hold E to steal the ' + near.model.name;
  return null;
};

// Step out of the car beside it.
SB.exitCar = function exitCar(player, car) {
  player.inCar = null;
  car.speed = 0;
  const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  player.x = car.x + side.x * 2.4;
  player.z = car.z + side.z * 2.4;
  player.heading = car.heading;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.visible = true;
};

// The chase camera: behind and above the player or the car, pulled out of buildings.
SB.updateCamera = function updateCamera(camera, player, city, dt) {
  const target = player.inCar
    ? { x: player.inCar.x, z: player.inCar.z, y: 1.6 }
    : { x: player.x, z: player.z, y: 1.6 };
  const dist = player.inCar ? 11 : player.camDist;
  const height = dist * Math.sin(player.camPitch) + 1.2;
  const back = dist * Math.cos(player.camPitch);
  let cx = target.x - Math.sin(player.camYaw) * back;
  let cz = target.z - Math.cos(player.camYaw) * back;
  const hit = SB.resolveCollisions(city, cx, cz, 1.2);
  cx = hit.x;
  cz = hit.z;
  const want = new window.THREE.Vector3(cx, height, cz);
  camera.position.lerp(want, 1 - Math.pow(0.0001, dt));
  camera.lookAt(target.x, target.y, target.z);
  // The sun's shadow box follows the camera so shadows stay crisp near the player.
  if (city.sun) {
    city.sun.position.set(target.x + 120, 180, target.z + 60);
    city.sun.target.position.set(target.x, 0, target.z);
    city.sun.target.updateMatrixWorld();
  }
};
