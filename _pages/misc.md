---
layout: single
title: "Misc"
permalink: /misc/
author_profile: true
---

{% include base_path %}

{% for post in site.misc reversed %}
  {% include archive-single.html %}
{% endfor %}