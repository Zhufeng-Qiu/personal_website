---
layout: page
title: Multi-GPU Similarity Engine
description: Lossless collective compression and communication–computation overlap
img:
importance: 1
category: systems
github: https://github.com/Zhufeng-Qiu/restaurant_recomendation_engine_study
---

`C++` `CUDA` `NCCL` `MPI` `OpenMP` `PySpark` `CMake` `Nsight Systems` &nbsp;·&nbsp; Aug. 2026

One Pearson-similarity kernel, five backends, one frozen numerical contract.
A Yelp collaborative-filtering workload was pulled out of Spark and
re-implemented across serial C++, OpenMP, MPI, single-GPU CUDA, and dual-GPU
NCCL — and every backend reproduces the reference similarities **bit-exactly**
(`max |diff| = 0.0`) at every thread, rank, GPU and chunk count.

#### What came out of it

**1.17M candidate pairs in 4.21 ms** on two A100s — 312× over serial, ~20× over
16-thread OpenMP.

**The AllReduce payload compresses 3× losslessly**, 56.2 → 18.8 MB. The six
sufficient statistics are secretly small integers (the ratings behind them are
1–5 stars), so they pack into two `uint64` words with carry-free 21-bit fields.
Because no field can carry into its neighbour, `pack(a) + pack(b) == pack(a+b)`
— NCCL sums the packed words **in compressed form, without ever decompressing**.
Unpacking happens once, in the finalize kernel.

**The same compression buys 4% on NVLink and 55% on PCIe.** Running the
identical binary on both, communication is 11% of the iteration on one and 91%
on the other. Compression pays when the collective is the bottleneck, and the
second half of that sentence is the part usually left out.

**Overlap has a ceiling of `min(compute, comm)/total`.** Nsight traces show the
async pipeline hides ~90% of the compute it possibly could, yet still loses its
A/B on NVLink — because chunking makes the collective itself 6.5× more expensive
on a link whose transfer time was already negligible. Overlap pays when compute
and communication are *comparable*, not when communication is large. That
corrects the project's own original hypothesis.

Along the way a chunk-size sweep exposed a real double-buffering race: a
slot-free event recorded before the finalize kernel that reads the slot.

---

<a href="https://github.com/Zhufeng-Qiu/restaurant_recomendation_engine_study" target="_blank">github.com/Zhufeng-Qiu/restaurant_recomendation_engine_study</a>
