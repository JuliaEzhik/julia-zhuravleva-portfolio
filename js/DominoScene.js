import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DominoPiece } from './DominoPiece.js';
import { CONFIG, DOMINO_COLORS, TITLE_FIRST, TITLE_LAST, SUBTITLE_TEXT, ACCENT_COLOR } from './config.js';

/**
 * Three.js scene: table, lighting, domino row, renderer, and responsive camera.
 */
export class DominoScene {
  /**
   * @param {HTMLElement} canvasHost
   */
  constructor(canvasHost) {
    this.host = canvasHost;
    this.clock = new THREE.Clock();
    this.dominoes = [];
    this._dominoLayoutListeners = new Set();
    this._baseCameraPos = new THREE.Vector3();
    this._shakeOffset = new THREE.Vector3();
    this._leanRendering = this._prefersLeanRendering();

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initEnvironment();
    this._initTable();
    this._initMobileStairs();
    this._initDominoes();
    this.subtitleText = SUBTITLE_TEXT;
    this._initTitlePlane();
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this._leanRendering,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.03;
    this.renderer.shadowMap.enabled = !this._leanRendering;
    this.renderer.shadowMap.type = this._leanRendering ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(CONFIG.scene.background, 0);
    this.renderer.setPixelRatio(this._getPixelRatio());
    this.host.appendChild(this.renderer.domElement);
  }

  _prefersLeanRendering() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const isMobileWidth = window.innerWidth < 640;
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

    return (isIOS && isSafari) || (isMobileWidth && isCoarsePointer);
  }

  _getPixelRatio() {
    const cap = this._leanRendering ? 1.5 : 2;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(
      CONFIG.scene.background,
      CONFIG.scene.fogNear,
      CONFIG.scene.fogFar
    );

    this.compositionPivot = new THREE.Group();
    this.compositionPivot.position.set(0, 0, 0);
    this.compositionPivot.rotation.y = THREE.MathUtils.degToRad(CONFIG.scene.viewRotationDeg);
    this.scene.add(this.compositionPivot);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    this._applyCameraLayout(window.innerWidth, window.innerHeight);
  }

  /**
   * Camera stays in front (+Z) and frames a lower domino band plus elevated title band.
   */
  _applyCameraLayout(width, height) {
    const aspect = width / height;
    const tier = this._getViewportTier(width);
    const cam = CONFIG.camera;
    const layout = cam[tier];
    const fov = cam.fov[tier];

    this.camera.aspect = aspect;
    this.camera.fov = fov;

    this._baseCameraPos.set(layout.x, layout.y, layout.z);
    this.camera.position.copy(this._baseCameraPos);
    this._lookAtY = layout.lookY;
    this.camera.lookAt(0, layout.lookY, 0);
    this.camera.updateProjectionMatrix();
  }

  _initLights() {
    const ambient = new THREE.AmbientLight(0xffead6, 0.34);
    this.scene.add(ambient);

    this.keyLight = new THREE.DirectionalLight(0xfff2df, 1.42);
    this.keyLight.position.set(-1.7, 5.9, 4.6);
    this.keyLight.castShadow = !this._leanRendering;
    this.keyLight.shadow.mapSize.set(this._leanRendering ? 512 : 2048, this._leanRendering ? 512 : 2048);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 18;
    this.keyLight.shadow.camera.left = -4;
    this.keyLight.shadow.camera.right = 4;
    this.keyLight.shadow.camera.top = 4;
    this.keyLight.shadow.camera.bottom = -4;
    this.keyLight.shadow.bias = -0.00025;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    const fill = new THREE.DirectionalLight(0xff7a33, 0.26);
    fill.position.set(3.2, 2.35, 2.4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xfff7ec, 0.72);
    rim.position.set(0.8, 3.8, -5.6);
    this.scene.add(rim);
  }

  _initEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = envRT.texture;
    envScene.dispose?.();
    pmrem.dispose();
    this._envMap = envRT.texture;
  }

  _initTable() {
    const tableGeo = new THREE.PlaneGeometry(1, 1);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x101218,
      roughness: 0.82,
      metalness: 0.06,
    });
    tableMat.envMap = this._envMap;
    tableMat.envMapIntensity = 0.16;

    this.table = new THREE.Mesh(tableGeo, tableMat);
    this.table.rotation.x = -Math.PI / 2;
    this.table.position.y = 0;
    this.table.receiveShadow = true;
    this.scene.add(this.table);

    const tableEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x090a0f,
      roughness: 0.88,
      metalness: 0.04,
    });
    tableEdgeMat.envMap = this._envMap;
    tableEdgeMat.envMapIntensity = 0.12;

    this.tableEdge = new THREE.Mesh(new THREE.BoxGeometry(1, 0.09, 1), tableEdgeMat);
    this.tableEdge.receiveShadow = true;
    this.tableEdge.castShadow = true;
    this.scene.add(this.tableEdge);
    this._applyTableLayout(window.innerWidth);
  }

  _dominoRowY(scale = 1, width = window.innerWidth) {
    const base = CONFIG.domino.rowY ?? 0;
    const table = CONFIG.scene.table?.[this._getViewportTier(width)] ?? CONFIG.scene.table?.desktop;
    return (table?.y ?? 0) + base * (0.9 + scale * 0.1);
  }

  _getViewportTier(width = window.innerWidth) {
    if (width < 640) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  _applyTableLayout(width = window.innerWidth) {
    const tier = this._getViewportTier(width);
    const table = CONFIG.scene.table?.[tier] ?? CONFIG.scene.table?.desktop;
    if (!table || !this.table) return;

    const isMobile = tier === 'mobile';
    this.table.visible = !isMobile;
    this.table.receiveShadow = !isMobile;
    this.table.scale.set(table.width, table.depth, 1);
    this.table.position.y = table.y ?? 0;

    if (this.tableEdge) {
      this.tableEdge.visible = !isMobile;
      this.tableEdge.scale.set(table.width, 1, table.depth);
      this.tableEdge.position.set(0, (table.y ?? 0) - 0.055, 0);
    }
  }

  _initMobileStairs() {
    const stairConfig = CONFIG.scene.stairs?.mobile;
    if (!stairConfig) return;

    this.mobileStairs = new THREE.Group();
    this.mobileStairs.name = 'mobileDominoStairs';

    const stepMat = new THREE.MeshStandardMaterial({
      color: 0x14171d,
      roughness: 0.72,
      metalness: 0.1,
      envMapIntensity: 0.22,
    });
    const treadMat = new THREE.MeshStandardMaterial({
      color: 0x22252d,
      roughness: 0.66,
      metalness: 0.08,
      envMapIntensity: 0.26,
    });
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0xff6a2a,
      emissive: 0xeb4710,
      emissiveIntensity: 0.16,
      roughness: 0.38,
      metalness: 0.08,
      envMapIntensity: 0.42,
    });

    [stepMat, treadMat, lipMat].forEach((mat) => {
      mat.envMap = this._envMap;
    });

    this.mobileStairs.userData.materials = [stepMat, treadMat, lipMat];
    this.mobileStairSteps = [];

    for (let i = 0; i < CONFIG.dominoCount.mobile; i++) {
      const step = new THREE.Group();
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(stairConfig.stepWidth, stairConfig.stepHeight, stairConfig.stepDepth),
        stepMat
      );
      block.receiveShadow = true;
      block.castShadow = true;
      step.add(block);

      const tread = new THREE.Mesh(
        new THREE.BoxGeometry(stairConfig.stepWidth * 0.98, 0.008, stairConfig.stepDepth * 0.92),
        treadMat
      );
      tread.position.y = stairConfig.stepHeight / 2 + 0.004;
      tread.receiveShadow = true;
      step.add(tread);

      const frontLip = new THREE.Mesh(
        new THREE.BoxGeometry(stairConfig.stepWidth * 0.98, stairConfig.coralLipHeight, stairConfig.coralLipDepth),
        lipMat
      );
      frontLip.position.set(
        0,
        stairConfig.stepHeight / 2 + stairConfig.coralLipHeight * 0.5,
        stairConfig.stepDepth / 2 + stairConfig.coralLipDepth * 0.5
      );
      step.add(frontLip);

      this.mobileStairs.add(step);
      this.mobileStairSteps.push(step);
    }

    this.mobileStairs.visible = false;
    this.compositionPivot.add(this.mobileStairs);
  }

  _positionMobileStairs(width = window.innerWidth) {
    if (!this.mobileStairs || !this.mobileStairSteps) return;

    const isMobile = this._getViewportTier(width) === 'mobile';
    this.mobileStairs.visible = isMobile;
    if (!isMobile) return;

    const stairConfig = CONFIG.scene.stairs?.mobile;
    const stepHeight = stairConfig?.stepHeight ?? 0.09;
    const topInset = stairConfig?.topInset ?? 0.01;

    this.mobileStairSteps.forEach((step, index) => {
      const domino = this.dominoes[index];
      if (!domino) {
        step.visible = false;
        return;
      }

      step.visible = true;
      step.position.set(
        0.02,
        domino.root.position.y - stepHeight / 2 - topInset,
        domino.root.position.z
      );
    });
  }

  _getDominoCount(width = window.innerWidth) {
    const counts = CONFIG.dominoCount;
    return this._getViewportTier(width) === 'mobile' ? counts.mobile : counts.desktop;
  }

  _getDominoSpacing(width = window.innerWidth) {
    if (this.getDominoLayoutMode(width) === 'vertical-zigzag') {
      return CONFIG.domino.mobileVerticalSpacing;
    }

    return this._getViewportTier(width) === 'mobile'
      ? CONFIG.domino.mobileSpacing
      : CONFIG.domino.spacing;
  }

  getDominoLayoutMode(width = window.innerWidth) {
    return this._getViewportTier(width) === 'mobile'
      ? CONFIG.domino.mobileLayout ?? 'row'
      : 'row';
  }

  _dominoLayoutKey(width = window.innerWidth) {
    return [
      this.getDominoLayoutMode(width),
      this._getDominoCount(width),
      this._getDominoSpacing(width),
    ].join(':');
  }

  _initDominoes(count = this._getDominoCount()) {
    const scale = this.getDominoScale();

    for (let i = 0; i < count; i++) {
      const palette = DOMINO_COLORS[i % DOMINO_COLORS.length];
      const isLast = i === count - 1;
      const piece = new DominoPiece(i, palette, isLast);
      piece.setEnvironmentMap(this._envMap);
      piece.root.scale.setScalar(scale);
      piece.addTo(this.compositionPivot);
      this.dominoes.push(piece);
    }

    this._positionDominoes(window.innerWidth);
    this._currentDominoLayoutKey = this._dominoLayoutKey(window.innerWidth);
  }

  _positionDominoes(width = window.innerWidth) {
    const spacing = this._getDominoSpacing(width);
    const scale = this.getDominoScale(width);
    const layoutMode = this.getDominoLayoutMode(width);

    if (layoutMode === 'vertical-zigzag') {
      const { mobileVerticalCenterY, mobileZigzagOffset } = CONFIG.domino;
      const count = this.dominoes.length;
      const startY = mobileVerticalCenterY + ((count - 1) * spacing) / 2;

      this.dominoes.forEach((piece, index) => {
        const screenLeftSign = index % 2 === 0 ? 1 : -1;
        const progress = index / Math.max(1, count - 1);
        const taper = 0.42 + progress * 1.34;
        const centerDrift = (progress - 0.5) * 0.04;
        piece.root.scale.setScalar(scale);
        piece.root.position.set(
          0,
          startY - index * spacing,
          centerDrift + screenLeftSign * mobileZigzagOffset * taper
        );
      });
      this._positionMobileStairs(width);
      return;
    }

    const totalDepth = (this.dominoes.length - 1) * spacing;
    /** Index 0 starts at local +Z; view rotation maps the chain left-to-right. */
    const startZ = totalDepth / 2;
    const rowY = this._dominoRowY(scale, width);

    this.dominoes.forEach((piece, index) => {
      piece.root.scale.setScalar(scale);
      piece.root.position.set(0, rowY, startZ - index * spacing);
    });
    this._positionMobileStairs(width);
  }

  _rebuildDominoesForWidth(width) {
    const nextLayoutKey = this._dominoLayoutKey(width);
    if (nextLayoutKey === this._currentDominoLayoutKey) return false;

    this.dominoes.forEach((piece) => {
      piece.root.removeFromParent();
    });
    this.dominoes = [];
    this._initDominoes(this._getDominoCount(width));
    return true;
  }

  onDominoLayoutChange(callback) {
    this._dominoLayoutListeners.add(callback);
    return () => this._dominoLayoutListeners.delete(callback);
  }

  _notifyDominoLayoutChange() {
    this._dominoLayoutListeners.forEach((callback) => callback(this.dominoes));
  }

  /** Subtle deterministic camera shake on final domino impact */
  applyCameraShake(intensity, time = 0) {
    const impulse = Math.sin(time * 58) * Math.exp(-time * 3.2);
    const secondary = Math.sin(time * 91 + 0.7) * Math.exp(-time * 4.4);

    this._shakeOffset.set(
      impulse * intensity * 0.85,
      secondary * intensity * 0.48,
      Math.sin(time * 37 + 1.2) * intensity * 0.12
    );
    this.camera.position.copy(this._baseCameraPos).add(this._shakeOffset);
  }

  clearCameraShake() {
    this._shakeOffset.set(0, 0, 0);
    this.camera.position.copy(this._baseCameraPos);
  }

  _initTitlePlane() {
    const { plane } = CONFIG.title;

    this.titleMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    this.titlePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(plane.width, plane.height),
      this.titleMaterial
    );
    this.titlePlane.position.set(plane.x, plane.y, plane.z);
    this.titlePlane.rotation.y = -this.compositionPivot.rotation.y;
    this.compositionPivot.add(this.titlePlane);
    this._titleReveal = 0;

    this._buildTitleTexture();
  }

  _buildTitleTexture() {
    const applyTexture = () => this._refreshTitleTexture();
    applyTexture();

    const { typography } = CONFIG.title;
    const fontLoads = [
      document.fonts.load(`300 ${typography.firstSize}px Syne`),
      document.fonts.load(`700 ${typography.lastSize}px Syne`),
      document.fonts.load(`500 ${typography.subtitleSize}px "DM Sans"`),
    ];

    Promise.all(fontLoads)
      .catch(() => {})
      .finally(applyTexture);
  }

  _refreshTitleTexture() {
    const canvas = this._drawTitleCanvas(this._titleReveal);
    if (!this.titleTexture) {
      this.titleTexture = new THREE.CanvasTexture(canvas);
      this.titleTexture.colorSpace = THREE.SRGBColorSpace;
      this.titleMaterial.map = this.titleTexture;
      this.titleMaterial.needsUpdate = true;
      return;
    }

    this.titleTexture.image = canvas;
    this.titleTexture.needsUpdate = true;
  }

  _drawTitleCanvas(reveal = 0) {
    const { canvas: layout, typography } = CONFIG.title;
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const subtitle = this.subtitleText.toUpperCase().replace(/\s·\s/g, '  ·  ');
    ctx.globalAlpha = reveal;
    ctx.font = `500 ${typography.subtitleSize}px "DM Sans", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(235, 71, 16, 0.82)';
    ctx.letterSpacing = typography.subtitleLetterSpacing;
    ctx.fillText(subtitle, cx, cy + layout.subtitleY);
    ctx.globalAlpha = 1;

    ctx.font = `300 ${typography.firstSize}px Syne, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(247, 237, 223, 0.92)';
    ctx.letterSpacing = typography.firstLetterSpacing;
    ctx.fillText(TITLE_FIRST, cx, cy + layout.firstY);

    ctx.font = `700 ${typography.lastSize}px Syne, system-ui, sans-serif`;
    ctx.fillStyle = ACCENT_COLOR;
    ctx.letterSpacing = typography.lastLetterSpacing;
    ctx.shadowColor = `rgba(235, 71, 16, ${typography.glowAlpha})`;
    ctx.shadowBlur = typography.glowBlur;
    ctx.shadowOffsetY = 4;
    ctx.fillText(TITLE_LAST, cx, cy + layout.lastY);
    ctx.shadowColor = 'transparent';

    const lastWidth = ctx.measureText(TITLE_LAST).width;
    const ruleY = cy + layout.lastY + layout.ruleOffsetY;
    const titleRule = ctx.createLinearGradient(cx - lastWidth / 2, 0, cx + lastWidth / 2, 0);
    titleRule.addColorStop(0, 'rgba(235, 71, 16, 0.06)');
    titleRule.addColorStop(0.22, 'rgba(235, 71, 16, 0.68)');
    titleRule.addColorStop(0.78, 'rgba(255, 90, 31, 0.76)');
    titleRule.addColorStop(1, 'rgba(255, 154, 85, 0.12)');
    ctx.globalAlpha = reveal;
    ctx.fillStyle = titleRule;
    ctx.fillRect(cx - lastWidth / 2, ruleY, lastWidth, typography.ruleHeight);
    ctx.globalAlpha = 1;

    return canvas;
  }

  /** Reveal the delayed subtitle/accent while keeping the name visible (0–1) */
  setTitleReveal(t) {
    this._titleReveal = Math.max(0, Math.min(1, t));
    this._refreshTitleTexture();
  }

  resetTitleReveal() {
    this.setTitleReveal(0);
  }

  /** @param {string} text */
  setSubtitleText(text) {
    this.subtitleText = text;
    this._refreshTitleTexture();
  }

  getDominoScale(width = window.innerWidth) {
    return CONFIG.domino.scale[this._getViewportTier(width)];
  }

  _onResize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    this.renderer.setPixelRatio(this._getPixelRatio());
    this.renderer.setSize(w, h, false);
    this._applyCameraLayout(w, h);

    const didRebuildRow = this._rebuildDominoesForWidth(w);
    const tier = this._getViewportTier(w);
    const scale = this.getDominoScale(w);
    this.renderer.toneMappingExposure = tier === 'mobile' ? 1.12 : 1.03;
    this._applyTableLayout(w);
    this._positionDominoes(w);

    if (this.titlePlane) {
      const { plane } = CONFIG.title;
      const mobileTitle = tier === 'mobile' ? plane.mobile : null;
      this.titlePlane.visible = tier !== 'mobile';
      this.titlePlane.scale.setScalar(mobileTitle?.scale ?? scale);
      this.titlePlane.position.set(
        mobileTitle?.x ?? plane.x,
        mobileTitle?.y ?? plane.y * (0.92 + scale * 0.08),
        plane.z
      );
    }

    const lookY = this._lookAtY ?? CONFIG.camera.desktop.lookY;
    this.camera.lookAt(0, lookY, 0);

    if (didRebuildRow) {
      this._notifyDominoLayoutChange();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.titleTexture?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
