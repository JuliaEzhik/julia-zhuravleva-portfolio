/**
 * Central configuration — customize colors, title, and timing here.
 */

/** Name revealed after the domino chain completes */
export const TITLE_FIRST = 'Julia';
export const TITLE_LAST = 'Zhuravleva';
export const TITLE_TEXT = `${TITLE_FIRST} ${TITLE_LAST}`;

export const SUBTITLE_TEXT = 'Web Developer · UI/UX';

/** Coral accent used on surname and detail lines */
export const ACCENT_COLOR = '#eb4710';

/** Minimal accent palette for premium inset domino faces */
export const DOMINO_COLORS = [
  { front: '#24262b', edge: '#eb4710' },
  { front: '#f1eee6', edge: '#ff5a1f' },
  { front: '#30343b', edge: '#ff7a33' },
  { front: '#e7e0d2', edge: '#ff9a55' },
  { front: '#1f2524', edge: '#ff6424' },
  { front: '#ebe7dc', edge: '#ff8842' },
  { front: '#2b2c30', edge: '#ffb06f' },
  { front: '#f4efe5', edge: '#f25518' },
];

export const CONFIG = {
  dominoCount: DOMINO_COLORS.length,

  /** Domino dimensions (world units) */
  domino: {
    width: 0.42,
    height: 0.88,
    depth: 0.12,
    /** Center spacing along the row; leaves a visible physical gap between yawed bodies */
    spacing: 0.72,
    /** Per-domino yaw, so the faces stay visible while side/depth still reads clearly */
    yawDeg: 64,
    /** Row root Y — keeps dominoes grounded in the lower foreground band. */
    rowY: 0.04,
  },

  /** Camera sits in front with a slight side offset so both bands read clearly */
  camera: {
    desktop: { x: 0.86, y: 1.76, z: 5.85, lookY: 0.88 },
    tablet: { x: 0.68, y: 1.72, z: 6.05, lookY: 0.84 },
    mobile: { x: 0.44, y: 1.78, z: 6.55, lookY: 0.88 },
    fov: { desktop: 42, tablet: 45, mobile: 50 },
  },

  /** Animation timing (seconds) */
  timing: {
    holdBeforeStart: 0.45,
    fallDuration: 0.44,
    impactAngleDeg: 66,
    lastFallDuration: 0.7,
    titleRevealDelay: 0.22,
    titleRevealDuration: 0.92,
  },

  /** Camera shake on final impact */
  impact: {
    shakeIntensity: 0.022,
    shakeDuration: 0.44,
  },

  scene: {
    background: 0x07080d,
    fogNear: 6.4,
    fogFar: 15.5,
    /** Rotates the whole domino/title composition around its center pivot */
    viewRotationDeg: -90,
  },

  /** 3D title plane + canvas texture layout (visual reveal above and behind domino row) */
  title: {
    plane: {
      width: 4.72,
      height: 1.32,
      /** Local X becomes depth after the composition turn, keeping the title behind the row. */
      x: -1.42,
      y: 1.82,
      z: 0,
    },
    canvas: {
      width: 1024,
      height: 448,
      /** Vertical offsets from canvas center (px) */
      subtitleY: -116,
      firstY: -28,
      lastY: 56,
      ruleOffsetY: 46,
    },
    typography: {
      firstSize: 66,
      lastSize: 88,
      subtitleSize: 20,
      firstLetterSpacing: '1.5px',
      lastLetterSpacing: '3.2px',
      subtitleLetterSpacing: '5.2px',
      glowBlur: 18,
      glowAlpha: 0.22,
      ruleHeight: 2,
    },
  },
};
