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
})();