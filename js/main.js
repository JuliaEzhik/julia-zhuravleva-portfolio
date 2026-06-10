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

  let scene;

  try {
    scene = new DominoScene(canvasHost);
  } catch {
    ui.showReveal(true);
    ui.setReplayVisible(false);
    return;
  }

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
    sparkDistance: 0,
    sparkViewportPoint: { x: -100, y: -100 },
    lastParticleAt: 0,
    layoutRetryTimer: 0,
    isScheduled: false,
    isLayoutScheduled: false,
    isActive: false,
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getViewportMetrics() {
    const doc = document.documentElement;
    const visualViewport = window.visualViewport;
    const width = visualViewport?.width || doc.clientWidth || window.innerWidth || 1;
    const height = visualViewport?.height || window.innerHeight || doc.clientHeight || 1;

    return {
      width,
      height,
      offsetLeft: visualViewport?.offsetLeft || 0,
      offsetTop: visualViewport?.offsetTop || 0,
    };
  }

  function isMobileFuseLayout() {
    return getViewportMetrics().width <= 639;
  }

  function getMobileRailViewportX() {
    const { width } = getViewportMetrics();

    return clamp(width * 0.11, 26, 42);
  }

  function getSafeViewportBounds(margin = 24) {
    const viewport = getViewportMetrics();

    return {
      minX: viewport.offsetLeft + margin,
      maxX: viewport.offsetLeft + Math.max(viewport.width - margin, margin),
      minY: viewport.offsetTop + margin,
      maxY: viewport.offsetTop + Math.max(viewport.height - margin, margin),
      width: viewport.width,
      height: viewport.height,
    };
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
    const bounds = getSafeViewportBounds();

    window.__scrollFuseSelfCheck = {
      elementsReady: true,
      reducedMotion: reducedMotionQuery.matches,
      active: state.isActive,
      pathLength: Number(state.pathLength.toFixed(2)),
      progress: Number(state.progress.toFixed(4)),
      sparkDistance: Number(state.sparkDistance.toFixed(2)),
      sparkLeft: Number(state.sparkViewportPoint.x.toFixed(1)),
      sparkTop: Number(state.sparkViewportPoint.y.toFixed(1)),
      sparkInViewport:
        state.sparkViewportPoint.x >= bounds.minX &&
        state.sparkViewportPoint.x <= bounds.maxX &&
        state.sparkViewportPoint.y >= bounds.minY &&
        state.sparkViewportPoint.y <= bounds.maxY,
      mobileRail: isMobileFuseLayout(),
      sections: state.sections.length,
    };
  }

  function queueLayoutRetry() {
    if (state.layoutRetryTimer) return;

    state.layoutRetryTimer = window.setTimeout(() => {
      state.layoutRetryTimer = 0;
      scheduleLayout();
    }, 120);
  }

  function setReducedMotionState() {
    document.documentElement.classList.remove('fuse-ready');
    overlay.hidden = true;
    state.isActive = false;
    igniteAll();
    writeSelfCheck();
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleLayout);
    window.visualViewport?.removeEventListener('resize', scheduleLayout);
    window.visualViewport?.removeEventListener('scroll', scheduleUpdate);
  }

  function getAnchorPoint(anchor, section) {
    const rect = anchor.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const isHiddenAnchor = rect.width === 0 && rect.height === 0;
    const anchorTop = isHiddenAnchor ? sectionRect.top : rect.top;
    const anchorHeight = isHiddenAnchor ? Math.min(sectionRect.height * 0.16, 120) : rect.height;

    if (isMobileFuseLayout()) {
      return {
        x: window.scrollX + getMobileRailViewportX(),
        y: anchorTop + window.scrollY + anchorHeight * 0.52,
      };
    }

    const railOffset = window.innerWidth < 760 ? 18 : 38;
    const minX = window.scrollX + 18;
    const maxX = window.scrollX + document.documentElement.clientWidth - 18;
    const preferredX = rect.left + window.scrollX - railOffset;

    return {
      x: clamp(preferredX, minX, maxX),
      y: anchorTop + window.scrollY + anchorHeight * 0.52,
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

  function findLengthForPoint(target, startDistance = 0) {
    const sampleCount = 360;
    const startRatio = state.pathLength > 0 ? clamp(startDistance / state.pathLength, 0, 1) : 0;
    let closestDistanceOnPath = startDistance;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let i = Math.round(startRatio * sampleCount); i <= sampleCount; i += 1) {
      const ratio = i / sampleCount;
      const distanceOnPath = state.pathLength * ratio;
      const point = ropePath.getPointAtLength(distanceOnPath);
      const distance = Math.hypot(point.x - target.x, point.y - target.y);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestDistanceOnPath = distanceOnPath;
      }
    }

    return closestDistanceOnPath;
  }

  function calculateMilestones(points) {
    let previousDistance = 0;

    return points.map((point, index) => {
      if (index === 0) return 0;

      previousDistance = findLengthForPoint(point, previousDistance);
      return previousDistance;
    });
  }

  function setBurnProgress(sparkDistance) {
    const dashOffset = Math.max(state.pathLength - sparkDistance, 0);

    [burnedPath, emberTrailPath].forEach((path) => {
      path.style.strokeDasharray = `${state.pathLength}`;
      path.style.strokeDashoffset = `${dashOffset}`;
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

    state.points = state.sections.map(({ anchor, section }) => getAnchorPoint(anchor, section));
    const pathData = buildFusePath(state.points);

    ropePath.setAttribute('d', pathData);
    burnedPath.setAttribute('d', pathData);
    emberTrailPath.setAttribute('d', pathData);
    burnedPath.removeAttribute('pathLength');
    emberTrailPath.removeAttribute('pathLength');
    state.pathLength = ropePath.getTotalLength();

    if (!Number.isFinite(state.pathLength) || state.pathLength <= 0) {
      state.pathLength = 0;
      state.sparkDistance = 0;
      state.isActive = false;
      overlay.hidden = true;
      document.documentElement.classList.remove('fuse-ready');
      writeSelfCheck();
      queueLayoutRetry();
      return;
    }

    state.milestones = calculateMilestones(state.points);
    state.isActive = true;
    overlay.hidden = false;
    document.documentElement.classList.add('fuse-ready');
    updateFuse();
  }

  function getScrollProgress() {
    const doc = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
    const viewportHeight = window.innerHeight || doc.clientHeight || 1;
    const maxScroll = Math.max(scrollHeight - viewportHeight, 1);
    const scrollTop = window.scrollY || window.pageYOffset || doc.scrollTop || body.scrollTop || 0;

    return clamp(scrollTop / maxScroll, 0, 1);
  }

  function getFallbackSparkPoint(progress) {
    if (state.points.length >= 2) {
      const scaledProgress = clamp(progress, 0, 1) * (state.points.length - 1);
      const startIndex = Math.min(Math.floor(scaledProgress), state.points.length - 2);
      const endIndex = startIndex + 1;
      const segmentProgress = scaledProgress - startIndex;
      const start = state.points[startIndex];
      const end = state.points[endIndex];

      return {
        x: start.x + (end.x - start.x) * segmentProgress,
        y: start.y + (end.y - start.y) * segmentProgress,
      };
    }

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 1;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;

    return {
      x: window.scrollX + viewportWidth * (0.18 + 0.64 * progress),
      y: window.scrollY + viewportHeight * (0.2 + 0.6 * progress),
    };
  }

  function getFallbackSparkViewportPoint(progress) {
    const bounds = getSafeViewportBounds();
    const travelWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const travelHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const weave = 0.5 + Math.sin(progress * Math.PI * 4) * 0.24;

    return {
      x: bounds.minX + travelWidth * weave,
      y: bounds.minY + travelHeight * clamp(progress, 0, 1),
    };
  }

  function toViewportPoint(point, progress) {
    const sourcePoint = Number.isFinite(point?.x) && Number.isFinite(point?.y)
      ? point
      : getFallbackSparkPoint(progress);
    const bounds = getSafeViewportBounds();

    const viewportPoint = {
      x: sourcePoint.x - window.scrollX,
      y: sourcePoint.y - window.scrollY,
    };

    if (isMobileFuseLayout()) {
      return {
        x: clamp(getMobileRailViewportX() + getViewportMetrics().offsetLeft, bounds.minX, bounds.maxX),
        y: clamp(viewportPoint.y, bounds.minY, bounds.maxY),
      };
    }

    const isVisible =
      viewportPoint.x >= bounds.minX &&
      viewportPoint.x <= bounds.maxX &&
      viewportPoint.y >= bounds.minY &&
      viewportPoint.y <= bounds.maxY;

    if (!isVisible) {
      return getFallbackSparkViewportPoint(progress);
    }

    return viewportPoint;
  }

  function setIgnitedSections(sparkDistance) {
    state.sections.forEach(({ section }, index) => {
      const milestone = state.milestones[index] ?? Number.POSITIVE_INFINITY;
      const tolerance = Math.max(state.pathLength * 0.006, 8);

      if (sparkDistance + tolerance >= milestone) {
        const wasIgnited = section.classList.contains('is-ignited');

        section.classList.add('is-ignited');

        if (!wasIgnited) {
          section.classList.add('is-igniting');
          window.setTimeout(() => section.classList.remove('is-igniting'), 900);
        }
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

  function updateSpark(point, angle, progress) {
    const viewportPoint = toViewportPoint(point, progress);

    state.sparkViewportPoint = viewportPoint;
    spark.classList.add('is-visible');
    spark.style.setProperty('--spark-angle', `${angle}rad`);
    spark.style.left = `${viewportPoint.x.toFixed(1)}px`;
    spark.style.top = `${viewportPoint.y.toFixed(1)}px`;
  }

  function updateFuse() {
    state.isScheduled = false;

    if (!state.isActive || state.pathLength <= 0) {
      queueLayoutRetry();
      return;
    }

    const progress = getScrollProgress();
    const sparkDistance = clamp(progress * state.pathLength, 0, state.pathLength);
    let point = ropePath.getPointAtLength(sparkDistance);
    let nextPoint = ropePath.getPointAtLength(clamp(sparkDistance + 2, 0, state.pathLength));

    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(nextPoint.x) ||
      !Number.isFinite(nextPoint.y)
    ) {
      point = getFallbackSparkPoint(progress);
      nextPoint = getFallbackSparkPoint(clamp(progress + 0.002, 0, 1));
      queueLayoutRetry();
    }

    const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x);
    const now = performance.now();

    state.progress = progress;
    state.sparkDistance = sparkDistance;
    overlay.style.setProperty('--fuse-progress', progress.toFixed(4));
    setBurnProgress(sparkDistance);
    updateSpark(point, angle, progress);
    setIgnitedSections(sparkDistance);
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
    window.visualViewport?.removeEventListener('resize', scheduleLayout);
    window.visualViewport?.removeEventListener('scroll', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleLayout);
    window.visualViewport?.addEventListener('resize', scheduleLayout);
    window.visualViewport?.addEventListener('scroll', scheduleUpdate, { passive: true });
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
