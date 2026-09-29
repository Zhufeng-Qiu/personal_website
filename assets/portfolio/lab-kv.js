/* Lab 02 (BoundRelay): raw vs compressed KV-cache movement on two paths, K/V quality,
 * and two chapters: the paired forest plot and the peer-copy observation. Every number
 * comes from ZQLab.kv. */
(() => {
  "use strict";
  const K = window.ZQKit,
    M = window.ZQMotion,
    L = window.ZQLab;
  if (!document.getElementById("race-panel") || !K || !L) return;
  const KV = L.kv;
  const $ = (id) => document.getElementById(id);
  const fmt = (v, d = 2) => v.toFixed(d);

  /* ---------- race: two paths at once, each scaled to its slower arm ---------- */
  // Every bar grows at the same pace on a shared clock, so the faster arm stops first and
  // the finished bars keep the measured proportions.
  const RACE_MS = 3000; // time for a full-length bar
  const ms = (v) => v.toFixed(v < 100 ? 2 : 1) + " ms";
  const pairedPath = { serial: "serial", pipeline: "pipeline", moosefs: "fsync" };
  const raceGroups = [...document.querySelectorAll("#races .race-group")].map((el) => {
    const key = el.dataset.path;
    const p = KV.paths[key];
    const slow = Math.max(p.raw, p.compressed);
    const r = p.compressed / p.raw;
    const lanes = [
      ["raw", p.raw],
      ["cmp", p.compressed],
    ].map(([arm, value]) => {
      const lane = el.querySelector(`.race-lane.${arm}`);
      return { lane, arm, value, f: value / slow, time: lane.querySelector("[data-time]") };
    });
    el.querySelector("[data-tick]").style.setProperty("--x", (p.raw / KV.ratio / slow).toFixed(4));
    const result = el.querySelector("[data-result]");
    result.textContent = r > 1 ? `compressed ${fmt(r)}× slower` : `compressed ${fmt(1 / r)}× faster`;
    result.className = "race-result " + (r > 1 ? "bad" : "good");
    const pairs = KV.paired.filter((x) => x.path === pairedPath[key]);
    const side = pairs.every((x) => x.ci[0] > 1) ? "above" : pairs.every((x) => x.ci[1] < 1) ? "below" : "";
    if (p.pooled && side)
      el.querySelector("[data-note]").textContent =
        `Paired round: pooled R = ${fmt(p.pooled)} over ${pairs.length} inputs, every 95% interval ${side} 1.`;
    return { el, slow, lanes, winner: r > 1 ? "raw" : "cmp" };
  });
  function draw(g, t) {
    g.lanes.forEach((l) => {
      const f = Math.min(t, l.f);
      l.lane.style.setProperty("--f", f.toFixed(4));
      l.time.textContent = ms(t >= l.f ? l.value : f * g.slow);
      l.lane.classList.toggle("is-racing", t > 0 && t < l.f);
      l.lane.classList.toggle("is-winner", t >= l.f && l.arm === g.winner);
    });
    g.el.classList.toggle("is-done", t >= 1);
  }
  function race(g) {
    g.stop && g.stop();
    g.stop = M.tween({ duration: RACE_MS, easing: M.ease.linear, onUpdate: (t) => draw(g, t) });
  }
  raceGroups.forEach((g) => draw(g, K.reduced() ? 1 : 0));
  K.verdict(
    $("kv-verdict"),
    `Same cache, same 3.02× fewer bytes, opposite signs. Between GPUs, encoding and decoding cost more than the smaller transfer saves: the stage-sum model predicted ${KV.model.predicted} ms for the compressed pipeline, and it measured ${KV.model.measured}. On the durable write the saved bytes win, but by 1.59×, not 3.02×: at 77.7 MB the write gets 0.55× the throughput it gets at 234.9 MB.`,
    false
  );
  $("race-again").addEventListener("click", () => raceGroups.forEach(race));
  // Each path starts when its own lanes are on screen, so neither race finishes unseen.
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          race(raceGroups.find((g) => g.el === e.target));
        }),
      { threshold: 0.6 }
    );
    raceGroups.forEach((g) => io.observe(g.el));
  } else raceGroups.forEach(race);

  /* ---------- forest plot ---------- */
  const forest = $("forest");
  const lo = Math.log(0.4),
    hi = Math.log(12);
  const X = (r) => ((Math.log(r) - lo) / (hi - lo)) * 100;
  const groups = [
    { key: "serial", label: "GPU → GPU · serial", pooled: KV.paths.serial.pooled },
    { key: "pipeline", label: "GPU → GPU · pipeline", pooled: KV.paths.pipeline.pooled },
    { key: "fsync", label: "fsync write · MooseFS", pooled: KV.paths.moosefs.pooled },
  ];
  let row = 0;
  groups.forEach((g) => {
    const head = document.createElement("div");
    head.className = "forest-group";
    head.innerHTML = `<span>${g.label}</span><span></span><output>pooled R ${fmt(g.pooled)}</output>`;
    forest.appendChild(head);
    KV.paired
      .filter((p) => p.path === g.key)
      .forEach((p) => {
        const cls = p.r > 1 ? "slower" : "faster";
        const a = X(p.ci[0]),
          b = X(p.ci[1]),
          x = X(p.r);
        const el = document.createElement("div");
        el.className = "forest-row";
        el.style.setProperty("--delay", (row++ * 0.07).toFixed(2) + "s");
        el.innerHTML = `<span>${p.input}</span><div class="forest-track"><span class="one" style="left:${X(1)}%"></span><span class="ci ${cls}" style="left:${a}%;width:${b - a}%;--origin:${((x - a) / Math.max(0.001, b - a)) * 100}%"></span><span class="pt ${cls}" style="left:${x}%"></span></div><output>${fmt(p.r)} [${fmt(p.ci[0])}, ${fmt(p.ci[1])}]</output>`;
        el.title = `${g.label}, ${p.input}: R = ${fmt(p.r, 3)}, 95% CI [${fmt(p.ci[0], 3)}, ${fmt(p.ci[1], 3)}]`;
        forest.appendChild(el);
      });
  });
  const axis = $("forest-axis");
  [0.5, 1, 2, 4, 8].forEach((t) => {
    const s = document.createElement("span");
    s.style.left = X(t) + "%";
    s.textContent = t === 1 ? "R = 1" : t + "×";
    if (t === 1) s.className = "one-label";
    axis.appendChild(s);
  });
  K.revealOnView(forest);

  /* ---------- K / V quality ---------- */
  const grid = $("kv-grid");
  const cells = [];
  ["K · keys", "V · values"].forEach((label, row) => {
    const name = document.createElement("span");
    name.className = "kv-name";
    name.textContent = label;
    grid.appendChild(name);
    for (let i = 0; i < 16; i++) {
      const c = document.createElement("i");
      c.className = row === 0 ? "k" : "v";
      c.style.setProperty("--k", i);
      grid.appendChild(c);
      cells.push(c);
    }
  });
  const ci = $("ci-chart");
  const arms = ["k", "v", "kv"];
  const qmin = -0.036,
    qmax = 0.028;
  const QX = (v) => ((v - qmin) / (qmax - qmin)) * 100;
  const ciRows = arms.map((key, i) => {
    const q = KV.quality[key];
    const r = document.createElement("div");
    r.className = "ci-row";
    r.style.top = i * 3 + "rem";
    r.innerHTML = `<span>${q.label}</span><div class="ci-track"><span class="zero" style="left:${QX(0)}%"></span><span class="interval" style="left:${QX(q.ci[0])}%;width:${QX(q.ci[1]) - QX(q.ci[0])}%"></span><span class="point" style="left:${QX(q.dnll)}%"></span></div>`;
    ci.appendChild(r);
    return r;
  });
  const articles = $("articles");
  const dots = [];
  for (let i = 0; i < KV.articles; i++) {
    const d = document.createElement("i");
    d.style.setProperty("--k", i);
    articles.appendChild(d);
    dots.push(d);
  }
  const signed = (v, d) => (v > 0 ? "+" : "−") + Math.abs(v).toFixed(d);
  function showArm(key) {
    const q = KV.quality[key];
    cells.forEach((c, i) => c.classList.toggle("is-compressed", key === "kv" || (key === "k" ? i < 16 : i >= 16)));
    ciRows.forEach((r, i) => r.classList.toggle("is-selected", arms[i] === key));
    dots.forEach((d, i) => d.classList.toggle("worse", i < q.worse));
    $("q-payload").textContent = q.payload.toFixed(3) + "×";
    M.countTo($("q-ppl"), q.ppl * 100, { decimals: 2, suffix: "%", sign: true, duration: 700 });
    $("q-ppl").className = q.ppl > 0 ? "bad" : "good";
    $("q-dnll").textContent = `ΔNLL ${signed(q.dnll, 4)}, CI [${signed(q.ci[0], 4)}, ${signed(q.ci[1], 4)}]`;
    $("q-worse").textContent = `${q.worse} / ${KV.articles}`;
    const texts = {
      k: `Compressing only the keys raised perplexity by 1.56%, and 26 of 32 held-out articles got worse. The interval sits entirely above zero; the development set had said the same thing on disjoint articles.`,
      v: `Compressing only the values, at nearly the same payload (0.667× vs 0.664×), did not raise mean NLL: −2.74% perplexity, 1 of 32 articles worse. Observed twice, explained neither time.`,
      kv: `Compressing both ships 0.330× the bytes. On average the value effect outweighs the key effect: −1.33% perplexity, with 11 of 32 articles worse. An average over articles, not a promise about any one of them.`,
    };
    K.verdict($("q-verdict"), texts[key], q.ppl > 0);
  }
  const armChoice = K.choice($("kv-arm"), (v) => showArm(v));
  armChoice.set("k", true);
  showArm("k");

  /* ---------- peer copy ---------- */
  const src = $("buf-src"),
    dst = $("buf-dst");
  const srcCells = [],
    dstCells = [];
  for (let i = 0; i < 32; i++) {
    const a = document.createElement("i");
    a.className = "full";
    const hue = 250 + ((i * 37) % 60) - 20;
    a.style.setProperty("--h", hue);
    a.style.setProperty("--k", i);
    src.appendChild(a);
    srcCells.push(a);
    const b = document.createElement("i");
    b.style.setProperty("--h", hue);
    b.style.setProperty("--k", i);
    dst.appendChild(b);
    dstCells.push(b);
  }
  const code = $("return-code"),
    kind = $("copy-kind");
  K.verdict($("peer-verdict"), "Run each copy. Both calls return cudaSuccess; only one of them moves the data.", false);
  document.querySelectorAll("[data-copy]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const peer = btn.dataset.copy === "peer";
      document.querySelectorAll("[data-copy]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      dstCells.forEach((c) => c.classList.remove("full"));
      code.classList.remove("show");
      kind.textContent = peer ? "cudaMemcpyPeer" : "D2H → H2D";
      setTimeout(
        () => {
          code.classList.add("show");
          if (!peer) dstCells.forEach((c) => c.classList.add("full"));
          K.verdict(
            $("peer-verdict"),
            peer
              ? "cudaSuccess, and every destination word is still zero. Nothing raised, nothing warned: a KV transfer built this way hands the receiver a tensor of the right shape and dtype, filled with zeros."
              : "Through host memory the same bytes arrive intact. This is why every transport number in this lab is host-staged.",
            peer
          );
        },
        K.reduced() ? 0 : 450
      );
    })
  );
})();
