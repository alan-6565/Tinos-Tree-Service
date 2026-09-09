/**
 * Tino's Tree Service – App Script
 * - Mobile nav toggle with proper aria-expanded
 * - Safe rotating logos duplication (idempotent)
 * - Auto year in footer
 * - Gallery filter buttons (our-work page)
 */
(function () {
  'use strict';

  // Helpers
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  // Mobile menu
  function initMobileMenu() {
    const toggle = $("#mobile-menu");
    const menu = $(".navbar__menu");
    if (!toggle || !menu) return;

    // Ensure initial aria-state
    toggle.setAttribute("aria-expanded", "false");

    function handleToggle() {
      const isActive = toggle.classList.toggle("is-active");
      menu.classList.toggle("active");
      toggle.setAttribute("aria-expanded", String(isActive));
    }

    toggle.addEventListener("click", handleToggle);
  }

  // Rotating logos: prevent multiple duplicates across navigations/reloads
  function initRotatingLogos() {
    const container = $(".rotating-logos");
    if (!container) return;

    const track = $(".rotating-logos__track", container);
    if (!track) return;

    // Only duplicate once
    if (!container.dataset.cloned) {
      const clone = track.cloneNode(true);
      container.appendChild(clone);
      container.dataset.cloned = "true";
    }
  }

  // Footer year
  function initYear() {
    const el = $("#year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  // Gallery filter buttons (our-work.html)
  function initGalleryFilters() {
    const filters = $(".gallery__filters");
    if (!filters) return;

    const buttons = $$("button", filters);
    const items = $$(".gallery__item");

    buttons.forEach((btn) => {
      btn.addEventListener("click", function () {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const filter = btn.textContent.trim();
        items.forEach((item) => {
          const tag = $(".tag", item);
          const matches = filter === "All Projects" || (tag && tag.textContent.trim() === filter);
          item.style.display = matches ? "" : "none";
        });
      });
    });
  }

  // Defer init until DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    initMobileMenu();
    initRotatingLogos();
    initYear();
    initGalleryFilters();
  });
})();
