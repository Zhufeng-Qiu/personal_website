---
layout: page
title: BoundRelay — LLM KV-Cache Compression and Transfer Study
description: Held-out K/V quality measurements and end-to-end compression/transfer benchmarks
importance: 0
category: systems
github: https://github.com/Zhufeng-Qiu/bound_relay_study
permalink: /projects/boundrelay/
---

`Python` `PyTorch` `CUDA` `cuSZp` `SZ3` `CUDA zfp` &nbsp;·&nbsp; Aug.–Sep. 2026

When does compressing an LLM's KV cache actually help? BoundRelay measures
compression quality, payload size, and end-to-end movement of Qwen3-1.7B caches.
The codec is a controlled variable; the question is what the complete path costs.

#### What came out of it

**Keys and values have different compression sensitivity.** On 32 held-out
WikiText-2 articles, at similar payload sizes, K-only compression raised mean
teacher-forced NLL by **0.0155 (95% CI [+0.0068, +0.0235])**, while V-only
compression did not. The direction replicated an earlier result on disjoint
development articles.

**Smaller payloads helped writes, but slowed GPU-to-GPU transfers.** Across
**360 paired prepared-cache comparisons**, approximately 3× payload compression
cut fsync-acknowledged write time by **26–49%**, but increased pipelined,
host-staged GPU-to-GPU transfer time to **1.52–2.33× the raw baseline**.

**A successful CUDA return code did not guarantee a successful copy.** On all
three rented multi-GPU pods tested, peer-to-peer copies reported CUDA success
without transferring data. Host-staged transport was used instead. This is an
observed failure on those machines, not a diagnosis of its cause or a claim about
all CUDA peer copies.

**Separately measured stage costs did not add up to the pipeline cost.** Stages
measured on the actual cache and hardware predicted **21.43 ms**; the complete
pipeline took **43.65 ms**. Per-tensor overhead and payload-dependent bandwidth
were sources of prediction error.

#### Reproducibility and limits

The benchmark covers **1,152 tensor observations**, with recorded model/codec
revisions and binary hashes, frozen evaluation inputs and tolerances, and a
versioned corrections register. Code, measurements, and the research note are
available in the repository.

The held-out quality round carries a recorded protocol deviation: 2 of 3,584
tensors exceeded the predeclared error tolerance, and the stop rule was relaxed
mid-round. The result is reported with that limitation, not as a passed numerical
contract. These measurements do not establish generality beyond the tested model,
corpus, and hardware.

---

[Code and measurements](https://github.com/Zhufeng-Qiu/bound_relay_study)
· [Research note](https://github.com/Zhufeng-Qiu/bound_relay_study/blob/main/NOTE.md)
