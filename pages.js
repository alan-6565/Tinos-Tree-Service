/**
 * Inner pages: service chapters fade in, rope knots tie as you scroll,
 * drag-to-compare before/after photos, and a photo lightbox for Our Work.
 */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('pg-js');

  // ---------- service chapters ----------
  function initChapters() {
    const secs = $$('.svc');
    if (!secs.length) return;
    if (reduce || !('IntersectionObserver' in window)) { secs.forEach((s) => s.classList.add('is-in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: 0.18 });
    secs.forEach((s) => io.observe(s));
  }

  // ---------- knots tie in order ----------
  function initKnots() {
    $$('.knots__list').forEach((list) => {
      const items = $$('li', list);
      list.style.setProperty('--n', items.length);
      const set = (k) => {
        list.style.setProperty('--tie', k.toFixed(3));
        items.forEach((li, i) => li.classList.toggle('is-tied', k >= (i + 0.5) / items.length - 0.02));
      };
      if (reduce) { set(1); return; }
      set(0);
      const tick = () => {
        const r = list.getBoundingClientRect();
        const k = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.3);
        set(Math.min(1, Math.max(0, k)));
      };
      addEventListener('scroll', tick, { passive: true });
      addEventListener('resize', tick);
      tick();
    });
  }

  // ---------- drag to compare ----------
  function initCompare() {
    $$('.cmp__frame').forEach((f) => {
      const range = $('.cmp__range', f);
      const set = (v) => { f.style.setProperty('--x', v + '%'); range.value = v; };
      range.addEventListener('input', () => set(+range.value));
      let drag = false;
      const at = (e) => { const r = f.getBoundingClientRect(); set(Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)))); };
      f.addEventListener('pointerdown', (e) => { drag = true; at(e); });
      addEventListener('pointermove', (e) => { if (drag) at(e); });
      addEventListener('pointerup', () => { drag = false; });
      set(50);
      // a little nudge the first time it shows, so people see it moves
      if (!reduce && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(([e]) => {
          if (!e.isIntersecting) return;
          io.disconnect();
          const t0 = performance.now();
          (function wig(t) {
            const k = (t - t0) / 1400;
            if (k >= 1 || drag) { if (!drag) set(50); return; }
            set(Math.round(50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k)));
            requestAnimationFrame(wig);
          })(t0);
        }, { threshold: 0.6 });
        io.observe(f);
      }
    });
  }

  // ---------- lightbox ----------
  function initLightbox() {
    const items = $$('.line-sec .gallery__item');
    if (!items.length) return;
    const lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.innerHTML = '<figure style="margin:0"><img alt=""><p></p></figure>' +
      '<button type="button" class="lb__x" aria-label="Close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
      '<button type="button" class="lb__prev" aria-label="Previous photo"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>' +
      '<button type="button" class="lb__next" aria-label="Next photo"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>';
    document.body.appendChild(lb);
    const img = $('img', lb), cap = $('p', lb);
    let cur = 0, opener = null;
    const visible = () => items.filter((it) => it.style.display !== 'none' && !it.hidden);
    function show(i) {
      const list = visible();
      if (!list.length) return;
      cur = (i + list.length) % list.length;
      const src = $('img', list[cur]);
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      cap.textContent = src.alt;
    }
    function open(it) {
      opener = it;
      show(visible().indexOf(it));
      lb.classList.add('is-open');
      $('.lb__x', lb).focus();
    }
    function close() {
      lb.classList.remove('is-open');
      if (opener) opener.focus();
    }
    items.forEach((it) => {
      it.tabIndex = 0;
      it.setAttribute('role', 'button');
      it.setAttribute('aria-label', 'View photo: ' + $('img', it).alt);
      it.addEventListener('click', () => open(it));
      it.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(it); } });
    });
    $('.lb__x', lb).addEventListener('click', close);
    $('.lb__prev', lb).addEventListener('click', () => show(cur - 1));
    $('.lb__next', lb).addEventListener('click', () => show(cur + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  // hide a gallery filter that has no photos yet (e.g. "Removal")
  function initFilters() {
    const items = $$('.gallery__item .tag').map((t) => t.textContent.trim());
    $$('.gallery__filters button').forEach((b) => {
      const f = b.textContent.trim();
      if (f !== 'All Projects' && !items.includes(f)) b.hidden = true;
    });
  }

  function start() { initChapters(); initKnots(); initCompare(); initLightbox(); initFilters(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
