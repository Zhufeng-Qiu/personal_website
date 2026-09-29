/* Lab 01, chapter 01: six float64 statistics → two 21-bit-field uint64 words → summed while packed.
 * Bit segments fly along arcs (Web Animations), rows collapse, and every number is
 * computed here with BigInt from a simulated pair; the layout is the project's real one. */
(() => {
  "use strict";
  const card = document.getElementById("lossless");
  const K = window.ZQKit,
    M = window.ZQMotion,
    L = window.ZQLab;
  if (!card || !K || !L) return;

  const W = 64,
    F = 21,
    VMAX = 5,
    N = 1363;
  const NAMES = ["n", "Σx", "Σy", "Σx²", "Σy²", "Σxy"];
  const BOUND = [N, VMAX * N, VMAX * N, VMAX * VMAX * N, VMAX * VMAX * N, VMAX * VMAX * N];
  if (!L.domainGate(N, VMAX)) throw new Error("Packing domain does not fit");
  const reg = document.getElementById("reg"),
    labs = document.getElementById("labs"),
    vals = document.getElementById("vals"),
    block = document.getElementById("reg-block");
  const stepButtons = [...document.querySelectorAll("#steps button")];
  const playBtn = document.getElementById("play");
  let a = [],
    b = [],
    step = 0,
    rowH = 20,
    regW = 600;

  const slotCol = (k) => 63 - (k * F + F - 1); // leftmost column of field k
  const bitLen = (v) => (v ? Math.floor(Math.log2(v)) + 1 : 1);
  function stats(k) {
    const s = [k, 0, 0, 0, 0, 0];
    for (let i = 0; i < k; i++) {
      const x = 1 + Math.floor(Math.random() * 5);
      const y = Math.max(1, Math.min(5, x + Math.round((Math.random() - 0.5) * 3)));
      s[1] += x;
      s[2] += y;
      s[3] += x * x;
      s[4] += y * y;
      s[5] += x * y;
    }
    return s;
  }
  function f64bits(v) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, v);
    return dv.getBigUint64(0).toString(2).padStart(64, "0");
  }
  const el = (tag, cls, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    parent && parent.appendChild(n);
    return n;
  };

  const rows = NAMES.map(() => {
    const r = el("div", "bitrow", reg);
    for (let c = 0; c < W; c++) {
      const cell = el("div", "cell", r);
      cell.style.setProperty("--d", (c * 6) / 1000 + "s");
    }
    return r;
  });
  const segs = NAMES.map(() => {
    const s = el("div", "seg-bits", reg);
    s.style.width = (F / W) * 100 + "%";
    return s;
  });
  const labels = NAMES.map(() => el("div", "reg-label", labs));
  const values = NAMES.map(() => el("div", "reg-label", vals));
  const fields = document.getElementById("fields");
  ["bits 0–20", "bits 21–41", "bits 42–62"].forEach((text, k) => {
    const s = el("span", "", fields);
    s.style.left = (slotCol(k) / W) * 100 + "%";
    s.style.width = (F / W) * 100 + "%";
    s.textContent = text;
  });
  const segPos = segs.map(() => ({ x: 0, y: 0 }));

  function fill() {
    rows.forEach((r, i) => {
      const bits = f64bits(a[i]);
      [...r.children].forEach((c, j) => (c.className = "cell" + (bits[j] === "1" ? " one" : "") + (j >= 1 && j <= 11 ? " exp" : "")));
    });
    segs.forEach((s, i) => {
      s.innerHTML = "";
      const bs = a[i].toString(2).padStart(F, "0"),
        bl = bitLen(BOUND[i]);
      for (let j = 0; j < F; j++) el("div", "cell" + (bs[j] === "1" ? " one" : F - j <= bl ? " used" : ""), s);
    });
  }

  function target(i, packed) {
    const row = packed ? Math.floor(i / 3) : i,
      slot = packed ? i % 3 : 0;
    return { x: (slotCol(slot) / W) * regW, y: row * rowH };
  }
  function moveSeg(i, packed, animate) {
    const s = segs[i],
      to = target(i, packed),
      from = { ...segPos[i] };
    segPos[i] = to;
    const toT = `translate3d(${to.x}px, ${to.y}px, 0)`;
    s.getAnimations && s.getAnimations().forEach((an) => an.cancel());
    if (!animate || K.reduced() || !s.animate) {
      s.style.transform = toT;
      s.style.opacity = packed ? "1" : "0";
      return;
    }
    const lift = -Math.max(18, Math.abs(to.y - from.y) * 0.35 + 14);
    const mid = `translate3d(${(from.x + to.x) / 2}px, ${(from.y + to.y) / 2 + lift}px, 0)`;
    const fromT = `translate3d(${from.x}px, ${from.y}px, 0)`;
    const frames = packed
      ? [
          { transform: fromT, opacity: 0 },
          { transform: fromT, opacity: 1, offset: 0.18 },
          { transform: mid, opacity: 1, offset: 0.58 },
          { transform: toT, opacity: 1 },
        ]
      : [
          { transform: fromT, opacity: 1 },
          { transform: mid, opacity: 1, offset: 0.45 },
          { transform: toT, opacity: 1, offset: 0.85 },
          { transform: toT, opacity: 0 },
        ];
    s.style.transform = toT;
    s.style.opacity = packed ? "1" : "0";
    s.animate(frames, { duration: 1050, delay: i * 90, easing: "cubic-bezier(.65,0,.35,1)", fill: "backwards" });
  }

  function layout(animate) {
    const packed = step >= 1;
    block.classList.toggle("packed", packed);
    reg.classList.toggle("packed", packed);
    const n = packed ? 2 : 6;
    [reg, labs, vals].forEach((x) => (x.style.height = n * rowH + "px"));
    rows.forEach((r, i) => {
      const y = packed ? Math.min(i, 1) * rowH : i * rowH;
      r.style.transform = `translate3d(0, ${y}px, 0)`;
      r.style.opacity = packed && i > 1 ? "0" : "1";
      r.style.transitionDelay = animate ? (packed ? "0.55s" : "0s") : "0s";
    });
    segs.forEach((_, i) => moveSeg(i, packed, animate && packed !== !!segs[i].dataset.packed));
    segs.forEach((s) => (s.dataset.packed = packed ? "1" : ""));
    labels.forEach((l, i) => {
      const y = packed ? Math.min(i, 1) * rowH : i * rowH;
      l.style.transform = `translate3d(0, ${y}px, 0)`;
      l.style.opacity = packed && i > 1 ? "0" : "1";
      l.textContent = packed ? (i < 2 ? `word${i} · u64` : "") : `${NAMES[i]} · f64`;
    });
    values.forEach((v, i) => {
      const y = packed ? Math.min(i, 1) * rowH : i * rowH;
      v.style.transform = `translate3d(0, ${y}px, 0)`;
      v.style.opacity = packed && i > 1 ? "0" : "1";
      v.textContent = packed ? (i < 2 ? (i ? "Σxy · Σy² · Σx²" : "Σy · Σx · n") : "") : a[i].toLocaleString() + ".0";
      v.style.color = packed ? "var(--muted)" : "";
    });
    document.getElementById("pbar").style.setProperty("--fill", packed ? "0.3333" : "1");
    M.countTo(document.getElementById("pbytes"), packed ? 16 : 48, { decimals: 0, suffix: " B", duration: 900 });
    document.getElementById("pmb").textContent = packed ? "18.7 MB for item_full · 3× smaller" : "56.2 MB for item_full";
    stepButtons.forEach((bt, i) => {
      bt.classList.toggle("on", i === step);
      bt.classList.toggle("done", i < step);
      bt.setAttribute("aria-pressed", String(i === step));
    });
    document.getElementById("wire").classList.toggle("show", step >= 2);
    document.getElementById("verify").classList.toggle("show", step >= 3);
    document.getElementById("prev").disabled = step === 0;
    document.getElementById("next").textContent = step === 3 ? "↺ Start over" : "Next →";
    const caps = [
      "GPU 0 holds its partial statistics for this pair as six <em>float64</em> values: 384 bits. Each is an exact integer, and even its bound (<code>5² × 1,363 = 34,075</code> for the second moments) needs only 16 bits. The rest of every word is exponent and zero mantissa.",
      "Each integer moves into a <em>21-bit field</em>, three fields per uint64. Tinted cells show how many bits the worst case could use. There are <em>no guard bits</em>: before the run a domain gate checks <code>N ≤ L</code>, <code>vmax·N ≤ L</code> and <code>vmax²·N ≤ L</code> with <code>L = 2²¹ − 1</code>, so no field can ever reach its neighbour.",
      "Because the rating dimension is split across GPUs, each field's cross-GPU sum <em>is</em> the global total and stays inside the same bound. So <code>pack(a) + pack(b) == pack(a + b)</code>, and the packed words go straight into <code>ncclSum</code> over <code>ncclUint64</code>. The collective never sees the uncompressed form.",
      "Unpacking happens once, in the finalize kernel, after the reduction. Every field matches the direct sum. On the real fixtures the emulation test sums packed words at 1-, 2- and 3-way splits with <code>max_abs_diff = 0.0</code>: exact integer reconstruction under the checked bounds, not a floating-point byte comparison.",
    ];
    document.getElementById("cap").innerHTML = caps[step];
    if (step >= 2) wire();
    if (step >= 3) verify();
  }

  function wordRow(label, x, cls, delay) {
    const r = el("div", "wrow" + (cls ? " " + cls : ""));
    r.style.setProperty("--d", delay + "s");
    el("span", "", r).textContent = label;
    const bits = el("div", "bits", r);
    const s = x.toString(2).padStart(64, "0");
    for (let c = 0; c < 64; c++) {
      let k = "cell";
      if (c === 0) k += " x";
      else {
        if (c === 22 || c === 43) k += " fb";
        k += s[c] === "1" ? " one" : " used";
      }
      const cell = el("div", k, bits);
      cell.style.setProperty("--c", c);
    }
    return r;
  }
  function wire() {
    const g = document.getElementById("wgrid");
    g.innerHTML = "";
    for (let w = 0; w < 2; w++) {
      const box = el("div", "wbox", g);
      el("h3", "", box).textContent = `word${w} · ${w ? "Σx², Σy², Σxy" : "n, Σx, Σy"}`;
      const x = L.pack(a, w),
        y = L.pack(b, w);
      box.appendChild(wordRow("GPU 0", x, "", 0.05 + w * 0.1));
      el("div", "plus", box).textContent = "+  ncclSum · ncclUint64";
      box.appendChild(wordRow("GPU 1", y, "", 0.2 + w * 0.1));
      box.appendChild(wordRow("Σ", x + y, "sum", 0.4 + w * 0.1));
    }
  }
  function verify() {
    const tb = document.getElementById("vbody");
    tb.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const w = Math.floor(i / 3),
        k = i % 3,
        u = L.unpack(L.pack(a, w) + L.pack(b, w), k),
        d = a[i] + b[i];
      const tr = el("tr", "", tb);
      tr.style.setProperty("--r", i);
      tr.innerHTML = `<td>${NAMES[i]}</td><td>${a[i].toLocaleString()}</td><td>${b[i].toLocaleString()}</td><td>${d.toLocaleString()}</td><td>${u.toLocaleString()}</td><td class="ok"><span>${u === d ? "✓ exact" : "✗"}</span></td>`;
    }
  }

  function measure() {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    rowH = Math.round(root * 1.4);
    regW = reg.clientWidth || regW;
  }
  function go(next, animate = true) {
    step = next;
    layout(animate);
  }
  function reroll() {
    const k0 = 40 + Math.floor(Math.random() * 600),
      k1 = 40 + Math.floor(Math.random() * 600);
    a = stats(k0);
    b = stats(k1);
    fill();
    layout(false);
  }

  /* autoplay through the four steps */
  let timer = 0,
    progressStop = null;
  function stopPlay() {
    clearTimeout(timer);
    progressStop && progressStop();
    playBtn.setAttribute("aria-pressed", "false");
    playBtn.textContent = "▶ Play all steps";
    stepButtons.forEach((bt) => bt.style.removeProperty("--step-progress"));
  }
  function playFrom(i) {
    go(i);
    const bt = stepButtons[i];
    progressStop && progressStop();
    progressStop = M.tween({ duration: 3000, easing: M.ease.linear, onUpdate: (v) => bt.style.setProperty("--step-progress", v.toFixed(3)) });
    timer = setTimeout(() => {
      if (i < 3) playFrom(i + 1);
      else stopPlay();
    }, 3200);
  }
  playBtn.addEventListener("click", () => {
    if (playBtn.getAttribute("aria-pressed") === "true") return stopPlay();
    playBtn.setAttribute("aria-pressed", "true");
    playBtn.textContent = "■ Stop";
    playFrom(0);
  });
  stepButtons.forEach((bt) =>
    bt.addEventListener("click", () => {
      stopPlay();
      go(+bt.dataset.s);
    })
  );
  document.getElementById("next").addEventListener("click", () => {
    stopPlay();
    go(step === 3 ? 0 : step + 1);
  });
  document.getElementById("prev").addEventListener("click", () => {
    stopPlay();
    if (step > 0) go(step - 1);
  });
  document.getElementById("reroll").addEventListener("click", () => {
    stopPlay();
    reroll();
  });
  document.addEventListener("visibilitychange", () => document.hidden && stopPlay());

  measure();
  if ("ResizeObserver" in window)
    new ResizeObserver(() => {
      const before = regW;
      measure();
      if (Math.abs(before - regW) > 1) layout(false);
    }).observe(reg);
  reroll();
})();
