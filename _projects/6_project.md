---
layout: page
title: Yelp Recommendation System
description: The original recommender — and the starting point of the multi-GPU study
img:
importance: 6
category: systems
---

`PySpark` `MinHash/LSH` `collaborative filtering` &nbsp;·&nbsp; Sep.–Dec. 2020 &nbsp;·&nbsp; USC INF 553 / CSCI 596

A Yelp recommendation pipeline built on Spark RDDs: MinHash/LSH candidate
generation, TF-IDF content-based recommendation, and item- and user-based
collaborative filtering with Pearson similarity.

This is where the [Multi-GPU Similarity Engine](/projects/1_project/) came from.
Revisiting it years later from a systems perspective — separating the
compute-intensive similarity evaluation from the application pipeline, then
asking how the same workload maps onto different execution backends — turned a
course project into a controlled study of CPU, distributed-memory, and
multi-GPU execution. End-to-end RMSE 0.8652, against the archived Spark model's
0.8657.
