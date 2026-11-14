/**
 * Tino's homepage: "the climb down"
 * 1. Rope + height readout (65 ft at the top, 0 ft at the curb)
 * 2. Hero: falling leaves that react to the cursor, headline reveal
 * 3. Descent: services change as you climb down (sticky photo)
 * 4. Growth rings: one ring per year, up to 25+
 * 5. Clean cut: before/after cut that follows your scroll, with sawdust
 * 6. Reviews hanging from a branch (they sway when you scroll)
 * 7. Size up your tree: fills in the estimate form on signup.html
 * Everything still works (statically) without GSAP or with reduced motion.
 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = () => window.matchMedia('(min-width: 901px)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TOP_FT = 65;

  function start() {
    const hasGsap = window.gsap && window.ScrollTrigger;
    if (hasGsap) gsap.registerPlugin(ScrollTrigger);

    // ---------- Smooth scroll (Lenis) ----------
    let lenis = null;
    const touch = matchMedia('(pointer: coarse)').matches;
    if (!reduce && !touch && window.Lenis && hasGsap) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
        const target = $(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80 });
      }));
    }

    // Scroll speed, shared by the leaves, sawdust and the hanging reviews.
    let lastY = window.scrollY, scrollVel = 0;
    function trackVel() {
      const y = window.scrollY;
      scrollVel = scrollVel * 0.8 + (y - lastY) * 0.2;
      lastY = y;
      requestAnimationFrame(trackVel);
    }
    trackVel();

    initRope();
    initHero(hasGsap);
    initDescent();
    initRings(hasGsap);
    initCut(hasGsap, () => scrollVel);
    initBranch(() => scrollVel);
    initSizeUp();
    if (hasGsap) window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  // ---------- 1. Rope ----------
  function initRope() {
    const rope = $('.rope');
    if (!rope) return;
    const clip = $('.rope__clip', rope), done = $('.rope__done', rope);
    const ftEl = $('.rope__ft', rope), zoneEl = $('.rope__zone', rope);
    const zones = $$('[data-zone]');
    let ticking = false;
    // Height comes from anchors (data-ft) so it always matches the service photo counter.
    const anchors = $$('[data-ft]');
    function heightNow() {
      const mid = innerHeight * 0.5;
      const pts = anchors.map((a) => ({ y: a.getBoundingClientRect().top + a.offsetHeight * (a.matches('.ih-hero, .pg-hero') ? 0 : 0.5), ft: +a.dataset.ft }));
      if (mid <= pts[0].y) return pts[0].ft;
      for (let i = 1; i < pts.length; i++) {
        if (mid <= pts[i].y) {
          const k = (mid - pts[i - 1].y) / ((pts[i].y - pts[i - 1].y) || 1);
          return pts[i - 1].ft + (pts[i].ft - pts[i - 1].ft) * k;
        }
      }
      return pts[pts.length - 1].ft;
    }
    function update() {
      ticking = false;
      const ft = anchors.length ? heightNow() : TOP_FT;
      const p = clamp(1 - ft / TOP_FT, 0, 1);
      if (desktop()) {
        clip.style.top = (p * rope.clientHeight) + 'px';
        done.style.height = (p * 100) + '%';
      }
      const hero = $('.ih-hero, .pg-hero');
      rope.classList.toggle('is-away', !!hero && scrollY < hero.offsetHeight * 0.6);
      ftEl.textContent = Math.round(ft);
      // shared with the 3D world (world.js)
      const max = document.documentElement.scrollHeight - innerHeight;
      const st = window.tinoState || (window.tinoState = {});
      st.ft = ft;
      st.p = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
      const crown = $('[data-storm]');
      if (crown) {
        const r = crown.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - innerHeight / 2) / (innerHeight * 0.7);
        const k = clamp(1 - d, 0, 1);
        st.storm = k * k * (3 - 2 * k);
      }
      const fin = $('.finale');
      if (fin) {
        const top = fin.getBoundingClientRect().top + scrollY - innerHeight;
        st.end = clamp((scrollY - top) / Math.max(1, max - top), 0, 1);
      }
      let zone = zones[0] ? zones[0].dataset.zone : '';
      for (const z of zones) if (z.getBoundingClientRect().top < innerHeight * 0.5) zone = z.dataset.zone;
      if (zoneEl.textContent !== zone) zoneEl.textContent = zone;
    }
    const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', req);
    update();
  }

  // ---------- 2. Hero ----------
  function initHero(hasGsap) {
    const hero = $('.ih-hero, .pg-hero');
    if (!hero || !hasGsap || reduce) return;
    const em = $('.ih-title em, .pg-title em', hero);
    if (em) gsap.set(em, { '--cut': 0 });
    const q = (sel) => $$(sel, hero);
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(q('.ih-line > span'), { yPercent: 110, duration: 1.2, stagger: 0.12 });
    if (em) tl.to(em, { '--cut': 1, duration: 0.9, ease: 'power3.inOut' }, '-=0.5');
    tl.from(q('.hero__eyebrow, .ih-lead, .pg-hero__inner > p, .hero__cta, .hero__trust, .pg-jump, .ih-scroll'),
      { y: 24, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.35);
    const bg = q('.ih-hero__bg');
    if (bg.length) gsap.to(bg, { yPercent: 10, scale: 1.08, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to(q('.ih-hero__inner, .pg-hero__inner'), { yPercent: -18, opacity: 0.2, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

  // ---------- Leaves ----------
  function initLeaves(getVel) {
    const cv = $('.ih-leaves');
    if (!cv || reduce) return;
    const hero = cv.parentElement;
    const ctx = cv.getContext('2d');
    const COLORS = ['#0e8c31', '#0b7a2a', '#3f8f3a', '#6a9a3a', '#a8a03c', '#c48a2c'];
    let W = 0, H = 0, dpr = 1, leaves = [], visible = true, wind = 0;
    const mouse = { x: -999, y: -999, vx: 0 };

    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = W < 700 ? 16 : 34;
      while (leaves.length < n) leaves.push(makeLeaf(true));
      leaves.length = n;
    }
    function makeLeaf(anywhere) {
      return {
        x: Math.random() * W, y: anywhere ? Math.random() * H : -30,
        vx: 0, vy: 0.4 + Math.random() * 0.6, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.04,
        s: 7 + Math.random() * 9, ph: Math.random() * 6.28, c: COLORS[(Math.random() * COLORS.length) | 0],
        flip: Math.random() * 6.28,
      };
    }
    function drawLeaf(l) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.r);
      ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(l.flip))); // tumbling: leaf turns edge-on
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.moveTo(-l.s, 0);
      ctx.quadraticCurveTo(0, -l.s * 0.75, l.s, 0);
      ctx.quadraticCurveTo(0, l.s * 0.75, -l.s, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-l.s * 1.25, 0); ctx.lineTo(l.s * 0.9, 0); ctx.stroke();
      ctx.restore();
    }
    function tick(t) {
      requestAnimationFrame(tick);
      if (!visible) return;
      ctx.clearRect(0, 0, W, H);
      wind = wind * 0.96 + mouse.vx * 0.015;
      mouse.vx *= 0.85;
      const sv = getVel();
      for (const l of leaves) {
        l.ph += 0.02;
        const dx = l.x - mouse.x, dy = l.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 14000) { const d = Math.sqrt(d2) || 1; l.vx += (dx / d) * 0.9; l.vy += (dy / d) * 0.5; l.vr += 0.01; }
        l.vx = l.vx * 0.94 + (Math.sin(l.ph) * 0.35 + wind) * 0.06;
        l.vy = l.vy * 0.96 + (0.55 - sv * 0.03) * 0.04;
        l.x += l.vx; l.y += l.vy;
        l.r += l.vr + l.vx * 0.01; l.vr *= 0.99; l.flip += 0.03 + Math.abs(l.vx) * 0.02;
        if (l.y > H + 30 || l.x < -60 || l.x > W + 60 || l.y < -80) Object.assign(l, makeLeaf(false), { x: Math.random() * W });
        drawLeaf(l);
      }
    }
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = e.clientX - r.left;
      mouse.vx = x - (mouse.x < -900 ? x : mouse.x);
      mouse.x = x; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
    addEventListener('resize', size);
    size();
    requestAnimationFrame(tick);
  }

  // ---------- 3. Descent ----------
  function initDescent() {
    const steps = $$('.descent__step');
    const photos = $$('.descent__photos img');
    const ticks = $$('.descent__ticks i');
    const ftEl = $('.descent__ft'), zoneEl = $('.descent__zone');
    if (!steps.length) return;
    let current = 0, shownFt = TOP_FT, anim = 0;
    ticks[0] && ticks[0].classList.add('is-on');

    function countTo(target) {
      cancelAnimationFrame(anim);
      const from = shownFt, t0 = performance.now();
      (function step(now) {
        const k = clamp((now - t0) / 700, 0, 1), e = 1 - Math.pow(1 - k, 3);
        shownFt = Math.round(from + (target - from) * e);
        ftEl.textContent = shownFt;
        if (k < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    function activate(i) {
      if (i === current) return;
      photos.forEach((p, j) => { p.classList.toggle('was-on', j === current); p.classList.toggle('is-on', j === i); });
      steps.forEach((s, j) => s.classList.toggle('is-on', j === i));
      ticks.forEach((t, j) => t.classList.toggle('is-on', j === i));
      zoneEl.textContent = steps[i].dataset.zone;
      const gl = $('.descent__gl');
      if (gl && gl.windShow) gl.windShow(i);
      if (reduce) { shownFt = +steps[i].dataset.ft; ftEl.textContent = shownFt; } else countTo(+steps[i].dataset.ft);
      current = i;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) activate(steps.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
  }

  // ---------- 4. Growth rings ----------
  function initRings(hasGsap) {
    const sec = $('.rings');
    if (!sec) return;
    const cv = $('.rings__canvas', sec), ctx = cv.getContext('2d');
    const num = $('.rings__num', sec), notes = $$('.rings__notes li', sec);
    const YEARS = 25, RINGS = 26;
    let S = 0, dpr = 1, progress = 0;

    // Same seed every time so the slice always looks the same.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ph = Array.from({ length: 4 }, () => rnd() * 6.28);
    const widths = Array.from({ length: RINGS }, () => 0.7 + rnd() * 0.6); // good years / dry years
    const total = widths.reduce((a, b) => a + b, 0);
    const radiusAt = (k) => { // k = ring count (can be fractional)
      let sum = 0;
      for (let i = 0; i < Math.floor(k); i++) sum += widths[i];
      if (k % 1 && Math.floor(k) < RINGS) sum += widths[Math.floor(k)] * (k % 1);
      return 0.05 + 0.85 * (sum / total);
    };
    const wob = (a, k) => 1 + 0.035 * Math.sin(3 * a + ph[0]) + 0.02 * Math.sin(5 * a + ph[1]) + 0.012 * Math.sin(8 * a + ph[2] + k * 0.25);

    function blob(r, k, R) {
      ctx.beginPath();
      for (let s = 0; s <= 120; s++) {
        const a = (s / 120) * Math.PI * 2, rr = r * wob(a, k) * R;
        const x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr * 0.96;
        s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
    // a real oak slice photo; the visible part grows from the pith outward
    const stump = new Image();
    stump.onload = () => draw();
    stump.src = cv.dataset.stump || '/images/fx/stump.webp';
    function drawPhoto() {
      const R = S * 0.47, k = 0.6 + progress * (RINGS - 0.6);
      const f = 0.1 + 0.9 * progress;
      ctx.clearRect(0, 0, S, S);
      ctx.save();
      if (progress < 0.995) { blob(f, k, R); ctx.clip(); }
      ctx.drawImage(stump, S / 2 - R, S / 2 - R, R * 2, R * 2);
      ctx.restore();
      if (progress < 0.995) {
        blob(f, k, R);
        ctx.strokeStyle = 'rgba(58,34,18,.9)'; ctx.lineWidth = Math.max(3, S / 70); ctx.stroke();
      }
    }
    function draw() {
      if (stump.complete && stump.naturalWidth) { drawPhoto(); return finishDraw(); }
      const R = S * 0.42;
      ctx.clearRect(0, 0, S, S);
      const k = 0.6 + progress * (RINGS - 0.6);
      const outer = radiusAt(k);
      // bark
      blob(outer + 0.07, k, R); ctx.fillStyle = '#2a1d13'; ctx.fill();
      blob(outer + 0.035, k, R); ctx.fillStyle = '#5a3e28'; ctx.fill();
      // wood
      const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, R * outer);
      g.addColorStop(0, '#f1e2c2'); g.addColorStop(0.7, '#e3c999'); g.addColorStop(1, '#c9a06a');
      blob(outer, k, R); ctx.fillStyle = g; ctx.fill();
      // rings
      for (let i = 1; i <= Math.floor(k); i++) {
        blob(radiusAt(i), i, R);
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(110,70,36,.75)' : 'rgba(140,96,54,.5)';
        ctx.lineWidth = Math.max(1, S / 380) * (i % 5 === 0 ? 1.8 : 1);
        ctx.stroke();
      }
      // a few drying cracks from the middle
      ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 1.2;
      [0.6, 2.3, 4.1].forEach((a, i) => {
        const len = Math.min(outer, 0.25 + i * 0.12) * R;
        ctx.beginPath(); ctx.moveTo(S / 2, S / 2);
        ctx.quadraticCurveTo(S / 2 + Math.cos(a + 0.2) * len * 0.5, S / 2 + Math.sin(a + 0.2) * len * 0.5, S / 2 + Math.cos(a) * len, S / 2 + Math.sin(a) * len);
        ctx.stroke();
      });
      // pith
      ctx.fillStyle = '#7a5530'; ctx.beginPath(); ctx.arc(S / 2, S / 2, R * 0.025, 0, 6.28); ctx.fill();
      finishDraw();
    }
    function finishDraw() {
      const years = Math.round(progress * YEARS);
      num.textContent = progress > 0.985 ? YEARS + '+' : years;
      notes.forEach((n, i) => n.classList.toggle('is-on', progress >= (i + 1) / (notes.length + 1)));
    }
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      S = cv.clientWidth;
      cv.width = cv.height = S * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      notes.forEach((n) => n.style.setProperty('--r', (S * (S < 400 ? 0.44 : 0.47)) + 'px'));
      draw();
    }
    addEventListener('resize', size);
    size();

    if (reduce || !hasGsap) { progress = 1; draw(); return; }
    const state = { p: 0 };
    ScrollTrigger.matchMedia({
      '(min-width: 901px)': () => {
        gsap.to(state, { p: 1, ease: 'none', onUpdate: () => { progress = state.p; draw(); },
          scrollTrigger: { trigger: sec, start: 'top 80px', end: '+=120%', pin: '.rings__pin', scrub: 0.6 } });
      },
      '(max-width: 900px)': () => {
        gsap.to(state, { p: 1, ease: 'none', onUpdate: () => { progress = state.p; draw(); },
          scrollTrigger: { trigger: sec, start: 'top top', end: '+=110%', pin: '.rings__pin', scrub: 0.5 } });
      },
    });
  }

  // ---------- 5. Clean cut ----------
  function initCut(hasGsap, getVel) {
    const sec = $('.cut');
    if (!sec) return;
    const frame = $('.cut__frame', sec), before = $('.cut__before', sec), after = $('.cut__after', sec);
    const cv = $('.cut__dust', sec), ctx = cv.getContext('2d');
    $('.cut__line', sec).style.display = 'none'; // drawn on the canvas so it matches the cut exactly
    const PAIRS = [
      ['/images/work-1.jpg', 'Before: overgrown oak in a front yard growing into the power lines',
       '/images/work-3.jpg', 'After: oak thinned and cleared away from the power lines'],
      ['/images/work-5.jpg', 'Before: large cedar ahead of a crown thinning',
       '/images/work-6.jpg', 'After: cedar thinned out with an open, balanced crown'],
    ];
    let W = 0, H = 0, dpr = 1, p = reduce ? 0.5 : 0.02, lastP = p, dust = [], visible = false;

    function setP(v) { p = v; frame.style.setProperty('--p', v); }
    setP(p);
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = frame.clientWidth; H = frame.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const lineX = (y) => W * (p * 1.2 - 0.1 - 0.1 * (y / H));
    function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      ctx.clearRect(0, 0, W, H);
      // sawdust: more when the cut moves faster
      const moved = Math.abs(p - lastP); lastP = p;
      const n = Math.min(14, Math.round(moved * 900 + Math.abs(getVel()) * 0.05));
      for (let i = 0; i < n && dust.length < 380; i++) {
        const y = Math.random() * H;
        dust.push({ x: lineX(y), y, vx: 1 + Math.random() * 3.5, vy: -1 - Math.random() * 2, life: 1, s: 1 + Math.random() * 2.4,
          c: Math.random() < 0.5 ? '#e8d5b0' : '#c9a06a' });
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.vy += 0.12; d.vx *= 0.97; d.x += d.vx; d.y += d.vy; d.life -= 0.018;
        if (d.life <= 0 || d.y > H) { dust.splice(i, 1); continue; }
        ctx.globalAlpha = d.life; ctx.fillStyle = d.c; ctx.fillRect(d.x, d.y, d.s, d.s);
      }
      ctx.globalAlpha = 1;
      // the cut line
      if (p > 0.005 && p < 0.995) {
        ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(242,183,5,.8)'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(lineX(0), 0); ctx.lineTo(lineX(H), H); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(frame);
    addEventListener('resize', size);
    size();
    requestAnimationFrame(tick);

    // tabs swap the photo pair
    const tabs = $$('.cut__tabs button', sec);
    tabs.forEach((b) => b.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.toggle('is-on', t === b); t.setAttribute('aria-selected', String(t === b)); });
      const [bs, ba, as, aa] = PAIRS[+b.dataset.pair];
      before.src = bs; before.alt = ba; after.src = as; after.alt = aa;
      if (!hasGsap || reduce) return;
      // replay a quick cut so the new pair gets "cut" too
      const keep = p;
      gsap.fromTo({ v: 0.02 }, { v: 0.02 }, { v: Math.max(keep, 0.6), duration: 1.1, ease: 'power2.inOut', onUpdate() { setP(this.targets()[0].v); } });
    }));
    // preload the second pair
    PAIRS[1].filter((_, i) => i % 2 === 0).forEach((src) => { const im = new Image(); im.src = src; });

    if (!hasGsap || reduce) return;
    const st = { v: 0.02 };
    gsap.to(st, { v: 1, ease: 'none', onUpdate: () => setP(st.v),
      scrollTrigger: { trigger: sec, start: 'top 80px', end: '+=110%', pin: '.cut__pin', scrub: 0.5 } });
  }

  // ---------- 6. Reviews hanging from a branch ----------
  function initBranch(getVel) {
    const cards = $$('.hang');
    if (!cards.length || reduce) return;
    const st = cards.map(() => ({ a: 0, v: 0 }));
    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe($('.branch'));
    cards.forEach((c, i) => c.addEventListener('pointermove', (e) => {
      st[i].v += clamp(e.movementX, -20, 20) * 0.0012;
    }));
    (function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      const push = clamp(getVel(), -40, 40) * 0.00022;
      st.forEach((s, i) => {
        s.v += -s.a * 0.035 - s.v * 0.06 + push * (i % 2 ? -1 : 1) * (1 + i * 0.2);
        s.a = clamp(s.a + s.v, -0.13, 0.13);
        cards[i].style.transform = `rotate(${s.a}rad)`;
      });
    })();
  }

  // ---------- 7. Size up your tree ----------
  function initSizeUp() {
    const sec = $('.sizeup');
    if (!sec) return;
    const range = $('.sizeup__range', sec), hEl = $('.sizeup__h', sec), likeEl = $('.sizeup__like', sec);
    const grow = $('.sizeup__grow', sec), send = $('.sizeup__send', sec), marks = $('.sizeup__marks', sec);
    const PX_PER_FT = 4, GROUND = 420, TREE_PX = 182;
    const choice = { service: '', urgency: 'Standard Service' };

    // height marks every 20 ft
    for (let ft = 20; ft <= 100; ft += 20) {
      const y = GROUND - ft * PX_PER_FT;
      marks.insertAdjacentHTML('beforeend',
        `<line x1="10" x2="26" y1="${y}" y2="${y}" stroke="#b9c3ba" stroke-width="2"/><text x="30" y="${y + 4}">${ft} ft</text>`);
    }
    const like = (ft) => ft <= 15 ? 'about a 1-story house' : ft <= 25 ? 'about a 2-story house' : ft <= 40 ? 'about a 3-story house'
      : ft <= 60 ? 'about a 5-story building' : ft <= 80 ? 'about a 7-story building' : 'taller than an 8-story building';

    function update() {
      const ft = +range.value;
      hEl.textContent = (ft >= 100 ? '100+' : ft) + ' ft';
      likeEl.textContent = like(ft);
      grow.style.transform = `scale(${(ft * PX_PER_FT) / TREE_PX})`;
      const q = new URLSearchParams();
      if (choice.service) q.set('service', choice.service);
      q.set('height', ft >= 100 ? '100+' : String(ft));
      q.set('urgency', choice.urgency);
      send.href = '/signup.html?' + q.toString();
    }
    $$('.sizeup__chips', sec).forEach((group) => {
      const btns = $$('button', group);
      btns.forEach((b) => b.addEventListener('click', () => {
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        choice[group.dataset.q] = b.dataset.v;
        update();
      }));
    });
    range.addEventListener('input', update);
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
