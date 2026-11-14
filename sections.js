/**
 * Job day (sideways timeline + clock), hedge-trimming game, chipper finale.
 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sound = (n) => window.TinoSound && window.TinoSound[n] && window.TinoSound[n]();

  // ---------- Job day ----------
  function initDay() {
    const sec = $('.day');
    if (!sec) return;
    const track = $('.day__track', sec), cards = $$('.day__card', sec);
    const hour = $('.day__hour', sec), min = $('.day__min', sec), label = $('.day__time', sec);
    const ticks = $('.day__ticks', sec);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ticks.insertAdjacentHTML('beforeend', `<line x1="${60 + Math.sin(a) * 44}" y1="${60 - Math.cos(a) * 44}" x2="${60 + Math.sin(a) * 49}" y2="${60 - Math.cos(a) * 49}"/>`);
    }
    function setTime(h) {
      const hh = Math.floor(h), mm = Math.round((h - hh) * 60 / 15) * 15 % 60;
      hour.setAttribute('transform', `rotate(${(h % 12) * 30} 60 60)`);
      min.setAttribute('transform', `rotate(${(h % 1) * 360} 60 60)`);
      const h12 = ((hh + 11) % 12) + 1;
      label.textContent = `${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
    }
    setTime(7);
    if (!window.gsap || !window.ScrollTrigger || reduce) return;
    const dist = () => Math.max(0, track.scrollWidth - track.parentElement.clientWidth + 40);
    const st = { p: 0 };
    gsap.to(st, {
      p: 1, ease: 'none',
      onUpdate: () => {
        track.style.transform = `translate3d(${-st.p * dist()}px,0,0)`;
        setTime(7 + st.p * 8);
        const c = st.p * (cards.length - 1);
        cards.forEach((el, i) => el.classList.toggle('is-on', Math.abs(i - c) < 0.5));
      },
      scrollTrigger: { trigger: sec, start: 'top 80px', end: () => '+=' + (dist() + innerHeight * 0.3), pin: '.day__pin', scrub: 0.6, invalidateOnRefresh: true },
    });
  }

  // ---------- Hedge game ----------
  function initHedge() {
    // His real hedge (work-9) sits underneath. On top, the same photo made
    // overgrown; rubbing erases the overgrowth and shows the real trim.
    const sec = $('.hedge');
    if (!sec) return;
    const cv = $('.hedge__canvas', sec), ctx = cv.getContext('2d', { willReadFrequently: true });
    const bar = $('.hedge__bar i', sec), pct = $('.hedge__pct', sec), win = $('.hedge__win', sec);
    const stage = $('.hedge__stage', sec);
    const fx = document.createElement('canvas');
    fx.className = 'hedge__fx'; fx.setAttribute('aria-hidden', 'true');
    stage.insertBefore(fx, $('.hedge__reset', sec));
    const fctx = fx.getContext('2d');
    const wild = new Image();
    wild.src = cv.dataset.wild || '/images/fx/hedge-wild.webp';
    let W = 0, H = 0, dpr = 1, bits = [], done = false, visible = false, ready = false, dirty = false;
    const LEAF = ['#2f6a26', '#3a8a34', '#4c9636', '#5aa040', '#6b4a2b'];

    function cover(img) {
      const ir = img.naturalWidth / img.naturalHeight, r = W / H;
      let dw = W, dh = H;
      if (r > ir) dh = W / ir; else dw = H * ir;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    function grow() {
      if (!ready || !W) return;
      done = false; bits = [];
      win.hidden = true; stage.classList.remove('is-won');
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      cover(wild);
      update(true);
    }
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      if (!W || !H) return;
      for (const c of [cv, fx]) { c.width = W * dpr; c.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      grow();
    }
    wild.onload = () => { ready = true; size(); };

    // share of the overgrowth erased, sampled on a coarse grid
    function measure() {
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const step = Math.max(8, Math.round(14 * dpr));
      let n = 0, gone = 0;
      for (let y = step >> 1; y < cv.height; y += step) {
        for (let x = step >> 1; x < cv.width; x += step) { n++; if (d[(y * cv.width + x) * 4 + 3] < 40) gone++; }
      }
      return n ? gone / n : 0;
    }
    function update(reset) {
      const k = reset ? 0 : Math.min(1, measure() / 0.88);
      bar.style.width = (k * 100) + '%';
      pct.textContent = Math.round(k * 100) + '%';
      if (k >= 1 && !done) {
        done = true;
        setTimeout(() => { stage.classList.add('is-won'); win.hidden = false; }, 300);
      }
    }
    let last = null, lastSound = 0;
    function trim(x0, y0, x1, y1) {
      if (!ready || done) return;
      const R = Math.max(22, W * 0.045);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = R * 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      const dist = Math.hypot(x1 - x0, y1 - y0);
      for (let i = 0; i < Math.min(8, 1 + dist / 6); i++) {
        bits.push({ x: x1 + (Math.random() - 0.5) * R * 1.6, y: y1 + (Math.random() - 0.5) * R * 1.6, vx: (x1 - x0) * 0.08 + (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, s: 3 + Math.random() * 5, c: LEAF[(Math.random() * LEAF.length) | 0] });
      }
      dirty = true;
      const now = performance.now();
      if (now - lastSound > 160) { sound('trim'); lastSound = now; }
    }
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointermove', (e) => { const p = pos(e); if (last) trim(last.x, last.y, p.x, p.y); last = p; });
    cv.addEventListener('pointerdown', (e) => { last = pos(e); trim(last.x, last.y, last.x + 1, last.y + 1); });
    cv.addEventListener('pointerleave', () => { last = null; });
    $('.hedge__reset', sec).addEventListener('click', grow);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !W) size(); }).observe(cv);
    addEventListener('resize', size);
    setInterval(() => { if (dirty) { dirty = false; update(); } }, 220);

    (function tick() {
      requestAnimationFrame(tick);
      if (!visible || !W) return;
      fctx.clearRect(0, 0, W, H);
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        if (b.y > H + 10) { bits.splice(i, 1); continue; }
        fctx.save(); fctx.translate(b.x, b.y); fctx.rotate(b.r); fctx.fillStyle = b.c;
        fctx.beginPath(); fctx.moveTo(-b.s, 0); fctx.quadraticCurveTo(0, -b.s * 0.6, b.s, 0); fctx.quadraticCurveTo(0, b.s * 0.6, -b.s, 0); fctx.fill();
        fctx.restore();
      }
    })();
  }

  // ---------- Finale: real log loop with his photos hanging under it ----------
  function initFinale() {
    const sec = $('.finale');
    if (!sec) return;
    const scene = $('.finale__scene', sec), vid = $('.finale__video', sec), hang = $('.finale__hang', sec);
    const cutsEl = $('.finale__cuts', sec);
    const small = matchMedia('(max-width: 760px)').matches;
    // where the rope leaves the log, as a share of the video frame
    const ANCHOR = small ? { x: 0.477, y: 0.47, ar: 4 / 5 } : { x: 0.486, y: 0.469, ar: 16 / 9 };
    if (small && vid.dataset.posterMobile) vid.poster = vid.dataset.posterMobile;
    let loaded = false;

    function place() {
      // the video box (fills the scene on desktop, a 4:5 box on phones)
      const W = vid.offsetWidth, H = vid.offsetHeight, L = vid.offsetLeft, T = vid.offsetTop;
      if (!W || !H) return;
      // object-fit: cover, centered
      let dw = W, dh = W / ANCHOR.ar;
      if (dh < H) { dh = H; dw = H * ANCHOR.ar; }
      const x = L + (W - dw) / 2 + ANCHOR.x * dw, y = T + (H - dh) / 2 + ANCHOR.y * dh;
      hang.style.setProperty('--hx', x + 'px');
      hang.style.setProperty('--hy', y + 'px');
      hang.style.setProperty('--hu', (small ? Math.min(W * 2.1, (H - (y - T)) * 4.6) : dw) + 'px');
    }
    // phones: size the log box so log + words fit one screen, then hold it there
    const inner = $('.finale__inner', sec);
    let lastW = 0;
    function fit() {
      if (!small) return;
      if (innerWidth === lastW) return; // ignore iOS toolbar height changes
      lastW = innerWidth;
      const room = innerHeight - 80 - inner.offsetHeight;
      scene.style.height = Math.round(Math.max(280, Math.min(scene.clientWidth * 1.05, room))) + 'px';
    }
    fit();
    addEventListener('resize', () => { fit(); place(); });
    place();
    if (small && !reduce && window.ScrollTrigger && sec.offsetHeight <= innerHeight - 70) {
      ScrollTrigger.create({ trigger: sec, start: 'top 80px', end: '+=55%', pin: true });
    }

    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loaded && !reduce) {
        loaded = true;
        vid.src = small ? vid.dataset.srcMobile : vid.dataset.src;
      }
    }, { rootMargin: '600px 0px' }).observe(sec);
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (loaded) vid.play().catch(() => {});
        const n = (window.tinoState && window.tinoState.cuts) || 0;
        if (n > 0) cutsEl.textContent = `You cut ${n} branch${n === 1 ? '' : 'es'} on the way in. We'll rig the rest down safely, chip it, and leave a clean curb.`;
      } else vid.pause();
    }, { threshold: 0.15 }).observe(scene);
  }

  function start() {
    initDay(); initHedge(); initFinale();
    if (window.ScrollTrigger) { ScrollTrigger.sort(); ScrollTrigger.refresh(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
