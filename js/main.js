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
 * Scroll fuse — fixed viewport rail that burns from global scroll progress.
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
  let sections = [];
  let nodes = [];
  const IGNITION_LEAD = 0.006;
  const IGNITION_FLASH_MS = 1400;

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
    milestones: [],
    pathLength: 0,
    scrollMax: 1,
    railX: 28,
    railTop: 96,
    railBottom: 640,
    progress: 0,
    lastParticleAt: 0,
    isScheduled: false,
    isLayoutScheduled: false,
    isActive: false,
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function igniteSection(section, withFlash = true) {
    const wasIgnited = section.classList.contains('is-ignited');

    section.classList.add('is-ignited');

    if (!withFlash || wasIgnited) return;

    section.classList.add('is-igniting');
    window.setTimeout(() => {
      section.classList.remove('is-igniting');
    }, IGNITION_FLASH_MS);
  }

  function getFuseSections() {
    return Array.from(document.querySelectorAll('[data-fuse-section]')).filter(
      (section) => section instanceof HTMLElement,
    );
  }

  function igniteAll() {
    getFuseSections().forEach((section) => {
      igniteSection(section, false);
    });
  }

  function setReducedMotionState() {
    document.documentElement.classList.remove('fuse-ready');
    overlay.hidden = true;
    state.isActive = false;
    igniteAll();
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleLayout);
  }

  function getMeasuredDocumentHeight() {
    const doc = document.documentElement;
    const body = document.body;

    return Math.max(
      body.scrollHeight,
      body.offsetHeight,
      doc.clientHeight,
      doc.scrollHeight,
      doc.offsetHeight,
      window.innerHeight,
    );
  }

  function getRailMetrics() {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width <= 639;
    const railX = isMobile ? clamp(width * 0.055, 17, 22) : clamp(width * 0.045, 28, 56);
    const railTop = isMobile ? clamp(height * 0.14, 74, 104) : clamp(height * 0.15, 92, 132);
    const railBottomInset = isMobile ? clamp(height * 0.055, 28, 44) : clamp(height * 0.08, 44, 72);

    return {
      railX,
      railTop,
      railBottom: Math.max(railTop + 180, height - railBottomInset),
    };
  }

  function getScrollProgress() {
    return clamp(window.scrollY / state.scrollMax, 0, 1);
  }

  function getSectionThreshold(section, index) {
    if (index === 0) return 0;

    const docTop = section.getBoundingClientRect().top + window.scrollY;
    const viewportLead = Math.min(window.innerHeight * 0.34, 240);
    return clamp((docTop - viewportLead) / state.scrollMax, 0, 1);
  }

  function createNodes() {
    nodes.forEach((node) => node.remove());
    nodes = state.milestones.map((threshold) => {
      const node = document.createElement('span');
      const y = state.railTop + (state.railBottom - state.railTop) * threshold;

      node.className = 'fuse-node';
      node.style.setProperty('--node-x', `${state.railX}px`);
      node.style.setProperty('--node-y', `${y}px`);
      overlay.appendChild(node);
      return node;
    });
  }

  function buildRailPath() {
    const { railX, railTop, railBottom } = state;
    const height = railBottom - railTop;
    const wobble = clamp(window.innerWidth * 0.018, 10, 22);
    const cp1y = railTop + height * 0.28;
    const cp2y = railTop + height * 0.72;

    return [
      `M ${railX.toFixed(1)} ${railTop.toFixed(1)}`,
      `C ${(railX + wobble).toFixed(1)} ${cp1y.toFixed(1)}, ${(railX - wobble).toFixed(1)} ${cp2y.toFixed(1)}, ${railX.toFixed(1)} ${railBottom.toFixed(1)}`,
    ].join(' ');
  }

  function writeSelfCheck() {
    window.__scrollFuseSelfCheck = {
      elementsReady: true,
      reducedMotion: reducedMotionQuery.matches,
      active: state.isActive,
      pathLength: Number(state.pathLength.toFixed(2)),
      scrollMax: Number(state.scrollMax.toFixed(2)),
      progress: Number(state.progress.toFixed(4)),
      sections: sections.length,
    };
  }

  function layoutFuse() {
    sections = getFuseSections();
    state.isLayoutScheduled = false;

    if (reducedMotionQuery.matches) {
      state.isActive = false;
      return;
    }

    if (sections.length < 2) {
      state.isActive = false;
      overlay.hidden = true;
      document.documentElement.classList.remove('fuse-ready');
      writeSelfCheck();
      return;
    }

    state.isActive = true;
    overlay.hidden = false;
    document.documentElement.classList.add('fuse-ready');

    const docHeight = getMeasuredDocumentHeight();
    const metrics = getRailMetrics();
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
    const viewportHeight = window.innerHeight;

    state.scrollMax = Math.max(1, docHeight - viewportHeight);
    state.railX = metrics.railX;
    state.railTop = metrics.railTop;
    state.railBottom = metrics.railBottom;

    svg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
    svg.setAttribute('width', String(viewportWidth));
    svg.setAttribute('height', String(viewportHeight));

    const pathData = buildRailPath();
    ropePath.setAttribute('d', pathData);
    burnedPath.setAttribute('d', pathData);
    emberTrailPath.setAttribute('d', pathData);
    state.pathLength = ropePath.getTotalLength();

    [ropePath, burnedPath, emberTrailPath].forEach((path) => {
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '';
      path.style.strokeDashoffset = '';
    });

    state.milestones = sections.map(getSectionThreshold);
    createNodes();
    updateFuse();
  }

  function setIgnitedSections(progress) {
    sections.forEach((section, index) => {
      if (progress >= state.milestones[index] - IGNITION_LEAD) {
        igniteSection(section);
        nodes[index]?.classList.add('is-ignited');
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
    scheduleLayout();
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
      getFuseSections().forEach((section) => section.classList.remove('is-ignited', 'is-igniting'));
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
