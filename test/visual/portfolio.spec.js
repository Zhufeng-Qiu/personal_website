const { test, expect } = require("playwright/test");
const route = (baseURL, path = "") => new URL(path, `${baseURL.replace(/\/+$/, "")}/`).href;
const LAB_PATHS = ["lab/compression/", "lab/kv-transfer/", "lab/quantization/"];
const openAll = (page) => page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));

test("new home, original Academic, and contact routes", async ({ page, baseURL }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(route(baseURL));
  await expect(page.locator("h1")).toHaveText("Zhufeng(Zephyr) Qiu");
  await expect(page.locator(".work-row").first()).toContainText("BoundRelay");
  await expect(page.locator(".work-row")).toHaveCount(6);
  const sglang = page.locator(".work-row").nth(1);
  await expect(sglang).toContainText("SGLang-Omni");
  await expect(sglang).toContainText("PR open");
  await expect(sglang.getByRole("link", { name: /PR #2296/ })).toHaveAttribute("href", "https://github.com/sgl-project/sglang-omni/pull/2296");
  await expect(sglang.getByRole("link", { name: /Details/ })).toHaveCount(0);
  // one lab button per row is visible at any width (in the finding column, or under the date)
  const labButton = (row) => row.locator(".lab-cta:visible");
  await expect(labButton(page.locator(".work-row").first())).toHaveAttribute("href", /\/lab\/kv-transfer\/$/);
  await expect(labButton(page.locator(".work-row").first())).toContainText("Lab 02");
  await expect(labButton(page.locator(".work-row", { hasText: "Quantized" }))).toHaveAttribute("href", /\/lab\/quantization\/$/);
  await expect(labButton(page.locator(".work-row", { hasText: "Quantized" }))).toContainText("Project lab");
  // the hero keeps degrees only
  await expect(page.locator(".education-strip")).not.toContainText("4.0");
  // two labs: Lab 01 featured, Lab 02 mirrored with its KV race preview
  await expect(page.locator("#lab .lab-feature")).toHaveCount(2);
  await expect(page.locator("#lab .lab-feature").nth(1)).toContainText("Fewer bytes");
  // each lab names the project it comes from
  const origins = page.locator("#lab .lab-origin .project-chip");
  await expect(origins).toHaveCount(2);
  await expect(origins.nth(0)).toContainText("Multi-GPU Similarity Engine");
  await expect(origins.nth(0)).toHaveAttribute("href", /\/projects\/1_project\/$/);
  await expect(origins.nth(1)).toContainText("BoundRelay");
  await expect(origins.nth(1)).toHaveAttribute("href", /\/projects\/boundrelay\/$/);
  await expect(page.locator('[data-ratio="pipeline"]')).toHaveText("1.97×");
  await expect(page.locator('[data-ratio="moosefs"]')).toHaveText("1.59×");
  await expect(page.locator("#experience details")).toHaveCount(3);
  // education is shown flat: no disclosure widgets, coursework visible
  await expect(page.locator("#education details")).toHaveCount(0);
  await expect(page.locator("#education .education-row")).toHaveCount(3);
  await expect(page.locator("#education .chips li").first()).toBeVisible();
  await expect(page.locator("#education")).toContainText("Parallel Data Processing");
  await expect(page.locator("#education")).toContainText("Seattle");
  // an online course sits below the three degrees, not among them
  const extra = page.locator("#education .edu-extra");
  await expect(extra).toContainText("Operating Systems");
  await expect(extra).toContainText("Peking University, via Coursera");
  await expect(extra).toContainText("Sep 2026");
  await expect(extra.getByRole("link", { name: /Operating Systems/ })).toHaveAttribute(
    "href",
    "https://www.coursera.org/account/accomplishments/verify/2WP99RFQ88X4"
  );
  // habits are their own section 06
  await expect(page.locator("#life .eyebrow").first()).toContainText("06");
  await expect(page.locator("#life .habit")).toHaveCount(5);
  await page.locator("#experience summary").first().click();
  await expect(page.locator("#experience details").first()).toHaveAttribute("open", "");
  await expect(page.locator("#contact h2")).toContainText("Talk about research?");
  await expect(page.locator('#contact a[href="mailto:zhufqiu@gmail.com"]')).toHaveCount(2);
  await page.locator(".academic-link").click();
  await expect(page).toHaveURL(/\/academic\/$/);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("h1")).toContainText("Zhufeng");
  if (await page.locator(".navbar-toggler").isVisible()) await page.locator(".navbar-toggler").click();
  await page.getByRole("link", { name: "Interactive" }).click();
  await expect(page.locator(".hero")).toBeVisible();
  const paths = ["cv/", "projects/", "publications/", "habits/", "projects/boundrelay/", "assets/pdf/Zhufeng_Qiu_PhD_CV.pdf", ...LAB_PATHS];
  for (const path of [...paths, "lab/packing/", "lab/overlap/"]) {
    expect((await page.request.get(route(baseURL, path))).ok(), path).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test("hero switch and lab preview respond", async ({ page, baseURL }) => {
  await page.goto(route(baseURL));
  const toggle = page.locator("#payload-switch");
  await page.locator('.switch-side[data-side="raw"]').click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#payload-bytes")).toHaveText("48 B");
  await expect(page.locator("#payload-words")).toHaveText("6 × f64");
  await expect(page.locator("#gpu-canvas")).toHaveAttribute("aria-label", /raw/);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#payload-bytes")).toHaveText("16 B");
  await toggle.press("ArrowLeft");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "PCIe PHB", exact: true }).click();
  await expect(page.locator("[data-preview-share]")).toHaveText("91.1%");
  await expect(page.locator("[data-preview-gain]")).toHaveText("55.5%");
});

test("compression lab: recorded cards, the model, packing in view, two closed chapters", async ({ page, baseURL }) => {
  await page.goto(route(baseURL, "lab/compression/"));
  await expect(page.locator(".lab-tabs a")).toHaveCount(2);
  await expect(page.locator(".lab-heading .project-chip")).toHaveAttribute("href", /\/projects\/1_project\/$/);
  const nv = page.locator('[data-recorded="nv"]');
  await nv.scrollIntoViewIfNeeded();
  await expect(nv.locator("[data-result]")).toHaveText("4.7%");
  await expect(page.locator('[data-recorded="phb"] [data-result]')).toHaveText("55.5%");
  await nv.getByRole("button", { name: "packed 3×" }).click();
  await expect(nv.locator('[data-row="packed"]')).toHaveClass(/is-selected/);
  await page.locator("#model-share").fill("60");
  await expect(page.locator("#model-total")).toHaveText("60.0 units");
  await expect(page.locator("#model-saving")).toHaveText("40.0%");
  await page.locator("#model-packed").click();
  await expect(page.locator("#model-total")).toHaveText("100.0 units");
  await expect(page.locator("#lossless")).toBeVisible();
  await expect(page.locator("#lossless")).not.toHaveJSProperty("tagName", "DETAILS");
  await expect(page.locator("details.chapter")).toHaveCount(2);
  await expect(page.locator("details.chapter[open]")).toHaveCount(0);
});

test("encoding chapter: the break-even follows the model's share", async ({ page, baseURL }) => {
  await page.goto(route(baseURL, "lab/compression/"));
  await page.locator("#encoding > summary").click();
  await expect(page.locator("#encoding")).toHaveAttribute("open", "");
  await expect(page.locator("#codec-total")).toHaveText("83.3 units");
  await page.locator("#codec-cost").fill("30");
  await expect(page.locator("#codec-total")).toHaveText("103.3 units");
  await expect(page.locator("#codec-saving")).toHaveText("3.3%");
  await expect(page.locator("#codec-label")).toHaveText("more modeled time");
  await page.locator("#model-share").fill("60");
  await expect(page.locator("#codec-note")).toContainText("less than 40.0");
  await expect(page.locator("#codec-total")).toHaveText("90.0 units");
  await expect(page.locator("#codec-label")).toHaveText("less modeled time");
  await expect(page.locator("#encoding .bridge")).toHaveAttribute("href", /\/lab\/kv-transfer\/$/);
});

test("packing: the old URL lands on it, and all six sums stay exact", async ({ page, baseURL }) => {
  await page.goto(route(baseURL, "lab/packing/"));
  await expect(page).toHaveURL(/\/lab\/compression\/#lossless$/);
  await expect(page.locator("#lossless")).toBeInViewport();
  await expect(page.locator("#prev")).toBeDisabled();
  await page.locator("#next").click();
  await expect(page.locator("#pbytes")).toHaveText("16 B");
  await page.locator("#next").click();
  await expect(page.locator("#wire")).toBeVisible();
  await expect(page.locator("#wire .wrow")).toHaveCount(6);
  await page.locator("#next").click();
  await expect(page.locator("#vbody tr")).toHaveCount(6);
  for (let n = 0; n < 5; n++) {
    await expect(page.locator("#vbody .ok")).toHaveText(Array(6).fill("✓ exact"));
    await page.locator("#reroll").click();
  }
  await page.locator("#next").click();
  await expect(page.locator("#pbytes")).toHaveText("48 B");
  await page.locator("#play").click();
  await expect(page.locator("#play")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#play").click();
  await expect(page.locator("#play")).toHaveAttribute("aria-pressed", "false");
});

test("overlap chapter: three measured regimes, no interpolation", async ({ page, baseURL }) => {
  await page.goto(route(baseURL, "lab/overlap/"));
  await expect(page).toHaveURL(/\/lab\/compression\/#overlap$/);
  await expect(page.locator("#overlap")).toHaveAttribute("open", "");
  await expect(page.locator("#regimes .preset")).toHaveCount(3);
  await expect(page.locator("#ov-async")).toHaveText("+19.3%");
  await expect(page.locator("#ov-pack")).toHaveText("−4.7%");
  await expect(page.locator("#ov-ceil")).toHaveText("−11.6%");
  await page.locator('#regimes [data-value="sys"]').click();
  await expect(page.locator("#ov-async")).toHaveText("+9.7%");
  await expect(page.locator("#ov-ceil")).toHaveText("−24.0%");
  await expect(page.locator("#ov-verdict")).toContainText("finalize");
  await page.locator('#regimes [data-value="phb"]').click();
  await expect(page.locator("#ov-async")).toHaveText("−4.3%");
  await expect(page.locator("#ov-pack")).toHaveText("−55.5%");
  await expect(page.locator("#ov-ceil")).toHaveText("−8.9%");
  // the chart sits inside a <details>: it must still draw once scrolled into view
  await page.locator("#ov-chart").scrollIntoViewIfNeeded();
  await expect(page.locator("#ov-chart")).toHaveClass(/is-in/);
});

test("kv-transfer lab: two paths, and finished bars keep their measured proportions", async ({ page, baseURL }) => {
  await page.goto(route(baseURL, "lab/kv-transfer/"));
  await expect(page.locator(".lab-heading .project-chip")).toHaveAttribute("href", /\/projects\/boundrelay\/$/);
  const pipeline = page.locator('.race-group[data-path="pipeline"]');
  const moosefs = page.locator('.race-group[data-path="moosefs"]');
  await expect(pipeline.locator("[data-result]")).toHaveText("compressed 1.97× slower");
  await expect(moosefs.locator("[data-result]")).toHaveText("compressed 1.59× faster");
  await pipeline.scrollIntoViewIfNeeded();
  await expect(pipeline).toHaveClass(/is-done/, { timeout: 8000 });
  await moosefs.scrollIntoViewIfNeeded();
  await expect(moosefs).toHaveClass(/is-done/, { timeout: 8000 });
  await expect(pipeline.locator(".race-lane.raw [data-time]")).toHaveText("22.19 ms");
  await expect(moosefs.locator(".race-lane.cmp [data-time]")).toHaveText("354.6 ms");
  const widths = (group) => group.evaluate((g) => [...g.querySelectorAll(".race-fill")].map((f) => f.getBoundingClientRect().width));
  const [raw, cmp] = await widths(pipeline);
  expect(raw / cmp).toBeCloseTo(22.19 / 43.65, 2);
  const [raw2, cmp2] = await widths(moosefs);
  expect(cmp2 / raw2).toBeCloseTo(354.6 / 563.1, 2);
  await expect(pipeline.locator(".race-lane.raw")).toHaveClass(/is-winner/);
  await expect(moosefs.locator(".race-lane.cmp")).toHaveClass(/is-winner/);
  await expect(pipeline.locator("[data-note]")).toContainText("every 95% interval above 1");
  await expect(moosefs.locator("[data-note]")).toContainText("every 95% interval below 1");
  await page.locator('#kv-arm [data-value="v"]').click();
  await expect(page.locator("#q-ppl")).toHaveText("−2.74%");
  await expect(page.locator("#q-worse")).toHaveText("1 / 32");
  await expect(page.locator("#evidence")).not.toHaveAttribute("open");
  await page.locator("#evidence > summary").click();
  await expect(page.locator("#forest .forest-row")).toHaveCount(12);
  await page.locator("#forest").scrollIntoViewIfNeeded();
  await expect(page.locator("#forest")).toHaveClass(/is-in/);
  await page.locator("#host-staged > summary").click();
  await expect(page.locator("#peer-verdict")).toContainText("Both calls return cudaSuccess");
  await page.locator('[data-copy="peer"]').click();
  await expect(page.locator("#return-code")).toHaveClass(/show/);
  await expect(page.locator("#peer-verdict")).toContainText("zero");
  await expect(page.locator("#buf-dst .full")).toHaveCount(0);
  await page.locator('[data-copy="host"]').click();
  await expect(page.locator("#buf-dst .full")).toHaveCount(32);
});

test("quantization project lab: opens on the A10 and never shows stale numbers", async ({ page, baseURL }) => {
  await page.goto(route(baseURL, "lab/quantization/"));
  await expect(page.locator(".lab-tabs")).toHaveCount(0);
  await expect(page.locator(".lab-heading .project-chip")).toHaveAttribute("href", /\/projects\/2_project\/$/);
  await expect(page.locator(".lab-body > .lab-panel").first()).toHaveAttribute("id", "capacity-panel");
  await expect(page.locator('#gpu [data-value="a10"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#r-prefill")).toHaveText("123 ms");
  await expect(page.locator("#r-decode")).toHaveText("70.6 ms");
  await page.locator('#gpu [data-value="t4"]').click();
  await expect(page.locator("#configs .preset")).toHaveCount(5);
  await expect(page.locator("#r-prefill")).toHaveText("1335 ms");
  await expect(page.locator("#r-share")).toHaveText("72.6%");
  // switching into a configuration that does not fit, while numbers are still counting
  await page.locator('#configs [data-value="nf4_fp16_dq"]').click();
  await page.locator('#configs [data-value="fp16"]').click();
  await expect(page.locator("#gauge")).toHaveClass(/over/);
  await expect(page.locator("#gauge-value")).toContainText("does not fit");
  await page.waitForTimeout(1200);
  for (const id of ["req-total", "r-prefill", "r-decode", "r-share", "r-e2e"]) await expect(page.locator(`#${id}`)).toHaveText("—");
  await page.locator('#gpu [data-value="a10"]').click();
  await expect(page.locator("#configs .preset")).toHaveCount(4);
  await expect(page.locator("#gauge")).not.toHaveClass(/over/);
  await page.locator('#configs [data-value="fp16"]').click();
  await expect(page.locator("#r-decode")).toHaveText("41.8 ms");
  await page.locator('#split-mode [data-value="time"]').click();
  await expect(page.locator("#split-bar .a")).toHaveText("prefill 39.2%");
  await expect(page.locator(".lab-pager a")).toHaveCount(2);
});

test("keyboard, reduced motion, and bounded mobile layouts", async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(route(baseURL));
  await expect(page.locator("#hero-pause")).toHaveText("Motion reduced");
  await expect(page.locator("#hero-pause")).toBeDisabled();
  await expect(page.locator(".hero-intro")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["", ...LAB_PATHS]) {
      await page.goto(route(baseURL, path));
      await openAll(page);
      if (path.includes("compression")) await page.locator('[data-s="3"]').click();
      const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      expect(size.scroll, `${path} at ${width}px`).toBeLessThanOrEqual(size.width);
    }
  }
  // with motion reduced, the race is already finished and proportional
  await page.goto(route(baseURL, "lab/kv-transfer/"));
  await expect(page.locator('.race-group[data-path="pipeline"]')).toHaveClass(/is-done/);
  await expect(page.locator('.race-group[data-path="pipeline"] .race-lane.raw [data-time]')).toHaveText("22.19 ms");
  expect(errors).toEqual([]);
});
