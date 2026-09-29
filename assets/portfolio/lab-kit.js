/* Shared lab building blocks: transform-driven timeline blocks, a looping playhead,
 * segmented/preset groups, range styling, and an on-screen animation loop. */
(() => {
  "use strict";
  const M = window.ZQMotion;
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Place a .blk inside its .track: x and w are fractions of the track width. */
  function place(el, x, w) {
    el.style.setProperty("--x", Math.max(0, x).toFixed(5));
    el.style.setProperty("--w", Math.max(0, w).toFixed(5));
  }
  function block(track, cls) {
    const el = document.createElement("span");
    el.className = "blk " + cls;
    track.appendChild(el);
    return el;
  }

  /* rAF loop that only runs while `el` is on screen and the tab is visible. */
  function loop(el, fn) {
    let frame = 0,
      last = 0,
      visible = true,
      enabled = true;
    const tick = (now) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      fn(dt, now);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (enabled && visible && !document.hidden && !reducedQuery.matches) frame = requestAnimationFrame(tick);
      else fn(0, performance.now());
    };
    if ("IntersectionObserver" in window)
      new IntersectionObserver((e) => {
        visible = e[0].isIntersecting;
        sync();
      }).observe(el);
    document.addEventListener("visibilitychange", sync);
    reducedQuery.addEventListener("change", sync);
    sync();
    return {
      set enabled(v) {
        enabled = v;
        sync();
      },
      sync,
    };
  }

  /* Sweeps `head` across `track` once per `period()` seconds; calls onFrame(u). */
  function playhead(head, track, period, onFrame) {
    let u = 0,
      width = track.offsetWidth;
    if ("ResizeObserver" in window) new ResizeObserver(() => (width = track.offsetWidth)).observe(track);
    const handle = loop(track, (dt) => {
      if (dt) u = (u + dt / Math.max(0.2, period())) % 1;
      else if (reducedQuery.matches) u = 0;
      head.style.transform = `translateX(${(u * width).toFixed(1)}px)`;
      head.style.opacity = reducedQuery.matches ? "0" : "1";
      onFrame && onFrame(u);
    });
    return {
      restart() {
        u = 0;
      },
      handle,
    };
  }

  /* Buttons with data-value inside `group` behave as a single-choice set. */
  function choice(group, onChange, attr = "value") {
    const buttons = [...group.querySelectorAll(`[data-${attr}]`)];
    const set = (value, silent) => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
      if (!silent) onChange && onChange(value);
    };
    buttons.forEach((b) =>
      b.addEventListener("click", () => {
        if (b.disabled) return;
        set(b.dataset[attr]);
      })
    );
    return {
      set,
      get: () => (buttons.find((b) => b.getAttribute("aria-pressed") === "true") || {}).dataset?.[attr],
      buttons,
    };
  }

  function styleRange(input) {
    const paint = () => {
      const min = +input.min || 0,
        max = +input.max || 100;
      input.style.setProperty("--p", (((+input.value - min) / (max - min)) * 100).toFixed(2) + "%");
    };
    input.addEventListener("input", paint);
    paint();
    return paint;
  }

  function verdict(el, text, bad) {
    if (el.dataset.text === text) return;
    el.dataset.text = text;
    el.classList.toggle("bad", !!bad);
    el.innerHTML = "";
    const span = document.createElement("span");
    span.className = "verdict-text";
    span.textContent = text;
    el.appendChild(span);
  }

  function revealOnView(el, cls = "is-in") {
    if (!("IntersectionObserver" in window) || reducedQuery.matches) {
      el.classList.add(cls);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          el.classList.add(cls);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    // Inside a closed <details> the observer is not told when it opens; observe afresh.
    const details = el.closest("details");
    if (details)
      details.addEventListener("toggle", () => {
        if (!details.open || el.classList.contains(cls)) return;
        io.unobserve(el);
        io.observe(el);
      });
  }

  window.ZQKit = Object.freeze({ place, block, loop, playhead, choice, styleRange, verdict, revealOnView, reduced: () => reducedQuery.matches, M });
})();
