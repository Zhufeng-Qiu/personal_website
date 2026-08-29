---
layout: page
title: Quantized LLM Inference Study
description: What 4-bit actually costs, measured on Turing and Ampere
img:
importance: 2
category: systems
github: https://github.com/Zhufeng-Qiu/product_price_alerter_lora_model_study
---

`PyTorch` `CUDA` `PEFT/LoRA` `bitsandbytes` `Modal` &nbsp;·&nbsp; Jul.–Sep. 2025; Jul.–Aug. 2026

Serving an 8B model on a 16 GB T4 means quantizing it — fp16 weights alone are
16.1 GB. This measures what that choice costs, and whether the configuration
running in production was the right one.

The model is Llama 3.1 8B fine-tuned with QLoRA (rank 32 / α 64 on attention
projections — **27M trainable parameters, 0.34% of base**) under completion-only
supervision on a curated 400,000-item dataset, served 4-bit NF4 via Modal.

#### What came out of it

**The deployed configuration was 2.50× slower than it needed to be.** Its
`bnb_4bit_compute_dtype=bfloat16` had been copied from the training notebook
onto a T4 — Turing, with no bf16 tensor cores. Nothing errors; bf16 just
silently runs off the fast path. The penalty is localized entirely to prefill
(4.42×, MFU collapsing to 3.2%), and an unquantized fp16/bf16 control on Ampere
agreeing within 0.8% rules out bf16 itself as the cause.

**4-bit buys capacity, not speed.** NF4 decode runs 1.69× *slower* than fp16
while moving 3.9× fewer bytes, reaching 9.8% of peak bandwidth against fp16's
64.1% — dequantization-bound, not bandwidth-bound.

**97% of the tokens are prefill, but only 39% of the time is.** Decode costs
54× more per token. Token counts are a bad guide to where time goes.

Two negative results are kept in the record: the per-step timer found no
first-token cache-growth cost on the T4 at all, and 4-bit visibly changes the
model's predictions relative to fp16.

---

<a href="https://github.com/Zhufeng-Qiu/product_price_alerter_lora_model_study" target="_blank">github.com/Zhufeng-Qiu/product_price_alerter_lora_model_study</a>
