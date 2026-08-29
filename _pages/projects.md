---
layout: page
title: projects
permalink: /projects/
description: Systems work first, then agents, research, and earlier full-stack projects.
nav: true
nav_order: 3
display_categories: [systems, ai, research, web]
category_titles:
  systems: ML Systems/AI Infra/Big Data
  ai: AI App
  research: Research
  web: Web
horizontal: false
_styles: |
  .projects .card-title {
    color: var(--global-text-color) !important;
  }
  .projects h2.category {
    color: var(--global-text-color) !important;
    text-align: left;
  }
  .project-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.5rem;
  }
---

<div class="projects">
{% if site.enable_project_categories and page.display_categories %}
  {% for category in page.display_categories %}
  <h2 id="{{ category }}" class="category">{{ page.category_titles[category] | default: category }}</h2>
  {% assign categorized_projects = site.projects | where: "category", category %}
  {% assign sorted_projects = categorized_projects | sort: "importance" %}
  <div class="row row-cols-1">
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
  {% endfor %}
{% else %}
{% assign sorted_projects = site.projects | sort: "importance" %}
  <div class="row row-cols-1">
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
{% endif %}
</div>
