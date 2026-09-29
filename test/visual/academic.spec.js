const { test, expect } = require("playwright/test");

const siteURL = (baseURL, path) => new URL(path, `${baseURL.replace(/\/+$/, "")}/`).href;

test("CV keeps research dates aligned and BoundRelay first", async ({ page, baseURL }) => {
  await page.goto(siteURL(baseURL, "cv/"));
  const rows = page.locator(".cv .list-group-item");
  const mapping = rows.filter({ hasText: "Web-Based Dynamic Thematic Mapping Technologies" });
  await expect(mapping.locator(".badge")).toHaveText("2018");
  await expect(mapping.locator(".location")).toContainText("SinoMaps Press, Beijing");
  const pm = rows.filter({ hasText: "PM2.5 Inversion and Spatiotemporal Analysis" });
  await expect(pm.locator(".badge")).toHaveText("2016 - 2017");

  const dateEdges = await page.locator(".cv .date-column .badge").evaluateAll((badges) => badges.map((badge) => badge.getBoundingClientRect().left));
  expect(Math.max(...dateEdges) - Math.min(...dateEdges)).toBeLessThan(2);

  const projects = page.locator(".cv > .card").filter({ has: page.getByRole("heading", { name: "Projects", exact: true }) });
  const first = projects.locator(".list-group-item").first();
  await expect(first.locator("h6")).toContainText("BoundRelay");
  await expect(first.locator(".badge")).toHaveText(/Aug 2026\s*– Sep 2026/i);
  await expect(first).toContainText("95% CI [+0.0068, +0.0235]");
  await expect(first).toContainText("all three rented multi-GPU pods");
  await expect(first.locator("table:not(.table-cv)")).toHaveCount(0);
  const second = projects.locator(".list-group-item").nth(1);
  await expect(second.locator("h6")).toContainText("SGLang-Omni — Open-source Contribution");
  await expect(second.locator(".badge")).toHaveText(/Sep 2026/i);
  await expect(second.locator('a[href="https://github.com/sgl-project/sglang-omni/pull/2296"]').first()).toBeVisible();
  await expect(second).toContainText("30-second English audio admission");

  const experience = page.locator(".cv > .card").filter({ has: page.getByRole("heading", { name: "Experience", exact: true }) });
  const teaching = experience.locator(".list-group-item").filter({ hasText: "Teaching Assistant" });
  await expect(teaching.locator(".badge")).toHaveText("2024 - 2025");
  await expect(teaching.locator("li")).toHaveText([/Parallel Data Processing \(Jan–May 2025\)/, /Algorithms \(Jan–May 2024\)/]);

  // a 2026 online course has its own dated section, not a line under a 2025 degree
  const education = page.locator(".cv > .card").filter({ has: page.getByRole("heading", { name: "Education", exact: true }) });
  await expect(education).not.toContainText("Coursera");
  const coursework = page.locator(".cv > .card").filter({ has: page.getByRole("heading", { name: "Additional Coursework", exact: true }) });
  await expect(coursework.locator(".list-group-item")).toHaveCount(1);
  await expect(coursework.locator(".badge")).toHaveText(/Sep 2026/i);
  await expect(coursework.getByRole("link", { name: /Operating Systems/ })).toHaveAttribute(
    "href",
    "https://www.coursera.org/account/accomplishments/verify/2WP99RFQ88X4"
  );

  const pdf = page.locator('.post-header a[href$="Zhufeng_Qiu_PhD_CV.pdf"]');
  const response = await page.request.get(await pdf.getAttribute("href"));
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/pdf");
});

test("BoundRelay preserves project actions and its qualification", async ({ page, baseURL }) => {
  await page.goto(siteURL(baseURL, "projects/"));
  const first = page.locator(".projects .card").first();
  await expect(first.locator(".card-title")).toContainText("BoundRelay");
  await expect(first.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/Zhufeng-Qiu/bound_relay_study");
  await first.getByRole("link", { name: "Details" }).click();
  await expect(page).toHaveURL(/\/projects\/boundrelay\/$/);
  await expect(page.locator("article")).toContainText("Aug.–Sep. 2026");
  await expect(page.locator("article")).toContainText("recorded protocol deviation");
  await page.locator(".project-back").getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
});

test("CV and project pages fit the viewport", async ({ page, baseURL }) => {
  for (const route of ["cv/", "projects/", "projects/boundrelay/", "projects/8_project/"]) {
    const response = await page.goto(siteURL(baseURL, route));
    expect(response.ok()).toBeTruthy();
    const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    expect(size.content).toBeLessThanOrEqual(size.viewport);
    if (route === "projects/8_project/") {
      await expect(page.locator("article")).toContainText("SinoMaps Press, Beijing");
      await expect(page.locator("article")).not.toContainText("Mar.–May 2018");
    }
  }
});
