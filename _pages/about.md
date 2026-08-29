---
layout: about
title: about
permalink: /
subtitle: GPU systems · collective communication · high-performance LLM inference

profile:
  align: right
  image: prof_pic.jpg
  image_circular: false
  more_info: >
    <p>Seattle, WA</p>
    <p><a href="mailto:zhufqiu@gmail.com">zhufqiu@gmail.com</a></p>

selected_papers: false
social: true

announcements:
  enabled: false
  scrollable: true
  limit: 5

latest_posts:
  enabled: false
  scrollable: true
  limit: 3

_styles: |
  @media (min-width: 576px) {
    .profile {
      width: 20%;
      max-width: 168px;
    }
  }
  .profile img {
    max-width: 168px;
  }
---

Hello — I'm Zhufeng Qiu, and you can also call me **Zephyr**.

I hold an M.S. in Computer Science from **Northeastern University** (GPA 4.0),
an M.S. in Applied Data Science from **University of Southern California**, and a
B.S. in Geographical Information Science from **Wuhan University**. Before
returning to school I spent a year and a half at **NSFOCUS** building
Kafka/Elasticsearch security-data pipelines and Spark batch workflows serving
100+ enterprise clients at roughly 5M records a day, and I have since been a
teaching assistant for Algorithms and Parallel Data Processing at Northeastern.

I'm applying to **Ph.D. programs in HPC, ML systems, AI infrastructure, and
parallel computing**. If you'd like to talk about research or a possible
collaboration, email is the fastest way to reach me.

Most of my recent work is the same exercise repeated: take one computation,
implement it across every execution model I can reach — serial, threaded,
distributed, single-GPU, multi-GPU — hold the numerics exactly constant, and
find out what the hardware actually charges for each choice. The interesting
results are usually the ones that came out the wrong way round.

Two of them recently did. A lossless 3× compression of an NCCL `AllReduce`
payload bought **4% on NVLink and 55% on PCIe** — same binary, opposite
verdicts, because the regime decides and not the interconnect's name. And 4-bit
quantization of an 8B model turned out to buy *capacity, not speed*: NF4 decode
runs 1.69× **slower** than fp16 while moving a quarter of the bytes. Both are
written up in [projects](/projects/), with the code and raw measurements public.
