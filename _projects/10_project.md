---
layout: page
title: Train Ticket Flash-Sale System
description: High-concurrency ticketing under Spring Cloud
img:
importance: 10
category: web
github: https://github.com/Zhufeng-Qiu/train_flash_sale
---

`Java` `Spring Boot 3` `Spring Cloud` `Redis` `RocketMQ` `MySQL` `Vue 3` &nbsp;·&nbsp; Jan.–Sep. 2025

A microservices ticketing platform built for the "100,000 people, 1,000 tickets"
problem. Spring Cloud Alibaba throughout — Nacos for registry and config, Seata
for distributed transactions, Sentinel for rate limiting, Gateway and Feign for
inter-service calls.

Inventory control is Redis-based with distributed locks and Lua scripts for
atomic deduction; RocketMQ decouples request handling from downstream order
creation and shapes traffic. Idempotency and consistency mechanisms guard against
duplicate purchases, overselling, and retry-related failures. Quartz generates
train schedules on a daily batch. Dual Vue 3 frontends for users and admins, plus
a FreeMarker-based code generator for CRUD scaffolding.

---

<a href="https://github.com/Zhufeng-Qiu/train_flash_sale" target="_blank">github.com/Zhufeng-Qiu/train_flash_sale</a>
