// util.js — small math and random helpers every other file uses. No dependencies.

// A seeded random generator (mulberry32): the same seed builds the same city.
SB.makeRandom = function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

SB.clamp = function clamp(v, low, high) {
  return v < low ? low : v > high ? high : v;
};

SB.lerp = function lerp(a, b, t) {
  return a + (b - a) * t;
};

// Shortest signed angle difference, in radians.
SB.angleDiff = function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

SB.angleLerp = function angleLerp(a, b, t) {
  return a + SB.angleDiff(a, b) * t;
};

SB.distance2d = function distance2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
};

// Pick one entry of an array with the seeded random.
SB.pick = function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
};

// Format cash as $1,250.
SB.money = function money(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Format a time of day the HUD shows (the city runs on a fixed sunny afternoon).
SB.clockText = function clockText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
};
