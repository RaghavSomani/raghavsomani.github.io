window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    processEscapes: true
  },
  options: {
    ignoreHtmlClass: 'tex2jax_ignore|mathjax_ignore',
    renderActions: {
      // Kramdown emits legacy math/tex scripts; also retain delimiter discovery.
      findScript: [10, function (doc) {
        const legacyMath = new doc.options.MathList();
        for (const node of document.querySelectorAll('script[type^="math/tex"]')) {
          const display = /; *mode=display/.test(node.type);
          const math = new doc.options.MathItem(node.textContent, doc.inputJax[0], display);
          const text = document.createTextNode('');
          node.parentNode.replaceChild(text, node);
          math.start = {node: text, delim: '', n: 0};
          math.end = {node: text, delim: '', n: 0};
          legacyMath.push(math);
        }
        // Keep macro definitions before later formulas in both input formats.
        doc.math.merge(legacyMath);
      }, '']
    }
  }
};
