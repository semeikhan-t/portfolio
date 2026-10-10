// Motion is progressive enhancement: content remains visible without animation support.
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const active = new Set();
  const frames = new Map();
  const counts = new Map();
  const observers = [];
  const seen = new WeakSet();
  const canAnimate = typeof Element.prototype.animate === 'function';
  const play = (el, keyframes, options) => {
    if (preference.matches || !canAnimate) return;
    const animation = el.animate(keyframes, options);
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  };
  const reveal = (el, delay = 0) => {
    play(el, [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 700, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
  };
  const counters = [...document.querySelectorAll('.metrics strong')];
  counters.forEach(el => { counts.set(el, el.textContent); el.setAttribute('aria-label', el.textContent); });
  const count = el => {
    const final = counts.get(el);
    const target = Number(final.match(/\d+/)?.[0]);
    if (preference.matches || !target) return;
    const start = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - start) / 1100);
      el.textContent = final.replace(/\d+/, String(Math.round(target * (1 - Math.pow(1 - progress, 3)))));
      if (progress < 1) frames.set(el, requestAnimationFrame(tick));
      else { el.textContent = final; frames.delete(el); }
    };
    frames.set(el, requestAnimationFrame(tick));
  };
  if (!preference.matches && canAnimate) {
    document.querySelectorAll('.hero .eyebrow, .hero h1, .hero-bottom, .hero-rule').forEach((el, i) => reveal(el, i * 110));
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          observer.unobserve(el);
          if (seen.has(el)) return;
          seen.add(el);
          reveal(el);
          if (el.matches('.metrics > div')) count(el.querySelector('strong'));
        });
      }, { threshold: 0.12 });
      document.querySelectorAll('.section-caption, .about-body, .section-heading, .project, .metrics > div, .skills-layout > h2, .skill-list > div, .beyond h2, .experience-row, .education-grid > div, .contact-body').forEach(el => observer.observe(el));
      observers.push(observer);
    }
  }
  // Fine-pointer tilt runs at most once per animation frame and never on touch screens.
  document.querySelectorAll('.project').forEach(card => {
    const visual = card.querySelector('.project-visual');
    let pending = null;
    const reset = () => {
      if (pending !== null) cancelAnimationFrame(pending);
      pending = null;
      visual.style.removeProperty('--tilt-x');
      visual.style.removeProperty('--tilt-y');
      visual.style.removeProperty('--glow-x');
      visual.style.removeProperty('--glow-y');
      visual.classList.remove('is-tilting');
    };
    card.addEventListener('pointermove', event => {
      if (preference.matches || !pointer.matches || event.pointerType === 'touch') return;
      if (pending !== null) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        pending = null;
        if (preference.matches) return;
        const rect = card.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        visual.classList.add('is-tilting');
        visual.style.setProperty('--tilt-x', `${(0.5 - y) * 5}deg`);
        visual.style.setProperty('--tilt-y', `${(x - 0.5) * 5}deg`);
        visual.style.setProperty('--glow-x', `${x * 100}%`);
        visual.style.setProperty('--glow-y', `${y * 100}%`);
      });
    });
    card.addEventListener('pointerleave', reset);
    card.addEventListener('blur', reset);
    preference.addEventListener('change', reset);
    pointer.addEventListener('change', reset);
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.project:not([hidden])').forEach((card, i) => reveal(card, i * 65));
  }));
  // A quiet reading-progress line; no scroll interception.
  const progressBar = document.createElement('div');
  progressBar.className = 'reading-progress';
  progressBar.setAttribute('aria-hidden', 'true');
  document.body.append(progressBar);
  let scrollFrame = null;
  const updateProgress = () => {
    scrollFrame = null;
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = `scaleX(${distance > 0 ? Math.max(0, Math.min(1, window.scrollY / distance)) : 0})`;
  };
  const scheduleProgress = () => {
    if (scrollFrame === null) scrollFrame = requestAnimationFrame(updateProgress);
  };
  window.addEventListener('scroll', scheduleProgress, { passive: true });
  window.addEventListener('resize', scheduleProgress);
  document.querySelectorAll('[data-filter], #language').forEach(el => el.addEventListener('click', scheduleProgress));
  updateProgress();
  preference.addEventListener('change', () => {
    if (!preference.matches) return;
    observers.forEach(observer => observer.disconnect());
    active.forEach(animation => animation.cancel());
    active.clear();
    frames.forEach(frame => cancelAnimationFrame(frame));
    frames.clear();
    counts.forEach((text, el) => el.textContent = text);
  });
})();

// Preserve the orbit's position while paused or offscreen.
(() => {
  const orbit = document.querySelector('.hero-orbit');
  const button = orbit?.querySelector('.orbit-toggle');
  if (!button) return;
  let paused = false;
  let visible = true;
  const syncPlayback = () => orbit.classList.toggle('is-idle', document.hidden || !visible);
  const syncButton = () => {
    const en = document.documentElement.lang === 'en';
    button.setAttribute('aria-label', paused ? (en ? 'Play animation' : 'Продолжить анимацию') : (en ? 'Pause animation' : 'Приостановить анимацию'));
    button.setAttribute('aria-pressed', String(paused));
    button.firstElementChild.textContent = paused ? '▶' : 'Ⅱ';
  };
  button.hidden = false;
  button.addEventListener('click', () => {
    paused = !paused;
    orbit.classList.toggle('is-paused', paused);
    syncButton();
  });
  document.getElementById('language')?.addEventListener('click', syncButton);
  document.addEventListener('visibilitychange', syncPlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    }).observe(orbit);
  }
  syncButton();
  syncPlayback();
})();
