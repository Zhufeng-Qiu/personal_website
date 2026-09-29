/* Lab 01: recorded NVLink / PCIe PHB iterations, the illustrative model, and two of the
 * deeper chapters: overlap across the three recorded regimes, and the codec break-even.
 * The lossless-packing chapter is driven by lab-packing.js. */
(() => {
  "use strict";
  const K = window.ZQKit,
    M = window.ZQMotion,
    L = window.ZQLab;
  if (!K || !M || !L) return;
  const $ = (id) => document.getElementById(id);

  /* ---------- recorded cards ---------- */
  document.querySelectorAll("[data-recorded]").forEach((card) => {
    const r = L.regimes[card.dataset.recorded];
    const s = r.share;
    const packedTotal = 1 + r.pack;
    const rows = {
      f64: card.querySelector('[data-row="f64"]'),
      packed: card.querySelector('[data-row="packed"]'),
    };
    const totals = { f64: 1, packed: packedTotal };
    const bars = {};
    Object.entries(rows).forEach(([key, row]) => {
      const track = row.querySelector(".track");
      bars[key] = {
        row,
        track,
        compute: track.querySelector(".blk.compute"),
        comm: track.querySelector(".blk.comm, .blk.packed"),
        head: track.querySelector(".playhead"),
        width: track.offsetWidth,
      };
      if ("ResizeObserver" in window) new ResizeObserver(() => (bars[key].width = track.offsetWidth)).observe(track);
    });
    // grow the bars in when the card first appears
    const grow = M.animator({ k: 0 }, ({ k }) => {
      K.place(bars.f64.compute, 0, (1 - s) * k);
      K.place(bars.f64.comm, (1 - s) * k, s * k);
      K.place(bars.packed.compute, 0, (1 - s) * k);
      K.place(bars.packed.comm, (1 - s) * k, (packedTotal - (1 - s)) * k);
    });
    const result = card.querySelector("[data-result]");
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      grow.set({ k: 1 }, { duration: 1300 });
      M.countTo(result, -r.pack * 100, { from: 0, decimals: 1, suffix: "%", duration: 1600 });
    };
    if ("IntersectionObserver" in window && !K.reduced()) {
      const io = new IntersectionObserver(
        (e) => {
          if (e[0].isIntersecting) {
            start();
            io.disconnect();
          }
        },
        { threshold: 0.3 }
      );
      io.observe(card);
    } else start();

    // one iteration race: both rows share a clock; the shorter one finishes first
    const period = 2.9;
    let u = 0;
    K.loop(card, (dt) => {
      if (dt) u = (u + dt / period) % 1.3;
      Object.entries(bars).forEach(([key, b]) => {
        const pos = Math.min(u, totals[key]);
        b.head.style.transform = `translateX(${(pos * b.width).toFixed(1)}px)`;
        b.head.style.opacity = K.reduced() ? "0" : "1";
        b.row.classList.toggle("is-done", u >= totals[key]);
        const inCompute = pos < 1 - s && u < totals[key];
        b.compute.classList.toggle("is-active", inCompute);
        b.comm.classList.toggle("is-active", !inCompute && u < totals[key]);
      });
    });

    const flow = window.ZQFlow ? ZQFlow.mount(card.querySelector("[data-flow]"), { share: s, period: 2.9 }) : null;
    const choice = K.choice(card.querySelector("[data-payload]"), (value) => {
      const packed = value === "packed";
      rows.f64.classList.toggle("is-selected", !packed);
      rows.packed.classList.toggle("is-selected", packed);
      flow && flow.set({ packed, commScale: packed ? (packedTotal - (1 - s)) / s : 1 });
    });
    choice.set("f64", true);
  });

  const share = $("model-share");
  if (!share) return;
  const timing = (mode) => (mode === "instant" ? { instant: true } : { duration: mode === "drag" ? 280 : 700 });

  /* ---------- chapter 03: the codec break-even, at the model's communication share ---------- */
  const codec = (() => {
    const input = $("codec-cost");
    if (!input) return { update() {} };
    const paint = K.styleRange(input);
    const base = { compute: K.block($("codec-base"), "compute"), comm: K.block($("codec-base"), "comm") };
    const sel = {
      compute: K.block($("codec-sel"), "compute"),
      cost: K.block($("codec-sel"), "cost"),
      comm: K.block($("codec-sel"), "comm packed"),
    };
    const end = $("codec-end"),
      mark = $("break-mark"),
      max = Number(input.max) / 100;
    const view = M.animator({ s: 0.4, h: 0.1 }, ({ s, h }) => {
      const compute = 1 - s,
        comm = s / 3;
      const scale = 1 / Math.max(1, compute + h + comm);
      K.place(base.compute, 0, compute * scale);
      K.place(base.comm, compute * scale, s * scale);
      K.place(sel.compute, 0, compute * scale);
      K.place(sel.cost, compute * scale, h * scale);
      K.place(sel.comm, (compute + h) * scale, comm * scale);
      end.style.setProperty("--x", scale.toFixed(4));
    });
    function update(mode) {
      const s = Number(share.value) / 100,
        h = Number(input.value) / 100;
      const m = L.compressionModel(s, true, false, h);
      const even = L.breakEven(s, 3);
      const units = (v) => (v * 100).toFixed(1);
      $("codec-output").textContent = input.value + " units";
      view.set({ s, h }, timing(mode));
      M.countTo($("codec-total"), m.total * 100, { decimals: 1, suffix: " units", duration: 600 });
      M.countTo($("codec-saving"), Math.abs(m.saving) * 100, { decimals: 1, suffix: "%", duration: 600 });
      const flat = Math.abs(m.saving) < 0.0005;
      $("codec-label").textContent = flat ? "change, at break-even" : m.saving > 0 ? "less modeled time" : "more modeled time";
      $("codec-saving").classList.toggle("bad", !flat && m.saving < 0);
      mark.style.setProperty("--x", Math.min(1, even / max).toFixed(4));
      mark.classList.toggle("off", even > max);
      $("codec-note").textContent =
        `At a ${share.value}% communication share, 3× fewer bytes save ${units(even)} units of transfer, ` +
        `so compression pays while encoding costs less than ${units(even)}.`;
    }
    input.addEventListener("input", () => update("drag"));
    paint();
    return { update };
  })();

  /* ---------- illustrative model ---------- */
  const packedBtn = $("model-packed");
  const paintShare = K.styleRange(share);
  const b = {
    baseCompute: K.block($("base-sm"), "compute"),
    baseComm: K.block($("base-nccl"), "comm"),
    compute: K.block($("sel-sm"), "compute"),
    comm: K.block($("sel-nccl"), "comm"),
  };
  const view = M.animator({ s: 0.4, packed: 1 }, (v) => {
    const compute = 1 - v.s;
    const comm = v.s / (1 + 2 * v.packed); // 3× when packed
    K.place(b.baseCompute, 0, compute);
    K.place(b.baseComm, compute, v.s);
    K.place(b.compute, 0, compute);
    K.place(b.comm, compute, comm);
    b.comm.classList.toggle("packed", v.packed > 0.5);
  });

  function update(mode) {
    const s = Number(share.value) / 100;
    const packed = packedBtn.getAttribute("aria-pressed") === "true";
    const m = L.compressionModel(s, packed, false, 0);
    $("share-output").textContent = share.value + "%";
    view.set({ s, packed: packed ? 1 : 0 }, timing(mode));
    M.countTo($("model-total"), m.total * 100, { decimals: 1, suffix: " units", duration: 700 });
    M.countTo($("model-saving"), m.saving * 100, { decimals: 1, suffix: "%", duration: 700 });
    $("saving-label").textContent = m.saving > 0.0001 ? "less modeled time" : "change in modeled time";
    $("model-caption").textContent = "Your configuration · " + (packed ? "3× packed" : "f64");
    $("sel-sm").setAttribute("aria-label", `Selected: ${(m.total * 100).toFixed(1)} normalized units, versus 100 for the baseline`);
    codec.update(mode);
  }
  share.addEventListener("input", () => update("drag"));
  packedBtn.addEventListener("click", () => {
    packedBtn.setAttribute("aria-pressed", String(packedBtn.getAttribute("aria-pressed") !== "true"));
    update();
  });
  update("instant");
  paintShare();

  /* ---------- chapter 02: overlap at the three recorded regimes ---------- */
  const regimesEl = $("regimes");
  const chart = $("ov-chart");
  if (!regimesEl || !chart) return;
  const R = L.regimes,
    P = Object.entries(R);
  P.forEach(([k, r]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset";
    btn.dataset.value = k;
    btn.innerHTML = `<b>${r.short}</b><span>${(r.share * 100).toFixed(1)}% communication</span>`;
    regimesEl.appendChild(btn);
  });

  const w = 900,
    h = 320,
    pl = 58,
    pr = 26,
    pt = 28,
    pb = 44;
  const X = (s) => pl + s * (w - pl - pr);
  const Y = (v) => pt + ((0.25 - v) / 0.85) * (h - pt - pb);
  let svg = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Recorded iteration-time changes against communication share. Packed 3× synchronous: −4.7, −23.5, −55.5 percent. f64 async overlap: +19.3, +9.7, −4.3 percent. At 11.6, 76.0 and 91.1 percent communication. Dashed: the ideal overlap ceiling."><g class="grid">`;
  [-0.6, -0.4, -0.2, 0, 0.2].forEach((v) => {
    svg += `<line x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 0 ? "zero" : ""}"/><text x="${pl - 10}" y="${Y(v) + 4}" font-size="12" text-anchor="end">${v > 0 ? "+" : ""}${Math.round(v * 100)}%</text>`;
  });
  svg += "</g>";
  [0, 0.25, 0.5, 0.75, 1].forEach((x) => (svg += `<text x="${X(x)}" y="${h - pb + 20}" font-size="12" text-anchor="middle">${x * 100}%</text>`));
  svg += `<text x="${(pl + w - pr) / 2}" y="${h - 6}" font-size="12" text-anchor="middle">COMMUNICATION SHARE (f64 sync)</text>`;
  svg += `<text x="${w - pr}" y="${Y(0.21)}" font-size="12" text-anchor="end">↑ slower</text><text x="${w - pr}" y="${Y(-0.56)}" font-size="12" text-anchor="end">↓ faster</text>`;
  let ceiling = "";
  for (let i = 0; i <= 100; i++) ceiling += (i ? "L" : "M") + X(i / 100).toFixed(1) + "," + Y(-Math.min(i / 100, 1 - i / 100)).toFixed(1);
  svg += `<path d="${ceiling}" fill="none" stroke="#6f6b78" stroke-dasharray="4 5"/>`;
  svg += `<text x="${X(0.5)}" y="${Y(-0.5) + 20}" font-size="12" text-anchor="middle">ideal ceiling</text>`;
  const series = (key) => P.map(([, r], i) => (i ? "L" : "M") + X(r.share) + "," + Y(r[key])).join("");
  svg += `<path class="series" pathLength="1000" style="--len:1000" d="${series("pack")}" stroke="#b9a3f1" stroke-opacity=".55"/>`;
  svg += `<path class="series" pathLength="1000" style="--len:1000" d="${series("async")}" stroke="#e7b67c" stroke-opacity=".55"/>`;
  svg += `<line class="ov-cursor" x1="${X(R.nv.share)}" x2="${X(R.nv.share)}" y1="${pt}" y2="${h - pb}" stroke="#8b6fd9" stroke-opacity=".7"/>`;
  P.forEach(([k, r]) => {
    svg += `<circle class="dot" data-k="${k}" cx="${X(r.share)}" cy="${Y(r.pack)}" r="5" fill="#b9a3f1" stroke="#16171b" stroke-width="2"/>`;
    svg += `<circle class="dot" data-k="${k}" cx="${X(r.share)}" cy="${Y(r.async)}" r="5" fill="#e7b67c" stroke="#16171b" stroke-width="2"/>`;
    svg += `<text x="${X(r.share)}" y="${Y(Math.max(r.async, r.pack)) - 14}" font-size="12" text-anchor="middle" data-label="${k}">${r.short}</text>`;
  });
  svg += "</svg>";
  chart.innerHTML = svg;
  K.revealOnView(chart);
  const cursor = chart.querySelector(".ov-cursor");
  let cursorX = X(R.nv.share),
    cursorStop = null;

  const verdicts = {
    nv: [
      "NVLink: only 11.6% of the iteration is communication, so overlap could hide at most 11.6%. Splitting the AllReduce into chunks added launch latency on a link that was already fast, and async made the iteration 19.3% slower. Packing saved 4.7%.",
      true,
    ],
    sys: [
      "PCIe SYS: the highest ceiling of the three, 24.0%, yet async took 9.7% longer in this snapshot. Later traces found GPU 0's finalize running on the communication stream; moving it changed the result. Packing saved 23.5%.",
      true,
    ],
    phb: [
      "PCIe PHB: the lowest ceiling of the three, 8.9%, yet the only async win, 4.3% less time: chunking barely changes a bandwidth-bound collective. Packing saved 55.5%. When bytes dominate, fewer bytes win by far.",
      false,
    ],
  };
  const pct = { decimals: 1, suffix: "%", sign: true, duration: 600 };
  function selectRegime(k) {
    const r = R[k];
    M.countTo($("ov-share"), r.share * 100, { decimals: 1, suffix: "%", duration: 600 });
    M.countTo($("ov-ceil"), -Math.min(r.share, 1 - r.share) * 100, pct);
    M.countTo($("ov-async"), r.async * 100, pct);
    M.countTo($("ov-pack"), r.pack * 100, pct);
    $("ov-async").className = r.async > 0 ? "bad" : "good";
    $("ov-pack").className = r.pack < 0 ? "good" : "bad";
    cursorStop && cursorStop();
    cursorStop = M.tween({
      from: cursorX,
      to: X(r.share),
      duration: 550,
      onUpdate: (x) => {
        cursorX = x;
        cursor.setAttribute("x1", x.toFixed(1));
        cursor.setAttribute("x2", x.toFixed(1));
      },
    });
    chart.querySelectorAll(".dot").forEach((d) => d.setAttribute("r", d.dataset.k === k ? 8 : 5));
    chart.querySelectorAll("[data-label]").forEach((t) => t.setAttribute("fill", t.dataset.label === k ? "#eeece6" : "#a4a0ad"));
    K.verdict($("ov-verdict"), verdicts[k][0], verdicts[k][1]);
  }
  K.choice(regimesEl, selectRegime).set("nv");
})();
