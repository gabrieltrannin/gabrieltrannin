/* Pixel Duel — efeitos sonoros e trilha chiptune feitos com WebAudio (sem arquivos). */
(function () {
  const PD = (window.PD = window.PD || {});
  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;
  const state = { sfx: true, music: false };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(master);
    return ctx;
  }

  function tone(freq, dur, opts) {
    const o = opts || {};
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(o.vol || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(o.dest || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, opts) {
    const o = opts || {};
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.cutoff || 2400;
    const g = ctx.createGain();
    g.gain.value = o.vol || 0.6;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const SFX = {
    select: () => tone(880, 0.05, { vol: 0.25 }),
    back: () => tone(440, 0.06, { vol: 0.25 }),
    error: () => { tone(160, 0.12, { vol: 0.35 }); tone(120, 0.15, { vol: 0.35, delay: 0.1 }); },
    draw: () => tone(660, 0.06, { vol: 0.2, to: 990 }),
    set: () => { tone(330, 0.06, { vol: 0.3 }); tone(247, 0.08, { vol: 0.3, delay: 0.05 }); },
    summon: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, { delay: i * 0.06, vol: 0.3 })),
    activate: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, { delay: i * 0.05, vol: 0.22, type: 'triangle' })),
    trap: () => [392, 370, 349, 523].forEach((f, i) => tone(f, 0.12, { delay: i * 0.07, vol: 0.3 })),
    attack: () => { noise(0.18, { vol: 0.5, cutoff: 3000 }); tone(600, 0.2, { to: 90, vol: 0.35, type: 'sawtooth' }); },
    hit: () => { noise(0.25, { vol: 0.7, cutoff: 1200 }); tone(110, 0.25, { to: 40, vol: 0.5, type: 'triangle' }); },
    destroy: () => { noise(0.4, { vol: 0.6, cutoff: 1800 }); tone(300, 0.35, { to: 50, vol: 0.3, type: 'sawtooth' }); },
    heal: () => [659, 784, 988].forEach((f, i) => tone(f, 0.12, { delay: i * 0.07, vol: 0.25, type: 'triangle' })),
    turn: () => { tone(988, 0.07, { vol: 0.25 }); tone(1319, 0.1, { vol: 0.25, delay: 0.08 }); },
    win: () => [523, 659, 784, 1046, 784, 1046, 1319].forEach((f, i) => tone(f, 0.16, { delay: i * 0.11, vol: 0.3 })),
    lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.25, { delay: i * 0.18, vol: 0.3, type: 'triangle' })),
  };

  function play(name) {
    if (!state.sfx || !SFX[name]) return;
    try { ensure(); if (ctx.state === 'suspended') ctx.resume(); SFX[name](); } catch (e) { /* sem áudio */ }
  }

  /* trilha: baixo + arpejo em lá menor, 4 compassos em loop */
  const PROG = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function startMusic() {
    if (!ensure() || musicTimer) return;
    if (ctx.state === 'suspended') ctx.resume();
    let step = 0;
    const tick = () => {
      const chord = PROG[Math.floor(step / 8) % PROG.length];
      const i = step % 8;
      if (i % 4 === 0) tone(midi(chord[0] - 24), 0.32, { type: 'triangle', vol: 0.55, dest: musicGain });
      tone(midi(chord[i % 3] + (i >= 4 ? 12 : 0)), 0.1, { type: 'square', vol: 0.12, dest: musicGain });
      if (i === 6 && Math.floor(step / 8) % 2) tone(midi(chord[2] + 24), 0.18, { type: 'square', vol: 0.08, dest: musicGain });
      step++;
    };
    musicTimer = setInterval(tick, 150);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

  PD.Audio = {
    play,
    get sfx() { return state.sfx; },
    get music() { return state.music; },
    setSfx(on) { state.sfx = !!on; },
    setMusic(on) { state.music = !!on; if (on) startMusic(); else stopMusic(); },
  };
})();
