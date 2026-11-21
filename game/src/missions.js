// missions.js — the story of Jace Marlowe's first week back in Solmar Bay: three jobs
// from the fixer Rico Delano, then side jobs for cash once the story is done. Each
// mission is a chain of objectives; a light beacon marks the current one in the city.

SB.createMissions = function createMissions(scene) {
  const THREE = window.THREE;
  // The beacon: a column of light and a floating diamond over the objective.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23f })
  );
  gem.position.y = 8;
  gem.visible = false;
  scene.add(gem);

  return {
    scene,
    beacon,
    gem,
    index: 0, // which mission of SB.MISSIONS is running
    step: 0, // which step of it
    done: false, // the whole story is finished
    sideJob: null, // { phase: 'pickup'|'dropoff', x, z, label } or null
    sideTimer: 0,
    rico: null, // Rico's figure, standing at the first meeting point
    message: null, // a one-shot message main.js shows once
    messageTimer: 0,
  };
};

// The mission and step running now, or null when the story is done.
SB.currentMission = function currentMission(missions) {
  if (missions.done) return null;
  return SB.MISSIONS[missions.index] || null;
};

SB.currentStep = function currentStep(missions) {
  const m = SB.currentMission(missions);
  return m ? m.steps[missions.step] : null;
};

// Where the player has to go right now: the step's marker, or the side job's.
SB.currentTarget = function currentTarget(missions) {
  const step = SB.currentStep(missions);
  if (step && step.type !== 'steal') return { x: step.x, z: step.z, label: step.label };
  if (missions.sideJob) return { x: missions.sideJob.x, z: missions.sideJob.z, label: missions.sideJob.label };
  return null;
};

// Start the current mission: show its brief and place Rico at the first meeting.
SB.startMission = function startMission(missions, game) {
  const m = SB.currentMission(missions);
  if (!m) return;
  missions.message = m.title + ' — ' + m.brief;
  missions.messageTimer = 8;
  const step = m.steps[0];
  if (step && step.wanted) SB.addWanted(game.police, step.wanted);
  if (step && step.type === 'goto' && missions.index === 0) {
    const rico = SB.makePersonMesh(0xd9a03f, 0x8a5a3a, false);
    rico.position.set(step.x, 0, step.z);
    game.scene.add(rico);
    missions.rico = rico;
  }
};

// A random road intersection, for side jobs.
function randomIntersection(city, rand) {
  const a = SB.pick(rand, city.roadCenters);
  const b = SB.pick(rand, city.roadCenters);
  return { x: a, z: b };
}

// Offer a side job: pick up a fare and drop them off, $150.
SB.startSideJob = function startSideJob(missions, city, rand) {
  const pick = randomIntersection(city, rand);
  missions.sideJob = {
    phase: 'pickup',
    x: pick.x,
    z: pick.z,
    label: 'Pick up the fare',
  };
  missions.message = 'Side job: pick up the fare and drop them off for ' + SB.money(SB.SIDE_JOB_REWARD) + '.';
  missions.messageTimer = 6;
};

// One frame of the story. `game` carries the player, the police and the callbacks.
SB.updateMissions = function updateMissions(missions, dt, game) {
  const { player, police, city, rand, audio } = game;
  if (missions.messageTimer > 0) missions.messageTimer -= dt;
  // Spin the beacon's diamond.
  if (missions.gem.visible) {
    missions.gem.rotation.y += dt * 2;
    missions.gem.position.y = 8 + Math.sin(performance.now() / 300) * 0.5;
  }
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;

  const step = SB.currentStep(missions);
  if (step) {
    const target = SB.currentTarget(missions);
    if (target) {
      missions.beacon.position.set(target.x, 30, target.z);
      missions.gem.position.set(target.x, missions.gem.position.y, target.z);
      missions.beacon.visible = true;
      missions.gem.visible = true;
    } else {
      missions.beacon.visible = false;
      missions.gem.visible = false;
    }
    let complete = false;
    if (step.type === 'goto') {
      complete = SB.distance2d(px, pz, step.x, step.z) < step.radius;
      if (complete && missions.rico) {
        game.scene.remove(missions.rico);
        missions.rico = null;
      }
    } else if (step.type === 'drive') {
      complete = player.inCar && SB.distance2d(px, pz, step.x, step.z) < step.radius;
    } else if (step.type === 'escape') {
      const nearestPolice = Math.min(
        police.cars.reduce((m, c) => Math.min(m, SB.distance2d(c.x, c.z, px, pz)), Infinity),
        police.cops.reduce((m, c) => Math.min(m, SB.distance2d(c.x, c.z, px, pz)), Infinity)
      );
      complete = SB.distance2d(px, pz, step.x, step.z) < step.radius && nearestPolice > 50;
    }
    // 'steal' completes through missions.onStolen, not here.
    if (complete) SB.advanceStep(missions, game);
    return;
  }

  // No mission running: the story is done, so run side jobs.
  missions.beacon.visible = false;
  missions.gem.visible = false;
  if (!missions.sideJob) {
    missions.sideTimer -= dt;
    if (missions.sideTimer <= 0) SB.startSideJob(missions, city, rand);
    return;
  }
  const job = missions.sideJob;
  missions.beacon.position.set(job.x, 30, job.z);
  missions.gem.position.set(job.x, missions.gem.position.y, job.z);
  missions.beacon.visible = true;
  missions.gem.visible = true;
  if (SB.distance2d(px, pz, job.x, job.z) < 7) {
    if (job.phase === 'pickup') {
      const drop = randomIntersection(city, rand);
      missions.sideJob = { phase: 'dropoff', x: drop.x, z: drop.z, label: 'Drop off the fare' };
      missions.message = 'Fare picked up. Drop them off at the marker.';
      missions.messageTimer = 5;
      if (audio) audio.pickup();
    } else {
      game.money += SB.SIDE_JOB_REWARD;
      missions.message = 'Fare dropped off. +' + SB.money(SB.SIDE_JOB_REWARD) + '.';
      missions.messageTimer = 5;
      missions.sideJob = null;
      missions.sideTimer = 8;
      if (audio) audio.missionDone();
    }
  }
};

// Move to the next step of the mission, or finish the mission and pay the reward.
SB.advanceStep = function advanceStep(missions, game) {
  const m = SB.currentMission(missions);
  missions.step += 1;
  if (missions.step >= m.steps.length) {
    game.money += m.reward;
    missions.message = m.title + ' complete! +' + SB.money(m.reward) + '.';
    missions.messageTimer = 6;
    if (game.audio) game.audio.missionDone();
    SB.saveGame(game); // finishing a job saves the game
    missions.index += 1;
    missions.step = 0;
    if (missions.index >= SB.MISSIONS.length) {
      missions.done = true;
      missions.message = 'Story complete! Solmar Bay is yours now — take side jobs and build your name.';
      missions.messageTimer = 8;
      if (game.onStoryComplete) game.onStoryComplete();
    } else {
      SB.startMission(missions, game);
    }
    return;
  }
  const step = SB.currentStep(missions);
  if (step && step.wanted) SB.addWanted(game.police, step.wanted);
  if (step) {
    missions.message = step.label;
    missions.messageTimer = 5;
    if (game.onStepStart) game.onStepStart(step);
  }
};

// Called when the player steals a car: it finishes a 'steal' step, if one is running.
// The wanted star for the theft itself is added by stealCar in main.js, so this
// hook only advances the story — never add stars here, or a mission steal counts twice.
SB.onStolen = function onStolen(missions, game) {
  const step = SB.currentStep(missions);
  if (step && step.type === 'steal') {
    SB.advanceStep(missions, game);
  }
};
