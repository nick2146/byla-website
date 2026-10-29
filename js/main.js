(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const toggle = $('.menu-toggle');
  const links = $('.nav-links');
  const dropdowns = $$('.nav-dropdown');

  const closeMenu = () => {
    if (!toggle || !links) return;
    links.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    toggle.textContent = '☰';
  };
  const closeDropdowns = (except = null) => dropdowns.forEach(item => {
    if (item !== except) item.removeAttribute('open');
  });

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = !links.classList.contains('is-open');
      links.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      toggle.textContent = open ? '×' : '☰';
      if (!open) closeDropdowns();
    });
    $$('a', links).forEach(anchor => anchor.addEventListener('click', () => {
      closeMenu();
      if (anchor.closest('.nav-dropdown-menu')) closeDropdowns();
    }));
    dropdowns.forEach(dropdown => {
      const summary = $('summary', dropdown);
      if (!summary) return;
      summary.addEventListener('click', event => {
        event.preventDefault();
        const willOpen = !dropdown.hasAttribute('open');
        closeDropdowns(dropdown);
        dropdown.toggleAttribute('open', willOpen);
        summary.setAttribute('aria-expanded', String(willOpen));
      });
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.nav-dropdown')) closeDropdowns();
      if (links.classList.contains('is-open') &&
          !event.target.closest('.nav') &&
          window.matchMedia('(max-width: 1020px)').matches) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDropdowns();
        closeMenu();
      }
    });
    window.addEventListener('resize', () => {
      if (window.matchMedia('(min-width: 1021px)').matches) closeMenu();
    }, { passive: true });
  }

  // Search navigation dropdown removed; the site header no longer injects a search panel.

  // Reading progress is updated on scroll and resize without a heavy animation loop.
  const progress = $('#scroll-progress-fill');
  const updateProgress = () => {
    if (!progress) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? Math.min(100, Math.max(0, window.scrollY / max * 100)) : 0) + '%';
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  // Active-page marker: one source of truth from each page's data-page value.
  const page = document.body.dataset.page;
  $$('[data-nav]').forEach(anchor => {
    if (anchor.dataset.nav === page) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  });
  dropdowns.forEach(dropdown => {
    const summary = $('summary', dropdown);
    if (summary) summary.setAttribute('aria-expanded', String(dropdown.hasAttribute('open')));
  });

  // Reveal a broad, consistent set of page elements as they enter the viewport.
  const animated = $$('.reveal, .feature-card, .timeline-item, .case-track, .tier, .prize, .stat, .editorial-image, .editorial-copy, .section-top, .cta-panel, .callout, .form-panel, .news-card, .learning-card');
  animated.forEach((element, index) => {
    element.classList.add('reveal');
    element.classList.remove('is-visible');
    element.style.setProperty('--reveal-delay', Math.min(index % 4, 3) * 75 + 'ms');
  });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.body.classList.add('motion-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -35px 0px' });
    animated.forEach(element => observer.observe(element));
  } else {
    animated.forEach(element => element.classList.add('is-visible'));
  }

  // Subtle page-exit transitions for same-site navigation.
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!motionPreference) {
    document.querySelectorAll('a[href]').forEach(anchor => {
      anchor.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
        const raw = anchor.getAttribute('href') || '';
        if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
        let destination;
        try { destination = new URL(raw, window.location.href); } catch (_) { return; }
        if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
        event.preventDefault();
        document.body.classList.add('page-leave');
        window.setTimeout(() => { window.location.href = destination.href; }, 120);
      });
    });
  }

  // Count up simple numeric stat labels once when they enter view.
  const animateStat = element => {
    if (element.dataset.counted === 'true') return;
    const raw = element.textContent.trim();
    const match = raw.match(/^(\D*?)([\d,]+(?:\.\d+)?)(\D*)$/);
    if (!match) return;
    const start = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(start) || start <= 0 || start > 1000000) return;
    element.dataset.counted = 'true';
    const prefix = match[1], suffix = match[3], duration = 850;
    const began = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = start * eased;
      const formatted = Number.isInteger(start) ? Math.round(value).toLocaleString() : value.toFixed(1);
      element.textContent = prefix + formatted + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!motionPreference && 'IntersectionObserver' in window) {
    const statObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateStat(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.45 });
    Array.from(document.querySelectorAll('.stat strong')).forEach(stat => statObserver.observe(stat));
  }

  // Keep the competition countdown neutral until a date is confirmed.
  const countdown = $('#competition-countdown');
  if (countdown) {
    ['countdown-days', 'countdown-hours', 'countdown-minutes'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.textContent = '00';
    });
    const label = $('.countdown-label span:last-child', countdown);
    if (label) label.textContent = 'COMPETITION DATE TO BE ANNOUNCED';
  }

  // Contact form prepares a draft in the visitor's email app; it never sends automatically.
  $$('.contact-form').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const subject = encodeURIComponent('BYLA ' + (data.get('interest') || 'Contact') + ' Inquiry' +
      (data.get('company') ? ' — ' + data.get('company') : ''));
    const body = encodeURIComponent('BYLA Website Inquiry\n\nName: ' + (data.get('name') || '') +
      '\nEmail: ' + (data.get('email') || '') +
      '\nOrganization: ' + (data.get('company') || '') +
      '\nInterest: ' + (data.get('interest') || 'General inquiry') +
      '\n\nMessage:\n' + (data.get('message') || data.get('challenge') || 'Not provided') +
      '\n\nSent from joinbyla.ca.');
    window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
  }));

  // Premium navigation feedback and accessible return-to-top control.
  const header = $('.site-header');
  const topButton = document.createElement('button');
  topButton.className = 'back-to-top';
  topButton.type = 'button';
  topButton.setAttribute('aria-label', 'Back to top');
  topButton.setAttribute('title', 'Back to top');
  topButton.textContent = '↑';
  document.body.appendChild(topButton);
  const updateScrollUI = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (header) header.classList.toggle('is-scrolled', y > 12);
    topButton.classList.toggle('is-visible', y > 520);
  };
  window.addEventListener('scroll', updateScrollUI, { passive: true });
  updateScrollUI();
  topButton.addEventListener('click', () => window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  }));

  // Site-wide visual refresh: concise page summaries, image-led story strips, and gentle reveal motion.
  const pageFile = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  const visualPages = {
    index: { title: 'BYLA at a glance', summary: 'A student-led business community built around practical challenges, financial literacy, and leadership.', tags: ['Learn by doing', 'Real-world thinking', 'Student-led'], images: [
      ['photo-1521737711867-e3b97375f902','Build together'],['photo-1460925895917-afdab827c52f','Think strategically'],['photo-1556761175-b413da4baf72','Present with confidence']]},
    about: { title: 'The BYLA difference', summary: 'Explore business through hands-on work, shared ideas, and opportunities open to high school students.', tags: ['Student-led', 'Practical learning', 'Open enrollment'], images: [
      ['photo-1521737711867-e3b97375f902','A community of ideas'],['photo-1552664730-d307ca884978','Collaboration in action'],['photo-1522071820081-009f0129c71c','Leadership grows here']]},
    competition: { title: 'The competition in 3 steps', summary: 'Work in a team, solve a business problem, and pitch a clear recommendation.', tags: ['Teams of 2–4', 'Five-slide deck', 'Pitch + Q&A'], images: [
      ['photo-1552664730-d307ca884978','Team strategy'],['photo-1454165804606-c3d57bc86b40','Business analysis'],['photo-1551836022-d5d88e9218df','Pitch your solution']]},
    partners: { title: 'Partner with purpose', summary: 'Bring a real business challenge, share expertise, or help students learn from professionals.', tags: ['Case partners', 'Mentors + judges', 'Community impact'], images: [
      ['photo-1521737711867-e3b97375f902','Meet future talent'],['photo-1556761175-b413da4baf72','Share your expertise'],['photo-1522071820081-009f0129c71c','Create opportunities']]},
    contact: { title: 'How can we help?', summary: 'Choose the topic that fits: student questions, business partnerships, judging, or general inquiries.', tags: ['Students', 'Businesses', 'Community'], images: [
      ['photo-1521737711867-e3b97375f902','Student community'],['photo-1556761175-b413da4baf72','Business partnerships'],['photo-1522071820081-009f0129c71c','Work together']]},
    events: { title: 'Plan your next step', summary: 'See upcoming BYLA activities and use self-paced resources when it suits your schedule.', tags: ['Competition updates', 'Learning activities', 'Plan ahead'], images: [
      ['photo-1503428593586-e225b39ddfe2','Mark the date'],['photo-1521737711867-e3b97375f902','Learn with others'],['photo-1454165804606-c3d57bc86b40','Prepare with purpose']]},
    'executive-positions': { title: 'Lead from where you are', summary: 'Find a role that matches your strengths and help build useful opportunities for students.', tags: ['Build experience', 'Work as a team', 'Make an impact'], images: [
      ['photo-1521737711867-e3b97375f902','Lead collaboratively'],['photo-1552664730-d307ca884978','Turn ideas into action'],['photo-1454165804606-c3d57bc86b40','Grow your skills']]},
    learning: { title: 'Learn it. Try it. Apply it.', summary: 'Use short guides, practical frameworks, and case exercises to strengthen your business toolkit.', tags: ['Business basics', 'Case analysis', 'Presentation skills'], images: [
      ['photo-1454165804606-c3d57bc86b40','Learn the framework'],['photo-1460925895917-afdab827c52f','Understand the numbers'],['photo-1552664730-d307ca884978','Practice together']]},
    'case-lab': { title: 'Practice business thinking', summary: 'Work through a case, choose your approach, and review the reasoning behind your decisions.', tags: ['Analyze', 'Decide', 'Reflect'], images: [
      ['photo-1454165804606-c3d57bc86b40','Break down the case'],['photo-1460925895917-afdab827c52f','Use evidence'],['photo-1552664730-d307ca884978','Compare perspectives']]},
    'case-library': { title: 'Pick a case. Build a solution.', summary: 'Practice strategy, marketing, finance, and operations using structured case exercises.', tags: ['Strategy', 'Finance', 'Marketing'], images: [
      ['photo-1454165804606-c3d57bc86b40','Frame the problem'],['photo-1460925895917-afdab827c52f','Follow the numbers'],['photo-1551836022-d5d88e9218df','Present the recommendation']]},
    markets: { title: 'Learn markets without real-money risk', summary: 'Explore companies and practise portfolio decisions with simulated money for learning.', tags: ['Virtual practice', 'Financial literacy', 'Learn at your pace'], images: [
      ['photo-1611974789855-9c2a0a7236a3','Markets in motion'],['photo-1460925895917-afdab827c52f','Read the data'],['photo-1554224155-6726b3ff858f','Build financial skills']]},
    news: { title: 'Read less. Understand more.', summary: 'Scan trusted sources, spot what changed, and connect headlines to business decisions.', tags: ['Canada + world', 'Markets + economy', 'Think critically'], images: [
      ['photo-1504711434969-e33886168f5c','Follow the headlines'],['photo-1460925895917-afdab827c52f','Make sense of data'],['photo-1516321318423-f06f85e504b3','Explore new ideas']]},
    opportunities: { title: 'Find your next opportunity', summary: 'Browse competitions, entrepreneurship programs, leadership roles, and learning resources.', tags: ['Compete', 'Create', 'Lead'], images: [
      ['photo-1521737711867-e3b97375f902','Meet collaborators'],['photo-1556761175-b413da4baf72','Explore business'],['photo-1454165804606-c3d57bc86b40','Build experience']]},
    resources: { title: 'Your toolkit, simplified', summary: 'Go straight to the tool you need: cases, practice, events, or business learning.', tags: ['Cases', 'Practice', 'Learning'], images: [
      ['photo-1454165804606-c3d57bc86b40','Start with a framework'],['photo-1460925895917-afdab827c52f','Work with evidence'],['photo-1552664730-d307ca884978','Put ideas to work']]},
    'weekly-challenge': { title: 'A small challenge. A sharper mind.', summary: 'Explore a business story, make a decision, and explain your reasoning each week.', tags: ['Read the story', 'Make a call', 'Explain why'], images: [
      ['photo-1504711434969-e33886168f5c','Understand the context'],['photo-1460925895917-afdab827c52f','Use the evidence'],['photo-1551836022-d5d88e9218df','Make the decision']]},
    'case-analysis-worksheet': { title: 'A simple case workflow', summary: 'Identify the problem, compare options, support your recommendation, and define the next step.', tags: ['Problem', 'Options', 'Recommendation'], images: [
      ['photo-1454165804606-c3d57bc86b40','Structure your thinking'],['photo-1460925895917-afdab827c52f','Support your answer'],['photo-1552664730-d307ca884978','Review your approach']]}
  };
  const visualConfig = visualPages[pageFile] || visualPages[document.body.dataset.page] || null;
  const pageHero = $('.page-hero');
  const overviewAnchor = pageHero || $('main');
  if (visualConfig && overviewAnchor && !document.querySelector('.site-visual-overview')) {
    const overview = document.createElement('section');
    overview.className = 'site-visual-overview container';
    overview.setAttribute('aria-label', 'Page overview');
    const quick = document.createElement('div');
    quick.className = 'site-quick-view';
    const label = document.createElement('span');
    label.className = 'site-quick-eyebrow';
    label.textContent = 'QUICK VIEW';
    const title = document.createElement('h2');
    title.textContent = visualConfig.title;
    const summary = document.createElement('p');
    summary.textContent = visualConfig.summary;
    const tags = document.createElement('div');
    tags.className = 'site-quick-tags';
    visualConfig.tags.forEach(tagText => {
      const tag = document.createElement('span');
      tag.textContent = tagText;
      tags.appendChild(tag);
    });
    quick.append(label, title, summary, tags);
    const gallery = document.createElement('div');
    gallery.className = 'site-image-gallery';
    visualConfig.images.forEach((item, index) => {
      const tile = document.createElement('figure');
      tile.className = 'site-image-tile';
      const img = document.createElement('img');
      img.src = 'https://images.unsplash.com/' + item[0] + '?auto=format&fit=crop&w=900&q=80';
      img.alt = item[1];
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 900;
      img.height = 620;
      const caption = document.createElement('figcaption');
      caption.innerHTML = '<span>0' + (index + 1) + '</span><strong></strong>';
      caption.querySelector('strong').textContent = item[1];
      tile.append(img, caption);
      gallery.appendChild(tile);
    });
    overview.append(quick, gallery);
    if (pageHero) pageHero.insertAdjacentElement('afterend', overview);
    else overviewAnchor.insertAdjacentElement('afterbegin', overview);
  }

  // Reveal sections as they enter view, with staggered card timing and reduced-motion support.
  const motionTargets = $('.page-hero, main > section, main .container > .section-top, main .container > .stats, main .container > .tool-wrap, .feature-card, .resource-card, .opportunity-card, .event-card, .news-card, .partner-card, .publisher-card, .learning-card, .case-card, .form-panel, .site-visual-overview');
  motionTargets.forEach((element, index) => {
    if (element.closest('.site-visual-overview') && element !== document.querySelector('.site-visual-overview')) return;
    if (element.classList.contains('site-reveal')) return;
    element.classList.add('site-reveal');
    if (element.matches('.feature-card, .resource-card, .opportunity-card, .event-card, .news-card, .partner-card, .publisher-card, .learning-card, .case-card')) {
      element.style.setProperty('--reveal-delay', (Math.min(index % 5, 4) * 70) + 'ms');
    }
  });
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -35px 0px' });
    $('.site-reveal').forEach(element => revealObserver.observe(element));
  } else {
    $('.site-reveal').forEach(element => element.classList.add('is-revealed'));
  }
  // Add subtle pointer tilt only to visual image tiles; no layout movement on touch screens.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $('.site-image-tile').forEach(tile => {
      tile.addEventListener('pointermove', event => {
        const rect = tile.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        tile.style.setProperty('--tilt-x', (y * -3) + 'deg');
        tile.style.setProperty('--tilt-y', (x * 3) + 'deg');
      });
      tile.addEventListener('pointerleave', () => {
        tile.style.setProperty('--tilt-x', '0deg');
        tile.style.setProperty('--tilt-y', '0deg');
      });
    });
  }

})();