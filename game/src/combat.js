// combat.js — the pistol, the punch, and the Vulture Crew. Shots are hitscan: a ray
// from the camera through the crosshair, a tracer line to show it, and damage on the
// first person or car it meets. Pedestrians go down and run; cops and thugs can be
// dropped. Nothing here is gory: a hit figure falls over and is gone.

SB.createCombat = function createCombat(scene) {
  return {
    scene,
    tracers: [],
    shootCooldown: 0,
    punchCooldown: 0,
    thugShootTimer: 0,
  };
};

// Find the entity behind a raycast hit by walking up to the group that carries it.
function targetOf(object) {
  let o = object;
  while (o) {
    if (o.userData && o.userData.target) return o.userData.target;
    o = o.parent;
  }
  return null;
}

// Draw a tracer from the muzzle to the hit point; it fades out in a tenth of a second.
function addTracer(combat, from, to) {
  const THREE = window.THREE;
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  combat.scene.add(line);
  combat.tracers.push({ line, life: 0.12 });
}

SB.updateCombat = function updateCombat(combat, dt) {
  combat.shootCooldown = Math.max(0, combat.shootCooldown - dt);
  combat.punchCooldown = Math.max(0, combat.punchCooldown - dt);
  for (let i = combat.tracers.length - 1; i >= 0; i--) {
    const t = combat.tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.12) * 0.9;
    if (t.life <= 0) {
      combat.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      combat.tracers.splice(i, 1);
    }
  }
};

// Fire the pistol at the crosshair. `targets` are the people and cars that can be hit.
// Returns the target hit, or null.
SB.shoot = function shoot(combat, camera, player, targets, audio) {
  if (combat.shootCooldown > 0 || player.ammo <= 0) return null;
  combat.shootCooldown = 0.28;
  player.ammo -= 1;
  if (audio) audio.shoot();
  const THREE = window.THREE;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  ray.far = SB.GAME.shootRange;
  const meshes = [];
  for (const t of targets) {
    if (t.mesh) {
      t.mesh.traverse((o) => { if (o.isMesh) meshes.push(o); });
    }
  }
  const hits = ray.intersectObjects(meshes, false);
  const from = new THREE.Vector3();
  camera.getWorldPosition(from);
  const to = hits.length > 0 ? hits[0].point.clone() : ray.ray.at(SB.GAME.shootRange, new THREE.Vector3());
  addTracer(combat, from, to);
  if (hits.length === 0) return null;
  const target = targetOf(hits[0].object);
  if (!target) return null;
  target.health = (target.health === undefined ? 100 : target.health) - SB.GAME.pistolDamage;
  if (audio) audio.hit();
  return target;
};

// A punch at the nearest person in front of the player.
SB.punch = function punch(combat, player, targets, audio) {
  if (combat.punchCooldown > 0) return null;
  combat.punchCooldown = 0.45;
  if (audio) audio.punch();
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  let best = null;
  let bd = SB.GAME.punchRange;
  for (const t of targets) {
    if (!t.mesh || t.kind === 'car') continue;
    const dx = t.x - player.x;
    const dz = t.z - player.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bd && (dx * fx + dz * fz) > 0) { bd = d; best = t; }
  }
  if (best) {
    best.health = (best.health === undefined ? 100 : best.health) - SB.GAME.punchDamage;
    if (audio) audio.hit();
  }
  return best;
};

// A Vulture Crew thug: a rival with a pistol who shoots at the player from a distance.
SB.spawnThug = function spawnThug(scene, x, z) {
  const mesh = SB.makePersonMesh(0x3a3a3a, 0xd9a06a, false);
  scene.add(mesh);
  const thug = {
    mesh,
    kind: 'thug',
    name: 'Vulture',
    x, z,
    heading: 0,
    health: 50,
    shootTimer: 1 + Math.random(),
    walkPhase: 0,
  };
  mesh.userData.target = thug;
  mesh.position.set(x, 0, z);
  return thug;
};

// Thugs stand their ground and shoot at the player with poor aim at range.
SB.updateThug = function updateThug(thug, dt, player, scene, audio) {
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  const dx = px - thug.x;
  const dz = pz - thug.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  thug.heading = SB.angleLerp(thug.heading, Math.atan2(dx, dz), dt * 4);
  thug.mesh.rotation.y = thug.heading;
  thug.shootTimer -= dt;
  if (thug.shootTimer <= 0 && dist < 45) {
    thug.shootTimer = 1.1 + Math.random() * 0.7;
    if (audio) audio.shoot();
    // Hit chance falls with distance; a hit costs the player 8 health.
    const chance = SB.clamp(0.55 - dist * 0.008, 0.08, 0.55);
    if (Math.random() < chance) {
      return { hitPlayer: true, damage: 8 };
    }
  }
  return null;
};

// A thug who is down: tip him over and take him out of the scene.
SB.removeThug = function removeThug(scene, thug) {
  scene.remove(thug.mesh);
};
