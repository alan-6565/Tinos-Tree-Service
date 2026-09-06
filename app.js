/**
 * Tino's Tree Service – App Script (Refactored)
 * - Mobile nav toggle with proper aria-expanded
 * - Safe rotating logos duplication (idempotent)
 * - Auto year in footer
 * - Pricing toggle (if present)
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

  // Pricing toggle (exists on pricing/services page)
  function initPricingToggle() {
    const checkbox = $("#pricing-toggle-checkbox");
    if (!checkbox) return;

    const monthlyPrices = $$(".monthly-price");
    const yearlyPrices = $$(".yearly-price");
    const yearlyDiscount = $(".save-percentage");

    function applyState() {
      const yearly = checkbox.checked;
      monthlyPrices.forEach((el) => el.classList.toggle("hidden", yearly));
      yearlyPrices.forEach((el) => el.classList.toggle("hidden", !yearly));
      if (yearlyDiscount) {
        yearlyDiscount.style.display = yearly ? "inline" : "none";
      }
    }

    checkbox.addEventListener("change", applyState);
    applyState(); // set initial view
  }

  // Defer init until DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    initMobileMenu();
    initRotatingLogos();
    initYear();
    initPricingToggle();
  });
})();
