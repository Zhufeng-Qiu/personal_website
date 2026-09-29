/* Recorded data and pure helpers shared by the home page, the labs and the tests.
 * Every number here is copied from the named source document; nothing is measured in
 * the visitor's browser. Update a table only together with its source note.
 */
(function (root) {
  "use strict";

  /* Multi-GPU Similarity Engine: docs/analysis.md, "A third regime: PCIe with P2P".
   * One historical table only; do not mix with the later README/claim-ledger runs.
   * Percent changes are in iteration time, relative to f64 synchronous execution. */
  const regimes = {
    nv: { name: "NVLink NV12", short: "NVLink", share: 0.116, pack: -0.047, async: 0.193 },
    sys: { name: "PCIe SYS · P2P", short: "PCIe SYS", share: 0.76, pack: -0.235, async: 0.097 },
    phb: { name: "PCIe PHB · host-staged", short: "PCIe PHB", share: 0.911, pack: -0.555, async: -0.043 },
  };

  function compressionModel(share, packed, overlap, overhead) {
    const compute = 1 - share;
    const comm = share / (packed ? 3 : 1);
    const extra = packed ? overhead : 0;
    const total = (overlap ? Math.max(compute, comm) : compute + comm) + extra;
    return { compute, comm, extra, total, saving: 1 - total };
  }
  /* The codec cost at which compressing by `ratio` stops paying: the transfer time it saves. */
  function breakEven(share, ratio = 3) {
    return share * (1 - 1 / ratio);
  }

  const fieldBits = 21n;
  const fieldLimit = (1n << fieldBits) - 1n;
  function pack(stats, word) {
    let result = 0n;
    for (let k = 0; k < 3; k++) {
      const value = BigInt(stats[word * 3 + k]);
      if (value < 0n || value > fieldLimit) throw new RangeError("Statistic exceeds its 21-bit field");
      result |= value << (BigInt(k) * fieldBits);
    }
    return result;
  }
  function unpack(word, field) {
    return Number((word >> (BigInt(field) * fieldBits)) & fieldLimit);
  }
  function domainGate(n, vmax) {
    if (!Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(vmax) || vmax < 0) return false;
    const count = BigInt(n),
      rating = BigInt(vmax);
    return count <= fieldLimit && rating * count <= fieldLimit && rating * rating * count <= fieldLimit;
  }

  /* BoundRelay: NOTE.md §2 ("Where compression pays") and §4 (held-out K/V quality);
   * paired round: results/public/protocol_2026_09_17/b2_findings.md.
   * One 234.9 MB Qwen3-1.7B cache (56 tensors), cuSZp fixed, c = 0.10, 3.02× fewer bytes.
   * The single-run ms arms were measured at different moments on a shared machine; the
   * paired round (360 back-to-back pairs, 2×A40 PXB, MooseFS for fsync) fixes the sign. */
  const kv = {
    cacheMB: 234.9,
    compressedMB: 77.7,
    ratio: 3.02,
    paths: {
      serial: {
        name: "Host-staged, serial",
        short: "GPU → GPU · serial",
        kind: "gpu",
        raw: 27.87,
        compressed: 53.35,
        pooled: 3.137,
        range: [2.096, 6.147],
      },
      pipeline: {
        name: "Host-staged, 7-stage pipeline",
        short: "GPU → GPU · pipeline",
        kind: "gpu",
        raw: 22.19,
        compressed: 43.65,
        pooled: 1.848,
        range: [1.522, 2.326],
      },
      overlay: {
        name: "Container overlay, fsync offload write",
        short: "Offload · overlay fsync",
        kind: "disk",
        raw: 130.0,
        compressed: 62.9,
        pooled: null,
        range: null,
      },
      moosefs: {
        name: "MooseFS, fsync offload write",
        short: "Offload · MooseFS fsync",
        kind: "disk",
        raw: 563.1,
        compressed: 354.6,
        pooled: 0.637,
        range: [0.508, 0.743],
      },
    },
    paired: [
      { input: "d00 · 1024", path: "serial", r: 3.471, ci: [3.312, 3.706] },
      { input: "d00 · 2048", path: "serial", r: 2.096, ci: [2.04, 2.159] },
      { input: "d01 · 1024", path: "serial", r: 6.147, ci: [3.85, 11.123] },
      { input: "d01 · 2048", path: "serial", r: 2.165, ci: [2.109, 2.229] },
      { input: "d00 · 1024", path: "pipeline", r: 2.145, ci: [1.932, 2.306] },
      { input: "d00 · 2048", path: "pipeline", r: 1.535, ci: [1.463, 1.667] },
      { input: "d01 · 1024", path: "pipeline", r: 2.326, ci: [2.236, 2.44] },
      { input: "d01 · 2048", path: "pipeline", r: 1.522, ci: [1.479, 1.574] },
      { input: "d00 · 1024", path: "fsync", r: 0.657, ci: [0.566, 0.749] },
      { input: "d00 · 2048", path: "fsync", r: 0.664, ci: [0.48, 0.969] },
      { input: "d01 · 1024", path: "fsync", r: 0.743, ci: [0.686, 0.802] },
      { input: "d01 · 2048", path: "fsync", r: 0.508, ci: [0.47, 0.554] },
    ],
    model: { predicted: 21.43, measured: 43.65 },
    breakEven: { model: 3.82, pipelined: 5.38 },
    quality: {
      k: { label: "K only", payload: 0.664, dnll: 0.0155, ci: [0.0068, 0.0235], ppl: 0.0156, worse: 26 },
      v: { label: "V only", payload: 0.667, dnll: -0.0278, ci: [-0.032, -0.0234], ppl: -0.0274, worse: 1 },
      kv: { label: "K + V", payload: 0.33, dnll: -0.0134, ci: [-0.0235, -0.0042], ppl: -0.0133, worse: 11 },
    },
    articles: 32,
  };
  function kvRatio(path) {
    const p = kv.paths[path];
    return p.compressed / p.raw;
  }

  /* Quantized LLM inference: docs/analysis.md, "Prefill / decode split" and "Backend
   * comparison". Batch 1, 175 prompt tokens, 5 generated tokens. `phaseTotal` is the
   * phase-split decomposition (prefill + 5 decode steps), not the end-to-end p50; `share` is
   * the documented prefill share of time from the same table. */
  const quant = {
    promptTokens: 175,
    outputTokens: 5,
    gpus: {
      t4: { name: "Tesla T4", arch: "Turing · SM 7.5", memory: 15.64, bf16Cores: false },
      a10: { name: "NVIDIA A10", arch: "Ampere · SM 8.6", memory: 23.68, bf16Cores: true },
    },
    configs: {
      t4: {
        nf4_bf16_dq: {
          label: "NF4 · bf16 compute",
          note: "deployed",
          e2e: 1706.9,
          prefill: 1335.1,
          decode: 100.6,
          share: 0.726,
          alloc: 6.1,
          mfu: 0.032,
          bw: 0.129,
        },
        nf4_fp16_dq: {
          label: "NF4 · fp16 compute",
          note: "one-line fix",
          e2e: 681.7,
          prefill: 302.1,
          decode: 93.5,
          share: 0.392,
          alloc: 5.98,
          mfu: 0.143,
          bw: 0.138,
        },
        nf4_fp16_nodq: {
          label: "NF4 · no double quant",
          note: "",
          e2e: 616.3,
          prefill: 302.2,
          decode: 80.1,
          share: 0.43,
          alloc: 6.33,
          mfu: 0.143,
          bw: 0.176,
        },
        int8: { label: "int8", note: "", e2e: 1028.4, prefill: 263.9, decode: 175.3, share: 0.233, alloc: 9.27, mfu: 0.164, bw: 0.143 },
        fp16: { label: "fp16 · unquantized", note: "does not fit", fits: false, alloc: 16.22 },
      },
      a10: {
        fp16: { label: "fp16 · unquantized", note: "", e2e: 248.7, prefill: 67.7, decode: 41.8, share: 0.243, alloc: 16.22, mfu: 0.332, bw: 0.641 },
        bf16: {
          label: "bf16 · unquantized",
          note: "control",
          e2e: 250.8,
          prefill: 67.6,
          decode: 42.0,
          share: 0.241,
          alloc: 16.22,
          mfu: 0.333,
          bw: 0.637,
        },
        nf4_fp16_dq: {
          label: "NF4 · fp16 compute",
          note: "",
          e2e: 420.1,
          prefill: 123.3,
          decode: 70.6,
          share: 0.259,
          alloc: 5.98,
          mfu: 0.182,
          bw: 0.098,
        },
        nf4_bf16_dq: {
          label: "NF4 · bf16 compute",
          note: "",
          e2e: 507.8,
          prefill: 189.0,
          decode: 77.2,
          share: 0.328,
          alloc: 6.1,
          mfu: 0.119,
          bw: 0.089,
        },
      },
    },
  };
  function phaseSplit(config) {
    const decodeTotal = config.decode * quant.outputTokens;
    const total = config.prefill + decodeTotal;
    return { total, decodeTotal, prefillShare: config.prefill / total };
  }

  const model = Object.freeze({ regimes, compressionModel, breakEven, pack, unpack, domainGate, kv, kvRatio, quant, phaseSplit });
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  else root.ZQLab = model;
})(typeof window !== "undefined" ? window : globalThis);
