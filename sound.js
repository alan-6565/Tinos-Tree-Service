/**
 * Optional sound, OFF until the visitor taps the button.
 * Everything is synthesized with Web Audio (no audio files):
 * wind + birds up in the canopy, rain in the storm, thunder, a short saw
 * buzz on cuts, clipper snips in the hedge game, chipper rumble at the end.
 */
(function () {
  'use strict';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sound-btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = '<i class="fa-solid fa-volume-xmark" aria-hidden="true"></i><span>Sound off</span>';
  document.body.appendChild(btn);

  let ac = null, master, wind, windGain, rainGain, chipGain, on = false, chipOn = false, birdTimer = 0;

  function noiseBuffer(type) {
    const len = ac.sampleRate * 2, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  function loop(buf, filterType, freq, gain) {
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(master); src.start();
    return { g, f };
  }
  function boot() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    const brown = noiseBuffer('brown'), white = noiseBuffer('white');
    wind = loop(brown, 'lowpass', 500, 0.5); windGain = wind.g;
    rainGain = loop(white, 'highpass', 2500, 0).g;
    const chip = loop(brown, 'lowpass', 180, 0); chipGain = chip.g;
    const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 55;
    const hg = ac.createGain(); hg.gain.value = 0.15; const hf = ac.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220;
    hum.connect(hf).connect(hg).connect(chipGain); hum.start();
  }
  function chirp() {
    if (!on) return;
    const t = ac.currentTime, n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(), g = ac.createGain();
      const t0 = t + i * 0.13, f = 2600 + Math.random() * 1400;
      o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 1.5, t0 + 0.08);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
      o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.12);
    }
  }
  function burst(freq, dur, vol, type) {
    if (!on) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = type || 'sawtooth'; o.frequency.setValueAtTime(freq, t); o.frequency.linearRampToValueAtTime(freq * 1.35, t + dur * 0.4); o.frequency.linearRampToValueAtTime(freq * 0.9, t + dur);
    f.type = 'bandpass'; f.frequency.value = freq * 6; f.Q.value = 0.8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  // ambience follows the page (height + storm)
  function tick() {
    requestAnimationFrame(tick);
    if (!on) return;
    const s = window.tinoState || {};
    const t = ac.currentTime, storm = s.storm || 0, ft = s.ft == null ? 65 : s.ft;
    windGain.gain.setTargetAtTime(0.25 + (ft / 65) * 0.35 + storm * 0.7, t, 0.3);
    wind.f.frequency.setTargetAtTime(400 + storm * 900, t, 0.3);
    rainGain.gain.setTargetAtTime(storm * 0.18, t, 0.3);
    chipGain.gain.setTargetAtTime(chipOn ? 0.35 : 0, t, 0.4);
    birdTimer -= 1 / 60;
    if (birdTimer <= 0) { birdTimer = 1.5 + Math.random() * 3; if (ft > 25 && storm < 0.3) chirp(); }
  }

  window.TinoSound = {
    saw: () => burst(140, 0.35, 0.22),
    trim: () => burst(900, 0.07, 0.12, 'square'),
    thunder: () => {
      if (!on) return;
      const t = ac.currentTime, src = ac.createBufferSource(); src.buffer = noiseBuffer('brown');
      const g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
      g.gain.setValueAtTime(0, t + 0.15); g.gain.linearRampToValueAtTime(0.9, t + 0.35); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
      src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 2.8);
    },
    chipper: (v) => { chipOn = v; },
  };

  btn.addEventListener('click', () => {
    if (!ac) { boot(); tick(); }
    on = !on;
    if (on && ac.state === 'suspended') ac.resume();
    master.gain.setTargetAtTime(on ? 0.8 : 0, ac.currentTime, 0.2);
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = on ? '<i class="fa-solid fa-volume-high" aria-hidden="true"></i><span>Sound on</span>'
                       : '<i class="fa-solid fa-volume-xmark" aria-hidden="true"></i><span>Sound off</span>';
  });
})();
