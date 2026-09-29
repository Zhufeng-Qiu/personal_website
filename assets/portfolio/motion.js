/* Shared, dependency-free interaction layer: scroll reveal, header progress, section
 * navigation, hover spotlights, magnetic buttons, smooth accordions, and small
 * animation helpers (tween, count-up, segmented thumbs) used by the labs. */
(() => {
  "use strict";
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => reducedQuery.matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    linear: (t) => t,
  };

  /* ---------- tiny animation helpers (exported) ---------- */
  function tween({ from = 0, to = 1, duration = 600, easing = ease.out, onUpdate, onDone }) {
    if (reduced() || duration <= 0) {
      onUpdate && onUpdate(to, 1);
      onDone && onDone();
      return () => {};
    }
    let frame = 0,
      start = 0,
      stopped = false;
    const step = (now) => {
      if (stopped) return;
      if (!start) start = now;
      const t = clamp((now - start) / duration, 0, 1);
      const k = easing(t);
      onUpdate && onUpdate(from + (to - from) * k, t);
      if (t < 1) frame = requestAnimationFrame(step);
      else onDone && onDone();
    };
    frame = requestAnimationFrame(step);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }

  /* Smoothly moves a numeric state object toward targets; returns a setter. */
  function animator(initial, render, { duration = 650, easing = ease.out } = {}) {
    const current = { ...initial };
    let stop = null;
    function set(target, opts = {}) {
      stop && stop();
      const start = { ...current };
      const keys = Object.keys(target);
      if (opts.instant || reduced()) {
        keys.forEach((k) => (current[k] = target[k]));
        render(current);
        return;
      }
      stop = tween({
        duration: opts.duration || duration,
        easing: opts.easing || easing,
        onUpdate: (_, t) => {
          const k = (opts.easing || easing)(t);
          keys.forEach((key) => {
            const a = start[key],
              b = target[key];
            current[key] = typeof a === "number" && typeof b === "number" ? a + (b - a) * k : b;
          });
          render(current);
        },
      });
    }
    render(current);
    return { set, get: () => ({ ...current }) };
  }

  function formatNumber(value, { decimals = 1, prefix = "", suffix = "", sign = false } = {}) {
    const fixed = Math.abs(value) < 0.5 * Math.pow(10, -decimals) ? 0 : value;
    const text = Math.abs(fixed).toFixed(decimals);
    const s = fixed < 0 ? "−" : sign && fixed > 0 ? "+" : "";
    return prefix + s + text + suffix;
  }
  /* Counts an element's number toward a target, keeping the last value per element. */
  const counters = new WeakMap();
  function countTo(el, value, opts = {}) {
    if (!el) return;
    const prev = counters.get(el);
    const from = prev ? prev.value : opts.from != null ? opts.from : value;
    prev && prev.stop && prev.stop();
    const state = { value: from, stop: null };
    counters.set(el, state);
    state.stop = tween({
      from,
      to: value,
      duration: opts.duration || 900,
      easing: ease.out,
      onUpdate: (v) => {
        state.value = v;
        el.textContent = formatNumber(v, opts);
      },
    });
  }
  /* Writes plain text into a counted element, cancelling any count still in flight. */
  function setText(el, text) {
    if (!el) return;
    const prev = counters.get(el);
    prev && prev.stop && prev.stop();
    counters.delete(el);
    el.textContent = text;
  }

  /* ---------- segmented controls with a sliding thumb ---------- */
  function syncSegmented(group) {
    let thumb = group.querySelector(".seg-thumb");
    if (!thumb) {
      thumb = document.createElement("span");
      thumb.className = "seg-thumb";
      thumb.setAttribute("aria-hidden", "true");
      group.prepend(thumb);
      group.classList.add("has-thumb");
    }
    const active = group.querySelector('button[aria-pressed="true"]');
    if (!active) {
      thumb.style.opacity = "0";
      return;
    }
    thumb.style.opacity = "1";
    thumb.style.width = active.offsetWidth + "px";
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
  }
  function initSegmented(root = document) {
    root.querySelectorAll("[data-segmented]").forEach((group) => {
      if (group.__segmented) return;
      group.__segmented = true;
      syncSegmented(group);
      new MutationObserver(() => syncSegmented(group)).observe(group, { attributes: true, subtree: true, attributeFilter: ["aria-pressed"] });
      if ("ResizeObserver" in window) new ResizeObserver(() => syncSegmented(group)).observe(group);
    });
  }

  /* ---------- reveal ---------- */
  function initReveal() {
    const items = [...document.querySelectorAll("[data-reveal], [data-section], .timeline-row")];
    const title = document.querySelector("[data-reveal-title]");
    if (title) requestAnimationFrame(() => requestAnimationFrame(() => title.classList.add("is-in")));
    if (!("IntersectionObserver" in window) || reduced()) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach((el) => io.observe(el));
    // Anything already on screen at load reveals immediately (incl. the hero copy).
    requestAnimationFrame(() => {
      items.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight * 0.95 && r.bottom > 0) el.classList.add("is-in");
      });
    });
  }

  /* ---------- scroll-driven state: header, progress, nav, rails, hero ---------- */
  function initScroll() {
    const header = document.querySelector(".site-header");
    const progress = document.querySelector(".scroll-progress");
    const nav = document.querySelector(".section-nav:not(.lab-nav)");
    const links = nav ? [...nav.querySelectorAll('a[href^="#"]')] : [];
    const indicator = nav && nav.querySelector(".nav-indicator");
    const sections = links.map((a) => document.querySelector(a.hash)).filter(Boolean);
    const rails = [...document.querySelectorAll("[data-rail]")];
    const hero = document.querySelector(".hero");
    let active = null,
      ticking = false;

    function placeIndicator(link) {
      if (!indicator) return;
      if (!link) {
        indicator.classList.remove("is-visible");
        return;
      }
      indicator.style.transform = `translateX(${link.offsetLeft}px) scaleX(${link.offsetWidth})`;
      indicator.classList.add("is-visible");
    }
    function update() {
      ticking = false;
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      header && header.classList.toggle("is-scrolled", y > 8);
      progress && progress.style.setProperty("--progress", max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
      if (links.length) {
        let current = null;
        const probe = innerHeight * 0.34;
        sections.forEach((s, i) => {
          if (s.getBoundingClientRect().top <= probe) current = links[i];
        });
        if (y + innerHeight >= document.documentElement.scrollHeight - 4 && sections.length) current = links[links.length - 1];
        if (current !== active) {
          links.forEach((l) => (l === current ? l.setAttribute("aria-current", "location") : l.removeAttribute("aria-current")));
          active = current;
          placeIndicator(current);
        }
      }
      rails.forEach((rail) => {
        const r = rail.getBoundingClientRect();
        const p = clamp((innerHeight * 0.62 - r.top) / Math.max(1, r.height), 0, 1);
        rail.style.setProperty("--rail", p.toFixed(4));
      });
      if (hero && !reduced()) {
        const h = hero.offsetHeight || innerHeight;
        hero.style.setProperty("--hero-scroll", clamp(y / h, 0, 1).toFixed(4));
      }
    }
    const request = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", () => {
      active = null;
      request();
    });
    document.fonts &&
      document.fonts.ready.then(() => {
        active = null;
        request();
      });
    update();
  }

  /* ---------- pointer effects ---------- */
  function initSpotlight() {
    if (!window.matchMedia("(hover: hover)").matches) return;
    document.querySelectorAll("[data-spotlight]").forEach((el) => {
      let frame = 0,
        x = 0,
        y = 0;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        x = e.clientX - r.left;
        y = e.clientY - r.top;
        if (!frame)
          frame = requestAnimationFrame(() => {
            frame = 0;
            el.style.setProperty("--mx", x + "px");
            el.style.setProperty("--my", y + "px");
          });
      });
    });
  }
  function initMagnetic() {
    if (!window.matchMedia("(hover: hover)").matches) return;
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        if (reduced()) return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = `translate(${dx * 8}px, ${dy * 6}px)`;
      });
      el.addEventListener("pointerleave", () => (el.style.transform = ""));
    });
  }

  /* ---------- accordions with animated height ---------- */
  function initAccordions() {
    document.querySelectorAll("details[data-accordion]").forEach((details) => {
      const summary = details.querySelector("summary");
      const body = details.querySelector(".accordion-body");
      if (!summary || !body) return;
      let anim = null;
      summary.addEventListener("click", (e) => {
        if (reduced() || !body.animate) return;
        e.preventDefault();
        anim && anim.cancel();
        if (details.open) {
          const h = body.offsetHeight;
          anim = body.animate(
            [
              { height: h + "px", opacity: 1 },
              { height: "0px", opacity: 0 },
            ],
            { duration: 380, easing: "cubic-bezier(.65,0,.35,1)" }
          );
          anim.onfinish = () => {
            details.open = false;
            anim = null;
          };
        } else {
          details.open = true;
          const h = body.offsetHeight;
          anim = body.animate(
            [
              { height: "0px", opacity: 0 },
              { height: h + "px", opacity: 1 },
            ],
            { duration: 480, easing: "cubic-bezier(.16,1,.3,1)" }
          );
          anim.onfinish = () => (anim = null);
        }
      });
    });
  }

  /* ---------- a link to #id opens the <details> that holds it ---------- */
  function initHashOpen() {
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = id && document.getElementById(id);
      const details = target && target.closest("details");
      if (!details || details.open) return;
      details.open = true;
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    open();
    addEventListener("hashchange", open);
  }

  function init() {
    initReveal();
    initScroll();
    initSpotlight();
    initMagnetic();
    initAccordions();
    initHashOpen();
    initSegmented();
  }
  window.ZQMotion = Object.freeze({
    tween,
    animator,
    countTo,
    setText,
    formatNumber,
    ease,
    clamp,
    reduced,
    onReducedChange: (fn) => reducedQuery.addEventListener("change", fn),
    initSegmented,
    syncSegmented,
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
