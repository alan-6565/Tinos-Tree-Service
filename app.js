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

  // Estimate form: show a clear message under each field that needs fixing
  // (the browser's own bubbles were hidden under the sticky header).
  function initEstimateForm() {
    const form = $("#estimate-form");
    if (!form) return;
    const rules = [
      { id: "fullname", check: (v) => v.length >= 2, msg: "Please enter your name." },
      { id: "phone", check: (v) => v.replace(/\D/g, "").length >= 10, msg: "Please enter a phone number with area code, e.g. (510) 555-1234." },
      { id: "email", check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: "Please enter a valid email, e.g. you@example.com." },
      { id: "details", check: (v) => v.length >= 5, msg: "Please tell us a little about the job." },
    ];
    const summary = $("#form-summary");

    function setError(input, msg) {
      let el = input.parentElement.querySelector(".field-error");
      if (!el) {
        el = document.createElement("p");
        el.className = "field-error";
        el.id = `${input.id}-error`;
        input.insertAdjacentElement("afterend", el);
      }
      el.textContent = msg || "";
      el.hidden = !msg;
      input.classList.toggle("is-invalid", Boolean(msg));
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg) input.setAttribute("aria-describedby", el.id);
    }

    function validate(rule) {
      const input = $(`#${rule.id}`);
      const ok = rule.check(input.value.trim());
      setError(input, ok ? "" : rule.msg);
      return ok;
    }

    rules.forEach((rule) => {
      const input = $(`#${rule.id}`);
      // Re-check as they fix it, once it has been flagged.
      input.addEventListener("input", () => {
        if (input.classList.contains("is-invalid")) validate(rule);
        if (!form.querySelector(".is-invalid")) summary.hidden = true;
      });
      input.addEventListener("blur", () => { if (input.value.trim()) validate(rule); });
    });

    form.addEventListener("submit", (e) => {
      const failed = rules.filter((rule) => !validate(rule));
      if (failed.length === 0) {
        summary.hidden = true;
        return;
      }
      e.preventDefault();
      summary.textContent = failed.length === 1
        ? "One thing needs fixing before we can send your request (marked in red above)."
        : `${failed.length} things need fixing before we can send your request (marked in red above).`;
      summary.hidden = false;
      const first = $(`#${failed[0].id}`);
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      first.focus({ preventScroll: true });
    });
  }

  // Defer init until DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    initMobileMenu();
    initRotatingLogos();
    initYear();
    initGalleryFilters();
    initEstimateForm();
  });
})();
