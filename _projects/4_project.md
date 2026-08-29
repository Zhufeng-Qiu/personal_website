---
layout: page
title: Zephyr Manus
description: A general-purpose agent runtime with a Docker-isolated tool sandbox
img:
importance: 4
category: ai
github: http://zephyr-manus.zhufqiu.com
---

`FastAPI` `Redis Streams` `PostgreSQL` `Docker` `Next.js` `MCP/A2A` &nbsp;·&nbsp; Mar.–May 2026

A Planner–ReAct agent runtime supporting task decomposition, external-tool
execution, persistent state, and human-in-the-loop wait/resume workflows.

Tools — Browser, Shell, File — run inside a Docker-isolated sandbox, so an agent
can execute code, browse, and manipulate files in a controlled environment. The
backend is event-driven: FastAPI with Redis Streams for task execution and state
transitions, PostgreSQL for persistence, SSE for live status, and MCP/A2A for
external tool integration and agent-to-agent collaboration.

---

<a href="http://zephyr-manus.zhufqiu.com" target="_blank">zephyr-manus.zhufqiu.com</a>
