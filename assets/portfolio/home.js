/* Home page: the recorded-snapshot previews of Lab 01 and Lab 02. */
(() => {
  "use strict";
  if (!window.ZQLab) return;
  const M = window.ZQMotion;

  /* Lab 01: one iteration, compute against AllReduce */
  const preview = document.querySelector("[data-preview]");
  if (preview) {
    const bar = preview.querySelector(".share-bar");
    const canvas = preview.querySelector("[data-flow]");
    const shareOut = preview.querySelector("[data-preview-share]");
    const gainOut = preview.querySelector("[data-preview-gain]");
    const computeLabel = preview.querySelector("[data-preview-compute]");
    const commLabel = preview.querySelector("[data-preview-comm]");
    const head = document.createElement("span");
    head.className = "share-playhead";
    head.setAttribute("aria-hidden", "true");
    bar.appendChild(head);
    let barWidth = bar.offsetWidth;
    if ("ResizeObserver" in window) new ResizeObserver(() => (barWidth = bar.offsetWidth)).observe(bar);

    const flow =
      window.ZQFlow && canvas
        ? ZQFlow.mount(canvas, {
            share: ZQLab.regimes.nv.share,
            period: 3.2,
            onPhase: (u) => {
              head.style.transform = `translateX(${(u * barWidth).toFixed(1)}px)`;
            },
          })
        : null;

    const select = (key) => {
      const r = ZQLab.regimes[key];
      preview.querySelectorAll("[data-regime]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.regime === key)));
      bar.style.setProperty("--compute", (1 - r.share).toFixed(3));
      bar.style.setProperty("--comm", r.share.toFixed(3));
      bar.setAttribute("aria-label", `${r.short}: ${((1 - r.share) * 100).toFixed(1)}% compute, ${(r.share * 100).toFixed(1)}% communication`);
      computeLabel.textContent = `${((1 - r.share) * 100).toFixed(1)}% compute`;
      commLabel.textContent = `${(r.share * 100).toFixed(1)}% communication`;
      M.countTo(shareOut, r.share * 100, { decimals: 1, suffix: "%" });
      M.countTo(gainOut, -r.pack * 100, { decimals: 1, suffix: "%" });
      flow && flow.set({ share: r.share });
    };
    preview.querySelectorAll("[data-regime]").forEach((b) => b.addEventListener("click", () => select(b.dataset.regime)));
    select("nv");
  }

  /* Lab 02: the same KV cache on two paths; bars are scaled to each path's slower arm */
  const kvPreview = document.querySelector("[data-kv-preview]");
  if (kvPreview) {
    const ms = (v) => v.toFixed(v < 100 ? 2 : 1) + " ms";
    kvPreview.querySelectorAll("[data-path]").forEach((group) => {
      const p = ZQLab.kv.paths[group.dataset.path];
      const slow = Math.max(p.raw, p.compressed);
      [
        ["raw", p.raw],
        ["cmp", p.compressed],
      ].forEach(([arm, value]) => {
        const row = group.querySelector(`.kv-bar.${arm}`);
        row.style.setProperty("--f", (value / slow).toFixed(4));
        row.querySelector("[data-arm]").textContent = `${arm === "raw" ? "raw" : "compressed"} · ${ms(value)}`;
      });
      const r = ZQLab.kvRatio(group.dataset.path);
      const out = kvPreview.querySelector(`[data-ratio="${group.dataset.path}"]`);
      out.textContent = (r > 1 ? r : 1 / r).toFixed(2) + "×";
      out.classList.toggle("bad", r > 1);
    });
  }
})();
