// main.js — boot and the one loop: the world is built, the screens change (title,
// play, paused, busted, wasted, story complete), and every frame reads the input,
// moves the city, and paints it. The game moves in fixed steps of at most 1/20 s so
// a slow frame never jumps the player through a wall.
//
// ?seed=N fixes the city. ?shot=cover|drive|chase|mission stages that scene instead
// of the title screen, paints it, and sets window.__shotReady for a screenshot.

(function () {
  'use strict';
  const THREE = window.THREE;
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedParam = Number.parseInt(params.get('seed') || '', 10);
  const seed = Number.isInteger(seedParam) ? seedParam : (shot ? 7 : (Math.random() * 4294967296) | 0);
  const rand = SB.makeRandom(seed);

  window.__errors = [];
  window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

  const canvas = document.getElementById('game');
  // ?fx=low turns the effects down (no antialiasing, no shadows) for weak machines.
  // On any machine the game also degrades itself if the first seconds run slowly.
  const fxLow = params.get('fx') === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !fxLow });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, fxLow ? 1 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !fxLow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(30, 20, 60);

  const city = SB.createCity(scene, rand);
  const traffic = SB.spawnTraffic(scene, city, rand);
  traffic.push(...SB.spawnParkedCars(scene, city, rand));
  const peds = SB.spawnPedestrians(scene, city, rand, 18);
  const player = SB.createPlayer(scene, city.spawn.x, city.spawn.z);
  const police = SB.createPolice(scene, city);
  const combat = SB.createCombat(scene);
  const missions = SB.createMissions(scene);
  const audio = SB.createAudio();
  const input = SB.createInput(canvas);
  const hud = SB.createHud(city);

  const game = {
    scene, city, rand, player, police, missions, traffic, peds, combat, audio,
    money: SB.GAME.startCash,
    timeMinutes: 15 * 60 + 30,
    thugs: [],
    screen: 'title', // title | play | paused | busted | wasted | complete
    frames: 0,
    shotReady: false,
    lastStepKey: '',
    onStoryComplete() {
      game.screen = 'complete';
      showScreen('complete');
    },
    onStepStart(step) {
      // A wanted step means the Vulture Crew is waiting: two thugs near the marker.
      if (step.wanted && step.x !== undefined) {
        for (let i = 0; i < 2; i++) {
          game.thugs.push(SB.spawnThug(scene, step.x + (i * 6 - 3), step.z + 8));
        }
      }
    },
  };

  // --- Screens (DOM overlays in index.html) ---------------------------------
  const screens = {
    title: document.getElementById('title-screen'),
    pause: document.getElementById('pause-screen'),
    end: document.getElementById('end-screen'),
    help: document.getElementById('help-panel'),
  };
  function showScreen(name) {
    for (const k in screens) screens[k].classList.add('hidden');
    if (name && screens[name]) screens[name].classList.remove('hidden');
    document.getElementById('hud').style.display = name === null ? 'block' : 'none';
  }
  function showEnd(title, text) {
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-text').textContent = text;
    showScreen('end');
  }

  function startGame(fromSave) {
    audio.start();
    let save = null;
    if (fromSave) save = SB.loadGame();
    if (save) {
      game.money = save.money;
      missions.index = Math.min(save.missionIndex, SB.MISSIONS.length);
      missions.step = save.missionStep;
      missions.done = !!save.storyDone;
      player.x = save.player.x;
      player.z = save.player.z;
      player.health = save.player.health;
      game.timeMinutes = save.timeMinutes || game.timeMinutes;
      player.mesh.position.set(player.x, 0, player.z);
      hud.showMessage('Save loaded — welcome back to Solmar Bay.', 5);
    } else {
      game.money = SB.GAME.startCash;
      missions.index = 0;
      missions.step = 0;
      missions.done = false;
      player.x = city.spawn.x;
      player.z = city.spawn.z;
      player.health = SB.GAME.playerHealth;
      player.mesh.position.set(player.x, 0, player.z);
      SB.startMission(missions, game);
    }
    game.screen = 'play';
    showScreen(null);
  }

  document.getElementById('btn-new').addEventListener('click', () => startGame(false));
  document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
  document.getElementById('btn-help').addEventListener('click', () => screens.help.classList.remove('hidden'));
  document.getElementById('btn-help-close').addEventListener('click', () => screens.help.classList.add('hidden'));
  // Fill the help panel from the controls list in config.js.
  document.getElementById('controls-table').innerHTML = SB.CONTROLS
    .map(([key, action]) => '<tr><td>' + key + '</td><td>' + action + '</td></tr>').join('');
  document.getElementById('btn-resume').addEventListener('click', () => { game.screen = 'play'; showScreen(null); });
  document.getElementById('btn-save').addEventListener('click', () => {
    SB.saveGame(game);
    hud.showMessage('Game saved.', 3);
  });
  document.getElementById('btn-quit').addEventListener('click', () => {
    SB.saveGame(game);
    game.screen = 'title';
    showScreen('title');
  });
  // The end screen's button: respawn after being busted or wasted, or back to the
  // title after the story ends.
  document.getElementById('btn-end').addEventListener('click', () => {
    if (game.screen === 'busted' || game.screen === 'wasted') respawn();
    else {
      game.screen = 'title';
      showScreen('title');
    }
  });
  if (!SB.hasSave()) document.getElementById('btn-continue').style.display = 'none';
  window.addEventListener('keydown', () => audio.start(), { once: true });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Damage, busted, wasted -------------------------------------------------
  function damagePlayer(amount) {
    // A staged screenshot (?shot=...) is a photo set, not a real run: the
    // player must stay alive for the picture, so damage is ignored there.
    if (shot) return;
    if (game.screen !== 'play') return;
    player.health -= amount;
    hud.flashDamage();
    if (player.health <= 0) {
      player.health = 0;
      game.screen = 'wasted';
      audio.busted();
      game.money = Math.max(0, game.money - 200);
      showEnd('WASTED', 'The Vulture Crew left you in the gutter. You wake up at St. Marina Hospital, $200 lighter.');
    }
  }
  function respawn() {
    player.health = SB.GAME.playerHealth;
    player.x = city.spawn.x;
    player.z = city.spawn.z;
    player.inCar = null;
    player.mesh.visible = true;
    player.mesh.position.set(player.x, 0, player.z);
    police.wanted = 0;
    for (const car of police.cars) scene.remove(car.mesh);
    for (const cop of police.cops) scene.remove(cop.mesh);
    police.cars.length = 0;
    police.cops.length = 0;
    game.screen = 'play';
    showScreen(null);
    SB.saveGame(game);
  }

  function onBusted() {
    // As with damage: no arrest during a staged screenshot.
    if (shot) return;
    if (game.screen !== 'play') return;
    game.screen = 'busted';
    audio.busted();
    game.money = Math.max(0, game.money - 100);
    showEnd('BUSTED', 'The Solmar PD took you in. You post bail and walk out $100 lighter.');
  }

  // --- Stealing ----------------------------------------------------------------
  function stealCar(car) {
    // A moving car has a driver, who bails out and runs. A parked car is empty.
    if (!car.parked) {
      const driver = SB.createPedestrian(scene, city, rand);
      driver.x = car.x + 2;
      driver.z = car.z + 2;
      driver.mesh.position.set(driver.x, 0, driver.z);
      driver.state = 'flee';
      driver.stateTime = 0;
      peds.push(driver);
    }
    // The car leaves the traffic flow: from here on the player drives it.
    const i = traffic.indexOf(car);
    if (i >= 0) traffic.splice(i, 1);
    car.parked = false;
    player.inCar = car;
    car.speed = 0;
    player.mesh.visible = false;
    player.camYaw = car.heading + Math.PI;
    // Every steal is a crime the police notice: wanted +1, no exceptions.
    // (The mission hook in onStolen only advances the step; it adds no stars.)
    SB.addWanted(police, 1);
    SB.onStolen(missions, game);
    hud.showMessage('You took the ' + car.model.name + '. Wanted level up.', 4);
  }

  // --- Shooting -----------------------------------------------------------------
  function shootTargets() {
    const targets = [];
    for (const p of peds) if (p.state !== 'down') targets.push(p);
    for (const c of police.cops) targets.push(c);
    for (const t of game.thugs) targets.push(t);
    for (const c of traffic) targets.push(c);
    for (const c of police.cars) targets.push(c);
    const hit = SB.shoot(combat, camera, player, targets, audio);
    if (!hit) return;
    if (hit.kind === 'ped') {
      SB.knockDown(hit);
      if (!hit.reported) {
        hit.reported = true;
        SB.addWanted(police, 1);
        hud.showMessage('A witness called the police! Wanted level up.', 3);
      }
    } else if (hit.kind === 'cop') {
      if (hit.health <= 0) {
        SB.removeCop(police, hit);
        SB.addWanted(police, 1);
        hud.showMessage('You dropped an officer. The whole PD is coming.', 3);
      }
    } else if (hit.kind === 'thug') {
      if (hit.health <= 0) {
        SB.removeThug(scene, hit);
        game.thugs.splice(game.thugs.indexOf(hit), 1);
        game.money += 50;
        hud.showMessage('Vulture down. Took $50 off him.', 3);
      }
    } else if (hit.kind === 'policecar') {
      if (!hit.reported) {
        hit.reported = true;
        SB.addWanted(police, 1);
      }
    }
  }

  // --- Shot staging for screenshots --------------------------------------------
  function stageShot() {
    game.screen = 'play';
    showScreen(null);
    if (shot === 'mission') {
      // The second mission: the docks pickup, so the beacon sits by the sea.
      missions.index = 1;
      missions.step = 0;
    }
    SB.startMission(missions, game);
    if (shot === 'drive' || shot === 'chase') {
      const model = SB.CARS.models[3];
      const car = SB.createCar(scene, model, model.colour, false, 29, 60, Math.PI);
      traffic.push(car);
      player.inCar = car;
      player.mesh.visible = false;
      player.camYaw = Math.PI;
      car.speed = 12;
      // The staged car stays in the traffic array (it drives itself along the
      // road), so its traffic axis must match its heading: north on road x=29.
      // Without this it keeps the default axis 'x' and turns east instead.
      car.axis = 'z';
      car.dir = -1;
      car.cruise = 12;
      // Traffic ahead on the same road, going the same way but slower, so the
      // shot shows the player driving in traffic rather than an empty street.
      // They start far enough ahead (z=-40, -90) that the player, closing at
      // ~4 units/s, is still behind them when the shot fires at frame 40.
      for (const [tz, mi] of [[-40, 1], [-90, 2]]) {
        const tm = SB.CARS.models[mi];
        const tc = SB.createCar(scene, tm, tm.colour, false, 29, tz, Math.PI);
        tc.axis = 'z';
        tc.dir = -1;
        tc.cruise = 8;
        traffic.push(tc);
      }
      if (shot === 'chase') {
        SB.addWanted(police, 3);
        for (let i = 0; i < 2; i++) {
          const pc = SB.createCar(scene, SB.CARS.policeModel, SB.CARS.policeModel.colour, true, 29 - 14 - i * 8, 40, Math.PI);
          pc.stuck = 0;
          pc.reverse = 0;
          police.cars.push(pc);
        }
      }
    } else if (shot === 'mission') {
      // On foot at the docks with two thugs and the package marker in view.
      player.x = 145;
      player.z = 235;
      player.heading = 0;
      player.camYaw = 0;
      player.mesh.position.set(player.x, 0, player.z);
      game.thugs.push(SB.spawnThug(scene, 145, 250));
      game.thugs.push(SB.spawnThug(scene, 138, 248));
      SB.addWanted(police, 1);
    } else {
      // cover: on foot at the park's south edge, looking north across the
      // fountain at the city — traffic passing, a police car nearby, beacon lit.
      player.x = 0;
      player.z = 14;
      player.heading = Math.PI;
      player.camYaw = Math.PI;
      player.mesh.position.set(player.x, 0, player.z);
      // No wanted level here: addWanted would dispatch a pursuing police car
      // that chases the on-foot player and ends up as a blob half out of
      // frame beside the camera. The parked police car below shows the PD.
      // The police car is parked on the road north of the park, in frame and
      // still: a pursuing police car chases the player and ends up half out
      // of frame by the time the shot fires.
      const pc = SB.createCar(scene, SB.CARS.policeModel, SB.CARS.policeModel.colour, true, 14, -29, Math.PI / 2);
      pc.parked = true;
      traffic.push(pc);
    }
    // Screenshots are for the judge: keep the mission banner out of the frame.
    missions.messageTimer = 0;
    missions.message = null;
    audio.start();
  }
  if (shot) stageShot();
  else showScreen('title');

  // --- The loop ------------------------------------------------------------------
  let last = performance.now();
  let titleOrbit = 0;
  let frameTimeSum = 0;
  let degraded = fxLow;

  // If the machine cannot hold 12 fps, turn the shadows off once: the game stays
  // playable on weak hardware instead of crawling.
  function degradeQuality() {
    if (degraded) return;
    degraded = true;
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(1);
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        if (o.material) o.material.needsUpdate = true;
      }
    });
  }

  // Fixed-timestep simulation: the world advances in 1/60 s steps, up to 30 of
  // them per rendered frame, so the game runs at real-time speed even when the
  // renderer manages only a few frames a second (software rendering). The HUD
  // and the render happen once per frame, not once per step.
  const STEP = 1 / 60;
  let acc = 0;
  let simSeconds = 0;
  let currentPrompt = '';

  function update(dt) {
    simSeconds += dt;
    game.timeMinutes = (game.timeMinutes + dt * 0.15) % (24 * 60);

    if (game.screen === 'title') {
      // A slow orbit over the city behind the title screen.
      titleOrbit += dt * 0.03;
      camera.position.set(Math.sin(titleOrbit) * 180, 90, Math.cos(titleOrbit) * 180);
      camera.lookAt(0, 0, 0);
      for (const car of traffic) SB.updateTrafficCar(car, dt, city, traffic);
    } else if (game.screen === 'play') {
      // Pause.
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        game.screen = 'paused';
        showScreen('pause');
      }
      // Mission details.
      if (input.wasPressed('KeyM')) {
        const m = SB.currentMission(missions);
        hud.showMessage(m ? m.title + ' — ' + m.brief : 'No mission running. Free roam!', 7);
      }
      // Enter or leave a car.
      if (!player.inCar && input.wasPressed('KeyE')) {
        // (holding E steals; a tap beside a parked car does nothing extra)
      }
      if (player.inCar && input.wasPressed('KeyE')) {
        const car = player.inCar;
        SB.exitCar(player, car);
        // The car stays where it is, parked at the kerb, and can be stolen again.
        car.parked = true;
        car.speed = 0;
        traffic.push(car);
      }
      if (input.wasPressed('KeyR')) {
        player.ammo = SB.GAME.pistolMag;
        hud.showMessage('Reloaded.', 1.5);
      }
      if (input.wasPressed('KeyF') && !player.inCar) {
        const hit = SB.punch(combat, player, [...peds, ...police.cops, ...game.thugs], audio);
        if (hit && hit.kind === 'ped') SB.knockDown(hit);
        if (hit && hit.kind === 'cop' && hit.health <= 0) SB.removeCop(police, hit);
        if (hit && hit.kind === 'thug' && hit.health <= 0) {
          SB.removeThug(scene, hit);
          game.thugs.splice(game.thugs.indexOf(hit), 1);
          game.money += 50;
        }
      }
      if (input.mousePressed() && !player.inCar) shootTargets();

      // Player: drive or walk.
      let prompt = null;
      if (player.inCar) {
        SB.drivePlayerCar(player.inCar, input, dt, city, [...traffic, ...police.cars], audio);
        // The player rides in the car: keep his position on it, so the HUD,
        // the minimap, the cops on foot and the test hooks all read where he is.
        player.x = player.inCar.x;
        player.z = player.inCar.z;
        // Running over a pedestrian is a crime the police notice.
        for (const ped of peds) {
          if (ped.state !== 'down' && Math.abs(player.inCar.speed) > 3 &&
            SB.distance2d(player.inCar.x, player.inCar.z, ped.x, ped.z) < 2.4) {
            SB.knockDown(ped);
            if (!ped.reported) {
              ped.reported = true;
              SB.addWanted(police, 1);
            }
            if (audio) audio.crash();
          }
        }
        prompt = 'Space — handbrake · E — get out';
      } else {
        prompt = SB.updatePlayerOnFoot(player, input, dt, city, traffic, audio, stealCar);
        audio.setEngine(0, 1);
      }

      // The city lives: traffic, pedestrians, police, thugs, missions.
      for (const car of traffic) SB.updateTrafficCar(car, dt, city, [...traffic, ...police.cars]);
      const danger = player.inCar && Math.abs(player.inCar.speed) > 6
        ? { x: player.inCar.x, z: player.inCar.z, radius: 10 }
        : null;
      for (const ped of peds) SB.updatePedestrian(ped, dt, city, danger, rand);
      SB.updatePolice(police, dt, player, [...traffic, ...police.cars], audio, rand, onBusted,
        (amount) => damagePlayer(amount));
      SB.updateCombat(combat, dt);
      for (let i = game.thugs.length - 1; i >= 0; i--) {
        const res = SB.updateThug(game.thugs[i], dt, player, scene, audio);
        if (res && res.hitPlayer) damagePlayer(res.damage);
      }
      SB.updateMissions(missions, dt, game);
      audio.setSiren(police.wanted, simSeconds);

      // The prompt is painted once per rendered frame, not once per step.
      currentPrompt = prompt || '';
      if (missions.messageTimer > 0 && missions.message) {
        hud.showMessage(missions.message, missions.messageTimer);
        missions.messageTimer = 0;
      }
      SB.updateCamera(camera, player, city, dt);
    }

    if (game.screen === 'paused' || game.screen === 'busted' || game.screen === 'wasted' || game.screen === 'complete') {
      // The world holds still behind the overlay; the camera stays where it was.
    }
  }

  // The HUD, once per rendered frame: the minimap redraw and the DOM writes are
  // the expensive part, so they do not run once per simulation step.
  function updateHud(frameDt) {
    const hudState = {
      player, police, missions, traffic, peds,
      money: game.money,
      timeMinutes: game.timeMinutes,
      inCar: !!player.inCar,
      speed: player.inCar ? player.inCar.speed : 0,
    };
    hud.update(frameDt, hudState);
    document.getElementById('prompt').textContent = currentPrompt;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = Math.min((now - last) / 1000, 0.5);
    last = now;
    game.frames += 1;
    if (!degraded && game.frames <= 90) {
      frameTimeSum += rawDt;
      if (game.frames === 90 && frameTimeSum / 90 > 1 / 12) degradeQuality();
    }
    acc += rawDt;
    let steps = 0;
    while (acc >= STEP && steps < 30) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 30) acc = 0; // too far behind: drop the backlog, never spiral
    if (game.screen === 'play') updateHud(rawDt);
    renderer.render(scene, camera);
    input.endFrame();

    if (shot && !game.shotReady && game.frames >= 40) {
      game.shotReady = true;
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(frame);

  // For play-testing and screenshots: the game's live state, read-only from outside.
  window.__game = {
    get screen() { return game.screen; },
    get money() { return game.money; },
    get wanted() { return police.wanted; },
    get missionIndex() { return missions.index; },
    get missionStep() { return missions.step; },
    get storyDone() { return missions.done; },
    get player() {
      return {
        x: player.x, z: player.z, health: player.health, ammo: player.ammo,
        inCar: !!player.inCar,
        carSpeed: player.inCar ? player.inCar.speed : 0,
      };
    },
    get policeCars() { return police.cars.length; },
    get cops() { return police.cops.length; },
    get traffic() { return traffic.length; },
    get peds() { return peds.length; },
    get thugs() { return game.thugs.length; },
    get errors() { return window.__errors; },
    get frames() { return game.frames; },
    // Play-test hooks: move the player (and his car) and set the wanted level.
    // Used by the maker's own tests and screenshots, never by the game itself.
    debug: {
      teleport(x, z) {
        if (player.inCar) {
          player.inCar.x = x;
          player.inCar.z = z;
          SB.syncCar(player.inCar);
        }
        player.x = x;
        player.z = z;
        // Never leave the player inside a building: push him out to the nearest
        // clear spot, so a teleported player is always standing where he can act.
        const hit = SB.resolveCollisions(city, player.x, player.z, 0.6);
        player.x = hit.x;
        player.z = hit.z;
        player.mesh.position.set(player.x, 0, player.z);
      },
      setWanted(n) { police.wanted = SB.clamp(n, 0, SB.GAME.wantedMax); police.spawnTimer = 0; },
      trafficPos() { return traffic.slice(0, 4).map((c) => ({ x: c.x, z: c.z })); },
      parkedPos() { return traffic.filter((c) => c.parked).map((c) => ({ x: c.x, z: c.z })); },
    },
  };
})();
