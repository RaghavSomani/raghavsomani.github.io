---
title: "Meta-learning for Mixed Linear Regression"
collection: publications
permalink: /publications/2020-06-01-MetaLearning_MLR-6
excerpt: 'The paper has been accepted for a presentation.'
date: 2020-06-01
venue: 'International Conference on Machine Learning (ICML)'
year: '2020'
authors: 'Weihao Kong, Raghav Somani, Zhao Song, Sham Kakade, Sewoong Oh'
arxiv: 'https://arxiv.org/abs/2002.08936'
bib: 'https://ui.adsabs.harvard.edu/abs/2020arXiv200208936K'
paperurl: 'https://proceedings.icml.cc/paper/2020/hash/b16e8712b35e498857df08af3944b127-Abstract.html'

---

![Trade-offs between batch size and number of tasks](https://raghavsomani.github.io/publications/files/MetaLearning.png){:class="img-responsive"}

In modern supervised learning, there are a large number of tasks, but many of them are associated with only a small amount of labeled data. These include data from medical image processing and robotic interaction. Even though each individual task cannot be meaningfully trained in isolation, one seeks to meta-learn across the tasks from past experiences by exploiting some similarities. We study a fundamental question of interest: When can abundant tasks with small data compensate for lack of tasks with big data? We focus on a canonical scenario where each task is drawn from a mixture of $$k$$ linear regressions, and identify sufficient conditions for such a graceful exchange to hold; The total number of examples necessary with only small data tasks scales similarly as when big data tasks are available. To this end, we introduce a novel spectral approach and show that we can efficiently utilize small data tasks with the help of $$\tilde\Omega(k^{3/2})$$ medium data tasks each with $$\tilde\Omega(k^{1/2})$$ examples.

The paper has been accepted at the [ICML 2020](https://icml.cc/Conferences/2020){:target="_blank"}.

Please find the below resources
1. [Proceedings](https://proceedings.icml.cc/paper/2020/hash/b16e8712b35e498857df08af3944b127-Abstract.html){:target="_blank"}.
2. [ArXiv](https://arxiv.org/abs/2002.08936){:target="_blank"}.
3. [Github code](https://github.com/RaghavSomani/RobustMetaLearningMLR){:target="_blank"}.