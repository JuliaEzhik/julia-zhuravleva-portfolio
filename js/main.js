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
    routeSamples: [],
    milestones: [],
    pathLength: 0,
    progress: 0,
    targetProgress: 0,
    targetDistance: 0,
    displayedDistance: 0,
    sparkDistance: 0,
    sparkViewportPoint: { x: -100, y: -100 },
    lastValidPoint: null,
    lastParticleAt: 0,
    lastFrameAt: 0,
    lastScrollAt: 0,
    layoutWidth: 0,
    layoutViewportHeight: 1,
    maxScroll: 1,
    layoutRetryTimer: 0,
    layoutTimer: 0,
    animationFrame: 0,
    isScheduled: false,
    isActive: false,
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function isFinitePoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
  }

  function getViewportMetrics() {
    const doc = document.documentElement;
    const visualViewport = window.visualViewport;
    const width = doc.clientWidth || window.innerWidth || visualViewport?.width || 1;
    const height = doc.clientHeight || window.innerHeight || visualViewport?.height || 1;

    return {
      width,
      height,
      visibleWidth: visualViewport?.width || width,
      visibleHeight: visualViewport?.height || height,
    };
  }

  function isMobileFuseLayout() {
    return getViewportMetrics().width <= 639;
  }

  function getMobileRailViewportX() {
    const { width } = getViewportMetrics();

    return clamp(width * 0.11, 26, 42);
  }

  function getScrollX() {
    return window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
  }

  function getScrollY() {
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function getClampedScrollY() {
    return clamp(getScrollY(), 0, state.isActive ? state.maxScroll : Number.MAX_SAFE_INTEGER);
  }

  function getSafeViewportBounds(margin = 24) {
    const viewport = getViewportMetrics();

    return {
      minX: margin,
      maxX: Math.max(viewport.visibleWidth - margin, margin),
      minY: margin,
      maxY: Math.max(viewport.visibleHeight - margin, margin),
      width: viewport.visibleWidth,
      height: viewport.visibleHeight,
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
      scheduleLayout(180);
    }, 180);
  }

  function setReducedMotionState() {
    document.documentElement.classList.remove('fuse-ready');
    overlay.hidden = true;
    state.isActive = false;
    igniteAll();
    writeSelfCheck();
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleViewportResize);
    window.removeEventListener('orientationchange', handleOrientationChange);
    window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    window.clearTimeout(state.layoutTimer);
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = 0;
    state.isScheduled = false;
  }

  function getAnchorPoint(anchor, section) {
    const rect = anchor.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const viewport = getViewportMetrics();
    const scrollX = getScrollX();
    const scrollY = getScrollY();
    const isHiddenAnchor = rect.width === 0 && rect.height === 0;
    const anchorTop = isHiddenAnchor ? sectionRect.top : rect.top;
    const anchorHeight = isHiddenAnchor ? Math.min(sectionRect.height * 0.16, 120) : rect.height;

    if (isMobileFuseLayout()) {
      return {
        x: scrollX + getMobileRailViewportX(),
        y: anchorTop + scrollY + anchorHeight * 0.52,
      };
    }

    const railOffset = viewport.width < 760 ? 18 : 38;
    const minX = scrollX + 18;
    const maxX = scrollX + Math.max(viewport.width - 18, 18);
    const preferredX = rect.left + scrollX - railOffset;

    return {
      x: clamp(preferredX, minX, maxX),
      y: anchorTop + scrollY + anchorHeight * 0.52,
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

  function buildRouteSamples() {
    const sampleCount = Math.round(clamp(state.pathLength / 28, 140, 560));

    state.routeSamples = Array.from({ length: sampleCount + 1 }, (_, index) => {
      const distance = state.pathLength * (index / sampleCount);
      const point = ropePath.getPointAtLength(distance);

      return {
        distance,
        x: point.x,
        y: point.y,
      };
    }).filter((sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y));
  }

  function setBurnProgress(sparkDistance) {
    const dashOffset = Math.max(state.pathLength - sparkDistance, 0);

    [burnedPath, emberTrailPath].forEach((path) => {
      path.style.strokeDasharray = `${state.pathLength}`;
      path.style.strokeDashoffset = `${dashOffset}`;
    });
  }

  function layoutFuse() {
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
    const previousProgress = state.pathLength > 0
      ? clamp(state.displayedDistance / state.pathLength, 0, 1)
      : getScrollProgress();

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

    buildRouteSamples();
    state.milestones = calculateMilestones(state.points);
    state.layoutWidth = doc.clientWidth || window.innerWidth || 1;
    state.layoutViewportHeight = doc.clientHeight || window.innerHeight || 1;
    state.maxScroll = Math.max(docHeight - state.layoutViewportHeight, 1);
    state.displayedDistance = clamp(previousProgress * state.pathLength, 0, state.pathLength);
    state.targetDistance = state.displayedDistance;
    state.lastValidPoint = null;
    state.lastFrameAt = 0;
    state.isActive = true;
    overlay.hidden = false;
    document.documentElement.classList.add('fuse-ready');
    scheduleUpdate();
  }

  function getScrollProgress() {
    const doc = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
    const viewportHeight = doc.clientHeight || window.innerHeight || 1;
    const measuredMaxScroll = Math.max(scrollHeight - viewportHeight, 1);
    const maxScroll = state.isActive ? state.maxScroll : measuredMaxScroll;
    const rawScrollTop = getScrollY();
    const scrollTop = clamp(rawScrollTop, 0, maxScroll);

    return rawScrollTop >= measuredMaxScroll - 2
      ? 1
      : clamp(scrollTop / maxScroll, 0, 1);
  }

  function getRouteDistanceForViewport(progress) {
    if (state.routeSamples.length < 2) {
      return clamp(progress * state.pathLength, 0, state.pathLength);
    }

    const firstSample = state.routeSamples[0];
    const lastSample = state.routeSamples[state.routeSamples.length - 1];
    if (progress <= 0.001) return 0;
    if (progress >= 0.999) return state.pathLength;

    const visibleTop = progress * state.maxScroll;
    const targetY = clamp(
      visibleTop + state.layoutViewportHeight * 0.46,
      Math.min(firstSample.y, lastSample.y),
      Math.max(firstSample.y, lastSample.y)
    );

    if (targetY <= firstSample.y) return firstSample.distance;
    if (targetY >= lastSample.y) return lastSample.distance;

    let low = 0;
    let high = state.routeSamples.length - 1;

    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);

      if (state.routeSamples[mid].y < targetY) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const start = state.routeSamples[low];
    const end = state.routeSamples[high];
    const segmentHeight = end.y - start.y;
    const segmentProgress = Math.abs(segmentHeight) > 0.001
      ? clamp((targetY - start.y) / segmentHeight, 0, 1)
      : 0;

    return clamp(
      start.distance + (end.distance - start.distance) * segmentProgress,
      0,
      state.pathLength
    );
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

    const viewport = getViewportMetrics();

    return {
      x: getScrollX() + viewport.width * (0.18 + 0.64 * progress),
      y: getScrollY() + viewport.height * (0.2 + 0.6 * progress),
    };
  }

  function toViewportPoint(point, progress) {
    const sourcePoint = isFinitePoint(point)
      ? point
      : state.lastValidPoint || getFallbackSparkPoint(progress);
    return {
      x: sourcePoint.x - getScrollX(),
      y: sourcePoint.y - getClampedScrollY(),
    };
  }

  function setIgnitedSections(sparkDistance) {
    state.sections.forEach(({ section }, index) => {
      const milestone = state.milestones[index] ?? Number.POSITIVE_INFINITY;
      const tolerance = Math.max(state.pathLength * 0.006, 8);
      const shouldIgnite = sparkDistance + tolerance >= milestone;
      const wasIgnited = section.classList.contains('is-ignited');

      section.classList.toggle('is-ignited', shouldIgnite);
      if (shouldIgnite && !wasIgnited) {
        section.classList.add('is-igniting');
        window.setTimeout(() => section.classList.remove('is-igniting'), 900);
      } else if (!shouldIgnite) {
        section.classList.remove('is-igniting');
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

  function setSparkViewportPoint(viewportPoint, angle) {
    state.sparkViewportPoint = viewportPoint;
    spark.classList.add('is-visible');
    spark.style.setProperty('--spark-angle', `${angle}rad`);
    spark.style.setProperty('--spark-x', `${viewportPoint.x.toFixed(1)}px`);
    spark.style.setProperty('--spark-y', `${viewportPoint.y.toFixed(1)}px`);
  }

  function updateSpark(point, angle, progress) {
    setSparkViewportPoint(toViewportPoint(point, progress), angle);
  }

  function getPathPoint(distance) {
    try {
      const point = ropePath.getPointAtLength(clamp(distance, 0, state.pathLength));
      return isFinitePoint(point) ? point : null;
    } catch {
      return null;
    }
  }

  function updateFuse(now = performance.now()) {
    state.animationFrame = 0;
    state.isScheduled = false;

    if (!state.isActive || state.pathLength <= 0) {
      queueLayoutRetry();
      return;
    }

    const progress = getScrollProgress();
    state.targetProgress = progress;
    state.targetDistance = clamp(getRouteDistanceForViewport(progress), 0, state.pathLength);

    const dt = state.lastFrameAt > 0 ? Math.min((now - state.lastFrameAt) / 1000, 0.05) : 0.05;
    const alpha = 1 - Math.exp(-22 * dt);
    const maxLag = Math.max(28, state.pathLength * 0.012);
    let displayedDistance = state.displayedDistance
      + (state.targetDistance - state.displayedDistance) * alpha;

    if (progress <= 0.001 || progress >= 0.999) {
      displayedDistance = state.targetDistance;
    } else {
      displayedDistance = clamp(
        displayedDistance,
        state.targetDistance - maxLag,
        state.targetDistance + maxLag
      );

      if (Math.abs(state.targetDistance - displayedDistance) < 0.35) {
        displayedDistance = state.targetDistance;
      }
    }

    const sparkDistance = clamp(displayedDistance, 0, state.pathLength);
    const tangentStep = state.targetDistance < state.displayedDistance ? -2 : 2;
    let point = getPathPoint(sparkDistance);
    let nextPoint = getPathPoint(sparkDistance + tangentStep);

    if (!isFinitePoint(point)) {
      point = state.lastValidPoint || getFallbackSparkPoint(progress);
      queueLayoutRetry();
    }
    if (!isFinitePoint(nextPoint)) nextPoint = point;
    if (isFinitePoint(point)) state.lastValidPoint = { x: point.x, y: point.y };

    const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x);
    const displayProgress = state.pathLength > 0 ? sparkDistance / state.pathLength : progress;

    state.lastFrameAt = now;
    state.displayedDistance = sparkDistance;
    state.progress = displayProgress;
    state.sparkDistance = sparkDistance;
    overlay.style.setProperty('--fuse-progress', displayProgress.toFixed(4));
    setBurnProgress(sparkDistance);
    updateSpark(point, angle, displayProgress);
    setIgnitedSections(sparkDistance);
    writeSelfCheck();

    if (now - state.lastParticleAt > (isMobileFuseLayout() ? 150 : 100) && progress > 0.01 && progress < 0.995) {
      emitParticle('ember', point, angle);

      if (!isMobileFuseLayout() && Math.random() > 0.55) {
        emitParticle('smoke', point, angle);
      }

      state.lastParticleAt = now;
    }

    if (Math.abs(state.targetDistance - state.displayedDistance) >= 0.35) {
      scheduleUpdate();
    }
  }

  function scheduleUpdate() {
    if (state.isScheduled) return;

    state.isScheduled = true;
    state.animationFrame = requestAnimationFrame(updateFuse);
  }

  function handleScroll() {
    state.lastScrollAt = performance.now();
    scheduleUpdate();
  }

  function scheduleLayout(delay = 180) {
    window.clearTimeout(state.layoutTimer);
    state.layoutTimer = window.setTimeout(() => {
      const scrollAge = performance.now() - state.lastScrollAt;
      if (scrollAge < 140) {
        scheduleLayout(160);
        return;
      }
      state.layoutTimer = 0;
      layoutFuse();
    }, delay);
  }

  function handleViewportResize() {
    const width = document.documentElement.clientWidth || window.innerWidth || 1;
    if (Math.abs(width - state.layoutWidth) > 2) {
      scheduleLayout(240);
    } else {
      scheduleUpdate();
    }
  }

  function handleOrientationChange() {
    scheduleLayout(280);
  }

  function activateFuse() {
    if (reducedMotionQuery.matches) return;

    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleViewportResize);
    window.removeEventListener('orientationchange', handleOrientationChange);
    window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleViewportResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.visualViewport?.addEventListener('resize', scheduleUpdate, { passive: true });
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
 * Phone gallery marquee — auto-scrolls on small screens, pauses for native swipe.
 */
(function initGalleryMarquee() {
  'use strict';

  const viewport = document.querySelector('.screen-gallery__viewport');
  const track = document.querySelector('.screen-gallery__grid');

  if (!(viewport instanceof HTMLElement) || !(track instanceof HTMLElement)) {
    return;
  }

  const mobileQuery = window.matchMedia('(max-width: 639px)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SPEED_PX_PER_SEC = 42;
  const RESUME_DELAY_MS = 1500;

  let interacting = false;
  let inView = true;
  let wrapping = false;
  let resumeTimer = 0;
  let kickstartTimer = 0;
  let rafId = 0;
  let lastTime = 0;
  let loopWidth = 0;
  let position = 0;

  function isMarqueeEnabled() {
    return mobileQuery.matches && !reducedMotionQuery.matches;
  }

  function hardenImages() {
    track.querySelectorAll('img').forEach((image) => {
      image.draggable = false;
      image.setAttribute('draggable', 'false');

      if (isMarqueeEnabled()) {
        image.loading = 'eager';
      }
    });
  }

  function setScrollLeft(value) {
    const next = Math.max(0, value);

    wrapping = true;
    viewport.scrollLeft = next;

    if (Math.abs(viewport.scrollLeft - next) > 1 && typeof viewport.scrollTo === 'function') {
      viewport.scrollTo(next, 0);
    }

    wrapping = false;
  }

  function removeClones() {
    track.querySelectorAll('.screen-card--clone').forEach((clone) => clone.remove());
    loopWidth = 0;
    position = 0;
  }

  function ensureClones() {
    if (!isMarqueeEnabled()) {
      removeClones();
      return;
    }

    if (track.querySelector('.screen-card--clone')) {
      measureLoop();
      return;
    }

    const originals = Array.from(track.querySelectorAll('.screen-card'));

    originals.forEach((card) => {
      const clone = card.cloneNode(true);

      if (!(clone instanceof HTMLElement)) return;

      clone.classList.add('screen-card--clone');
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
      clone.querySelectorAll('img').forEach((image) => {
        image.alt = '';
        image.removeAttribute('data-i18n-alt');
        image.draggable = false;
        image.setAttribute('draggable', 'false');
        image.loading = 'eager';
        image.addEventListener('load', measureLoop, { once: true });
      });
      track.appendChild(clone);
    });

    measureLoop();
    requestAnimationFrame(measureLoop);
  }

  function measureLoop() {
    const first = track.querySelector('.screen-card:not(.screen-card--clone)');
    const clone = track.querySelector('.screen-card--clone');

    if (
      !(first instanceof HTMLElement) ||
      !(clone instanceof HTMLElement) ||
      clone.offsetWidth <= 0
    ) {
      loopWidth = 0;
      return;
    }

    const nextWidth = Math.round(
      clone.getBoundingClientRect().left - first.getBoundingClientRect().left + viewport.scrollLeft
    );

    if (nextWidth > 1) {
      loopWidth = nextWidth;
    }
  }

  function wrapScroll() {
    if (loopWidth <= 1) return;

    if (viewport.scrollLeft >= loopWidth - 0.5) {
      setScrollLeft(viewport.scrollLeft - loopWidth);
    } else if (viewport.scrollLeft < 0) {
      setScrollLeft(viewport.scrollLeft + loopWidth);
    }
  }

  function pause() {
    interacting = true;
    position = viewport.scrollLeft;
    viewport.classList.add('is-paused');
    window.clearTimeout(resumeTimer);
  }

  function scheduleResume() {
    window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      interacting = false;
      position = viewport.scrollLeft;
      viewport.classList.remove('is-paused');
      lastTime = performance.now();
    }, RESUME_DELAY_MS);
  }

  function kickstartScroller() {
    if (!isMarqueeEnabled()) return;

    const current = viewport.scrollLeft;
    setScrollLeft(current + 1);
    setScrollLeft(current);
    position = viewport.scrollLeft;
    lastTime = performance.now();
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);

    if (!isMarqueeEnabled() || interacting || !inView || document.hidden) {
      lastTime = now;
      return;
    }

    if (loopWidth <= 1) {
      measureLoop();
      lastTime = now;
      return;
    }

    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    position += SPEED_PX_PER_SEC * dt;

    while (loopWidth > 1 && position >= loopWidth) {
      position -= loopWidth;
    }

    while (loopWidth > 1 && position < 0) {
      position += loopWidth;
    }

    const next = Math.round(position);

    if (next !== viewport.scrollLeft) {
      setScrollLeft(next);
      wrapScroll();
    }
  }

  function startLoop() {
    if (rafId) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function syncMode() {
    interacting = false;
    viewport.classList.remove('is-paused');
    window.clearTimeout(resumeTimer);
    window.clearTimeout(kickstartTimer);
    ensureClones();
    hardenImages();

    if (isMarqueeEnabled()) {
      startLoop();
      kickstartScroller();
      kickstartTimer = window.setTimeout(kickstartScroller, 120);
    } else {
      stopLoop();
      position = 0;
      setScrollLeft(0);
    }
  }

  function bindRelease(event) {
    const pointerId = event.pointerId;
    const end = (releaseEvent) => {
      if (releaseEvent.pointerId !== undefined && releaseEvent.pointerId !== pointerId) {
        return;
      }
      scheduleResume();
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };

    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  viewport.addEventListener('pointerdown', (event) => {
    if (!mobileQuery.matches) return;
    pause();
    bindRelease(event);
  });
  viewport.addEventListener('touchstart', () => {
    if (!mobileQuery.matches) return;
    pause();
  }, { passive: true });
  viewport.addEventListener('touchend', () => {
    if (!mobileQuery.matches) return;
    scheduleResume();
  }, { passive: true });
  viewport.addEventListener('touchcancel', () => {
    if (!mobileQuery.matches) return;
    scheduleResume();
  }, { passive: true });
  viewport.addEventListener('keydown', () => {
    if (!mobileQuery.matches) return;
    pause();
  });
  viewport.addEventListener('keyup', () => {
    if (!mobileQuery.matches) return;
    scheduleResume();
  });

  viewport.addEventListener('wheel', () => {
    if (!mobileQuery.matches) return;
    pause();
    scheduleResume();
  }, { passive: true });

  viewport.addEventListener('scroll', () => {
    if (wrapping) return;
    if (interacting || Math.abs(viewport.scrollLeft - position) > 1.5) {
      position = viewport.scrollLeft;
    }
    wrapScroll();
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const wasInView = inView;
      inView = entries.some((entry) => entry.isIntersecting);

      if (inView && !wasInView) {
        position = viewport.scrollLeft;
        lastTime = performance.now();
        kickstartScroller();
      }
    }, { threshold: 0.01 });
    observer.observe(viewport);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      position = viewport.scrollLeft;
      lastTime = performance.now();
      kickstartScroller();
    }
  });

  track.querySelectorAll('img').forEach((image) => {
    image.addEventListener('load', () => {
      measureLoop();
      kickstartScroller();
    }, { once: true });
  });

  window.addEventListener('resize', () => {
    measureLoop();
    position = viewport.scrollLeft;
  });
  mobileQuery.addEventListener('change', syncMode);
  reducedMotionQuery.addEventListener('change', syncMode);

  hardenImages();
  syncMode();
})();

/**
 * Contact form — validates input and sends via FormSubmit.co (AJAX).
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
    gotcha: form.elements.namedItem('_gotcha'),
  };

  const status = document.getElementById('contact-form-status');
  const submitButton = form.querySelector('.contact-form__submit');
  const formSubmitEndpoint = `https://formsubmit.co/ajax/${CONTACT_EMAIL_PLACEHOLDER}`;

  function setFieldError(field, message) {
    if (!(field instanceof HTMLElement)) return;

    const error = document.getElementById(`${field.id}-error`);
    field.setAttribute('aria-invalid', message ? 'true' : 'false');

    if (error) {
      error.textContent = message;
      field.setAttribute('aria-describedby', error.id);
    }
  }

  function setStatus(message, { isSuccess = false, isError = false } = {}) {
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('is-success', isSuccess);
    status.classList.toggle('is-error', isError);
  }

  function setSubmitting(isSubmitting) {
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = isSubmitting;
    }
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

  function isSpamSubmission() {
    return fields.gotcha instanceof HTMLInputElement && fields.gotcha.value.trim().length > 0;
  }

  async function submitToFormSubmit() {
    const name = fields.name instanceof HTMLInputElement ? fields.name.value.trim() : '';
    const email = fields.email instanceof HTMLInputElement ? fields.email.value.trim() : '';
    const projectType = getProjectTypeLabel();
    const message = fields.message instanceof HTMLTextAreaElement ? fields.message.value.trim() : '';

    const response = await fetch(formSubmitEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        projectType,
        message,
        _subject: t('form.mailtoSubject', undefined, { type: projectType }),
        _template: 'table',
        _captcha: 'false',
      }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const succeeded =
      response.ok &&
      data &&
      (data.success === true || data.success === 'true');

    return { succeeded, data };
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      setStatus(t('form.statusFix'), { isError: true });
      errors[0].focus();
      return;
    }

    if (isSpamSubmission()) {
      setStatus(t('form.statusSuccess'), { isSuccess: true });
      form.reset();
      return;
    }

    setSubmitting(true);
    setStatus(t('form.statusSending'));

    try {
      const { succeeded } = await submitToFormSubmit();

      if (succeeded) {
        setStatus(t('form.statusSuccess'), { isSuccess: true });
        form.reset();
        return;
      }

      setStatus(t('form.statusError'), { isError: true });
    } catch {
      setStatus(t('form.statusError'), { isError: true });
    } finally {
      setSubmitting(false);
    }
  });
})();

/**
 * Tennisio gallery — CSS marquee row + lightbox on tap/click.
 */
(function initTennisioGallery() {
  'use strict';

  const preview = document.querySelector('.tennisio-preview');
  const track = document.querySelector('.tennisio-preview__track');
  const sourceGroup = document.querySelector('.tennisio-preview__group');
  const lightbox = document.getElementById('tennisio-lightbox');

  if (
    !(preview instanceof HTMLElement) ||
    !(track instanceof HTMLElement) ||
    !(sourceGroup instanceof HTMLElement) ||
    !(lightbox instanceof HTMLElement)
  ) {
    return;
  }

  const lightboxImage = lightbox.querySelector('.tennisio-lightbox__image');
  const lightboxCaption = lightbox.querySelector('.tennisio-lightbox__caption');
  const closeButtons = lightbox.querySelectorAll('[data-tennisio-lightbox-close]');
  const prevButton = lightbox.querySelector('[data-tennisio-lightbox-prev]');
  const nextButton = lightbox.querySelector('[data-tennisio-lightbox-next]');

  if (
    !(lightboxImage instanceof HTMLImageElement) ||
    !(lightboxCaption instanceof HTMLElement) ||
    !(prevButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  let currentIndex = 0;
  let lastFocus = null;

  function buildMirrorGroup() {
    if (track.querySelector('.tennisio-preview__group[aria-hidden="true"]')) {
      return;
    }

    const mirror = sourceGroup.cloneNode(true);
    if (!(mirror instanceof HTMLElement)) return;

    mirror.setAttribute('aria-hidden', 'true');
    mirror.querySelectorAll('.tennisio-preview__slide').forEach((slide) => {
      slide.classList.add('tennisio-preview__slide--mirror');
    });
    mirror.querySelectorAll('button').forEach((button) => {
      const frame = button.querySelector('.laptop-frame');
      if (!(frame instanceof HTMLElement)) {
        button.remove();
        return;
      }

      const replacement = frame.cloneNode(true);
      if (replacement instanceof HTMLElement) {
        replacement.classList.add('laptop-frame--mirror');
        button.replaceWith(replacement);
      }
    });
    mirror.querySelectorAll('figcaption').forEach((caption) => caption.remove());
    mirror.querySelectorAll('img').forEach((image) => {
      image.alt = '';
      image.removeAttribute('data-i18n-alt');
      image.loading = 'eager';
      image.draggable = false;
      image.setAttribute('draggable', 'false');
    });

    track.appendChild(mirror);
  }

  buildMirrorGroup();

  const slides = Array.from(sourceGroup.querySelectorAll('.tennisio-preview__slide'));
  const openButtons = sourceGroup.querySelectorAll('.tennisio-preview__open');
  const items = slides.map((slide) => {
    const image = slide.querySelector('img');
    const caption = slide.querySelector('figcaption');

    return {
      src: image instanceof HTMLImageElement ? image.currentSrc || image.src : '',
      alt: caption instanceof HTMLElement ? caption.textContent.trim() : '',
    };
  });

  function renderLightbox(index) {
    const item = items[index];
    if (!item) return;

    currentIndex = index;
    lightboxImage.src = item.src;
    lightboxImage.alt = item.alt;
    lightboxCaption.textContent = item.alt;
    prevButton.disabled = items.length <= 1;
    nextButton.disabled = items.length <= 1;
  }

  function openLightbox(index, trigger) {
    if (!(trigger instanceof HTMLElement)) return;

    lastFocus = trigger;
    preview.classList.add('is-paused');
    renderLightbox(index);
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-tennisio-lightbox-open');
    lightbox.querySelector('.tennisio-lightbox__close')?.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-tennisio-lightbox-open');
    lightboxImage.removeAttribute('src');
    preview.classList.remove('is-paused');

    if (lastFocus instanceof HTMLElement) {
      lastFocus.focus();
    }
  }

  function stepLightbox(delta) {
    if (!items.length) return;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    renderLightbox(nextIndex);
  }

  openButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number.parseInt(button.getAttribute('data-tennisio-index') || '0', 10);
      openLightbox(Number.isFinite(index) ? index : 0, button);
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', closeLightbox);
  });

  prevButton.addEventListener('click', () => stepLightbox(-1));
  nextButton.addEventListener('click', () => stepLightbox(1));

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepLightbox(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepLightbox(1);
    }
  });

  sourceGroup.querySelectorAll('img').forEach((image) => {
    image.draggable = false;
    image.setAttribute('draggable', 'false');
  });

  onLanguageChange(() => {
    items.splice(0, items.length, ...slides.map((slide) => {
      const image = slide.querySelector('img');
      const caption = slide.querySelector('figcaption');

      return {
        src: image instanceof HTMLImageElement ? image.currentSrc || image.src : '',
        alt: caption instanceof HTMLElement ? caption.textContent.trim() : '',
      };
    }));

    if (!lightbox.hidden) {
      renderLightbox(currentIndex);
    }
  });
})();
