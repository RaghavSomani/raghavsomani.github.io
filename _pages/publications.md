---
layout: archive
title: "Selected Publications"
permalink: /publications/
author_profile: true
---

{% include base_path %}

{% if author.googlescholar %}
  You can find the list of all publications on <u><a href="{{author.googlescholar}}">my Google Scholar profile</a>.</u>
{% endif %}

{% for post in site.publications reversed %}
  {% include archive-single.html %}
{% endfor %}
