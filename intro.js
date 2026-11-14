/**
 * "Cut your way in": overgrown branches cover the hero.
 * Swipe / slash across them to cut them; pieces fall with sawdust.
 * Scrolling down (or Skip) drops whatever is left. The page underneath
 * always works, the branches never block clicks.
 */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = document.querySelector('.ih-hero');
  if (!hero) return;

  const cv = document.createElement('canvas');
  cv.className = 'cutin';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const hint = document.createElement('div');
  hint.className = 'cutin__hint';
  hint.innerHTML = '<span><i class="fa-solid fa-hand-pointer" aria-hidden="true"></i> Swipe across the branches to cut your way in</span><button type="button">Skip</button>';
  document.body.appendChild(hint);
  const ctx = cv.getContext('2d');
  const st = window.tinoState || (window.tinoState = {});
  st.cuts = 0;
  document.documentElement.classList.add('cutting');

  let W = 0, H = 0, dpr = 1;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const range = (a, b) => a + rnd() * (b - a);

  // Real leafy branch photo (transparent PNG cut out). In the image the stem
  // starts bottom-left and runs to the tip at the upper right.
  const img = new Image();
  img.src = '/images/fx/branch.webp';
  const BASE = { x: 0.012, y: 0.968 }, TIP = { x: 0.975, y: 0.253 }; // share of image size
  let IW = 1, IH = 1, AX = 0, AL = 1;

  let branches = [], pieces = [], dust = [], alive = true, dropping = false, ready = false;

  // A branch: anchored at a screen edge, pointing inward at angle `ang`,
  // `L` px long. `cut` = how far along it is still attached (px).
  function makeBranch(x, y, ang, L, flip) {
    return { x, y, ang, L, cut: L, flip: flip ? -1 : 1, ph: rnd() * 6 };
  }
  function build() {
    branches = [];
    const s = Math.min(W, 1400);
    const L = s * (W < 700 ? 0.85 : 0.55);
    branches.push(makeBranch(-30, H * 0.2, 0.12, L, false));
    branches.push(makeBranch(-30, H * 0.66, -0.3, L * 0.9, true));
    branches.push(makeBranch(W + 30, H * 0.32, Math.PI - 0.1, L, true));
    branches.push(makeBranch(W + 30, H * 0.8, Math.PI + 0.32, L * 0.85, false));
    branches.push(makeBranch(W * 0.28, -30, 1.3, H * 0.62, false));
    branches.push(makeBranch(W * 0.74, -30, 1.8, H * 0.66, true));
    if (W > 900) branches.push(makeBranch(W * 0.52, -30, 1.52, H * 0.48, false));
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!st.cuts) build();
  }

  // ---- cutting ----
  function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
    const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (!d) return null;
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
    const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
  }
  function cut(b, at, vx, vy) {
    // the part from `at` to the old end falls, pivoting at the cut
    const px = b.x + Math.cos(b.ang) * at, py = b.y + Math.sin(b.ang) * at;
    pieces.push({
      b: { x: b.x, y: b.y, ang: b.ang, L: b.L, flip: b.flip }, from: at, to: b.cut,
      px, py, ox: 0, oy: 0, rot: 0,
      vx: vx * 0.25 + range(-1, 1), vy: Math.min(vy * 0.2, 0) - range(0, 2), vr: (vx >= 0 ? 1 : -1) * range(0.02, 0.05),
    });
    b.cut = at;
    for (let k = 0; k < 26; k++) dust.push({ x: px, y: py, vx: range(-4, 4) + vx * 0.1, vy: range(-5, 1), life: 1, s: range(1.5, 3.5), c: rnd() < 0.5 ? '#e8d5b0' : '#c9a06a' });
    st.cuts++;
    window.TinoSound && window.TinoSound.saw && window.TinoSound.saw();
    if (st.cuts >= 2) hint.classList.add('is-done');
    if (remaining() < 0.42) dropAll();
  }
  function remaining() {
    let a = 0;
    for (const b of branches) a += b.cut / b.L;
    return branches.length ? a / branches.length : 0;
  }
  function slash(x0, y0, x1, y1) {
    if (dropping || !ready) return;
    for (const b of branches) {
      if (b.cut <= 0) continue;
      const ex = b.x + Math.cos(b.ang) * b.cut, ey = b.y + Math.sin(b.ang) * b.cut;
      const t = segHit(b.x, b.y, ex, ey, x0, y0, x1, y1);
      if (t != null && t * b.cut > b.L * 0.12) cut(b, t * b.cut, x1 - x0, y1 - y0);
    }
  }
  function dropAll() {
    if (dropping) return;
    dropping = true;
    hint.classList.add('is-done');
    branches.forEach((b) => { if (b.cut > 0) cut(b, 0, range(-6, 6), 0); });
  }

  let last = null;
  addEventListener('pointermove', (e) => {
    if (!alive) return;
    const p = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (last) {
      const dt = Math.max(1, p.t - last.t), sp = Math.hypot(p.x - last.x, p.y - last.y) / dt;
      if (e.pointerType !== 'mouse' || sp > 0.45 || e.buttons) slash(last.x, last.y, p.x, p.y);
    }
    last = p;
  }, { passive: true });
  addEventListener('pointerdown', (e) => { last = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
  addEventListener('scroll', () => { if (scrollY > 60) dropAll(); }, { passive: true });
  hint.querySelector('button').addEventListener('click', dropAll);

  // ---- drawing ----
  // Draw the photo of branch b, only the part between `from` and `to` (px along it).
  function drawBranch(b, from, to, sway) {
    if (to - from < 1) return;
    const k = b.L / AL;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.ang + sway);
    ctx.beginPath(); ctx.rect(from, -b.L, to - from + (to >= b.L ? b.L : 0), b.L * 2); ctx.clip();
    ctx.scale(k, k * b.flip);
    ctx.rotate(-AX);
    ctx.drawImage(img, -BASE.x * IW, -BASE.y * IH, IW, IH);
    ctx.restore();
  }
  function tick(t) {
    if (!alive) return;
    requestAnimationFrame(tick);
    ctx.clearRect(0, 0, W, H);
    if (!ready) return;
    for (const b of branches) if (b.cut > 0) drawBranch(b, 0, b.cut, Math.sin(t / 1100 + b.ph) * 0.012);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.vy += 0.55; p.vx *= 0.99;
      p.ox += p.vx; p.oy += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.px + p.ox, p.py + p.oy); ctx.rotate(p.rot); ctx.translate(-p.px, -p.py);
      drawBranch(p.b, p.from, p.to, 0);
      ctx.restore();
      if (p.py + p.oy > H + 900) pieces.splice(i, 1);
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.vy += 0.25; d.x += d.vx; d.y += d.vy; d.life -= 0.02;
      if (d.life <= 0) { dust.splice(i, 1); continue; }
      ctx.globalAlpha = d.life; ctx.fillStyle = d.c; ctx.fillRect(d.x, d.y, d.s, d.s);
    }
    ctx.globalAlpha = 1;
    if (dropping && !pieces.length && !dust.length) finish();
  }
  function finish() {
    alive = false;
    document.documentElement.classList.remove('cutting');
    cv.remove();
    hint.remove();
  }
  addEventListener('resize', () => { if (!st.cuts) size(); });
  size();
  img.onload = () => {
    IW = img.naturalWidth; IH = img.naturalHeight;
    AX = Math.atan2((TIP.y - BASE.y) * IH, (TIP.x - BASE.x) * IW);
    AL = Math.hypot((TIP.x - BASE.x) * IW, (TIP.y - BASE.y) * IH);
    ready = true;
  };
  img.onerror = () => { dropping = true; finish(); };
  requestAnimationFrame(tick);
  // if they land mid-page (reload / anchor), skip the intro
  if (scrollY > 60) dropAll();
})();
