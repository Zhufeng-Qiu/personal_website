/* One synchronous iteration, drawn small: both GPUs compute, then packets cross the
 * link in both directions (an AllReduce). The communication phase lasts `share` of the
 * loop, so a communication-heavy regime visibly spends most of its time on the wire.
 * Packed mode sends one compressed packet for every three data packets. */
(() => {
  "use strict";
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let sprite = null;
  function glow() {
    if (sprite) return sprite;
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.18, "rgba(220,205,255,0.9)");
    r.addColorStop(0.45, "rgba(165,135,242,0.28)");
    r.addColorStop(1, "rgba(120,86,198,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 48, 48);
    return (sprite = c);
  }

  function mount(canvas, options = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const state = {
      share: options.share ?? 0.5,
      packed: !!options.packed,
      commScale: options.commScale ?? 1, // comm duration relative to the f64 baseline
      period: options.period ?? 2.8,
      label: options.label ?? "",
    };
    let shown = { share: state.share, commScale: state.commScale, pack: state.packed ? 1 : 0 };
    let W = 0,
      H = 0,
      dpr = 1,
      phase = 0,
      last = 0,
      frame = 0,
      visible = true;
    const cells = new Float32Array(32);

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(120, r.width);
      H = Math.max(60, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      draw(0);
    }
    function rootPx(rem) {
      return rem * parseFloat(getComputedStyle(document.documentElement).fontSize || "16");
    }

    function chip(x, y, w, h, label, energy, computing) {
      ctx.save();
      ctx.fillStyle = "#121217";
      ctx.strokeStyle = `rgba(190,165,240,${0.45 + energy * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 4);
      else ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.stroke();
      // 4x4 die cells
      const s = Math.min(w, h) * 0.46,
        cx = x + w / 2,
        cy = y + h * 0.58;
      const c = s / 4;
      for (let a = 0; a < 4; a++)
        for (let b = 0; b < 4; b++) {
          const e = computing[a * 4 + b];
          ctx.fillStyle = `rgba(${Math.round(150 + 90 * e)},${Math.round(130 + 90 * e)},${Math.round(210 + 45 * e)},${0.25 + e * 0.7})`;
          ctx.fillRect(cx - s / 2 + a * c + c * 0.2, cy - s / 2 + b * c + c * 0.2, c * 0.6, c * 0.6);
        }
      ctx.fillStyle = "#cfc6e6";
      ctx.font = `${rootPx(0.6).toFixed(1)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(label, cx, y + rootPx(0.95));
      ctx.restore();
    }

    function draw(dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // ease displayed parameters toward targets
      const k = dt ? Math.min(1, dt * 4) : 1;
      shown.share += (state.share - shown.share) * k;
      shown.commScale += (state.commScale - shown.commScale) * k;
      shown.pack += ((state.packed ? 1 : 0) - shown.pack) * k;

      const baseComm = shown.share,
        comm = baseComm * shown.commScale,
        compute = 1 - baseComm;
      const total = compute + comm;
      const u = phase % 1; // position inside one iteration of length `total` (normalised to 1)
      const tNow = u * total;
      const computing = tNow < compute;

      const cw = Math.min(W * 0.17, 92),
        ch = H * 0.78,
        y = (H - ch) / 2;
      const x0 = 2,
        x1 = W - cw - 2;
      // die activity
      for (let i = 0; i < cells.length; i++) cells[i] *= dt ? Math.exp(-dt * 5) : 1;
      if (computing && dt) for (let n = 0; n < 3; n++) cells[(Math.random() * 32) | 0] = 1;
      const e0 = cells.subarray(0, 16),
        e1 = cells.subarray(16, 32);
      chip(x0, y, cw, ch, "GPU 0", computing ? 0.6 : 0.1, e0);
      chip(x1, y, cw, ch, "GPU 1", computing ? 0.6 : 0.1, e1);

      // channel
      const ax = x0 + cw + 6,
        bx = x1 - 6;
      const ly1 = H * 0.42,
        ly2 = H * 0.62;
      ctx.save();
      ctx.strokeStyle = "rgba(160,135,220,0.22)";
      ctx.setLineDash([2, 4]);
      [ly1, ly2].forEach((ly) => {
        ctx.beginPath();
        ctx.moveTo(ax, ly);
        ctx.lineTo(bx, ly);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      // phase caption in the middle
      ctx.save();
      ctx.font = `${rootPx(0.56).toFixed(1)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = computing ? "rgba(200,196,210,0.75)" : "rgba(214,198,255,0.95)";
      ctx.fillText(computing ? "computing" : state.packed ? "allreduce · packed" : "allreduce · f64", (ax + bx) / 2, H * 0.24);
      ctx.restore();

      // packets during the communication phase
      if (!computing) {
        const local = (tNow - compute) / Math.max(1e-6, comm); // 0..1 through comm phase
        const n = Math.round(12 - 8 * shown.pack);
        const travel = 0.42;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = glow();
        for (let dir = 0; dir < 2; dir++)
          for (let i = 0; i < n; i++) {
            const start = (i / n) * (1 - travel);
            const f = (local - start) / travel;
            if (f < 0 || f > 1) continue;
            const px = dir === 0 ? ax + (bx - ax) * f : bx - (bx - ax) * f;
            const py = dir === 0 ? ly1 : ly2;
            const big = shown.pack > 0.5;
            const s = big ? 15 : 9;
            ctx.globalAlpha = Math.sin(Math.PI * f) * 0.95;
            ctx.drawImage(g, px - s / 2, py - s / 2, s, s);
            if (big) {
              ctx.save();
              ctx.translate(px, py);
              ctx.rotate(Math.PI / 4);
              ctx.fillStyle = "rgba(245,240,255,0.95)";
              ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
              ctx.restore();
            }
          }
        ctx.restore();
      }
      if (options.onPhase) options.onPhase(u, { compute: compute / total, computing });
    }

    function tick(now) {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      // period stretches with total iteration time so the timing ratio stays honest
      const total = 1 - shown.share + shown.share * shown.commScale;
      phase += dt / (state.period * Math.max(0.25, total));
      draw(dt);
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      last = 0;
      if (visible && !document.hidden && !reducedQuery.matches) frame = requestAnimationFrame(tick);
      else {
        phase = 1 - shown.share * 0.5; // a still frame mid-communication
        draw(0);
      }
    }
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    if ("IntersectionObserver" in window)
      new IntersectionObserver((e) => {
        visible = e[0].isIntersecting;
        sync();
      }).observe(canvas);
    document.addEventListener("visibilitychange", sync);
    reducedQuery.addEventListener("change", sync);
    resize();
    sync();
    return {
      set(next) {
        Object.assign(state, next);
        if (reducedQuery.matches) {
          shown = { share: state.share, commScale: state.commScale, pack: state.packed ? 1 : 0 };
          sync();
        }
      },
      restart() {
        phase = 0;
      },
    };
  }
  window.ZQFlow = Object.freeze({ mount, clamp });
})();
