/* Project lab (Quantized LLM inference): memory fit, a replayed request, and two findings. */
(() => {
  "use strict";
  const K = window.ZQKit,
    M = window.ZQMotion,
    L = window.ZQLab;
  const panel = document.getElementById("quant-panel");
  if (!panel || !K || !L) return;
  const Q = L.quant;
  const $ = (id) => document.getElementById(id);
  const ORDER = {
    t4: ["nf4_bf16_dq", "nf4_fp16_dq", "nf4_fp16_nodq", "int8", "fp16"],
    a10: ["fp16", "bf16", "nf4_fp16_dq", "nf4_bf16_dq"],
  };
  // one fixed time scale for every configuration: the slowest request fills the track
  const MAX = Math.max(
    ...Object.values(Q.configs).flatMap((g) =>
      Object.values(g)
        .filter((c) => c.prefill)
        .map((c) => L.phaseSplit(c).total)
    )
  );
  const REPLAY_MAX = 3600; // ms of animation for the slowest request
  // Opens on the A10 with NF4 weights: the configuration behind "capacity ≠ speed".
  let gpu = "a10",
    cfgKey = "nf4_fp16_dq";

  /* tokens */
  const tokensEl = $("tokens");
  const prompt = [],
    outputs = [];
  for (let i = 0; i < Q.promptTokens; i++) {
    const t = document.createElement("i");
    tokensEl.appendChild(t);
    prompt.push(t);
  }
  for (let i = 0; i < Q.outputTokens; i++) {
    const t = document.createElement("i");
    t.className = "out";
    tokensEl.appendChild(t);
    outputs.push(t);
  }

  /* request timeline blocks */
  const track = $("req-track");
  const pre = K.block(track, "prefill");
  const dec = Array.from({ length: Q.outputTokens }, () => K.block(track, "decode"));
  const head = $("req-head");
  let width = track.offsetWidth;
  if ("ResizeObserver" in window) new ResizeObserver(() => (width = track.offsetWidth)).observe(track);

  const geo = M.animator({ p: 0, d: 0 }, ({ p, d }) => {
    K.place(pre, 0, p / MAX);
    dec.forEach((b, k) => K.place(b, (p + k * d) / MAX + 0.0015, Math.max(0, d / MAX - 0.003)));
  });

  /* gauge */
  const gauge = $("gauge");
  const gaugeFill = gauge.querySelector(".gauge-fill");
  const gaugeView = M.animator({ f: 0, cap: 1 }, ({ f, cap }) => {
    gaugeFill.style.setProperty("--f", f.toFixed(4));
    $("gauge-cap").style.setProperty("--cap", cap.toFixed(4));
  });

  /* replay clock */
  let clock = 0,
    playing = true;
  const config = () => Q.configs[gpu][cfgKey];
  K.loop(panel, (dt) => {
    const c = config();
    if (!c.prefill) {
      head.style.opacity = "0";
      return;
    }
    const split = L.phaseSplit(c);
    const duration = (split.total / MAX) * REPLAY_MAX;
    if (dt && playing) clock += dt * 1000;
    if (clock > duration + 1400) clock = 0; // hold, then loop
    const t = K.reduced() ? split.total : Math.min(clock / duration, 1) * split.total; // request time in ms
    head.style.opacity = K.reduced() ? "0" : "1";
    head.style.transform = `translateX(${((t / MAX) * width).toFixed(1)}px)`;
    const inPrefill = t < c.prefill;
    const lit = inPrefill ? Math.floor((t / c.prefill) * Q.promptTokens) : Q.promptTokens;
    for (let i = 0; i < prompt.length; i++) prompt[i].classList.toggle("lit", i < lit);
    const done = inPrefill ? 0 : Math.min(Q.outputTokens, Math.floor((t - c.prefill) / c.decode + 1e-6));
    outputs.forEach((o, i) => o.classList.toggle("lit", i < done));
    pre.classList.toggle("is-active", inPrefill && t > 0);
    dec.forEach((b, k) => b.classList.toggle("is-active", !inPrefill && k === done && t < split.total));
  });

  const texts = {
    t4: {
      nf4_bf16_dq: [
        "The deployed configuration. bnb_4bit_compute_dtype = bfloat16 was copied from the Ampere training notebook onto a Turing T4, which has no bf16 tensor cores. Nothing errors; prefill just runs off the fast path at 3.2% of peak FLOPs. End to end it is 2.50× slower than the one-line fix.",
        true,
      ],
      nf4_fp16_dq: [
        "The one-line fix: the same 4-bit weights with fp16 compute. Prefill drops 4.42× (1335 → 302 ms) while decode barely moves (100.6 → 93.5 ms per step). Prefill is a GEMM that wants tensor cores; decode is a GEMV that does not care.",
        false,
      ],
      nf4_fp16_nodq: [
        "Double quantization costs 65.4 ms end to end, all of it in decode (80.1 → 93.5 ms per step, +16.7%), to save 0.35 GB. On a card where 4.5 GB already fits, dropping it is the better trade.",
        false,
      ],
      int8: ["int8 needs 9.27 GB and has the slowest decode here, 175.3 ms per step, even though its prefill is the fastest on this card.", true],
      fp16: [
        "Unquantized fp16 weights alone are 16.06 GB, and measured peak allocation is 16.22 GB, above the T4's 15.64 GB before any CUDA context. On this device 4-bit is the precondition for running at all.",
        true,
      ],
    },
    a10: {
      fp16: [
        "Unquantized on Ampere: 67.7 ms prefill and 41.8 ms per decode step, streaming weights at 64.1% of peak bandwidth. Fast, but it needs 16.22 GB.",
        false,
      ],
      bf16: [
        "The control. On Ampere, where bf16 tensor cores exist, bf16 and fp16 agree within 0.8% end to end. bf16 as a dtype is not the problem; bf16 on Turing is.",
        false,
      ],
      nf4_fp16_dq: [
        "NF4 on the same A10: 3.9× fewer weight bytes, yet decode takes 70.6 ms per step against fp16's 41.8, at 9.8% of peak bandwidth. Dequantization-bound, not bandwidth-bound: 4-bit buys capacity, not speed.",
        true,
      ],
      nf4_bf16_dq: [
        "NF4 with bf16 compute on Ampere costs 1.21× end to end over fp16 compute (507.8 vs 420.1 ms), a residual from the dequantize-then-GEMM path. On Turing, the same choice costs roughly another 2.9×.",
        true,
      ],
    },
  };

  const configsEl = $("configs");
  let cfgChoice = null;
  function renderConfigs() {
    configsEl.innerHTML = "";
    ORDER[gpu].forEach((key) => {
      const c = Q.configs[gpu][key];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "preset";
      b.dataset.value = key;
      b.innerHTML = `<b>${c.label}</b><small>${c.note || (c.prefill ? (L.phaseSplit(c).total / 1000 >= 1 ? (L.phaseSplit(c).total / 1000).toFixed(2) + " s" : L.phaseSplit(c).total.toFixed(0) + " ms") + " per request" : "")}</small>`;
      configsEl.appendChild(b);
    });
    cfgChoice = K.choice(configsEl, (v) => select(v));
  }

  function select(key) {
    cfgKey = key;
    cfgChoice.set(key, true);
    const c = config(),
      g = Q.gpus[gpu];
    const top = Math.max(g.memory, c.alloc) * 1.06;
    gaugeView.set({ f: c.alloc / top, cap: g.memory / top }, { duration: 900 });
    const over = c.alloc > g.memory;
    gauge.classList.toggle("over", over);
    $("gauge-value").textContent = `${c.alloc.toFixed(2)} GB${over ? " · does not fit" : ""}`;
    $("mem-note").textContent = `${c.alloc.toFixed(2)} of ${g.memory.toFixed(2)} GB`;
    clock = 0;
    if (c.prefill) {
      const split = L.phaseSplit(c);
      geo.set({ p: c.prefill, d: c.decode }, { duration: 900 });
      M.countTo($("req-total"), split.total, { decimals: 1, suffix: " ms", duration: 900 });
      M.countTo($("r-prefill"), c.prefill, { decimals: c.prefill < 100 ? 1 : 0, suffix: " ms", duration: 900 });
      M.countTo($("r-decode"), c.decode, { decimals: 1, suffix: " ms", duration: 900 });
      M.countTo($("r-share"), c.share * 100, { decimals: 1, suffix: "%", duration: 900 });
      M.countTo($("r-e2e"), c.e2e, { decimals: 1, suffix: " ms", duration: 900 });
      $("r-mfu").textContent = `${(c.mfu * 100).toFixed(1)}% of peak FLOPs`;
      $("r-bw").textContent = `${(c.bw * 100).toFixed(1)}% of peak bandwidth`;
      $("r-share").className = c.share > 0.5 ? "bad" : "";
      $("r-prefill").className = key === "nf4_bf16_dq" && gpu === "t4" ? "bad" : "";
    } else {
      geo.set({ p: 0, d: 0 }, { duration: 700 });
      // setText also stops a count still running from the previous configuration
      ["req-total", "r-prefill", "r-decode", "r-share", "r-e2e"].forEach((id) => M.setText($(id), "—"));
      $("r-share").className = "";
      $("r-prefill").className = "";
      $("r-mfu").textContent = "does not fit";
      $("r-bw").textContent = "does not fit";
      prompt.concat(outputs).forEach((t) => t.classList.remove("lit"));
    }
    const [text, bad] = texts[gpu][key];
    K.verdict($("q-verdict"), text, bad);
  }

  K.choice($("gpu"), (v) => {
    gpu = v;
    renderConfigs();
    select(gpu === "t4" ? "nf4_bf16_dq" : "nf4_fp16_dq");
  }).set(gpu, true);
  renderConfigs();
  select(cfgKey);
  $("replay").addEventListener("click", () => (clock = 0));

  /* tokens vs time */
  const split = $("split-bar");
  const [a, b] = split.querySelectorAll("i");
  const t4 = Q.configs.t4.nf4_fp16_dq;
  K.choice($("split-mode"), (v) => {
    if (v === "time") {
      a.style.flexGrow = (t4.share * 100).toFixed(1);
      b.style.flexGrow = ((1 - t4.share) * 100).toFixed(1);
      a.textContent = `prefill ${(t4.share * 100).toFixed(1)}%`;
      b.textContent = `5 decode steps ${((1 - t4.share) * 100).toFixed(1)}%`;
      $("split-caption").textContent = "By time, the five decode steps take 60.8%: each step streams the whole weight set again for one token.";
    } else {
      a.style.flexGrow = "97.2";
      b.style.flexGrow = "2.8";
      a.textContent = "prefill 97.2%";
      b.textContent = "2.8%";
      $("split-caption").textContent = "175 of 180 tokens are prompt tokens, processed together in one prefill pass.";
    }
  }).set("tokens", true);
  K.revealOnView($("ratio-bars"));
})();
