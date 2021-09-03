---
layout: archive
title: "Selected Publications"
permalink: /publications/
author_profile: true
---

{% include base_path %}

{% if author.googlescholar %}
  You can find the list of all publications on my <u><a href="{{author.googlescholar}}">Google Scholar</a></u> profile.
{% endif %}

{% for post in site.publications reversed %}
  {% include archive-single.html %}
{% endfor %}
