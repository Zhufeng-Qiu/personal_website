# Interactive portfolio

The dark portfolio is the default home at `/`. The original al-folio About page is
at `/academic/`; its CV, project, publication, habits, and PDF URLs are unchanged.
The academic navigation includes an **Interactive** link back to `/`.

## Ownership and content

- `_layouts/portfolio.liquid` is a standalone site-local layout. Its CSS and JavaScript
  are loaded only by the portfolio and lab pages, never by the academic layout. Each
  page lists its own scripts in front matter (`scripts: [...]`); `lab-models.js` and
  `motion.js` load everywhere.
- `_pages/portfolio.html` is the home: hero, 01 Selected work, 02 Lab, 03 Experience,
  04 Education, 05 Correspondence, 06 Away from the keyboard. Selected work, the lab
  list, and the habit cards come from `_data/portfolio.yml`; experience, education
  (degree, GPA, coursework), and email reuse `_data/cv.yml`. The five habit sentences
  mirror `_pages/habits.md`; keep the two in step.
- Two labs make up the series: `_pages/lab-compression.html` (`/lab/compression/`,
  Lab 01) and `_pages/lab-kv.html` (`/lab/kv-transfer/`, Lab 02). Each answers one
  question on its first screen and keeps deeper material in `<details class="chapter">`
  sections that are closed by default. Each lab page and each home lab feature names
  the project it comes from (`_includes/portfolio-lab-origin.liquid`, from the lab's
  `project` field), and each Selected work row with a lab has a “Try it live” button. Tabs and the previous/next pager are generated
  from `site.data.portfolio.labs` by `_includes/portfolio-lab-tabs.liquid` and
  `_includes/portfolio-lab-pager.liquid`.
- `_pages/lab-quantization.html` (`/lab/quantization/`) is a project lab outside the
  series: no tabs, reached from the Quantized LLM Inference work row, with a pager to
  both labs.
- `_pages/lab-packing.html` and `_pages/lab-overlap.html` only redirect the old URLs to
  Lab 01's `#lossless` section and `#overlap` chapter; a link to a chapter's id opens it.
- `assets/portfolio/` contains dependency-free browser code and styles:

  | File            | Role                                                                                                                                                                                    |
  | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `portfolio.css` | tokens, fluid scale, header, home sections, lab scaffolding                                                                                                                             |
  | `labs.css`      | lab panels, controls, transform-driven timelines, charts                                                                                                                                |
  | `motion.js`     | reveal on scroll, header progress, section indicator, hover spotlights, magnetic buttons, animated accordions, tween/count-up helpers, opening the `<details>` a `#id` link points into |
  | `hero.js`       | the GPU ↔ GPU canvas and its RAW/PACKED switch                                                                                                                                          |
  | `flow.js`       | the small compute → AllReduce iteration canvas (home preview, Lab 01)                                                                                                                   |
  | `home.js`       | the Lab 01 and Lab 02 previews on the home page                                                                                                                                         |
  | `lab-kit.js`    | shared lab helpers: timeline blocks, on-screen loops, choice groups                                                                                                                     |
  | `lab-models.js` | all recorded data and pure functions; also loaded by the Node tests                                                                                                                     |
  | `lab-*.js`      | one file per lab; Lab 01 also loads `lab-packing.js` for its lossless-packing chapter                                                                                                   |

  The GPU illustration is drawn locally; it does not load an image, WebGL engine, or
  GPU service.

- `_includes/header.liquid` is the only existing academic template changed. Its
  reviewed override is recorded in `.al-folio-overrides.yml`.

No deploy workflow changes are needed: Jekyll emits both editions into the existing
Pages output. Merely building or serving locally does not publish the changes.

## Scale and motion

The root font size is fluid and every size is in `rem`, so the whole portfolio scales
from one value. Phones get 16 px, easing to 13 px by 1000 px wide; laptops get 13 px
(chosen to match how the previous, larger scale looked at 50% browser zoom); very wide
monitors grow back to 16 px. Content is capped at `80rem` (1040 px at 13 px).

Timelines move blocks with `transform` driven by JavaScript tweens rather than CSS
`left`/`width` transitions. Canvas and lab loops run only while their element is on
screen and the tab is visible. `prefers-reduced-motion` disables continuous
animation, reveals, tweens, and the hero intro; every number is still shown.

## Lab provenance and boundaries

Every lab states its source and limits on the page. All numbers live in
`lab-models.js`; update a table only together with its vintage and qualifications.

**Lab 01, Multi-GPU Similarity Engine**
([restaurant_recomendation_engine_study](https://github.com/Zhufeng-Qiu/restaurant_recomendation_engine_study)).
One historical table from the “A third regime: PCIe with P2P” section in
`docs/analysis.md`: communication shares 11.6 / 76.0 / 91.1%, packed iteration-time
reductions 4.7 / 23.5 / 55.5%, and async iteration-time changes +19.3 / +9.7 / −4.3%.
These are not the later README headline measurements. The hosts used comparable
builds, not a verified identical binary. PCIe numbers predate warp packing; the +9.7%
SYS result predates the finalize-stream fix.

- **First screen:** recorded NVLink and PHB cards, then an illustrative model with one
  share slider and a compression switch. With baseline 1, communication share `s`, and
  ratio `r`, synchronous time is `(1-s) + s/r`. The model has no latency, bandwidth
  curve, or contention. In the recorded cards the packed total is measured; its
  compute/communication split is schematic.
- **How is it lossless?** Shown in full after the model (`#lossless`), not in a
  chapter. Simulated 1–5-star ratings use the real 21-bit
  packing layout and domain gate from `docs/pearson_contract.md` §§9–10. JavaScript
  BigInt preserves uint64 arithmetic. The demo verifies integer sums, not GPU
  execution. The documented `max_abs_diff = 0.0` is not described as a floating-point
  byte check.
- **Chapter 01, Can overlap help?** Only the three measured configurations, as presets
  and as dots against the ideal ceiling `min(compute, comm) / total`. Nothing is
  interpolated; the lines only join the dots.
- **Chapter 02, What if encoding isn't free?** The same model with an encode + decode
  cost `h` added; compression pays while `h < s(1 - 1/r)` (`breakEven` in
  `lab-models.js`). Illustrative, and linked to Lab 02 for a measured codec.

48 → 16 bytes/pair and 56.2 → 18.7 MB describe AllReduce **input representation**,
not observed network-wire bytes.

**Lab 02, BoundRelay**
([bound_relay_study](https://github.com/Zhufeng-Qiu/bound_relay_study)). The race
shows two single-run paths from NOTE.md §2 at once: the 7-stage GPU → GPU pipeline
(22.19 / 43.65 ms) and the MooseFS fsync write (563.1 / 354.6 ms), the two paths whose
sign the paired round also measured. Each path is scaled to its slower arm; bars grow
at the same pace and keep the measured proportions when they stop. The dashed tick is
a bytes-only prediction (raw time ÷ 3.02). The serial and overlay paths are cited in
the fine print. The forest plot is the paired 2026-09-17 round
(`results/public/protocol_2026_09_17/b2_findings.md`: 12 configurations, R with 95% CI,
2× A40, fsync on MooseFS), in the “Evidence & uncertainty” chapter. K/V quality is
NOTE.md §4 on 32 held-out articles, with its recorded protocol deviation stated on the
page. The peer-copy panel (“Why host-staged?”) illustrates an observation on three
rented pods; it is characterised, not diagnosed.

**Project lab, Quantized LLM inference**
([product_price_alerter_lora_model_study](https://github.com/Zhufeng-Qiu/product_price_alerter_lora_model_study)).
`docs/analysis.md` “Backend comparison” and “Prefill / decode split”. The page leads
with the A10 fp16-against-NF4 comparison its title states, and the replay opens on the
A10 with NF4 weights. The replayed request is the phase-split decomposition, prefill +
5 × decode step; the end-to-end p50 from `generate()` is shown beside it and is not the
same quantity. The fp16 weight-byte ratio (16.06 vs 4.14 GB) is arithmetic; decode
times and bandwidth utilization are measured.

## Local development and verification

Use Ruby 3.3.5 (`.ruby-version`) rather than macOS's system Ruby. From this repository:

```sh
bundle exec jekyll serve --host 127.0.0.1 --port 4000
node test/portfolio-models.cjs
npx playwright test --config test/visual/portfolio.config.js
```

The portfolio test config targets the domain-root preview at port 4000. Set
`BASE_URL` for another URL, or `BROWSER_EXECUTABLE` to use an existing browser
instead of a Playwright browser download. The implementation was checked using an
external preview override that disables unrelated external blog imports and
notebook/example pages. Production continues using the unchanged content plugins and
the existing deployment workflow.

`test/portfolio-models.cjs` covers 1,000 bounded integer-sum trials, the recorded
tables (including that every paired BoundRelay interval sits on the expected side of
1 and that derived prefill shares match the documented ones), and the model and
break-even arithmetic. The Playwright suite covers the home sections, old routes/PDF,
the redirects into Lab 01's chapters, the hero switch, both labs and every chapter,
the project lab (including that switching to a configuration that does not fit leaves
no numbers from the previous one), keyboard use, reduced motion, and no horizontal
overflow at widths 320, 390, 768, 1024, and 1440 with every chapter open. No JavaScript is required to read the
portfolio, academic edition, or source notes.
