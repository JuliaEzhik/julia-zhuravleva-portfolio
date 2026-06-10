import * as THREE from 'three';
import { CONFIG } from './config.js';

const YAW_RAD = THREE.MathUtils.degToRad(CONFIG.domino.yawDeg);
const REST_ANGLE = THREE.MathUtils.degToRad(86.5);
const STACK_SETTLE_SLIDE = CONFIG.domino.depth * 0.2;
const CONTACT_GEOMETRY = createContactGeometry();
const PRE_IMPACT_LEAN = THREE.MathUtils.degToRad(1.4);
const CONTACT_HOLD_ALLOWANCE = THREE.MathUtils.degToRad(1.8);

/**
 * Keyframe chain-reaction controller — tuned collision timing, no physics engine.
 */
export class AnimationController {
  /**
   * @param {import('./DominoScene.js').DominoScene} scene
   * @param {{ onComplete?: () => void, onImpact?: () => void }} callbacks
   */
  constructor(scene, callbacks = {}) {
    this.scene = scene;
    this.onComplete = callbacks.onComplete ?? (() => {});
    this.onImpact = callbacks.onImpact ?? (() => {});

    this.state = 'idle';
    this.elapsed = 0;
    this.dominoes = [];
    this.fallStarts = [];
    this.contactTimes = [];
    this.contactFired = [];
    this.lastFallStart = Infinity;
    this.shakeElapsed = 0;
    this.shakeActive = false;
    this._impactFired = false;
    this._completeFired = false;
    this._titleRevealElapsed = 0;
    this._syncDominoes();
    this._unsubscribeDominoLayout = scene.onDominoLayoutChange?.(() => {
      this._handleDominoLayoutChange();
    });
  }

  _syncDominoes() {
    if (this.dominoes === this.scene.dominoes && this.fallStarts.length === this.scene.dominoes.length) {
      return false;
    }

    this.dominoes = this.scene.dominoes;
    this.fallStarts = new Array(this.dominoes.length).fill(Infinity);
    this.contactTimes = new Array(this.dominoes.length).fill(-Infinity);
    this.contactFired = new Array(this.dominoes.length).fill(false);
    return true;
  }

  _handleDominoLayoutChange() {
    const wasPlaying = this.state === 'playing';
    const wasComplete = this.state === 'complete';

    this._syncDominoes();
    this.reset();

    if (wasComplete) {
      this.showEndState();
    } else if (wasPlaying) {
      this.start();
    }
  }

  _impactAngleRad() {
    return CONTACT_GEOMETRY.contactAngle;
  }

  _variation(index, salt = 0) {
    return Math.sin((index + 1) * 12.9898 + salt * 78.233) * 0.5 + 0.5;
  }

  _profile(index) {
    const timing = CONFIG.timing;
    const tempo = this._variation(index, 0.2) - 0.5;

    return {
      duration: timing.fallDuration * (0.96 + tempo * 0.09),
      contactAngle: this._impactAngleRad(),
      contactDelay: 0.016 + this._variation(index, 1.4) * 0.012,
      settleAccent: 0.88 + this._variation(index, 2.1) * 0.22,
      wobblePhase: this._variation(index, 3.5) * Math.PI * 2,
    };
  }

  _fallMotion(localT, index) {
    const impactT = 0.84;
    const overshoot = THREE.MathUtils.degToRad(4.5 + this._variation(index, 4.2) * 2.2);
    const impactTarget = Math.PI / 2;
    const target = REST_ANGLE;
    const profile = this._profile(index);

    if (localT >= 1) {
      return {
        angle: REST_ANGLE,
        yawWobble: 0,
        wobble: 0,
        compression: 0,
        liftY: 0,
        slideBack: STACK_SETTLE_SLIDE,
        highlight: 0,
      };
    }

    if (localT <= impactT) {
      const u = Math.max(0, localT / impactT);
      const accelerated = Math.pow(u, 2.22);
      const weightShift = Math.sin(u * Math.PI) * u * 0.018;

      return {
        angle: accelerated * (impactTarget + overshoot * 0.55),
        yawWobble: weightShift * (this._variation(index, 5.1) - 0.5),
        wobble: 0,
        compression: this._contactPulse(index, 0.24) * 0.65,
        liftY: 0,
        slideZ: 0,
        highlight: this._contactPulse(index, 0.22) * 0.55,
      };
    }

    const u = Math.min(1, Math.max(0, (localT - impactT) / (1 - impactT)));
    const damp = Math.exp(-4.4 * u);
    const rebound = Math.cos(u * Math.PI * 3.2 + profile.wobblePhase * 0.12) * damp;
    const settle = smoothstep(u);
    const angle = THREE.MathUtils.lerp(impactTarget + overshoot, target, settle) + rebound * 0.028;
    const groundPulse = Math.sin(Math.min(u * Math.PI, Math.PI)) * damp * profile.settleAccent;

    return {
      angle,
      yawWobble: rebound * 0.012,
      wobble: rebound * 0.018,
      compression: groundPulse + this._contactPulse(index, 0.24) * 0.5,
      liftY: Math.max(0, rebound) * 0.006,
      slideBack: STACK_SETTLE_SLIDE * settle,
      highlight: groundPulse * 0.35 + this._contactPulse(index, 0.22) * 0.5,
    };
  }

  _contactPulse(index, duration) {
    const age = this.elapsed - this.contactTimes[index];
    if (age < 0 || age > duration) return 0;

    const u = age / duration;
    return Math.sin(u * Math.PI) * Math.pow(1 - u, 0.65);
  }

  /**
   * Contact uses the front-to-back fall projected onto the row direction.
   * The slight overlap allowance lets each tile lean into the next before release.
   */
  _hasReachedContact(angle) {
    const rowReach = CONTACT_GEOMETRY.height * CONTACT_GEOMETRY.frontBackRowProjection * Math.sin(angle);
    return rowReach >= CONTACT_GEOMETRY.contactGap;
  }

  _nextStartTime(index, lastIndex) {
    return index + 1 === lastIndex ? this.lastFallStart : this.fallStarts[index + 1];
  }

  _isVerticalZigzagLayout() {
    return this.scene.getDominoLayoutMode?.() === 'vertical-zigzag';
  }

  _fallSignForIndex(index) {
    if (!this._isVerticalZigzagLayout()) return 1;
    return index % 2 === 0 ? -1 : 1;
  }

  _applyPreImpactResponse(lastIndex) {
    for (let i = 1; i <= lastIndex; i++) {
      const start = i === lastIndex ? this.lastFallStart : this.fallStarts[i];
      if (this.elapsed >= start || this.contactTimes[i] === -Infinity) continue;

      const pulse = this._contactPulse(i, 0.18);
      this.dominoes[i].setFallAngle(PRE_IMPACT_LEAN * pulse, {
        fallSign: this._fallSignForIndex(i),
        wobble: Math.sin(pulse * Math.PI) * 0.01,
        yawWobble: pulse * 0.006,
        compression: pulse * 0.72,
      });
      this.dominoes[i].setImpactHighlight(pulse * 0.55);
    }
  }

  start() {
    this._syncDominoes();
    this.reset(false);
    this.state = 'playing';
    this.elapsed = 0;
    /** Screen-left domino (index 0, local +Z) leads the chain toward screen-right. */
    this.fallStarts[0] = CONFIG.timing.holdBeforeStart;
  }

  /** Show final pose immediately (prefers-reduced-motion) */
  showEndState() {
    this._syncDominoes();
    this.state = 'complete';
    this.dominoes.forEach((d, i) => {
      d.setImpactHighlight(0);
      const fallSign = this._fallSignForIndex(i);
      if (i < this.dominoes.length - 1) {
        d.setFallAngle(REST_ANGLE, { fallSign, slideBack: STACK_SETTLE_SLIDE });
      } else {
        d.setLastDominoPose(1, { fallSign });
      }
    });
    this.scene.clearCameraShake();
    this.scene.setTitleReveal(1);
    if (!this._completeFired) {
      this._completeFired = true;
      this.onComplete();
    }
  }

  reset(clearDominoes = true) {
    this._syncDominoes();
    if (clearDominoes) {
      this.dominoes.forEach((d) => d.reset());
    }
    this.state = 'idle';
    this.elapsed = 0;
    this.fallStarts.fill(Infinity);
    this.contactTimes.fill(-Infinity);
    this.contactFired.fill(false);
    this.lastFallStart = Infinity;
    this.shakeActive = false;
    this.shakeElapsed = 0;
    this._impactFired = false;
    this._completeFired = false;
    this._titleRevealElapsed = 0;
    this.scene.clearCameraShake();
    this.scene.resetTitleReveal();
  }

  /**
   * Advance animation by dt seconds; call each frame from the render loop.
   * @param {number} dt
   */
  update(dt) {
    this._syncDominoes();
    if (this.state === 'idle') return;

    if (this.state === 'complete') {
      this._updateTitleReveal(dt);
      return;
    }

    this.elapsed += dt;
    const { lastFallDuration } = CONFIG.timing;
    const lastIndex = this.dominoes.length - 1;

    this._applyPreImpactResponse(lastIndex);

    if (this._isVerticalZigzagLayout()) {
      this._updateVerticalZigzag(lastIndex, lastFallDuration, dt);
      return;
    }

    for (let i = 0; i < lastIndex; i++) {
      const start = this.fallStarts[i];
      if (this.elapsed < start) continue;

      const profile = this._profile(i);
      const localT = (this.elapsed - start) / profile.duration;
      const motion = this._fallMotion(localT, i);
      const nextStart = this._nextStartTime(i, lastIndex);
      if (this.contactFired[i] && this.elapsed < nextStart) {
        motion.angle = Math.min(motion.angle, profile.contactAngle + CONTACT_HOLD_ALLOWANCE);
        motion.compression = Math.max(motion.compression, this._contactPulse(i, 0.18) * 0.8);
      }
      this.dominoes[i].setFallAngle(motion.angle, motion);
      this.dominoes[i].setImpactHighlight(motion.highlight);

      if (this._hasReachedContact(motion.angle) && !this.contactFired[i]) {
        this.contactFired[i] = true;
        this.contactTimes[i] = this.elapsed;
        this.contactTimes[i + 1] = this.elapsed;
        if (i + 1 === lastIndex) {
          this.lastFallStart = this.elapsed + profile.contactDelay;
        } else {
          this.fallStarts[i + 1] = this.elapsed + profile.contactDelay;
        }
      }
    }

    if (this.lastFallStart !== Infinity && this.elapsed >= this.lastFallStart) {
      const localT = (this.elapsed - this.lastFallStart) / lastFallDuration;
      const t = Math.min(localT, 1);
      this.dominoes[lastIndex].setLastDominoPose(t);
      this.dominoes[lastIndex].setImpactHighlight(this._contactPulse(lastIndex, 0.26));

      if (t >= 0.68 && !this._impactFired) {
        this._impactFired = true;
        this.contactTimes[lastIndex] = this.elapsed;
        this.shakeActive = true;
        this.shakeElapsed = 0;
        this.onImpact();
      }

      if (this.shakeActive) {
        this.shakeElapsed += dt;
        const { shakeIntensity, shakeDuration } = CONFIG.impact;
        const fade = 1 - this.shakeElapsed / shakeDuration;
        if (fade > 0) {
          this.scene.applyCameraShake(shakeIntensity * fade, this.shakeElapsed);
        } else {
          this.shakeActive = false;
          this.scene.clearCameraShake();
        }
      }

      if (localT >= 1 && !this._completeFired) {
        this.dominoes[lastIndex].setLastDominoPose(1);
        this.state = 'complete';
        this.scene.clearCameraShake();
        this._completeFired = true;
        this._titleRevealElapsed = 0;
        this.onComplete();
        this._updateTitleReveal(dt);
      }
    }
  }

  _updateVerticalZigzag(lastIndex, lastFallDuration, dt) {
    for (let i = 0; i < lastIndex; i++) {
      const start = this.fallStarts[i];
      if (this.elapsed < start) continue;

      const profile = this._profile(i);
      const localT = (this.elapsed - start) / profile.duration;
      const motion = this._fallMotion(localT, i);
      const nextStart = this._nextStartTime(i, lastIndex);
      motion.fallSign = this._fallSignForIndex(i);

      if (this.contactFired[i] && this.elapsed < nextStart) {
        motion.angle = Math.min(motion.angle, profile.contactAngle + CONTACT_HOLD_ALLOWANCE);
        motion.compression = Math.max(motion.compression, this._contactPulse(i, 0.18) * 0.8);
      }

      this.dominoes[i].setFallAngle(motion.angle, motion);
      this.dominoes[i].setImpactHighlight(motion.highlight);

      if (localT >= 0.54 && !this.contactFired[i]) {
        this.contactFired[i] = true;
        this.contactTimes[i] = this.elapsed;
        this.contactTimes[i + 1] = this.elapsed;
        if (i + 1 === lastIndex) {
          this.lastFallStart = this.elapsed + profile.contactDelay + 0.025;
        } else {
          this.fallStarts[i + 1] = this.elapsed + profile.contactDelay + 0.025;
        }
      }
    }

    if (this.lastFallStart !== Infinity && this.elapsed >= this.lastFallStart) {
      const localT = (this.elapsed - this.lastFallStart) / lastFallDuration;
      const t = Math.min(localT, 1);
      this.dominoes[lastIndex].setLastDominoPose(t, {
        fallSign: this._fallSignForIndex(lastIndex),
      });
      this.dominoes[lastIndex].setImpactHighlight(this._contactPulse(lastIndex, 0.26));

      if (t >= 0.68 && !this._impactFired) {
        this._impactFired = true;
        this.contactTimes[lastIndex] = this.elapsed;
        this.shakeActive = true;
        this.shakeElapsed = 0;
        this.onImpact();
      }

      if (this.shakeActive) {
        this.shakeElapsed += dt;
        const { shakeIntensity, shakeDuration } = CONFIG.impact;
        const fade = 1 - this.shakeElapsed / shakeDuration;
        if (fade > 0) {
          this.scene.applyCameraShake(shakeIntensity * fade, this.shakeElapsed);
        } else {
          this.shakeActive = false;
          this.scene.clearCameraShake();
        }
      }

      if (localT >= 1 && !this._completeFired) {
        this.dominoes[lastIndex].setLastDominoPose(1, {
          fallSign: this._fallSignForIndex(lastIndex),
        });
        this.state = 'complete';
        this.scene.clearCameraShake();
        this._completeFired = true;
        this._titleRevealElapsed = 0;
        this.onComplete();
        this._updateTitleReveal(dt);
      }
    }
  }

  _updateTitleReveal(dt) {
    const { titleRevealDelay, titleRevealDuration } = CONFIG.timing;
    const total = titleRevealDelay + titleRevealDuration;
    if (this._titleRevealElapsed >= total) return;

    this._titleRevealElapsed += dt;
    const t = Math.max(0, (this._titleRevealElapsed - titleRevealDelay) / titleRevealDuration);
    const eased = 1 - Math.pow(1 - Math.min(t, 1), 3);
    this.scene.setTitleReveal(eased);
  }
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function createContactGeometry() {
  const { width, height, depth, spacing, yawDeg } = CONFIG.domino;
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const chainHalfDepth = (Math.abs(Math.sin(yaw)) * width + Math.abs(Math.cos(yaw)) * depth) / 2;
  const frontBackRowProjection = Math.max(0.001, Math.abs(Math.cos(yaw)));
  const leanOverlap = depth * 0.16 * frontBackRowProjection;
  const contactGap = Math.max(0.001, spacing - chainHalfDepth * 2 - leanOverlap);
  const contactAngle = Math.asin(Math.min(0.985, contactGap / (height * frontBackRowProjection)));

  return {
    height,
    spacing,
    chainHalfDepth,
    frontBackRowProjection,
    leanOverlap,
    contactGap,
    contactAngle,
  };
}
