const assert = require("node:assert/strict");
const {
  pack,
  unpack,
  domainGate,
  compressionModel,
  breakEven,
  regimes,
  kv,
  kvRatio,
  quant,
  phaseSplit,
} = require("../assets/portfolio/lab-models.js");

/* ---------- packing (Multi-GPU Similarity Engine, pearson_contract §9) ---------- */
assert.ok(domainGate(1363, 5));
assert.ok(domainGate(83886, 5));
assert.equal(domainGate(83887, 5), false);
assert.equal(domainGate(-1, 5), false);
assert.equal(domainGate(1.5, 5), false);
assert.equal(domainGate(2 ** 53, 5), false);
assert.throws(() => pack([2097152, 0, 0], 0), RangeError);
assert.throws(() => pack([-1, 0, 0], 0), RangeError);

// Deterministic bounded property checks, including values near each field's limit.
let seed = 0x5eeda11;
function rand(n) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed % n;
}
for (let run = 0; run < 1000; run++) {
  const a = [],
    b = [];
  for (let i = 0; i < 6; i++) {
    a[i] = rand(2097152);
    b[i] = rand(2097152 - a[i]);
  }
  for (let word = 0; word < 2; word++) {
    const sum = pack(a, word) + pack(b, word);
    assert.equal(
      sum,
      pack(
        a.map((n, i) => n + b[i]),
        word
      )
    );
    for (let field = 0; field < 3; field++) assert.equal(unpack(sum, field), a[word * 3 + field] + b[word * 3 + field]);
  }
}

/* ---------- illustrative compression model ---------- */
const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
close(compressionModel(0.6, false, false, 0.2).total, 1);
close(compressionModel(0.6, true, false, 0).total, 0.6);
close(compressionModel(0.6, true, true, 0.1).total, 0.5);
assert.ok(compressionModel(0.05, true, false, 0.4).saving < 0);
for (let s = 0.05; s <= 0.95; s += 0.01) {
  close(compressionModel(s, false, false, 0).total, 1);
  assert.ok(compressionModel(s, true, true, 0).total <= compressionModel(s, true, false, 0).total);
  // compression stops paying exactly when the codec costs what the smaller transfer saves
  close(compressionModel(s, true, false, breakEven(s)).saving, 0);
  assert.ok(compressionModel(s, true, false, breakEven(s) + 0.01).saving < 0);
}
close(breakEven(0.4), 0.4 * (2 / 3));
close(breakEven(0.6, 1), 0);

/* ---------- recorded three-regime table (analysis.md) ---------- */
assert.deepEqual(
  Object.values(regimes).map((r) => r.share),
  [0.116, 0.76, 0.911]
);
assert.deepEqual(
  Object.values(regimes).map((r) => r.pack),
  [-0.047, -0.235, -0.555]
);
assert.deepEqual(
  Object.values(regimes).map((r) => r.async),
  [0.193, 0.097, -0.043]
);

/* ---------- BoundRelay (NOTE.md §2, b2_findings.md) ---------- */
close(kvRatio("serial"), 53.35 / 27.87);
close(kvRatio("pipeline"), 43.65 / 22.19);
close(kvRatio("overlay"), 62.9 / 130.0);
close(kvRatio("moosefs"), 354.6 / 563.1);
assert.ok(kvRatio("serial") > 1 && kvRatio("pipeline") > 1, "GPU-to-GPU paths are slower compressed");
assert.ok(kvRatio("overlay") < 1 && kvRatio("moosefs") < 1, "fsync writes are faster compressed");
assert.equal(kv.paired.length, 12);
kv.paired.forEach((p) => {
  assert.ok(p.ci[0] <= p.r && p.r <= p.ci[1], `${p.path} ${p.input}: point inside its interval`);
  if (p.path === "fsync") assert.ok(p.ci[1] < 1, `${p.input}: fsync interval below 1`);
  else assert.ok(p.ci[0] > 1, `${p.path} ${p.input}: GPU path interval above 1`);
});
["serial", "pipeline"].forEach((path) => {
  const rs = kv.paired.filter((p) => p.path === path).map((p) => p.r);
  close(Math.min(...rs), kv.paths[path].range[0]);
  close(Math.max(...rs), kv.paths[path].range[1]);
});
close(kv.cacheMB / kv.compressedMB, 3.02, 0.01);
assert.ok(kv.quality.k.dnll > 0 && kv.quality.k.ci[0] > 0, "K-only interval above zero");
assert.ok(kv.quality.v.dnll < 0 && kv.quality.v.ci[1] < 0, "V-only interval below zero");
assert.ok(kv.quality.kv.ci[1] < 0);

/* ---------- quantized inference (analysis.md phase split) ---------- */
for (const gpu of Object.keys(quant.configs))
  for (const [name, c] of Object.entries(quant.configs[gpu])) {
    if (!c.prefill) {
      assert.ok(c.alloc > quant.gpus[gpu].memory, `${gpu} ${name} is recorded as not fitting`);
      continue;
    }
    const split = phaseSplit(c);
    close(split.total, c.prefill + 5 * c.decode, 1e-9);
    // derived share agrees with the documented one to within rounding of the table
    assert.ok(Math.abs(split.prefillShare - c.share) < 0.005, `${gpu} ${name}: share ${split.prefillShare} vs ${c.share}`);
    assert.ok(c.alloc < quant.gpus[gpu].memory, `${gpu} ${name} fits`);
  }
close(quant.configs.t4.nf4_bf16_dq.e2e / quant.configs.t4.nf4_fp16_dq.e2e, 2.504, 0.001);
close(quant.configs.t4.nf4_bf16_dq.prefill / quant.configs.t4.nf4_fp16_dq.prefill, 4.42, 0.01);
close(quant.configs.a10.nf4_fp16_dq.decode / quant.configs.a10.fp16.decode, 1.69, 0.005);
close(quant.promptTokens / (quant.promptTokens + quant.outputTokens), 0.972, 0.001);

console.log(
  "PASS: packing gates, 1,000 exact-sum trials, compression model and break-even, three-regime table, BoundRelay and quantization datasets"
);
