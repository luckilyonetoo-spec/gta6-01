// audio.js — every sound in Solmar Bay is synthesized with the Web Audio API: no audio
// files, no network. Everything is guarded: if the browser has no audio (or the player
// never clicks), the game plays silently instead of throwing.

SB.createAudio = function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let started = false;

  // A tiny chord pad loop (A minor, sunny and lazy): the city's own music.
  const CHORDS = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66],
    [164.81, 220.0, 261.63],
  ];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  // Start on the first user gesture (the start button, or any key): browsers refuse
  // audio before one. Safe to call often; it does nothing after the first start.
  function start() {
    if (started || !ensure()) return;
    started = true;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      // Engine: a low sawtooth whose pitch follows the car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: two alternating tones, quiet until the wanted level rises.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // Music: one soft chord every 1.6 seconds, cycling through the progression.
      musicTimer = window.setInterval(() => {
        if (!ctx) return;
        const chord = CHORDS[musicStep % CHORDS.length];
        musicStep += 1;
        for (const freq of chord) {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.4);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6);
          osc.connect(g);
          g.connect(master);
          osc.start();
          osc.stop(ctx.currentTime + 1.7);
        }
      }, 1600);
    } catch (e) {
      // Audio is decoration: never let it break the game.
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || !started) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* silent */ }
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || !started) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 3000;
      const g = ctx.createGain();
      g.gain.value = vol || 0.2;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
    } catch (e) { /* silent */ }
  }

  return {
    start,
    // Called every frame with the car's speed (0 on foot): the engine follows it.
    setEngine(speed, topSpeed) {
      if (!ctx || !engineOsc || !engineGain) return;
      try {
        const f = 55 + (SB.clamp(speed / Math.max(topSpeed, 1), 0, 1) * 140);
        engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(speed > 0.5 ? 0.05 : 0.0, ctx.currentTime, 0.1);
      } catch (e) { /* silent */ }
    },
    // Called every frame with the wanted level: the siren wails while the police chase.
    setSiren(wanted, time) {
      if (!ctx || !sirenOsc || !sirenGain) return;
      try {
        if (wanted > 0) {
          sirenOsc.frequency.value = (Math.floor(time * 2.4) % 2 === 0) ? 660 : 880;
          sirenGain.gain.setTargetAtTime(0.03 + wanted * 0.008, ctx.currentTime, 0.2);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        }
      } catch (e) { /* silent */ }
    },
    shoot() { noise(0.12, 0.28, 2400); },
    punch() { noise(0.08, 0.16, 900); },
    hit() { blip(180, 0.1, 'square', 0.1); },
    pickup() { blip(660, 0.09, 'sine', 0.14); blip(990, 0.14, 'sine', 0.12); },
    crash() { noise(0.25, 0.3, 700); },
    steal() { blip(440, 0.07, 'triangle', 0.12); blip(554, 0.1, 'triangle', 0.12); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => {
        window.setTimeout(() => blip(f, 0.22, 'triangle', 0.14), i * 110);
      });
    },
    busted() { blip(330, 0.4, 'sawtooth', 0.12); blip(220, 0.6, 'sawtooth', 0.12); },
  };
};
