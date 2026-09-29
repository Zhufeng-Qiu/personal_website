/* Hero instrument: two GPU boards and a luminous stream between them.
 * RAW: every datum travels on its own lane. PACKED: lanes fan out, converge into a
 * rotating cluster, and every three data packets fuse into one compressed packet.
 * The switch (or a horizontal drag on the stage) morphs continuously between the two.
 * Illustrative only; nothing here is a measurement. */
(() => {
  "use strict";
  const canvas = document.getElementById("gpu-canvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const root = document.querySelector("[data-hero]");
  const toggle = document.getElementById("payload-switch");
  const pauseButton = document.getElementById("hero-pause");
  const bytesOut = document.getElementById("payload-bytes");
  const wordsOut = document.getElementById("payload-words");
  const sides = root.querySelectorAll(".switch-side");
  const M = window.ZQMotion;
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  // Deterministic pseudo-random numbers so the drawing is stable across resizes.
  let seed = 20260928;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

  let W = 0,
    H = 0,
    dpr = 1;
  let layout = null,
    field = null,
    chips = null,
    sprites = null;
  let lanes = [],
    particles = [];
  let p = 0, // 0 = raw, 1 = packed (continuous)
    pTarget = 1,
    time = 0,
    last = 0,
    frame = 0,
    visible = true,
    userPaused = false,
    introDone = false;
  const pointer = { x: -9999, y: -9999, inside: false, sx: 0, sy: 0 };
  const flash0 = new Float32Array(81);
  let arrival = 0;

  /* ---------- sprites ---------- */
  function makeSprites() {
    const size = 64;
    const dot = document.createElement("canvas");
    dot.width = dot.height = size;
    const d = dot.getContext("2d");
    const g = d.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.14, "rgba(226,212,255,0.95)");
    g.addColorStop(0.36, "rgba(172,142,245,0.32)");
    g.addColorStop(1, "rgba(120,86,198,0)");
    d.fillStyle = g;
    d.fillRect(0, 0, size, size);

    const packet = document.createElement("canvas");
    packet.width = packet.height = size;
    const q = packet.getContext("2d");
    const h = q.createRadialGradient(32, 32, 0, 32, 32, 32);
    h.addColorStop(0, "rgba(214,196,255,0.55)");
    h.addColorStop(0.5, "rgba(150,118,236,0.16)");
    h.addColorStop(1, "rgba(120,86,198,0)");
    q.fillStyle = h;
    q.fillRect(0, 0, size, size);
    q.translate(32, 32);
    q.rotate(Math.PI / 4);
    q.fillStyle = "rgba(246,240,255,0.98)";
    q.fillRect(-5, -5, 10, 10);
    q.strokeStyle = "rgba(190,165,250,0.9)";
    q.lineWidth = 1.5;
    q.strokeRect(-7.5, -7.5, 15, 15);
    return { dot, packet };
  }

  /* ---------- geometry ---------- */
  function computeLayout() {
    const bw = W * 0.19,
      bh = H * 0.48,
      sk = 0.075;
    const X0 = W * 0.07,
      Y0 = H * 0.25;
    const X1 = W - W * 0.07 - bw,
      Y1 = H * 0.25;
    const g0right = X0 + bw,
      g0top = Y0 + sk * bw;
    const g1left = X1,
      g1top = Y1 + sk * bw;
    const cy = g1top + bh * 0.5;
    const R = W * 0.058;
    const C = { x: g1left - W * 0.05, y: cy };
    const F = { x: C.x - R * 0.55, y: cy };
    return { bw, bh, sk, X0, Y0, X1, Y1, g0right, g0top, g1left, g1top, R, C, F, E: { x: g1left + W * 0.012, y: cy } };
  }

  function buildLanes() {
    seed = 1234567;
    const L = layout;
    const count = W < 520 ? 38 : W < 820 ? 52 : 70;
    lanes = [];
    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0.5 : i / (count - 1);
      const c = u - 0.5;
      const j = () => rand() - 0.5;
      const sx = L.g0right + 2 + j() * W * 0.006;
      const sy = L.g0top + L.bh * lerp(0.12, 0.88, u) + j() * 3;
      const ey = L.g1top + L.bh * lerp(0.16, 0.84, u) + j() * 4;
      const fan = 0.52 + rand() * 0.22;
      lanes.push({
        u,
        bright: i % 4 === 0,
        raw: [sx, sy, W * 0.4, sy + c * H * 0.07, W * 0.6, ey + c * H * 0.04, L.g1left - 3, ey],
        packed: [
          sx,
          sy,
          W * (0.37 + rand() * 0.04),
          sy + c * H * fan,
          W * (0.55 + rand() * 0.03),
          L.F.y + c * H * 0.11,
          L.F.x + j() * W * 0.008,
          L.F.y + j() * H * 0.012,
        ],
      });
    }
    // particles: several per lane, evenly phased with jitter
    const per = W < 520 ? 5 : W < 820 ? 6 : 7;
    particles = [];
    let id = 0;
    lanes.forEach((lane, li) => {
      for (let k = 0; k < per; k++) {
        const theta = rand() * TAU,
          z = rand() * 2 - 1,
          r = Math.cbrt(rand());
        const s = Math.sqrt(1 - z * z);
        particles.push({
          lane: li,
          t: (k + rand() * 0.7) / per,
          speed: 0.085 + rand() * 0.05,
          id: id++,
          sphere: [s * Math.cos(theta) * r, z * r * 0.92, s * Math.sin(theta) * r],
          exitY: (rand() - 0.5) * layout.bh * 0.24,
          size: 0.75 + rand() * 0.6,
        });
      }
    });
  }

  function bez(c, t, out) {
    const m = 1 - t,
      a = m * m * m,
      b = 3 * m * m * t,
      d = 3 * m * t * t,
      e = t * t * t;
    out[0] = a * c[0] + b * c[2] + d * c[4] + e * c[6];
    out[1] = a * c[1] + b * c[3] + d * c[5] + e * c[7];
    return out;
  }
  const tmpA = [0, 0],
    tmpB = [0, 0],
    blendCtl = new Float64Array(8);

  // Position of particle q at phase t, for the current morph p.
  function position(q, t, out) {
    const lane = lanes[q.lane];
    bez(lane.raw, t, tmpA);
    const rx = tmpA[0],
      ry = tmpA[1];
    if (p <= 0.001) {
      out[0] = rx;
      out[1] = ry;
      return 0;
    }
    const s = Math.min(1, t / 0.62);
    bez(lane.packed, s, tmpB);
    let x = tmpB[0],
      y = tmpB[1];
    const L = layout;
    const w1 = smooth(0.55, 0.68, t);
    if (w1 > 0) {
      const th = time * 0.55;
      const [sx, sy, sz] = q.sphere;
      const cx = sx * Math.cos(th) + sz * Math.sin(th);
      const cz = -sx * Math.sin(th) + sz * Math.cos(th);
      const persp = 1 + cz * 0.18;
      const ox = L.C.x + cx * L.R * persp,
        oy = L.C.y + sy * L.R * persp;
      x = lerp(x, ox, w1);
      y = lerp(y, oy, w1);
      q.depth = cz;
    } else q.depth = 0;
    const w2 = smooth(0.88, 1, t);
    if (w2 > 0) {
      x = lerp(x, L.E.x, w2);
      y = lerp(y, L.E.y + q.exitY, w2);
    }
    out[0] = lerp(rx, x, p);
    out[1] = lerp(ry, y, p);
    return w1;
  }

  /* ---------- static layers ---------- */
  function offscreen(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    return [c, g];
  }

  function renderField() {
    const [c, g] = offscreen(W, H);
    const cx = W * 0.52,
      cy = H * 0.52;
    const step = Math.max(14, W / 58);
    for (let x = step / 2; x < W; x += step)
      for (let y = step / 2; y < H; y += step) {
        const d = Math.hypot((x - cx) / (W * 0.55), (y - cy) / (H * 0.52));
        const a = Math.max(0, 1 - d) * 0.34;
        if (a < 0.01) continue;
        g.fillStyle = `rgba(185,160,235,${a.toFixed(3)})`;
        g.fillRect(x, y, 1.2, 1.2);
      }
    const haze = g.createRadialGradient(W * 0.56, H * 0.5, 0, W * 0.56, H * 0.5, W * 0.42);
    haze.addColorStop(0, "rgba(140,105,230,0.12)");
    haze.addColorStop(0.55, "rgba(110,80,200,0.045)");
    haze.addColorStop(1, "rgba(90,60,170,0)");
    g.fillStyle = haze;
    g.fillRect(0, 0, W, H);
    return c;
  }

  function drawChipBody(g, bw, bh) {
    // thickness layers
    for (let k = 4; k >= 1; k--) {
      g.fillStyle = "#0c0c10";
      g.strokeStyle = `rgba(160,130,215,${0.14 + (4 - k) * 0.05})`;
      g.lineWidth = 1;
      g.beginPath();
      g.rect(-k * 3.4, k * 1.8, bw, bh);
      g.fill();
      g.stroke();
    }
    // face
    const face = g.createLinearGradient(0, 0, bw, bh);
    face.addColorStop(0, "#17161f");
    face.addColorStop(1, "#0e0e13");
    g.fillStyle = face;
    g.fillRect(0, 0, bw, bh);
    g.save();
    g.shadowColor = "rgba(175,145,245,0.55)";
    g.shadowBlur = 14;
    g.strokeStyle = "rgba(205,184,248,0.85)";
    g.lineWidth = 1.3;
    g.strokeRect(0, 0, bw, bh);
    g.restore();
    g.strokeStyle = "rgba(170,145,225,0.22)";
    g.lineWidth = 0.8;
    g.strokeRect(5, 5, bw - 10, bh - 10);

    const line = (pts, a, w = 0.7) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = `rgba(170,145,225,${a})`;
      g.lineWidth = w;
      g.stroke();
    };
    const dx = bw * 0.5,
      dy = bh * 0.47;
    const ps = bw * 0.5,
      ds = bw * 0.36;
    // traces from edge components toward the package
    for (let r = 0; r < 5; r++) {
      const y = bh * (0.12 + r * 0.17);
      line(
        [
          [bw * 0.16, y],
          [bw * 0.24, y],
          [dx - ps / 2, dy - ps / 3 + r * (ps / 6)],
        ],
        0.22
      );
      line(
        [
          [bw * 0.84, y],
          [bw * 0.76, y],
          [dx + ps / 2, dy - ps / 3 + r * (ps / 6)],
        ],
        0.22
      );
    }
    for (let n = 0; n < 7; n++) {
      const x = bw * (0.22 + n * 0.093);
      line(
        [
          [x, bh * 0.1],
          [x, dy - ps / 2 - 4],
        ],
        0.18
      );
      line(
        [
          [x, dy + ps / 2 + 4],
          [x, bh * 0.86],
        ],
        0.16
      );
    }
    // side component stacks (VRM / caps)
    for (let r = 0; r < 5; r++) {
      [bw * 0.06, bw * 0.84].forEach((x) => {
        const y = bh * (0.08 + r * 0.17);
        g.strokeStyle = "rgba(190,165,235,0.62)";
        g.lineWidth = 0.9;
        g.strokeRect(x, y, bw * 0.1, bh * 0.1);
        for (let j = 1; j < 4; j++)
          line(
            [
              [x + 2, y + (bh * 0.1 * j) / 4],
              [x + bw * 0.1 - 2, y + (bh * 0.1 * j) / 4],
            ],
            0.35,
            0.6
          );
      });
    }
    // top row of memory packages
    for (let n = 0; n < 6; n++) {
      const x = bw * (0.22 + n * 0.095);
      g.strokeStyle = "rgba(190,165,235,0.5)";
      g.strokeRect(x, bh * 0.045, bw * 0.06, bh * 0.07);
    }
    // package + die
    g.save();
    g.shadowColor = "rgba(185,160,250,0.7)";
    g.shadowBlur = 10;
    g.strokeStyle = "rgba(214,196,255,0.9)";
    g.lineWidth = 1.2;
    g.strokeRect(dx - ps / 2, dy - ps / 2, ps, ps);
    g.restore();
    g.strokeStyle = "rgba(185,160,240,0.6)";
    g.strokeRect(dx - ps / 2 + 4, dy - ps / 2 + 4, ps - 8, ps - 8);
    g.fillStyle = "rgba(30,26,44,0.95)";
    g.fillRect(dx - ds / 2, dy - ds / 2, ds, ds);
    g.strokeStyle = "rgba(205,184,250,0.8)";
    g.strokeRect(dx - ds / 2, dy - ds / 2, ds, ds);
    const cell = ds / 9;
    for (let a = 0; a < 9; a++)
      for (let b = 0; b < 9; b++) {
        g.fillStyle = (a + b) % 5 === 0 ? "rgba(200,178,250,0.55)" : "rgba(160,135,215,0.28)";
        g.fillRect(dx - ds / 2 + a * cell + cell * 0.22, dy - ds / 2 + b * cell + cell * 0.22, cell * 0.56, cell * 0.56);
      }
    // connector fingers
    g.fillStyle = "rgba(175,150,230,0.5)";
    for (let n = 0; n < 22; n++) g.fillRect(bw * 0.12 + n * bw * 0.035, bh + 2, bw * 0.018, bh * 0.035);
    return { dx, dy, ds, cell };
  }

  function renderChip(mirror) {
    const L = layout;
    const pad = 28,
      depth = 16;
    const w = L.bw + pad * 2 + depth,
      h = L.bh + L.bw * L.sk + pad * 2 + depth;
    const [c, g] = offscreen(w, h);
    g.save();
    if (!mirror) g.translate(pad + depth, pad);
    else {
      g.translate(pad + L.bw, pad);
      g.scale(-1, 1);
    }
    g.transform(1, L.sk, 0, 1, 0, 0);
    const die = drawChipBody(g, L.bw, L.bh);
    g.restore();
    return { canvas: c, w, h, faceX: mirror ? pad : pad + depth, faceY: pad, die };
  }

  function rebuild() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(280, rect.width);
    H = Math.max(180, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, W * H > 700000 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    layout = computeLayout();
    sprites = sprites || makeSprites();
    field = renderField();
    chips = [renderChip(false), renderChip(true)];
    buildLanes();
  }

  /* ---------- per-frame drawing ---------- */
  function chipToScreen(mirror, lx, ly, px, py) {
    const L = layout;
    if (!mirror) return [L.X0 + lx + px, L.Y0 + ly + L.sk * lx + py];
    return [L.X1 + (L.bw - lx) + px, L.Y1 + ly + L.sk * lx + py];
  }

  function drawDieActivity(mirror, px, py, energyFn) {
    const die = chips[mirror ? 1 : 0].die;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let a = 0; a < 9; a++)
      for (let b = 0; b < 9; b++) {
        const e = energyFn(a * 9 + b);
        if (e < 0.03) continue;
        const lx = die.dx - die.ds / 2 + a * die.cell + die.cell * 0.5;
        const ly = die.dy - die.ds / 2 + b * die.cell + die.cell * 0.5;
        const [sx, sy] = chipToScreen(mirror, lx, ly, px, py);
        const s = die.cell * (1.6 + e * 2.4);
        ctx.globalAlpha = Math.min(1, e);
        ctx.drawImage(sprites.dot, sx - s / 2, sy - s / 2, s, s);
      }
    ctx.restore();
  }

  function drawOrbits() {
    const L = layout;
    ctx.save();
    ctx.lineWidth = 0.8;
    for (let a = 0; a < 3; a++) {
      ctx.beginPath();
      ctx.ellipse(L.C.x + W * 0.02, L.C.y, W * (0.2 + a * 0.035), H * (0.36 + a * 0.05), -0.22, 0, TAU);
      ctx.strokeStyle = `rgba(175,140,230,${(0.1 - a * 0.022).toFixed(3)})`;
      ctx.setLineDash(a === 1 ? [2, 7] : []);
      ctx.lineDashOffset = -time * 9 * (a + 1);
      ctx.stroke();
    }
    // a slow comet on the middle orbit
    const ang = time * 0.22;
    const ox = L.C.x + W * 0.02 + Math.cos(ang) * W * 0.235,
      oy = L.C.y + Math.sin(ang) * H * 0.41;
    const rx = Math.cos(-0.22),
      ry = Math.sin(-0.22);
    const cxp = L.C.x + W * 0.02 + (ox - L.C.x - W * 0.02) * rx - (oy - L.C.y) * ry;
    const cyp = L.C.y + (ox - L.C.x - W * 0.02) * ry + (oy - L.C.y) * rx;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.drawImage(sprites.dot, cxp - 8, cyp - 8, 16, 16);
    ctx.restore();
  }

  function draw(dt) {
    const L = layout;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // pointer parallax (smoothed)
    const tx = pointer.inside ? pointer.x / W - 0.5 : 0,
      ty = pointer.inside ? pointer.y / H - 0.5 : 0;
    pointer.sx += (tx - pointer.sx) * Math.min(1, dt * 4);
    pointer.sy += (ty - pointer.sy) * Math.min(1, dt * 4);
    const px = -pointer.sx * 10,
      py = -pointer.sy * 7;

    ctx.drawImage(field, pointer.sx * 6, pointer.sy * 5, W, H);
    drawOrbits();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // fibers
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      for (let k = 0; k < 8; k++) blendCtl[k] = lerp(lane.raw[k], lane.packed[k], p);
      ctx.beginPath();
      ctx.moveTo(blendCtl[0], blendCtl[1]);
      ctx.bezierCurveTo(blendCtl[2], blendCtl[3], blendCtl[4], blendCtl[5], blendCtl[6], blendCtl[7]);
      ctx.strokeStyle = lane.bright ? `rgba(190,160,250,${0.2 + 0.08 * p})` : "rgba(170,140,240,0.075)";
      ctx.lineWidth = lane.bright ? 0.9 : 0.7;
      ctx.stroke();
    }
    // convergence halo + beam core
    if (p > 0.02) {
      const pulse = 1 + Math.sin(time * 2.1) * 0.08;
      const r = L.R * 2.4 * pulse;
      const halo = ctx.createRadialGradient(L.C.x, L.C.y, 0, L.C.x, L.C.y, r);
      halo.addColorStop(0, `rgba(200,175,255,${0.32 * p})`);
      halo.addColorStop(0.45, `rgba(150,115,240,${0.12 * p})`);
      halo.addColorStop(1, "rgba(120,86,198,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(L.C.x - r, L.C.y - r, r * 2, r * 2);
      const beam = ctx.createLinearGradient(W * 0.46, 0, L.F.x, 0);
      beam.addColorStop(0, "rgba(180,150,250,0)");
      beam.addColorStop(1, `rgba(215,195,255,${0.38 * p})`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(W * 0.46, L.F.y - H * 0.035);
      ctx.quadraticCurveTo(L.F.x - W * 0.04, L.F.y - H * 0.006, L.F.x, L.F.y);
      ctx.quadraticCurveTo(L.F.x - W * 0.04, L.F.y + H * 0.006, W * 0.46, L.F.y + H * 0.035);
      ctx.fill();
    }
    // particles
    const lensR = W * 0.11;
    for (let i = 0; i < particles.length; i++) {
      const q = particles[i];
      if (dt) {
        q.t += q.speed * dt * (1 + p * 0.12);
        if (q.t >= 1) {
          q.t -= 1;
          if (p < 0.5 || q.id % 3 === 0) arrival = Math.min(1.4, arrival + (p > 0.5 ? 0.06 : 0.025));
        }
      }
      const w1 = position(q, q.t, tmpA);
      let x = tmpA[0],
        y = tmpA[1];
      if (pointer.inside) {
        const ddx = x - pointer.x,
          ddy = y - pointer.y,
          d = Math.hypot(ddx, ddy);
        if (d < lensR && d > 0.01) {
          const f = Math.pow(1 - d / lensR, 2) * 26;
          x += (ddx / d) * f;
          y += (ddy / d) * f;
        }
      }
      const m = smooth(0.57, 0.82, q.t) * p; // merge progress
      let alpha = smooth(0, 0.05, q.t) * (1 - smooth(0.95, 1, q.t)) * (0.35 + 0.65 * q.t);
      const isPacket = q.id % 3 === 0;
      if (!isPacket) alpha *= 1 - m;
      if (alpha < 0.02) continue;
      const depthK = 1 + (q.depth || 0) * 0.3 * w1 * p;
      // short trail
      position(q, Math.max(0, q.t - 0.02), tmpB);
      ctx.globalAlpha = alpha * 0.42;
      ctx.strokeStyle = "rgb(190,165,252)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(tmpB[0], tmpB[1]);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = Math.min(1, alpha * depthK);
      if (isPacket && m > 0.25) {
        const s = lerp(10, 19, m) * q.size * depthK;
        ctx.drawImage(sprites.packet, x - s / 2, y - s / 2, s, s);
      } else {
        const s = (7 + 3 * q.t) * q.size * depthK;
        ctx.drawImage(sprites.dot, x - s / 2, y - s / 2, s, s);
      }
    }
    // lens glow under the cursor
    if (pointer.inside) {
      ctx.globalAlpha = 0.5;
      const lg = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, lensR * 0.9);
      lg.addColorStop(0, "rgba(170,140,245,0.14)");
      lg.addColorStop(1, "rgba(120,86,198,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(pointer.x - lensR, pointer.y - lensR, lensR * 2, lensR * 2);
    }
    ctx.restore();

    // boards on top, with parallax
    ctx.globalAlpha = 1;
    ctx.drawImage(chips[0].canvas, L.X0 - chips[0].faceX + px, L.Y0 - chips[0].faceY + py, chips[0].w, chips[0].h);
    ctx.drawImage(chips[1].canvas, L.X1 - chips[1].faceX + px * 0.6, L.Y1 - chips[1].faceY + py * 0.6, chips[1].w, chips[1].h);
    // GPU 0 computes (random twinkle), GPU 1 lights up as packets land
    if (dt) {
      for (let i = 0; i < flash0.length; i++) flash0[i] *= Math.exp(-dt * 3.2);
      const sparks = Math.random() < dt * 22 ? (1 + Math.random() * 3) | 0 : 0;
      for (let s = 0; s < sparks; s++) flash0[(Math.random() * 81) | 0] = 0.9;
      arrival *= Math.exp(-dt * 2.2);
    }
    drawDieActivity(false, px, py, (i) => flash0[i]);
    drawDieActivity(true, px * 0.6, py * 0.6, (i) => {
      const a = (i / 9) | 0,
        b = i % 9;
      const ring = Math.hypot(a - 4, b - 4) / 5.7;
      return arrival * Math.max(0, 1 - Math.abs(ring - ((time * 1.4) % 1)) * 3) * 0.9;
    });
  }

  /* ---------- loop & state ---------- */
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    time += dt;
    if (!dragging && Math.abs(pTarget - p) > 0.0005) {
      p += (pTarget - p) * Math.min(1, dt * 3.2);
      syncReadout();
    }
    draw(dt);
    frame = requestAnimationFrame(tick);
  }
  function running() {
    return !userPaused && !reducedQuery.matches && visible && !document.hidden;
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = 0;
    pauseButton.textContent = reducedQuery.matches ? "Motion reduced" : userPaused ? "Play motion" : "Pause motion";
    pauseButton.setAttribute("aria-pressed", String(userPaused || reducedQuery.matches));
    pauseButton.disabled = reducedQuery.matches;
    if (!running()) {
      p = pTarget;
      syncReadout();
    }
    draw(0);
    if (running()) frame = requestAnimationFrame(tick);
  }

  let shownPacked = null;
  function syncReadout() {
    toggle.style.setProperty("--p", p.toFixed(3));
    const packed = pTarget > 0.5;
    toggle.setAttribute("aria-checked", String(packed));
    sides.forEach((s) => s.classList.toggle("is-active", (s.dataset.side === "packed") === packed));
    if (shownPacked !== packed) {
      shownPacked = packed;
      canvas.setAttribute(
        "aria-label",
        `Illustration of ${packed ? "packed" : "raw"} data moving between two GPUs. ${packed ? "Every three data packets fuse into one compressed packet." : "Each datum travels separately."} Not a measurement.`
      );
      wordsOut.textContent = packed ? "2 × u64" : "6 × f64";
      if (M) M.countTo(bytesOut, packed ? 16 : 48, { decimals: 0, suffix: " B", duration: 700 });
      else bytesOut.textContent = packed ? "16 B" : "48 B";
    }
  }
  function setTarget(v, instant) {
    pTarget = v;
    introDone = true;
    if (instant || !running()) p = v;
    syncReadout();
    if (!running()) draw(0);
  }

  /* ---------- input ---------- */
  let dragging = false,
    dragStartX = 0,
    dragStartP = 0,
    moved = false;
  toggle.addEventListener("click", () => {
    if (moved) {
      moved = false;
      return;
    }
    setTarget(pTarget > 0.5 ? 0 : 1);
  });
  toggle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setTarget(0);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setTarget(1);
    }
  });
  sides.forEach((s) => s.addEventListener("click", () => setTarget(s.dataset.side === "packed" ? 1 : 0)));
  function startDrag(e, el, span) {
    dragging = true;
    moved = false;
    dragStartX = e.clientX;
    dragStartP = p;
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    toggle.classList.add("is-dragging");
    const onMove = (ev) => {
      const dx = ev.clientX - dragStartX;
      if (Math.abs(dx) > 3) moved = true;
      p = clamp(dragStartP + dx / span(), 0, 1);
      pTarget = p;
      toggle.style.setProperty("--p", p.toFixed(3));
      if (!running()) draw(0);
    };
    const onUp = () => {
      dragging = false;
      toggle.classList.remove("is-dragging");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (moved) setTarget(p > 0.5 ? 1 : 0);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }
  toggle.addEventListener("pointerdown", (e) => startDrag(e, toggle, () => toggle.offsetWidth * 0.5));
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    startDrag(e, canvas, () => W * 0.45);
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * W;
    pointer.y = ((e.clientY - r.top) / r.height) * H;
    pointer.inside = e.pointerType === "mouse" && !reducedQuery.matches;
    if (!running()) draw(0);
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.inside = false;
    if (!running()) draw(0);
  });
  pauseButton.addEventListener("click", () => {
    userPaused = !userPaused;
    sync();
  });

  if ("ResizeObserver" in window)
    new ResizeObserver(() => {
      rebuild();
      draw(0);
    }).observe(canvas);
  if ("IntersectionObserver" in window)
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      sync();
    }).observe(canvas);
  document.addEventListener("visibilitychange", sync);
  reducedQuery.addEventListener("change", sync);

  rebuild();
  // Open on RAW, then morph to PACKED once so the idea is visible without interaction.
  if (!reducedQuery.matches) {
    p = 0;
    pTarget = 0;
    syncReadout();
    setTimeout(() => {
      if (!introDone) {
        pTarget = 1;
        syncReadout();
      }
    }, 1400);
  } else {
    p = pTarget = 1;
    syncReadout();
  }
  sync();
})();
