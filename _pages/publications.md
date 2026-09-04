---
layout: archive
title: "Selected Publications"
permalink: /publications/
author_profile: true
description: "Selected publications by Raghav Somani on machine learning, optimization, stochastic gradients, meta-learning, sparse recovery, and graphons."
---

{% include base_path %}

See my complete publication record on <a href="{{ site.author.googlescholar }}" target="_blank" rel="noopener noreferrer">Google Scholar</a>{% if site.author.dblp %} or <a href="{{ site.author.dblp }}" target="_blank" rel="noopener noreferrer">DBLP</a>{% endif %}.

{% for post in site.publications reversed %}
  {% include archive-single.html %}
{% endfor %}

<p class="publication-note"><sup>*</sup> Equal contribution</p>
