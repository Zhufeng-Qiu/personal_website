---
layout: page
title: Distributed Apriori Mining on Yelp
description: Frequent-itemset mining on Hadoop MapReduce, two storage backends
img:
importance: 3
category: systems
github: https://github.com/Zhufeng-Qiu/cs6240
---

`Java` `Hadoop MapReduce` `HBase` `Hive` `AWS S3` &nbsp;·&nbsp; Feb.–May 2024 &nbsp;·&nbsp; Northeastern CS 6240

Identifying similar restaurants by treating co-reviewed businesses as frequent
itemsets, over ~550K Yelp reviews and ~15K businesses.

The pipeline decomposes into candidate generation, support counting, pruning,
and iterative frequent-itemset discovery, with Hive external tables preprocessing
raw JSON into per-user review baskets.

The part worth keeping: **two interchangeable storage backends for cross-pass
state**. An HBase path materializes each Apriori pass as its own table, loading
the previous pass's frequent itemsets to prune baskets before generating
k-combinations, and applying the support threshold at write time. A file-based
path writes each pass to HDFS/S3, with a runtime flag switching between local
directory traversal and S3 object listing to discover per-pass outputs.

---

<a href="https://github.com/Zhufeng-Qiu/cs6240" target="_blank">github.com/Zhufeng-Qiu/cs6240</a>
