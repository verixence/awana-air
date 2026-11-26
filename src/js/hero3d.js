// AWANA AIR hero: CC0 business-jet glTF (tevy.dev) in a golden-hour sky with layered volumetric-look clouds,
// a physically smoothed flight model (critically damped springs, bank into turns, pitch on climb),
// camera follow, engine contrails, IBL (CC0 HDR sky), soft shadows + bloom on desktop.
import { MeshStandardMaterial, DoubleSide,
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, SphereGeometry, PlaneGeometry, ShaderMaterial, BackSide, Vector3, Vector2,
  Quaternion, Euler, Color, DirectionalLight, HemisphereLight, PMREMGenerator, SRGBColorSpace, ACESFilmicToneMapping,
  EquirectangularReflectionMapping, PCFShadowMap, InstancedMesh, InstancedBufferAttribute, DataTexture, RGBAFormat,
  LinearFilter, BufferGeometry, BufferAttribute, DynamicDrawUsage, MeshPhysicalMaterial, Box3, Matrix4, Object3D, LinearMipmapLinearFilter,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { UltraHDRLoader } from 'three/examples/jsm/loaders/UltraHDRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const UP = new Vector3(0, 1, 0);
const FWD = new Vector3(1, 0, 0.42).normalize();            // flight direction in world space
const RIGHT = new Vector3().crossVectors(FWD, UP).normalize(); // jet's right
const SUN = new Vector3(0.78, 0.1, -0.62).normalize();       // low golden sun, right of frame, behind

// critically damped spring (Unity-style SmoothDamp), per component
function damp(cur, target, vel, smoothTime, dt) {
  const omega = 2 / smoothTime, x = omega * dt, exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target, temp = (vel + omega * change) * dt;
  const v = (vel - omega * temp) * exp;
  return [target + (change + temp) * exp, v];
}
class Spring3 {
  constructor(v, t) { this.p = v.clone(); this.v = new Vector3(); this.t = t; }
  step(target, dt) { for (const k of ['x', 'y', 'z']) { const [p, v] = damp(this.p[k], target[k], this.v[k], this.t, dt); this.p[k] = p; this.v[k] = v; } return this.p; }
}

// ---------- sky dome ----------
function skyMaterial() {
  return new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y; float s = max(dot(d, uSun), 0.0);
        vec3 zen = vec3(0.012,0.022,0.06), mid = vec3(0.035,0.06,0.14), hor = vec3(0.24,0.19,0.23), warm = vec3(1.0,0.55,0.24);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.07, h));
        col = mix(col, zen, smoothstep(0.06, 0.4, h));
        float band = exp(-abs(h) * 26.0);
        col += warm * band * (0.25 + 0.9 * pow(s, 3.0));
        col += warm * (pow(s, 12.0) * 0.6 + pow(s, 180.0) * 2.5 + pow(s, 2600.0) * 14.0) * smoothstep(-0.05, 0.02, h);
        vec3 below = mix(vec3(0.16,0.13,0.16), vec3(0.05,0.06,0.1), smoothstep(0.0, -0.35, h));
        col = mix(col, below + warm * band * 0.25 * pow(s, 2.0), smoothstep(0.0, -0.03, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ---------- clouds: instanced soft billboards with baked top-lighting ----------
function cloudAtlas() {
  const S = 128, W = S * 2, data = new Uint8Array(W * S * 4);
  const hash = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  const noise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (x, y, s) => { let f = 0, a = 0.5; for (let o = 0; o < 5; o++) { f += a * noise(x, y, s + o * 13); x *= 2.03; y *= 2.03; a *= 0.5; } return f; };
  const dens = new Float32Array(W * S);
  for (let v = 0; v < 2; v++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x / S) * 2 - 1, ny = (y / S) * 2 - 1;
    const r = Math.sqrt(nx * nx * 0.9 + (ny > 0 ? ny * ny * 2.6 : ny * ny * 1.1)); // flatter base (y grows downward)
    const n = fbm(x / 22 + v * 9, y / 22, v * 31);
    dens[y * W + v * S + x] = Math.max(0, Math.min(1, (n * 1.25 - r * 0.95) * 2.2));
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = dens[i];
    const up = y > 4 ? dens[(y - 4) * W + x] : 0;               // light from above
    const lit = Math.max(0, Math.min(1, 0.55 + (d - up) * 1.8 - (y / S) * 0.25));
    data[i * 4] = d * 255; data[i * 4 + 1] = lit * 255; data[i * 4 + 2] = 0; data[i * 4 + 3] = 255;
  }
  const t = new DataTexture(data, W, S, RGBAFormat); t.flipY = true; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
function makeClouds(count, rand) {
  const geo = new PlaneGeometry(1, 1);
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTex: { value: cloudAtlas() }, uSunV: { value: new Vector3() } },
    vertexShader: `attribute vec4 aCloud; attribute vec3 aOff; varying vec2 vUv; varying float vA; varying float vSunF; varying float vDist; uniform vec3 uSunV;
      void main(){
        vec4 mv = viewMatrix * vec4(aOff, 1.0);
        mv.xy += position.xy * aCloud.xy;
        vUv = vec2((uv.x + aCloud.z) * 0.5, uv.y); vA = aCloud.w;
        vec3 toC = normalize(mv.xyz); vSunF = pow(max(dot(toC, uSunV), 0.0), 6.0); vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; varying vec2 vUv; varying float vA; varying float vSunF; varying float vDist;
      void main(){
        vec4 t = texture2D(uTex, vUv); float d = t.r; if (d < 0.01) discard;
        vec3 shade = vec3(0.17,0.17,0.24), lit = vec3(1.0,0.82,0.62), rim = vec3(1.0,0.72,0.42);
        vec3 col = mix(shade, lit, t.g);
        col += rim * vSunF * (1.0 - d) * 1.6;                 // silver lining toward the sun
        float near = smoothstep(1.5, 9.0, vDist);              // fade as we fly through
        float far = 1.0 - smoothstep(70.0, 110.0, vDist);
        col = mix(col, vec3(0.3,0.24,0.27), smoothstep(30.0, 100.0, vDist) * 0.7); // aerial perspective
        gl_FragColor = vec4(col, d * vA * near * far);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const off = new Float32Array(count * 3), cl = new Float32Array(count * 4);
  const items = [];
  for (let i = 0; i < count; i++) {
    const layer = i % 5 === 0 ? 'near' : i % 3 === 0 ? 'high' : 'deck';
    const it = { layer, s: (rand() - 0.5) * 120, lat: 0, y: 0 };
    respawn(it, rand, true);
    const sc = layer === 'near' ? 6 + rand() * 6 : layer === 'high' ? 10 + rand() * 10 : 14 + rand() * 18;
    cl.set([sc * (1.6 + rand() * 0.6), sc * (0.55 + rand() * 0.25), rand() < 0.5 ? 0 : 1, layer === 'near' ? 0.55 : layer === 'high' ? 0.5 : 0.8], i * 4);
    items.push(it);
  }
  geo.setAttribute('aOff', new InstancedBufferAttribute(off, 3).setUsage(DynamicDrawUsage));
  geo.setAttribute('aCloud', new InstancedBufferAttribute(cl, 4));
  return { mesh, items, off };
}
function respawn(it, rand, initial) {
  if (!initial) it.s += 120;
  if (it.layer === 'near') { it.lat = 4 + rand() * 9; it.y = -1.5 + rand() * 3.5; }       // between camera and jet
  else if (it.layer === 'high') { it.lat = -60 + rand() * 50; it.y = 3 + rand() * 6; }
  else { it.lat = -70 + rand() * 80; it.y = -7 - rand() * 4; }                            // cloud sea below
}

// ---------- contrails: camera-facing ribbons advected by the airflow ----------
function makeTrail(n) {
  const pos = new Float32Array(n * 2 * 3), a = new Float32Array(n * 2), sd = new Float32Array(n * 2), idx = [];
  for (let i = 0; i < n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  for (let i = 0; i < n; i++) { a[i * 2] = a[i * 2 + 1] = i / (n - 1); sd[i * 2] = 1; sd[i * 2 + 1] = -1; }
  const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage)); g.setAttribute('aT', new BufferAttribute(a, 1)); g.setAttribute('aS', new BufferAttribute(sd, 1)); g.setIndex(idx);
  const m = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide,
    vertexShader: 'attribute float aT; attribute float aS; varying float vT; varying float vS; void main(){ vT = aT; vS = aS; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying float vT; varying float vS; void main(){ float a = (1.0 - vS * vS) * (1.0 - vS * vS) * smoothstep(0.02, 0.12, vT) * pow(1.0 - vT, 1.6) * 0.42 * (0.75 + 0.25 * sin(vT * 40.0)); gl_FragColor = vec4(vec3(1.0,0.95,0.9), a);\n#include <colorspace_fragment>\n}' });
  const mesh = new Mesh(g, m); mesh.frustumCulled = false;
  return { mesh, pts: Array.from({ length: n }, () => null), n };
}

const MODEL = { desktop: '/assets/models/bizjet-lod0.glb', mobile: '/assets/models/bizjet-lod1.glb' };
export const modelUrl = (mobile) => (mobile ? MODEL.mobile : MODEL.desktop);

async function loadAssets(renderer, mobile) {
  const ktx2 = new KTX2Loader().setTranscoderPath('/assets/vendor/basis/').detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const pre = window.__jet && window.__jet.url === modelUrl(mobile) ? window.__jet.buf : null;   // fetched early by the head script
  const jet = pre ? pre.then((buf) => loader.parseAsync(buf, '/assets/models/')).catch(() => loader.loadAsync(modelUrl(mobile))) : loader.loadAsync(modelUrl(mobile));
  const [gltf, hdr] = await Promise.all([jet, new UltraHDRLoader().loadAsync('/assets/env/golden-hour-1k.jpg')]);
  ktx2.dispose();
  return { gltf, hdr };
}

function prepareJet(gltf, { shadows, mobile }) {
  const model = gltf.scene;
  const box = new Box3().setFromObject(model); const c = box.getCenter(new Vector3()); const size = box.getSize(new Vector3());
  model.position.sub(c);
  const holder = new Group(); holder.add(model); holder.scale.setScalar(10.5 / size.z);
  const nozzles = [];
  model.traverse((o) => {
    if (/^nacelle_[LR]$/.test(o.name)) nozzles.push(o);
    if (!o.isMesh) return;
    o.castShadow = shadows; o.receiveShadow = shadows;
    const m = o.material;
    if (m && m.name === 'cockpit_glass') {           // transmission is costly: use a reflective tinted glass instead
      o.material = new MeshPhysicalMaterial({ color: 0x0b1220, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
    } else if (m && /paint_white|paint_wing/.test(m.name) && mobile) { m.metalness = 0.32; m.roughness = 0.4; m.color.setRGB(0.95, 0.97, 1.0);
    } else if (m && /paint_white|paint_wing/.test(m.name)) {
      const p = m.isMeshPhysicalMaterial ? m : new MeshPhysicalMaterial(); if (p !== m) { MeshStandardMaterial.prototype.copy.call(p, m); p.defines = { STANDARD: '', PHYSICAL: '' }; } p.clearcoat = 1; p.clearcoatRoughness = 0.06; p.metalness = 0.32; p.roughness = 0.42; p.color.setRGB(0.95, 0.97, 1.0); o.material = p;
    } else if (m && /cabin_window/.test(m.name)) { m.roughness = 0.05; m.envMapIntensity = 1.4; }
  });
  return { holder, nozzles };
}

function layoutFor(aspect) {
  const narrow = aspect < 1;
  return narrow
    ? { yaw: -0.5, base: new Vector3(0.3, 4.6, 0), cam: new Vector3(0, 2.6, 19), look: new Vector3(0, 1.2, 0), scale: Math.min(0.5, Math.max(0.38, aspect * 0.8)) }
    : { yaw: -0.22, base: new Vector3(5.1 + (aspect - 1.6) * 2.2, 0.8, 0), cam: new Vector3(0, 2.2, 18), look: new Vector3(1.4, 0.9, 0), scale: 0.55 };
}

function buildWorld(renderer, assets, { mobile, quality }) {
  const scene = new Scene();
  const pm = new PMREMGenerator(renderer);
  assets.hdr.mapping = EquirectangularReflectionMapping;
  scene.environment = pm.fromEquirectangular(assets.hdr).texture; pm.dispose();
  scene.environmentIntensity = 0.6;
  scene.add(new Mesh(new SphereGeometry(400, 32, 16), skyMaterial()));
  scene.add(new HemisphereLight(0xb4c4ec, 0x2c2630, 0.6));
  const sun = new DirectionalLight(0xfff0e0, 2.6); sun.position.copy(SUN).multiplyScalar(40).add(new Vector3(0, 12, 26)); scene.add(sun);
  const rim = new DirectionalLight(0xffb878, 1.4); rim.position.copy(SUN).multiplyScalar(40); scene.add(rim);
  if (quality) {
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera; sc.left = sc.bottom = -8; sc.right = sc.top = 8; sc.near = 1; sc.far = 90;
  }
  const { holder, nozzles } = prepareJet(assets.gltf, { shadows: quality, mobile });
  const jet = new Group(); jet.add(holder); scene.add(jet);
  sun.target = jet; rim.target = jet;
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const clouds = makeClouds(mobile ? 34 : 70, rand); scene.add(clouds.mesh);
  const trails = [makeTrail(mobile ? 40 : 70), makeTrail(mobile ? 40 : 70)]; trails.forEach((t) => scene.add(t.mesh));
  return { scene, jet, holder, nozzles, clouds, trails, sun };
}

function createSim(world, camera, { getProgress, mobile }) {
  const { jet, clouds, trails, nozzles } = world;
  let L = layoutFor(camera.aspect);
  const pos = new Spring3(L.base, 1.15), camS = new Spring3(L.cam, 1.6), lookS = new Spring3(L.look, 1.3);
  let prog = 0, progV = 0, t = 0;
  const q = new Quaternion(), qt = new Quaternion(), e = new Euler(0, 0, 0, 'YXZ');
  const baseYaw = Math.atan2(FWD.x, FWD.z);
  const pointer = { x: 0, y: 0 };
  const tmp = new Vector3(), tgt = new Vector3(), m4 = new Matrix4(), sunV = new Vector3();
  let speed = 16;
  q.setFromEuler(e.set(0, baseYaw, 0)); jet.quaternion.copy(q);
  function relayout() { L = layoutFor(camera.aspect); }
  function step(dt) {
    t += dt;
    [prog, progV] = damp(prog, getProgress(), progV, 0.45, dt);           // eased, no overshoot
    // target: base + slow S-turn wander + scroll climb-away + pointer
    const wander = Math.sin(t * 0.21) * 1.1 + Math.sin(t * 0.087 + 1.3) * 0.6;
    tgt.copy(L.base)
      .addScaledVector(RIGHT, wander * (mobile ? 0.45 : 0.6))
      .addScaledVector(UP, Math.sin(t * 0.33 + 0.7) * 0.32 - pointer.y * 0.8 + prog * 5.5)
      .addScaledVector(FWD, prog * 4);
    jet.position.copy(pos.step(tgt, dt));
    jet.scale.setScalar(L.scale);
    const vLat = pos.v.dot(RIGHT), vUp = pos.v.y;
    const bank = Math.max(-0.75, Math.min(0.75, vLat * 0.55));            // bank into the turn
    const pitch = -Math.max(-0.35, Math.min(0.35, vUp * 0.22 + prog * 0.18)); // nose up on climb
    qt.setFromEuler(e.set(pitch, baseYaw + L.yaw + vLat * 0.06, bank + 0.12));
    q.slerp(qt, 1 - Math.exp(-dt * 3.2)); jet.quaternion.copy(q);
    // camera follow with lag
    tmp.copy(L.cam).addScaledVector(jet.position.clone().sub(L.base), 0.22).add(new Vector3(pointer.x * 0.8, -pointer.y * 0.4, 0)).addScaledVector(UP, prog * 1.2);
    camera.position.copy(camS.step(tmp, dt));
    tmp.copy(L.look).addScaledVector(jet.position.clone().sub(L.base), 0.45);
    camera.lookAt(lookS.step(tmp, dt));
    // airflow
    speed += ((16 + prog * 14) - speed) * (1 - Math.exp(-dt * 2));
    const flow = speed * dt;
    const arr = clouds.off;
    clouds.items.forEach((it, i) => {
      it.s -= flow * (it.layer === 'high' ? 0.6 : 1);
      if (it.s < -60) respawn(it, Math.random, false);
      tmp.copy(FWD).multiplyScalar(it.s).addScaledVector(RIGHT, -it.lat).setY(it.y);
      arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z;
    });
    clouds.mesh.geometry.attributes.aOff.needsUpdate = true;
    camera.updateMatrixWorld();
    sunV.copy(SUN).transformDirection(camera.matrixWorldInverse);
    clouds.mesh.material.uniforms.uSunV.value.copy(sunV);
    // contrails from each nacelle exhaust
    trails.forEach((tr, k) => {
      const nz = nozzles[k]; if (!nz) return;
      nz.updateWorldMatrix(true, false);
      const box = new Box3().setFromObject(nz); const p = box.getCenter(new Vector3()); p.addScaledVector(FWD.clone().applyQuaternion(q).normalize(), 0); // centre
      const back = new Vector3(0, 0, -1).applyQuaternion(q); p.addScaledVector(back, (box.max.x - box.min.x) * 0.55);
      for (let i = tr.n - 1; i > 0; i--) tr.pts[i] = tr.pts[i - 1] ? tr.pts[i - 1].addScaledVector(FWD, -flow) : null;
      tr.pts[0] = p;
      const P = tr.mesh.geometry.attributes.position.array; const camPos = camera.position;
      for (let i = 0; i < tr.n; i++) {
        const a = tr.pts[i] || p, b = tr.pts[Math.min(i + 1, tr.n - 1)] || a;
        const dir = tmp.copy(b).sub(a); if (dir.lengthSq() < 1e-8) dir.copy(FWD).negate();
        const side = dir.cross(new Vector3().subVectors(camPos, a)).normalize().multiplyScalar((0.05 + Math.sqrt(i / tr.n) * 0.4) * L.scale);
        P.set([a.x + side.x, a.y + side.y, a.z + side.z, a.x - side.x, a.y - side.y, a.z - side.z], i * 6);
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true;
    });
  }
  return { step, relayout, pointer };
}

export async function initHero(container, { mobile = false, getProgress = () => 0, force = false, onFail = () => {}, manual = false } = {}) {
  if (!container) return;
  let renderer;
  try { renderer = new WebGLRenderer({ antialias: true, powerPreference: mobile ? 'low-power' : 'high-performance' }); } catch { onFail(); return; }
  const quality = !mobile;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.6 : 1.5));
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  if (quality) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap; }
  let assets;
  try { assets = await loadAssets(renderer, mobile); } catch (err) { renderer.dispose(); onFail(); return; }
  const world = buildWorld(renderer, assets, { mobile, quality });
  const camera = new PerspectiveCamera(30, 1, 0.1, 900);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  let composer = null;
  if (quality) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(world.scene, camera));
    composer.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.32, 0.55, 0.82));
    composer.addPass(new OutputPass());
  }
  const sim = createSim(world, camera, { getProgress, mobile });
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sim.relayout();
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  };
  resize(); new ResizeObserver(resize).observe(container);
  for (let i = 0; i < 240; i++) sim.step(1 / 60);                       // same settle as the pre-rendered still, so the cross-fade matches
  if (!mobile) addEventListener('pointermove', (ev) => { sim.pointer.x = ev.clientX / innerWidth - 0.5; sim.pointer.y = ev.clientY / innerHeight - 0.5; }, { passive: true });

  if (manual) {   // deterministic fixed-step rendering, used only to record the hero clips (?rec)
    const draw = () => (composer ? composer.render() : renderer.render(world.scene, camera));
    draw(); container.classList.add('ready');
    return { step(dt = 1 / 30, pointer) { if (pointer) Object.assign(sim.pointer, pointer); sim.step(dt); draw(); } };
  }
  let running = false, visible = true, last = performance.now(), frames = 0, slow = 0, shown = false;
  function frame(now) {
    if (!running) return;
    const raw = now - last;
    if (mobile && raw < 30) { requestAnimationFrame(frame); return; }     // ~30fps on phones
    last = now;
    sim.step(Math.min(0.05, raw / 1000));
    composer ? composer.render() : renderer.render(world.scene, camera);
    frames++;
    if (!shown) { shown = true; container.classList.add('ready'); }
    if (!force && frames > 5 && frames < 60) { if (raw > 60) slow++; if (slow > 30) { running = false; renderer.dispose(); container.replaceChildren(); container.classList.remove('ready'); onFail(); return; } }
    requestAnimationFrame(frame);
  }
  const update = () => { const want = visible && !document.hidden; if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!want) running = false; };
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; update(); }).observe(container);
  document.addEventListener('visibilitychange', update);
  update();
}

// Pre-rendered still from the real scene (used for no-WebGL / low-power / reduced motion / Save-Data).
export async function renderStill(w = 1920, h = 1080) {
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  const assets = await loadAssets(renderer, false);
  const world = buildWorld(renderer, assets, { mobile: false, quality: true });
  const camera = new PerspectiveCamera(30, w / h, 0.1, 900);
  const sim = createSim(world, camera, { getProgress: () => 0, mobile: w < h });
  for (let i = 0; i < 240; i++) sim.step(1 / 60);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world.scene, camera));
  composer.addPass(new UnrealBloomPass(new Vector2(w / 2, h / 2), 0.32, 0.55, 0.82));
  composer.addPass(new OutputPass());
  composer.setSize(w, h);
  composer.render();
  return renderer.domElement.toDataURL('image/jpeg', 0.92);
}
