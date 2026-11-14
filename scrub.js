/**
 * Photo-real descent: a video (canopy -> curb) split into still frames,
 * drawn on the fixed .world canvas. The frame follows the rope height
 * (window.tinoState.ft: 65 = top frame, 0 = last frame).
 * Also draws the storm (darken + rain) while Emergency is on screen,
 * and warms toward sunset in the finale.
 */
(function () {
  'use strict';
  const cv = document.querySelector('.world');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (!ctx) { document.documentElement.classList.add('no-world'); return; }
  document.documentElement.classList.add('has-world');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 760;
  const N = +cv.dataset.frames || 1;
  const dir = small ? cv.dataset.dirMobile : cv.dataset.dir;
  const ext = cv.dataset.ext || 'webp';
  const frames = new Array(N).fill(null);
  const pad = (i) => String(i + 1).padStart(3, '0');

  // Load order: first + last, then coarse to fine, so any scroll position
  // has a nearby frame right away.
  const order = [0, N - 1];
  for (let step = 32; step >= 1; step = Math.floor(step / 2)) {
    for (let i = 0; i < N; i += step) if (!order.includes(i)) order.push(i);
    if (step === 1) break;
  }
  // a page that only shows one height (data-ft) needs only that frame
  if (cv.dataset.ft) { order.length = 0; order.push(Math.round(((65 - +cv.dataset.ft) / 65) * (N - 1))); }
  let inflight = 0, qi = 0;
  function pump() {
    while (inflight < 6 && qi < order.length) {
      const i = order[qi++];
      const img = new Image();
      inflight++;
      img.onload = () => { frames[i] = img; inflight--; pump(); };
      img.onerror = () => { inflight--; pump(); };
      img.decoding = 'async';
      img.src = `${dir}d-${pad(i)}.${ext}`;
    }
  }
  pump();

  function nearest(i) {
    if (frames[i]) return frames[i];
    for (let d = 1; d < N; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  }

  let W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', size);
  size();

  // rain drops (screen space)
  const drops = Array.from({ length: small ? 220 : 480 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));

  let cur = 0, lastDrawn = -1, lastStorm = -1, lastEnd = -1;
  function draw(t) {
    requestAnimationFrame(draw);
    if (document.hidden) return;
    const s = window.tinoState || { ft: 65 };
    const ft = Math.min(65, Math.max(0, s.ft == null ? (cv.dataset.ft ? +cv.dataset.ft : 65) : s.ft));
    const target = ((65 - ft) / 65) * (N - 1);
    cur += (target - cur) * (reduce ? 1 : 0.18);
    const storm = s.storm || 0, end = s.end || 0;
    const idx = Math.round(cur);
    if (idx === lastDrawn && storm < 0.01 && lastStorm < 0.01 && Math.abs(end - lastEnd) < 0.002) return;
    const img = nearest(idx);
    if (!img) return;
    lastDrawn = idx; lastStorm = storm; lastEnd = end;

    // cover-fit, with a slow push-out in the finale
    const zoom = 1 + (1 - end) * 0 + end * 0.0;
    const ir = img.naturalWidth / img.naturalHeight, r = W / H;
    let dw = W * zoom, dh = H * zoom;
    if (r > ir) dh = dw / ir; else dw = dh * ir;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

    if (storm > 0.01) {
      ctx.fillStyle = `rgba(18,26,34,${0.55 * storm})`;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(200,215,230,${0.45 * storm})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const tt = t / 1000;
      for (const d of drops) {
        const y = ((d.y + tt * 1.6 * d.s) % 1) * (H + 40) - 20;
        const x = d.x * W - y * 0.12;
        ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 22 * d.s);
      }
      ctx.stroke();
    }
    if (end > 0.01) {
      // golden hour sliding into dusk for the finale
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(60,40,90,${0.45 * end})`);
      g.addColorStop(0.6, `rgba(240,120,50,${0.25 * end})`);
      g.addColorStop(1, `rgba(30,15,10,${0.45 * end})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
  requestAnimationFrame(draw);

  // lightning flashes during the storm
  const flashEl = document.querySelector('.flash');
  let next = 2;
  setInterval(() => {
    const s = window.tinoState || {};
    if (reduce || !flashEl || (s.storm || 0) < 0.55) return;
    next -= 0.25;
    if (next > 0) return;
    next = 2.5 + Math.random() * 3;
    flashEl.style.transition = 'none'; flashEl.style.opacity = '0.6';
    setTimeout(() => { flashEl.style.opacity = '0.1'; }, 90);
    setTimeout(() => { flashEl.style.opacity = '0.45'; }, 170);
    setTimeout(() => { flashEl.style.transition = 'opacity .6s'; flashEl.style.opacity = '0'; }, 260);
    window.TinoSound && window.TinoSound.thunder && window.TinoSound.thunder();
  }, 250);
})();
