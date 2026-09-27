/* The WebGL stage: one sachet, lit like a product shot, that follows the
 * page. It is loaded after first paint and registers `window.SahsihStage`.
 * The page tells it where to be through `getPose()` (a screen-space box in
 * CSS pixels) and how fast the page is scrolling through `getVelocity()`.
 * Everything else, spin, squeeze, wobble, tilt, lives here.
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG, flavourById } from './config.js';
import {
  DIM,
  LABEL_LAYOUT,
  createGeometry,
  createMaterial,
  drawBack,
  drawFront,
  drawSurfaceMap,
  makeTexture,
  surface,
} from './sachet.js';

const TAU = Math.PI * 2;
const damp = (current, target, lambda, dt) => MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

async function fontsReady() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load('800 62px Archivo'),
      document.fonts.load('condensed 900 118px Archivo'),
      document.fonts.load('600 20px "JetBrains Mono"'),
      document.fonts.load('700 26px "JetBrains Mono"'),
    ]);
  } catch {
    // Fall back to whatever is available; the label still draws.
  }
}

function loadLogo(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function mount(options) {
  const {
    canvas,
    getPose,
    getVelocity = () => 0,
    getPointer = () => ({ x: 0, y: 0 }),
    logoSrc,
    reducedMotion = false,
    mobile = false,
    initialFlavour = CONFIG.defaultFlavour,
    onReady = () => {},
    onFrame = () => {},
  } = options;

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null; // no WebGL: the page keeps its poster images
  }

  let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const viewHeight = 2 * camera.position.z * Math.tan(MathUtils.degToRad(camera.fov / 2));

  // Lights: a white key, a coloured rim that follows the flavour, a blue kicker.
  scene.add(new HemisphereLight(0xffffff, 0x0a0a12, 0.35));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const rim = new DirectionalLight(0xff4de0, 5);
  rim.position.set(-5, 2, -4);
  scene.add(rim);
  const kicker = new DirectionalLight(0x3f6cff, 4);
  kicker.position.set(5, -2, -3);
  scene.add(kicker);
  const front = new DirectionalLight(0xffffff, 0.7);
  front.position.set(2, -1, 8);
  scene.add(front);

  // Hierarchy: root (where) > tilt (lean) > spin (turn) > mesh.
  const root = new Group();
  const tilt = new Group();
  const spin = new Group();
  root.add(tilt);
  tilt.add(spin);
  scene.add(root);

  const uniforms = {
    uSqueeze: { value: 0 },
    uBend: { value: 0 },
    uTwist: { value: 0 },
  };
  const surfaceMap = makeTexture(drawSurfaceMap(), renderer);
  surfaceMap.colorSpace = '';
  const frontMat = createMaterial({ map: null, surfaceMap, uniforms });
  const backMat = createMaterial({ map: null, surfaceMap, uniforms, back: true });
  const geometry = createGeometry(mobile ? { segU: 48, segV: 170 } : undefined);
  const mesh = new Mesh(geometry, [frontMat, backMat]);
  mesh.visible = false;
  spin.add(mesh);

  // Soft coloured glow behind the pack.
  const glowMat = new MeshBasicMaterial({
    map: glowTexture(),
    color: new Color(0xff4de0),
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0.55,
  });
  const glow = new Mesh(new PlaneGeometry(DIM.W * 4.2, DIM.H * 1.6), glowMat);
  glow.position.z = -1.2;
  tilt.add(glow);

  /* Textures, drawn on demand and cached per flavour. */
  const cache = new Map();
  let logoImg = null;
  const ready = Promise.all([fontsReady(), loadLogo(logoSrc).then((img) => (logoImg = img))]);

  async function texturesFor(id) {
    if (!cache.has(id)) {
      cache.set(
        id,
        (async () => {
          await ready;
          const flavour = flavourById(id);
          const frontCanvas = await drawFront(flavour, logoImg, CONFIG.label);
          const backCanvas = drawBack(flavour, logoImg);
          return { front: makeTexture(frontCanvas, renderer), back: makeTexture(backCanvas, renderer) };
        })()
      );
    }
    return cache.get(id);
  }

  let flavourId = initialFlavour;
  const accentNow = new Color(flavourById(flavourId).accent);
  const accentTarget = accentNow.clone();

  async function applyFlavour(id) {
    const tex = await texturesFor(id);
    if (id !== flavourId) return; // a newer choice arrived while drawing
    frontMat.map = tex.front;
    backMat.map = tex.back;
    frontMat.needsUpdate = true;
    backMat.needsUpdate = true;
  }

  /* Motion state. */
  const state = {
    x: 0,
    y: 0,
    s: 0.001,
    angle: -0.5,
    boost: 0,
    face: 0,
    tiltX: 0,
    tiltZ: 0,
    tiltY: 0,
    sq: 0,
    sqv: 0,
    bend: 0,
    bendv: 0,
    twist: 0,
    twistv: 0,
    glow: 0.55,
    first: true,
  };

  function squeeze(strength = 1) {
    state.sqv += strength * 9.5;
  }

  /* Sizing. */
  let vw = 1;
  let vh = 1;
  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* Adaptive quality: if frames run long on a desktop, drop the pixel ratio. */
  let slowFrames = 0;
  let sampled = 0;

  let last = performance.now();
  let time = 0;
  let readyFired = false;
  let lastSqueezeAt = 0;

  function tick(now) {
    // Frame timestamps can predate the mount time; never step backwards.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = Math.max(last, now);
    time += dt;

    if (!mesh.visible && frontMat.map) mesh.visible = true;

    const pose = getPose();
    const wpp = viewHeight / vh;
    const tx = (pose.cx - vw / 2) * wpp;
    const ty = -(pose.cy - vh / 2) * wpp;
    const ts = Math.max(0.001, (pose.h * wpp) / DIM.H);

    const follow = reducedMotion ? 40 : 9;
    if (state.first) {
      state.x = tx;
      state.y = ty;
      state.s = ts;
      state.first = false;
    } else {
      state.x = damp(state.x, tx, follow, dt);
      state.y = damp(state.y, ty, follow, dt);
      state.s = damp(state.s, ts, follow, dt);
    }

    const velocity = reducedMotion ? 0 : getVelocity();
    const pointer = reducedMotion ? { x: 0, y: 0 } : getPointer();

    // Spin: a slow constant turn, extra spin from scroll speed, and a
    // pull to face the camera where the page asks for it.
    state.face = damp(state.face, pose.face || 0, 3, dt);
    if (!reducedMotion) {
      state.boost = state.boost * Math.exp(-dt * 1.6) + velocity * 0.0007;
      state.boost = MathUtils.clamp(state.boost, -6, 6);
      state.angle += dt * ((0.55 * (pose.spin ?? 1)) * (1 - state.face) + state.boost);
    }
    const front = Math.round(state.angle / TAU) * TAU + Math.sin(time * 0.7) * 0.38;
    const displayAngle = MathUtils.lerp(state.angle, front, state.face);

    // Lean toward the cursor.
    state.tiltX = damp(state.tiltX, -pointer.y * 0.28, 4, dt);
    state.tiltY = damp(state.tiltY, pointer.x * 0.45, 4, dt);
    state.tiltZ = damp(state.tiltZ, (pose.tilt || 0) - pointer.x * 0.1, 4, dt);

    // Squeeze spring (clicks, fast scroll, landings).
    if (!reducedMotion && Math.abs(velocity) > 55 && now - lastSqueezeAt > 700) {
      squeeze(Math.min(0.7, Math.abs(velocity) / 140));
      lastSqueezeAt = now;
    }
    const sqStiff = reducedMotion ? 260 : 120;
    const sqDamp = reducedMotion ? 32 : 10;
    state.sqv += (-sqStiff * state.sq - sqDamp * state.sqv) * dt;
    state.sq += state.sqv * dt;

    // Wobble springs driven by scroll speed.
    const bendTarget = MathUtils.clamp(velocity * 0.004, -0.55, 0.55);
    state.bendv += (-(state.bend - bendTarget) * 70 - state.bendv * 7) * dt;
    state.bend += state.bendv * dt;
    const twistTarget = MathUtils.clamp(velocity * 0.0025, -0.4, 0.4);
    state.twistv += (-(state.twist - twistTarget) * 60 - state.twistv * 6.5) * dt;
    state.twist += state.twistv * dt;

    uniforms.uSqueeze.value = MathUtils.clamp(state.sq, -0.4, 1);
    uniforms.uBend.value = state.bend;
    uniforms.uTwist.value = state.twist;

    // Place it.
    const float = reducedMotion ? 0 : Math.sin(time * 1.25) * 0.035 * DIM.H * state.s;
    root.position.set(state.x, state.y + float, 0);
    root.scale.setScalar(state.s);
    tilt.rotation.set(state.tiltX + (pose.tiltX || 0), 0, state.tiltZ);
    spin.rotation.y = (reducedMotion ? -0.45 : displayAngle) + state.tiltY;

    // Colour follows the flavour.
    accentNow.lerp(accentTarget, 1 - Math.exp(-dt * 5));
    rim.color.copy(accentNow);
    glowMat.color.copy(accentNow);
    state.glow = damp(state.glow, pose.glow ?? 0.55, 4, dt);
    glowMat.opacity = state.glow;

    renderer.render(scene, camera);
    onFrame();

    if (!readyFired && mesh.visible) {
      readyFired = true;
      onReady();
    }

    if (!mobile && sampled < 180) {
      sampled++;
      if (dt > 0.024) slowFrames++;
      if (sampled === 180 && slowFrames > 90 && pixelRatio > 1) {
        pixelRatio = 1;
        renderer.setPixelRatio(pixelRatio);
        resize();
      }
    }
  }

  renderer.setAnimationLoop(tick);
  applyFlavour(flavourId);
  if (window.__SAHSIH_DEBUG) window.__sahsihDebug = { scene, camera, mesh, spin, tilt, root, frontMat, backMat, geometry, state };

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const tmp = new Vector3();
  const normal = new Vector3();
  const toCamera = new Vector3();

  return {
    setFlavour(id) {
      if (id === flavourId) return;
      flavourId = id;
      accentTarget.set(flavourById(id).accent);
      squeeze(0.55);
      applyFlavour(id);
      // Warm the rest of the cache while idle.
      for (const f of CONFIG.flavours) texturesFor(f.id);
    },
    squeeze,
    hitTest(clientX, clientY) {
      if (!mesh.visible) return false;
      ndc.set((clientX / vw) * 2 - 1, -(clientY / vh) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObject(mesh, false).length > 0;
    },
    /* Screen position of an ingredient row on the front label. */
    project(row) {
      const v = 1 - LABEL_LAYOUT.rows[row];
      surface(0.19, v, 1, tmp);
      mesh.localToWorld(tmp);
      normal.set(0, 0, 1).transformDirection(mesh.matrixWorld);
      toCamera.copy(camera.position).sub(tmp).normalize();
      const facing = normal.dot(toCamera);
      tmp.project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * vw, y: (-tmp.y * 0.5 + 0.5) * vh, facing };
    },
    destroy() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}

window.SahsihStage = { mount };
