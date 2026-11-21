// hud.js — everything on screen that is not the 3D world: health and cash, the wanted
// stars, the mission objective, the minimap, the prompts and the messages. The minimap
// is a 2D canvas the city is drawn onto once, with the player, the police, the traffic
// and the objective moving over it every frame.

SB.createHud = function createHud(city) {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  const size = minimap.width;
  const scale = size / (city.extent * 2 + 40);
  const toMap = (x, z) => ({ x: size / 2 + x * scale, y: size / 2 + z * scale });

  // The static map: roads on dark ground, the sea along the bottom edge.
  const base = document.createElement('canvas');
  base.width = size;
  base.height = size;
  const b = base.getContext('2d');
  b.fillStyle = '#23282e';
  b.fillRect(0, 0, size, size);
  b.fillStyle = '#2f7fb8';
  b.fillRect(0, size - 10, size, 10);
  b.fillStyle = '#3a3f45';
  for (const c of city.roadCenters) {
    const p = toMap(c, 0);
    b.fillRect(0, p.y - 2, size, 4);
    b.fillRect(p.x - 2, 0, 4, size);
  }
  b.fillStyle = '#6fa05a';
  const park = toMap(0, 0);
  b.fillRect(park.x - 8, park.y - 8, 16, 16);

  const hud = {
    damageFlash: 0,
    messageTimer: 0,
    flashDamage() { this.damageFlash = 0.55; },
    showMessage(text, seconds) {
      el('message').textContent = text;
      el('message').style.opacity = '1';
      this.messageTimer = seconds || 4;
    },
    update(dt, state) {
      const { player, police, missions, money, timeMinutes, inCar, speed } = state;
      el('health-fill').style.width = Math.max(0, player.health) + '%';
      el('health-fill').style.background = player.health > 50 ? '#58c96b' : player.health > 25 ? '#e8b820' : '#c23b2e';
      el('money').textContent = SB.money(money);
      el('clock').textContent = SB.clockText(timeMinutes);
      // Wanted stars: filled for the level, empty for the rest.
      let stars = '';
      for (let i = 0; i < SB.GAME.wantedMax; i++) stars += i < police.wanted ? '★' : '☆';
      el('stars').textContent = stars;
      el('stars').style.color = police.wanted > 0 ? '#ffd23f' : '#8a8f96';
      // Objective line: the current step, or the side job, or free roam.
      const step = SB.currentStep(missions);
      let objective = 'Free roam — Solmar Bay is yours';
      if (step) objective = SB.MISSIONS[missions.index].title + ': ' + step.label;
      else if (missions.sideJob) objective = 'Side job: ' + missions.sideJob.label;
      else if (missions.done) objective = 'Story complete — take a side job';
      el('objective').textContent = objective;
      // Ammo and speed.
      el('ammo').textContent = 'Pistol ' + player.ammo + '/' + SB.GAME.pistolMag;
      el('speed').textContent = inCar ? Math.round(Math.abs(speed) * 2.2) + ' mph' : '';
      el('crosshair').style.display = !inCar ? 'block' : 'none';
      // The objective compass: an arrow under the objective, pointing at the marker.
      const target = SB.currentTarget(missions);
      const arrow = el('objective-arrow');
      if (target) {
        const px = inCar ? player.inCar.x : player.x;
        const pz = inCar ? player.inCar.z : player.z;
        const bearing = Math.atan2(target.x - px, target.z - pz);
        const rel = bearing - player.camYaw;
        const dist = Math.round(SB.distance2d(px, pz, target.x, target.z));
        arrow.textContent = '➤ ' + dist + 'm';
        arrow.style.transform = 'rotate(' + (rel * 180 / Math.PI + 180) + 'deg)';
        arrow.style.display = 'block';
      } else {
        arrow.style.display = 'none';
      }
      // Message banner and damage flash fade out on their own.
      if (this.messageTimer > 0) {
        this.messageTimer -= dt;
        if (this.messageTimer <= 0) el('message').style.opacity = '0';
      }
      if (this.damageFlash > 0) {
        this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
        el('damage').style.opacity = String(this.damageFlash);
      }
      this.drawMinimap(mctx, base, size, toMap, state);
    },
    drawMinimap(mctx, base, size, toMap, state) {
      const { player, police, missions, traffic, peds } = state;
      mctx.clearRect(0, 0, size, size);
      mctx.drawImage(base, 0, 0);
      // Traffic as pale dots, pedestrians as faint ones.
      mctx.fillStyle = '#cfd6dd';
      for (const car of traffic) {
        const p = toMap(car.x, car.z);
        mctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      mctx.fillStyle = 'rgba(207,214,221,0.5)';
      for (const ped of peds) {
        const p = toMap(ped.x, ped.z);
        mctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      // Police as blue dots.
      mctx.fillStyle = '#4f8ef7';
      for (const car of police.cars) {
        const p = toMap(car.x, car.z);
        mctx.beginPath();
        mctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        mctx.fill();
      }
      for (const cop of police.cops) {
        const p = toMap(cop.x, cop.z);
        mctx.beginPath();
        mctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        mctx.fill();
      }
      // The objective as a yellow diamond.
      const target = SB.currentTarget(missions);
      if (target) {
        const p = toMap(target.x, target.z);
        mctx.fillStyle = '#ffd23f';
        mctx.beginPath();
        mctx.moveTo(p.x, p.y - 5);
        mctx.lineTo(p.x + 5, p.y);
        mctx.lineTo(p.x, p.y + 5);
        mctx.lineTo(p.x - 5, p.y);
        mctx.closePath();
        mctx.fill();
      }
      // The player as a green arrow, pointing the way he faces.
      const px = player.inCar ? player.inCar.x : player.x;
      const pz = player.inCar ? player.inCar.z : player.z;
      const heading = player.inCar ? player.inCar.heading : player.heading;
      const p = toMap(px, pz);
      mctx.save();
      mctx.translate(p.x, p.y);
      // Canvas y grows downward, so the arrow (drawn pointing up) needs pi - heading.
      mctx.rotate(Math.PI - heading);
      mctx.fillStyle = '#58c96b';
      mctx.beginPath();
      mctx.moveTo(0, -6);
      mctx.lineTo(4, 5);
      mctx.lineTo(-4, 5);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
      // A border so the map reads as a panel.
      mctx.strokeStyle = 'rgba(255,255,255,0.35)';
      mctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    },
  };
  return hud;
};
