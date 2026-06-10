import { DominoScene } from './DominoScene.js';
import { AnimationController } from './AnimationController.js';
import { UIController } from './UIController.js';
import { initI18n, onLanguageChange, t } from './i18n.js';

const CONTACT_EMAIL_PLACEHOLDER = 'juliaezhik09@gmail.com';

initI18n();

/**
 * Entry point — wires scene, animation, UI, and accessibility preferences.
 */
(function bootstrap() {
  'use strict';

  const canvasHost = document.getElementById('canvas-host');
  if (!canvasHost) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ui = new UIController({
    reveal: document.getElementById('title-reveal'),
    title: document.getElementById('reveal-title'),
    subtitle: document.getElementById('reveal-subtitle'),
    replayBtn: document.getElementById('replay-btn'),
  });

  const scene = new DominoScene(canvasHost);

  function vibrateOnFinalImpact() {
    if (typeof navigator.vibrate !== 'function') return;

    try {
      navigator.vibrate([18, 20, 28]);
    } catch {
      // Some mobile browsers expose the API but block it; the animation should continue silently.
    }
  }

  function syncHeroSubtitle() {
    const subtitle = t('hero.subtitle');
    ui.setSubtitle(subtitle);
    scene.setSubtitleText(subtitle);
  }

  syncHeroSubtitle();
  onLanguageChange(syncHeroSubtitle);

  const animation = new AnimationController(scene, {
    onImpact: vibrateOnFinalImpact,
    onComplete: () => {
      ui.showReveal(reducedMotion);
      ui.setReplayVisible(true);
    },
  });

  ui.onReplay(() => {
    ui.hideReveal();
    ui.setReplayVisible(false);
    animation.reset();
    animation.start();
  });

  if (reducedMotion) {
    animation.showEndState();
    ui.showReveal(true);
    ui.setReplayVisible(true);
  } else {
    animation.start();
  }

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (e.matches) {
      animation.showEndState();
      ui.showReveal(true);
      ui.setReplayVisible(true);
    }
  });

  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    animation.update(dt);
    scene.render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

/**
 * Header navigation — toggles the compact menu on small screens.
 */
(function initNavigation() {
  'use strict';

  const nav = document.querySelector('.site-nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('site-nav-links');

  if (!(nav instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement) || !(links instanceof HTMLElement)) {
    return;
  }

  function setOpen(isOpen) {
    nav.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  }

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  links.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });

  window.matchMedia('(max-width: 760px)').addEventListener('change', (event) => {
    if (!event.matches) {
      setOpen(false);
    }
  });
})();

/**
 * Scroll fuse — draws a decorative fuse between section headings and burns it with scroll.
 */
(function initScrollFuse() {
  'use strict';

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const overlay = document.getElementById('fuse-overlay');
  const svg = overlay?.querySelector('.fuse-overlay__svg');
  const ropePath = document.getElementById('fuse-rope');
  const burnedPath = document.getElementById('fuse-burned');
  const emberTrailPath = document.getElementById('fuse-ember-trail');
  const spark = document.getElementById('fuse-spark');

  if (
    !(overlay instanceof HTMLElement) ||
    !(svg instanceof SVGSVGElement) ||
    !(ropePath instanceof SVGPathElement) ||
    !(burnedPath instanceof SVGPathElement) ||
    !(emberTrailPath instanceof SVGPathElement) ||
    !(spark instanceof HTMLElement)
  ) {
    return;
  }

  const state = {
    sections: [],
    points: [],
    milestones: [],
    pathLength: 0,
    progress: 0,
    lastParticleAt: 0,
    isScheduled: false,
    isLayoutScheduled: false,
    isActive: false,
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getFuseSections() {
    return Array.from(document.querySelectorAll('[data-fuse-section]'))
      .map((section) => ({
        section,
        anchor: section.querySelector('[data-fuse-anchor]'),
      }))
      .filter(({ section, anchor }) => section instanceof HTMLElement && anchor instanceof HTMLElement);
  }

  function igniteAll() {
    getFuseSections().forEach(({ section }) => {
      section.classList.add('is-ignited');
    });
  }

  function writeSelfCheck() {
    window.__scrollFuseSelfCheck = {
      elementsReady: true,
      reducedMotion: reducedMotionQuery.matches,
      active: state.isActive,
      pathLength: Number(state.pathLength.toFixed(2)),
      progress: Number(state.progress.toFixed(4)),
      sections: state.sections.length,
    };
  }

  function setReducedMotionState() {
    document.documentElement.classList.remove('fuse-ready');
    overlay.hidden = true;
    state.isActive = false;
    igniteAll();
    writeSelfCheck();
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleLayout);
  }

  function getAnchorPoint(anchor) {
    const rect = anchor.getBoundingClientRect();
    const railOffset = window.innerWidth < 760 ? 18 : 38;
    const minX = window.scrollX + 18;
    const maxX = window.scrollX + document.documentElement.clientWidth - 18;
    const preferredX = rect.left + window.scrollX - railOffset;

    return {
      x: clamp(preferredX, minX, maxX),
      y: rect.top + window.scrollY + rect.height * 0.52,
    };
  }

  function buildFusePath(points) {
    return points.reduce((path, point, index) => {
      if (index === 0) {
        return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }

      const previous = points[index - 1];
      const dy = point.y - previous.y;
      const direction = point.x >= previous.x ? 1 : -1;
      const curve = clamp(Math.abs(dy) * 0.08, 36, 112) * direction;
      const cp1x = previous.x + curve;
      const cp1y = previous.y + dy * 0.32;
      const cp2x = point.x - curve;
      const cp2y = point.y - dy * 0.3;

      return `${path} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }, '');
  }

  function findLengthRatioForPoint(target, startRatio = 0) {
    const sampleCount = 180;
    let closestRatio = startRatio;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let i = Math.round(startRatio * sampleCount); i <= sampleCount; i += 1) {
      const ratio = i / sampleCount;
      const point = ropePath.getPointAtLength(state.pathLength * ratio);
      const distance = Math.hypot(point.x - target.x, point.y - target.y);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestRatio = ratio;
      }
    }

    return closestRatio;
  }

  function calculateMilestones(points) {
    let previousRatio = 0;

    return points.map((point, index) => {
      if (index === 0) return 0;

      previousRatio = findLengthRatioForPoint(point, previousRatio);
      return previousRatio;
    });
  }

  function layoutFuse() {
    state.isLayoutScheduled = false;
    state.sections = getFuseSections();

    if (reducedMotionQuery.matches) {
      state.isActive = false;
      writeSelfCheck();
      return;
    }

    if (state.sections.length < 2) {
      state.isActive = false;
      overlay.hidden = true;
      document.documentElement.classList.remove('fuse-ready');
      writeSelfCheck();
      return;
    }

    const doc = document.documentElement;
    const body = document.body;
    const docWidth = Math.max(doc.clientWidth, doc.scrollWidth, body.scrollWidth);
    const docHeight = Math.max(doc.scrollHeight, body.scrollHeight, window.innerHeight);

    overlay.style.setProperty('--fuse-doc-height', `${docHeight}px`);
    svg.setAttribute('viewBox', `0 0 ${docWidth} ${docHeight}`);
    svg.setAttribute('width', String(docWidth));
    svg.setAttribute('height', String(docHeight));

    state.points = state.sections.map(({ anchor }) => getAnchorPoint(anchor));
    const pathData = buildFusePath(state.points);

    ropePath.setAttribute('d', pathData);
    burnedPath.setAttribute('d', pathData);
    emberTrailPath.setAttribute('d', pathData);
    state.pathLength = ropePath.getTotalLength();
    state.milestones = calculateMilestones(state.points);
    state.isActive = true;
    overlay.hidden = false;
    document.documentElement.classList.add('fuse-ready');
    updateFuse();
  }

  function getScrollProgress() {
    const firstPoint = state.points[0];
    const lastPoint = state.points[state.points.length - 1];

    if (!firstPoint || !lastPoint || firstPoint.y === lastPoint.y) {
      return 0;
    }

    const triggerY = window.scrollY + window.innerHeight * 0.58;
    return clamp((triggerY - firstPoint.y) / (lastPoint.y - firstPoint.y), 0, 1);
  }

  function setIgnitedSections(progress) {
    state.sections.forEach(({ section }, index) => {
      if (progress >= state.milestones[index] - 0.015) {
        section.classList.add('is-ignited');
      }
    });
  }

  function emitParticle(type, point, angle) {
    const particle = document.createElement('span');
    const isSmoke = type === 'smoke';
    const spread = isSmoke ? 28 : 16;
    const driftX = (Math.random() - 0.5) * spread - Math.cos(angle) * (isSmoke ? 28 : 12);
    const driftY = -Math.random() * (isSmoke ? 42 : 24) - 8;

    particle.className = isSmoke ? 'fuse-smoke-puff' : 'fuse-ember';
    particle.style.setProperty(isSmoke ? '--smoke-x' : '--ember-x', `${point.x}px`);
    particle.style.setProperty(isSmoke ? '--smoke-y' : '--ember-y', `${point.y}px`);
    particle.style.setProperty(isSmoke ? '--smoke-drift-x' : '--ember-drift-x', `${driftX.toFixed(1)}px`);
    particle.style.setProperty(isSmoke ? '--smoke-drift-y' : '--ember-drift-y', `${driftY.toFixed(1)}px`);

    if (isSmoke) {
      particle.style.setProperty('--smoke-size', `${(14 + Math.random() * 12).toFixed(1)}px`);
    } else {
      particle.style.setProperty('--ember-size', `${(2 + Math.random() * 3).toFixed(1)}px`);
    }

    overlay.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }

  function updateSpark(point, angle) {
    spark.classList.add('is-visible');
    spark.style.setProperty('--spark-angle', `${angle}rad`);
    spark.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`;
  }

  function updateFuse() {
    state.isScheduled = false;

    if (!state.isActive || state.pathLength <= 0) {
      return;
    }

    const progress = getScrollProgress();
    const length = state.pathLength * progress;
    const point = ropePath.getPointAtLength(length);
    const nextPoint = ropePath.getPointAtLength(clamp(length + 2, 0, state.pathLength));
    const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x);
    const now = performance.now();

    state.progress = progress;
    overlay.style.setProperty('--fuse-progress', progress.toFixed(4));
    updateSpark(point, angle);
    setIgnitedSections(progress);
    writeSelfCheck();

    if (now - state.lastParticleAt > 95 && progress > 0.01 && progress < 0.995) {
      emitParticle('ember', point, angle);

      if (Math.random() > 0.45) {
        emitParticle('smoke', point, angle);
      }

      state.lastParticleAt = now;
    }
  }

  function scheduleUpdate() {
    if (state.isScheduled) return;

    state.isScheduled = true;
    requestAnimationFrame(updateFuse);
  }

  function scheduleLayout() {
    if (state.isLayoutScheduled) return;

    state.isLayoutScheduled = true;
    requestAnimationFrame(layoutFuse);
  }

  function activateFuse() {
    if (reducedMotionQuery.matches) return;

    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleLayout);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleLayout);
    layoutFuse();
  }

  if (reducedMotionQuery.matches) {
    setReducedMotionState();
  } else {
    activateFuse();
  }

  reducedMotionQuery.addEventListener('change', (event) => {
    if (event.matches) {
      setReducedMotionState();
    } else {
      getFuseSections().forEach(({ section }) => section.classList.remove('is-ignited'));
      activateFuse();
    }
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleLayout).catch(() => {});
  }

  document.querySelectorAll('img').forEach((image) => {
    if (typeof image.decode === 'function') {
      image.decode().then(scheduleLayout).catch(() => {});
    }

    if (image.complete) return;
    image.addEventListener('load', scheduleLayout, { once: true });
    image.addEventListener('error', scheduleLayout, { once: true });
  });

  onLanguageChange(scheduleLayout);
  window.addEventListener('load', scheduleLayout, { once: true });
})();

/**
 * Contact form — validates input and opens the user's email client.
 */
(function initContactForm() {
  'use strict';

  const form = document.getElementById('contact-form');
  if (!form) return;

  const fields = {
    name: form.elements.namedItem('name'),
    email: form.elements.namedItem('email'),
    projectType: form.elements.namedItem('projectType'),
    message: form.elements.namedItem('message'),
  };

  const status = document.getElementById('contact-form-status');
  const recipient = form.dataset.recipient || CONTACT_EMAIL_PLACEHOLDER;

  function setFieldError(field, message) {
    if (!(field instanceof HTMLElement)) return;

    const error = document.getElementById(`${field.id}-error`);
    field.setAttribute('aria-invalid', message ? 'true' : 'false');

    if (error) {
      error.textContent = message;
      field.setAttribute('aria-describedby', error.id);
    }
  }

  function setStatus(message, isSuccess = false) {
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('is-success', isSuccess);
  }

  function validateForm() {
    const name = fields.name instanceof HTMLInputElement ? fields.name.value.trim() : '';
    const email = fields.email instanceof HTMLInputElement ? fields.email.value.trim() : '';
    const message = fields.message instanceof HTMLTextAreaElement ? fields.message.value.trim() : '';
    const errors = [];

    setFieldError(fields.name, '');
    setFieldError(fields.email, '');
    setFieldError(fields.message, '');
    setStatus('');

    if (!name) {
      errors.push(fields.name);
      setFieldError(fields.name, t('form.errorName'));
    }

    if (!email) {
      errors.push(fields.email);
      setFieldError(fields.email, t('form.errorEmail'));
    } else if (fields.email instanceof HTMLInputElement && !fields.email.validity.valid) {
      errors.push(fields.email);
      setFieldError(fields.email, t('form.errorEmailInvalid'));
    }

    if (!message) {
      errors.push(fields.message);
      setFieldError(fields.message, t('form.errorMessage'));
    }

    return errors;
  }

  function getProjectTypeLabel() {
    if (!(fields.projectType instanceof HTMLSelectElement)) {
      return t('form.optionOther');
    }

    const option = fields.projectType.selectedOptions[0];
    const key = option?.getAttribute('data-i18n');
    return key ? t(key) : option?.textContent?.trim() ?? t('form.optionOther');
  }

  function buildMailtoUrl() {
    const name = fields.name instanceof HTMLInputElement ? fields.name.value.trim() : '';
    const email = fields.email instanceof HTMLInputElement ? fields.email.value.trim() : '';
    const projectType = getProjectTypeLabel();
    const message = fields.message instanceof HTMLTextAreaElement ? fields.message.value.trim() : '';
    const subject = t('form.mailtoSubject', undefined, { type: projectType });
    const body = [
      `${t('form.mailtoName')}: ${name}`,
      `${t('form.mailtoEmail')}: ${email}`,
      `${t('form.mailtoProjectType')}: ${projectType}`,
      '',
      `${t('form.mailtoMessage')}:`,
      message,
    ].join('\n');

    return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      setStatus(t('form.statusFix'));
      errors[0].focus();
      return;
    }

    setStatus(t('form.statusOpening'), true);
    window.location.href = buildMailtoUrl();
  });
})();
