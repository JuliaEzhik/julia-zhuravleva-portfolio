import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONFIG } from './config.js';

const { width: W, height: H, depth: D } = CONFIG.domino;
const FACE_PANEL_DEPTH = 0.01;
const FACE_CENTER_Z = D / 2 + FACE_PANEL_DEPTH * 0.35;
const FACE_SURFACE_Z = FACE_CENTER_Z + FACE_PANEL_DEPTH / 2 + 0.0008;
const EDGE_PAINT_OFFSET = 0.004;
const EDGE_BAND_THICKNESS = 0.014;
const YAW_RAD = THREE.MathUtils.degToRad(CONFIG.domino.yawDeg);
const FALL_AXIS = new THREE.Vector3(Math.cos(YAW_RAD), 0, -Math.sin(YAW_RAD)).normalize();
const LOCAL_BACK = new THREE.Vector3(-Math.sin(YAW_RAD), 0, -Math.cos(YAW_RAD)).normalize();

let coralGradientTexture;
let boneTexture;
let boneBumpTexture;
let pipCavityTexture;

/**
 * Single domino mesh with pivot groups for front-to-back fall and last-tile end pose.
 */
export class DominoPiece {
  /**
   * @param {number} index
   * @param {{ front: string, edge: string }} palette
   * @param {boolean} isLast
   */
  constructor(index, palette, isLast = false) {
    this.index = index;
    this.isLast = isLast;
    this.fallAngle = 0;
    this.lastPhase = 0;

    this.root = new THREE.Group();
    this.fallPivot = new THREE.Group();
    this.yawGroup = new THREE.Group();
    this.visual = this._buildMesh(palette);

    this.yawGroup.add(this.visual);
    this.fallPivot.add(this.yawGroup);
    this.root.add(this.fallPivot);

    this._applyBaseOrientation();
  }

  /**
   * Per-piece orientation (not camera/scene):
   * - ivory inset face sits on local +Z and remains visible
   * - yawGroup turns the domino itself more so the side/depth reads clearly
   * - fallPivot hinges around the yawed local X axis so +Z face falls toward -Z back
   */
  _applyBaseOrientation() {
    this.visual.rotation.set(0, 0, 0);
    this.yawGroup.rotation.set(0, THREE.MathUtils.degToRad(CONFIG.domino.yawDeg), 0);
    this.fallPivot.rotation.set(0, 0, 0);
    this.fallPivot.quaternion.identity();
    this._applyHingePosition();
    this.visual.position.set(0, 0, 0);
  }

  /**
   * @param {{ front: string, edge: string }} palette
   * @returns {THREE.Group}
   */
  _buildMesh(palette) {
    const group = new THREE.Group();
    const geometry = new RoundedBoxGeometry(W, H, D, 8, 0.05);

    const ivory = new THREE.Color('#f3ead9');
    const insetIvory = new THREE.Color('#f7f1e5');
    const lineColor = new THREE.Color('#5a5146');
    const markColor = new THREE.Color('#3f3932');
    const accent = new THREE.Color(palette.edge);

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: ivory,
      map: getBoneTexture(),
      bumpMap: getBoneBumpTexture(),
      bumpScale: 0.007,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.42,
      clearcoatRoughness: 0.46,
      envMapIntensity: 0.68,
    });

    const frontMat = new THREE.MeshPhysicalMaterial({
      color: insetIvory,
      map: getBoneTexture(),
      bumpMap: getBoneBumpTexture(),
      bumpScale: 0.004,
      roughness: 0.36,
      metalness: 0.015,
      clearcoat: 0.44,
      clearcoatRoughness: 0.42,
      envMapIntensity: 0.72,
    });

    const grooveMat = new THREE.MeshPhysicalMaterial({
      color: lineColor.lerp(accent, 0.24),
      roughness: 0.5,
      metalness: 0.03,
      clearcoat: 0.18,
      clearcoatRoughness: 0.62,
    });

    const grooveHighlightMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fff8e9').lerp(insetIvory, 0.35),
      roughness: 0.34,
      metalness: 0.01,
      clearcoat: 0.5,
      clearcoatRoughness: 0.38,
      envMapIntensity: 0.64,
    });

    const grooveShadowMat = new THREE.MeshPhysicalMaterial({
      color: '#2f2924',
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.78,
    });

    const pipBottomMat = new THREE.MeshPhysicalMaterial({
      color: markColor,
      map: getPipCavityTexture(),
      roughness: 0.68,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.82,
    });

    const pipWallMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#5f5448').lerp(accent, 0.12),
      roughness: 0.54,
      metalness: 0.02,
      clearcoat: 0.14,
      clearcoatRoughness: 0.66,
    });

    const pipRimMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#fff8e9').lerp(insetIvory, 0.25),
      map: getBoneTexture(),
      bumpMap: getBoneBumpTexture(),
      bumpScale: 0.002,
      roughness: 0.33,
      metalness: 0.01,
      clearcoat: 0.5,
      clearcoatRoughness: 0.34,
      envMapIntensity: 0.76,
    });

    const coralGradientMat = getCoralGradientMaterial();

    const body = new THREE.Mesh(geometry, bodyMat);
    body.name = 'dominoBody';
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const frontEdgeBand = new THREE.Mesh(
      createRoundedRectRingGeometry(W * 0.96, H * 0.96, EDGE_BAND_THICKNESS, W * 0.115),
      coralGradientMat
    );
    frontEdgeBand.name = 'dominoFrontCoralEdgeBand';
    frontEdgeBand.position.z = D / 2 + EDGE_PAINT_OFFSET;
    frontEdgeBand.castShadow = true;
    frontEdgeBand.receiveShadow = true;
    frontEdgeBand.renderOrder = 1;
    group.add(frontEdgeBand);

    const addSideEdgeBand = (name, x, rotationY) => {
      const sideBand = new THREE.Mesh(
        createRoundedRectRingGeometry(D * 0.92, H * 0.96, EDGE_BAND_THICKNESS, D * 0.36),
        coralGradientMat
      );
      sideBand.name = name;
      sideBand.position.set(x, 0, 0);
      sideBand.rotation.y = rotationY;
      sideBand.castShadow = true;
      sideBand.receiveShadow = true;
      sideBand.renderOrder = 1;
      group.add(sideBand);
    };

    addSideEdgeBand('dominoRightCoralEdgeBand', W / 2 + EDGE_PAINT_OFFSET, Math.PI / 2);
    addSideEdgeBand('dominoLeftCoralEdgeBand', -W / 2 - EDGE_PAINT_OFFSET, -Math.PI / 2);

    const bottomEdgeBand = new THREE.Mesh(
      createRoundedRectRingGeometry(W * 0.96, D * 0.92, EDGE_BAND_THICKNESS, D * 0.36),
      coralGradientMat
    );
    bottomEdgeBand.name = 'dominoBottomCoralEdgeBand';
    bottomEdgeBand.position.set(0, -H / 2 - EDGE_PAINT_OFFSET, 0);
    // ShapeGeometry defaults to +Z; +π/2 around X points the rounded band toward the underside.
    bottomEdgeBand.rotation.x = Math.PI / 2;
    bottomEdgeBand.castShadow = true;
    bottomEdgeBand.receiveShadow = true;
    bottomEdgeBand.renderOrder = 1;
    group.add(bottomEdgeBand);

    const face = new THREE.Mesh(
      new RoundedBoxGeometry(W * 0.78, H * 0.8, FACE_PANEL_DEPTH, 5, 0.018),
      frontMat
    );
    face.name = 'dominoInsetFace';
    face.position.z = FACE_CENTER_Z;
    face.castShadow = true;
    face.receiveShadow = true;
    group.add(face);

    const borderChannel = 0.011;
    const borderW = W * 0.83;
    const borderH = H * 0.85;
    const borderRadius = W * 0.105;
    const borderGroove = new THREE.Mesh(
      createRoundedRectRingGeometry(borderW, borderH, borderChannel, borderRadius),
      grooveMat
    );
    borderGroove.name = 'roundedDominoBorderGroove';
    borderGroove.position.z = FACE_SURFACE_Z + 0.0008;
    borderGroove.receiveShadow = true;
    group.add(borderGroove);

    const borderInnerLip = new THREE.Mesh(
      createRoundedRectRingGeometry(
        borderW - borderChannel * 0.95,
        borderH - borderChannel * 0.95,
        borderChannel * 0.24,
        borderRadius - borderChannel * 0.48
      ),
      grooveHighlightMat
    );
    borderInnerLip.name = 'roundedDominoBorderLip';
    borderInnerLip.position.z = FACE_SURFACE_Z + 0.0016;
    group.add(borderInnerLip);

    const dividerH = borderChannel * 0.9;
    const dividerW = borderW * 0.72;
    const dividerRadius = dividerH * 0.5;
    const addDividerLayer = (name, y, w, h, mat, z) => {
      const divider = new THREE.Mesh(createRoundedRectGeometry(w, h, h * 0.5), mat);
      divider.name = name;
      divider.position.set(0, y, z);
      group.add(divider);
    };

    addDividerLayer('roundedDividerGroove', 0, dividerW, dividerH, grooveMat, FACE_SURFACE_Z + 0.0009);
    addDividerLayer(
      'roundedDividerHighlight',
      dividerRadius * 0.55,
      dividerW - dividerRadius,
      dividerH * 0.18,
      grooveHighlightMat,
      FACE_SURFACE_Z + 0.0017
    );
    addDividerLayer(
      'roundedDividerShadow',
      -dividerRadius * 0.55,
      dividerW - dividerRadius,
      dividerH * 0.18,
      grooveShadowMat,
      FACE_SURFACE_Z + 0.0017
    );

    const pipRadius = W * 0.034;
    const pipBottomGeometry = new THREE.CircleGeometry(pipRadius * 0.86, 48);
    const pipWallGeometry = new THREE.RingGeometry(pipRadius * 0.72, pipRadius * 1.12, 48);
    const pipRimGeometry = new THREE.TorusGeometry(pipRadius * 1.05, pipRadius * 0.085, 8, 48);
    const pipPositions = [
      [-W * 0.12, H * 0.19],
      [W * 0.12, H * 0.19],
      [0, -H * 0.19],
    ];

    pipPositions.forEach(([x, y]) => {
      const bottom = new THREE.Mesh(pipBottomGeometry, pipBottomMat);
      bottom.name = 'recessedPipBottom';
      bottom.position.set(x, y, FACE_SURFACE_Z + 0.001);
      group.add(bottom);

      const wall = new THREE.Mesh(pipWallGeometry, pipWallMat);
      wall.name = 'recessedPipWall';
      wall.position.set(x, y, FACE_SURFACE_Z + 0.0018);
      group.add(wall);

      const rim = new THREE.Mesh(pipRimGeometry, pipRimMat);
      rim.name = 'roundedPipLip';
      rim.position.set(x, y, FACE_SURFACE_Z + 0.0024);
      rim.castShadow = true;
      rim.receiveShadow = true;
      group.add(rim);
    });

    group.userData.materials = [
      bodyMat,
      frontMat,
      grooveMat,
      grooveHighlightMat,
      grooveShadowMat,
      pipBottomMat,
      pipWallMat,
      pipRimMat,
      coralGradientMat,
    ];
    return group;
  }

  /** Apply environment map to all materials for subtle reflections */
  setEnvironmentMap(envMap) {
    this.visual.userData.materials.forEach((mat) => {
      mat.envMap = envMap;
      mat.envMapIntensity = mat.envMapIntensity ?? (mat.metalness > 0.2 ? 0.7 : 0.5);
      mat.needsUpdate = true;
    });
  }

  /** Chain fall — hinge on local back edge; negative local X rotation tips +Z face toward -Z back. */
  setFallAngle(radians, motion = {}) {
    this.fallAngle = radians;
    const wobble = motion.wobble ?? 0;
    const yawWobble = motion.yawWobble ?? 0;
    const compression = motion.compression ?? 0;
    const fallSign = motion.fallSign ?? 1;

    this.fallPivot.quaternion.setFromAxisAngle(FALL_AXIS, -radians * fallSign + wobble * fallSign);
    this._applyHingePosition(motion.slideBack ?? motion.slideZ ?? 0, motion.liftY ?? 0, fallSign);
    this.yawGroup.rotation.y = THREE.MathUtils.degToRad(CONFIG.domino.yawDeg) + yawWobble;
    this._applyVisualCompression(compression);
  }

  /**
   * Last domino: cascade fall then hero settle — inset face toward camera.
   * @param {number} t 0–1 through last-domino animation
   */
  setLastDominoPose(t, motion = {}) {
    this.lastPhase = t;
    const yaw = THREE.MathUtils.degToRad(CONFIG.domino.yawDeg);
    const layAngle = Math.PI / 2;
    const heroAngle = THREE.MathUtils.degToRad(86);
    const impactT = 0.64;
    const fallSign = motion.fallSign ?? 1;

    if (t >= 1) {
      this.fallPivot.quaternion.setFromAxisAngle(FALL_AXIS, -heroAngle * fallSign);
      this._applyHingePosition(D * 0.18, 0, fallSign);
      this.yawGroup.rotation.y = yaw;
      this._applyVisualCompression(0);
      return;
    }

    if (t <= impactT) {
      const u = clamp01(t / impactT);
      const accelerated = Math.pow(u, 2.18);
      const angle = accelerated * layAngle * 1.02;
      const yawWobble = Math.sin(u * Math.PI) * 0.012;

      this.fallPivot.quaternion.setFromAxisAngle(FALL_AXIS, -angle * fallSign);
      this._applyHingePosition(0, 0, fallSign);
      this.yawGroup.rotation.y = yaw + yawWobble;
      this._applyVisualCompression(0);
      return;
    }

    const u = clamp01((t - impactT) / (1 - impactT));
    const eased = smoothstep(u);
    const damp = Math.exp(-4.7 * u);
    const rebound = Math.sin(u * Math.PI * 3.4) * damp;
    const angle = THREE.MathUtils.lerp(layAngle * 1.02, heroAngle, eased) + rebound * 0.045;
    const compression = Math.sin(Math.min(u * Math.PI, Math.PI)) * damp * 1.35;

    this.fallPivot.quaternion.setFromAxisAngle(FALL_AXIS, -angle * fallSign);
    this._applyHingePosition(eased * D * 0.18, Math.max(0, rebound) * 0.012, fallSign);
    this.yawGroup.rotation.y = yaw + rebound * 0.018;
    this._applyVisualCompression(compression);
  }

  /** Instant end state for reduced motion */
  setEndStateImmediate() {
    if (this.isLast) {
      this.setLastDominoPose(1);
    } else {
      this.setFallAngle(THREE.MathUtils.degToRad(86.5), { slideBack: D * 0.2 });
    }
  }

  /** Keep hinge at the local back bottom edge; optional back-slide/lift during contact settle. */
  _applyHingePosition(slideBack = 0, liftY = 0, fallSign = 1) {
    const hingeX = LOCAL_BACK.x * (D / 2) * fallSign;
    const hingeZ = LOCAL_BACK.z * (D / 2) * fallSign;
    const slideX = LOCAL_BACK.x * slideBack * fallSign;
    const slideZ = LOCAL_BACK.z * slideBack * fallSign;
    this.fallPivot.position.set(hingeX + slideX, liftY, hingeZ + slideZ);
    this.yawGroup.position.set(-hingeX, H / 2, -hingeZ);
    this.visual.position.set(0, 0, 0);
  }

  /** Subtle impact squash and light catch without changing the domino silhouette. */
  _applyVisualCompression(amount = 0) {
    const compression = Math.max(0, amount);
    this.visual.scale.set(
      1 + compression * 0.012,
      1 - compression * 0.01,
      1 + compression * 0.016
    );
  }

  /** Short contact highlight used when one domino strikes the next. */
  setImpactHighlight(amount = 0) {
    const glow = Math.max(0, Math.min(1, amount));
    this.visual.userData.materials.forEach((mat, index) => {
      if (!mat.emissive) return;
      mat.emissive.set(index === 2 ? 0xff5a1f : 0xfff3e2);
      mat.emissiveIntensity = glow * (index === 2 ? 0.34 : 0.1);
    });
  }

  reset() {
    this.fallAngle = 0;
    this.lastPhase = 0;
    this.fallPivot.rotation.set(0, 0, 0);
    this.fallPivot.quaternion.identity();
    this._applyVisualCompression(0);
    this.setImpactHighlight(0);
    this._applyBaseOrientation();
  }

  addTo(parent) {
    parent.add(this.root);
  }
}

function createRoundedRectRingGeometry(width, height, thickness, radius) {
  const outerRadius = Math.min(radius, width / 2, height / 2);
  const innerWidth = Math.max(width - thickness * 2, thickness);
  const innerHeight = Math.max(height - thickness * 2, thickness);
  const innerRadius = Math.max(outerRadius - thickness, thickness * 0.5);
  const shape = createRoundedRectShape(width, height, outerRadius);
  shape.holes.push(createRoundedRectPath(innerWidth, innerHeight, innerRadius, true));

  return new THREE.ShapeGeometry(shape, 12);
}

function createRoundedRectGeometry(width, height, radius) {
  return new THREE.ShapeGeometry(createRoundedRectShape(width, height, radius), 12);
}

function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  addRoundedRectPath(shape, width, height, radius, false);
  return shape;
}

function createRoundedRectPath(width, height, radius, clockwise = false) {
  const path = new THREE.Path();
  addRoundedRectPath(path, width, height, radius, clockwise);
  return path;
}

function addRoundedRectPath(path, width, height, radius, clockwise) {
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(radius, halfW, halfH);

  if (clockwise) {
    path.moveTo(-halfW + r, -halfH);
    path.quadraticCurveTo(-halfW, -halfH, -halfW, -halfH + r);
    path.lineTo(-halfW, halfH - r);
    path.quadraticCurveTo(-halfW, halfH, -halfW + r, halfH);
    path.lineTo(halfW - r, halfH);
    path.quadraticCurveTo(halfW, halfH, halfW, halfH - r);
    path.lineTo(halfW, -halfH + r);
    path.quadraticCurveTo(halfW, -halfH, halfW - r, -halfH);
    path.lineTo(-halfW + r, -halfH);
  } else {
    path.moveTo(-halfW + r, -halfH);
    path.lineTo(halfW - r, -halfH);
    path.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    path.lineTo(halfW, halfH - r);
    path.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    path.lineTo(-halfW + r, halfH);
    path.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
    path.lineTo(-halfW, -halfH + r);
    path.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
  }

  path.closePath();
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

let coralGradientMaterial;

function getPipCavityTexture() {
  if (pipCavityTexture) return pipCavityTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');
  const cavity = ctx.createRadialGradient(60, 56, 4, 64, 64, 64);
  cavity.addColorStop(0, '#51483f');
  cavity.addColorStop(0.48, '#3d352e');
  cavity.addColorStop(0.74, '#1f1a16');
  cavity.addColorStop(1, '#0f0d0b');
  ctx.fillStyle = cavity;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const reflectedLight = ctx.createRadialGradient(38, 34, 0, 38, 34, 48);
  reflectedLight.addColorStop(0, 'rgba(255, 236, 196, 0.16)');
  reflectedLight.addColorStop(0.44, 'rgba(255, 236, 196, 0.05)');
  reflectedLight.addColorStop(1, 'rgba(255, 236, 196, 0)');
  ctx.fillStyle = reflectedLight;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  pipCavityTexture = new THREE.CanvasTexture(canvas);
  pipCavityTexture.colorSpace = THREE.SRGBColorSpace;
  pipCavityTexture.anisotropy = 4;
  pipCavityTexture.needsUpdate = true;

  return pipCavityTexture;
}

function getBoneTexture() {
  if (boneTexture) return boneTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;

  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  base.addColorStop(0, '#fbf6ea');
  base.addColorStop(0.34, '#f0e4cf');
  base.addColorStop(0.68, '#f8f0df');
  base.addColorStop(1, '#eadcc5');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  addBoneStructure(ctx, canvas.width, canvas.height, false);

  boneTexture = new THREE.CanvasTexture(canvas);
  boneTexture.colorSpace = THREE.SRGBColorSpace;
  boneTexture.wrapS = THREE.RepeatWrapping;
  boneTexture.wrapT = THREE.RepeatWrapping;
  boneTexture.anisotropy = 4;
  boneTexture.needsUpdate = true;

  return boneTexture;
}

function getBoneBumpTexture() {
  if (boneBumpTexture) return boneBumpTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  addBoneStructure(ctx, canvas.width, canvas.height, true);

  boneBumpTexture = new THREE.CanvasTexture(canvas);
  boneBumpTexture.wrapS = THREE.RepeatWrapping;
  boneBumpTexture.wrapT = THREE.RepeatWrapping;
  boneBumpTexture.anisotropy = 4;
  boneBumpTexture.needsUpdate = true;

  return boneBumpTexture;
}

function addBoneStructure(ctx, width, height, bumpOnly) {
  const veinCount = bumpOnly ? 34 : 24;

  ctx.save();
  ctx.globalCompositeOperation = bumpOnly ? 'source-over' : 'multiply';
  for (let i = 0; i < veinCount; i++) {
    const x = (i / veinCount) * width + Math.sin(i * 2.1) * 18;
    const warm = 112 + (i % 5) * 7;
    ctx.strokeStyle = bumpOnly
      ? `rgba(${warm}, ${warm}, ${warm}, 0.18)`
      : `rgba(132, 96, 56, ${0.035 + (i % 4) * 0.007})`;
    ctx.lineWidth = bumpOnly ? 0.9 + (i % 3) * 0.35 : 0.45 + (i % 4) * 0.24;
    ctx.beginPath();
    for (let y = -24; y <= height + 24; y += 22) {
      const wave = Math.sin(y * 0.018 + i * 1.73) * 12 + Math.sin(y * 0.047 + i) * 4;
      const px = x + wave;
      if (y === -24) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = bumpOnly ? 'source-over' : 'screen';
  for (let i = 0; i < 110; i++) {
    const x = (Math.sin(i * 47.13) * 0.5 + 0.5) * width;
    const y = (Math.sin(i * 91.7 + 2.4) * 0.5 + 0.5) * height;
    const radius = 10 + (i % 9) * 3.8;
    const alpha = bumpOnly ? 0.035 : 0.055;
    const spot = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spot.addColorStop(0, `rgba(255, 250, 236, ${alpha})`);
    spot.addColorStop(1, 'rgba(255, 250, 236, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

/** One shared material for the shape-matched coral edge bands. */
function getCoralGradientMaterial() {
  if (coralGradientMaterial) return coralGradientMaterial;

  coralGradientMaterial = new THREE.MeshPhysicalMaterial({
    map: getCoralGradientTexture(),
    color: 0xffffff,
    side: THREE.DoubleSide,
    emissive: 0xff5a1f,
    emissiveIntensity: 0.12,
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 0.5,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.78,
  });

  return coralGradientMaterial;
}

function getCoralGradientTexture() {
  if (coralGradientTexture) return coralGradientTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#eb4710');
  gradient.addColorStop(0.28, '#ff5a1f');
  gradient.addColorStop(0.58, '#ff7a33');
  gradient.addColorStop(0.82, '#ff9a55');
  gradient.addColorStop(1, '#ffd0a8');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  coralGradientTexture = new THREE.CanvasTexture(canvas);
  coralGradientTexture.colorSpace = THREE.SRGBColorSpace;
  coralGradientTexture.needsUpdate = true;

  return coralGradientTexture;
}
