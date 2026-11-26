// AWANA AIR sky: ONE persistent fixed WebGL canvas behind the whole page.
// CC0 business-jet glTF (tevy.dev) flies a scroll-choreographed path through every section: golden-hour IBL
// (CC0 HDR sky), sky dome + layered clouds in the hero, contrails, critically damped motion (bank into turns,
// pitch on climb, no snapping). The same renderer also draws the route globe (scissored into its box), so the
// page never runs two WebGL contexts. The jet fades behind any text it would cover.
import { MeshStandardMaterial, MeshBasicMaterial, DoubleSide,
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, SphereGeometry, PlaneGeometry, ShaderMaterial, BackSide, Vector3, Vector2,
  Quaternion, Euler, DirectionalLight, HemisphereLight, PMREMGenerator, SRGBColorSpace, ACESFilmicToneMapping,
  EquirectangularReflectionMapping, PCFShadowMap, InstancedMesh, InstancedBufferAttribute, DataTexture, RGBAFormat,
  LinearFilter, BufferGeometry, BufferAttribute, DynamicDrawUsage, MeshPhysicalMaterial, Box3, LinearMipmapLinearFilter,
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
const FWD = new Vector3(1, 0, 0.42).normalize();            // hero flight direction in world space (cloud flow)
const SUN = new Vector3(0.78, 0.1, -0.62).normalize();       // low golden sun, right of frame, behind
const FOV = 30, JET_LEN = 10.5;

// critically damped spring (Unity-style SmoothDamp)
function damp(cur, target, vel, smoothTime, dt) {
  const omega = 2 / smoothTime, x = omega * dt, exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target, temp = (vel + omega * change) * dt;
  const v = (vel - omega * temp) * exp;
  return [target + (change + temp) * exp, v];
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- sky dome ----------
function skyMaterial() {
  return new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false, transparent: true,
    uniforms: { uSun: { value: SUN }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 uSun; uniform float uAlpha; varying vec3 vDir;
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
        gl_FragColor = vec4(col, uAlpha);
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
    uniforms: { uTex: { value: cloudAtlas() }, uSunV: { value: new Vector3() }, uVis: { value: 1 } },
    vertexShader: `attribute vec4 aCloud; attribute vec3 aOff; varying vec2 vUv; varying float vA; varying float vSunF; varying float vDist; uniform vec3 uSunV;
      void main(){
        vec4 mv = viewMatrix * vec4(aOff, 1.0);
        mv.xy += position.xy * aCloud.xy;
        vUv = vec2((uv.x + aCloud.z) * 0.5, uv.y); vA = aCloud.w;
        vec3 toC = normalize(mv.xyz); vSunF = pow(max(dot(toC, uSunV), 0.0), 6.0); vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uVis; varying vec2 vUv; varying float vA; varying float vSunF; varying float vDist;
      void main(){
        vec4 t = texture2D(uTex, vUv); float d = t.r; if (d < 0.01) discard;
        vec3 shade = vec3(0.17,0.17,0.24), lit = vec3(1.0,0.82,0.62), rim = vec3(1.0,0.72,0.42);
        vec3 col = mix(shade, lit, t.g);
        col += rim * vSunF * (1.0 - d) * 1.6;                 // silver lining toward the sun
        float near = smoothstep(1.5, 9.0, vDist);              // fade as we fly through
        float far = 1.0 - smoothstep(70.0, 110.0, vDist);
        col = mix(col, vec3(0.3,0.24,0.27), smoothstep(30.0, 100.0, vDist) * 0.7); // aerial perspective
        gl_FragColor = vec4(col, d * vA * near * far * uVis);
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
  const m = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, uniforms: { uAlpha: { value: 1 }, uLen: { value: 1 } },
    vertexShader: 'attribute float aT; attribute float aS; varying float vT; varying float vS; void main(){ vT = aT; vS = aS; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float uAlpha; uniform float uLen; varying float vT; varying float vS; void main(){ float a = (1.0 - vS * vS) * (1.0 - vS * vS) * smoothstep(0.02, 0.12, vT) * pow(1.0 - vT, 1.6) * 0.42 * (0.75 + 0.25 * sin(vT * 40.0)); a *= 1.0 - smoothstep(uLen * 0.5, uLen, vT); gl_FragColor = vec4(vec3(1.0,0.95,0.9), a * uAlpha);\n#include <colorspace_fragment>\n}' });
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
  holder.updateMatrixWorld(true);
  // footprint samples: the 8 bounding-box corners of every part, in the jet's frame (tight, still conservative)
  const pts = [], v = new Vector3(), meshes = [];
  model.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const mats = [...new Set(meshes.map((o) => o.material))];
  for (const o of meshes) {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (let i = 0; i < 8; i++) { v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld); pts.push(v.x, v.y, v.z); }
    // depth-only twin: when the jet is faded, only its front-most surfaces blend (no x-ray look)
    const twin = new Mesh(o.geometry, new MeshBasicMaterial({ colorWrite: false }));
    twin.visible = false; twin.renderOrder = -1; o.add(twin); o.userData.twin = twin;
  }
  const twins = meshes.map((o) => o.userData.twin);
  return { holder, nozzles, local: new Float32Array(pts), mats, twins };
}


// Hero camera (the reference frame the whole flight is placed in).
function cameraFor(aspect) {
  return aspect < 1 ? { cam: new Vector3(0, 2.6, 19), look: new Vector3(0, 1.6, 0), scale: 0.5 } : { cam: new Vector3(0, 2.2, 18), look: new Vector3(1.4, 0.9, 0), scale: 0.55 };
}
// Hero placement in screen terms: x, y = centre as a fraction of the viewport, w = jet width as a fraction of the viewport width.
export function heroTrack(mobile, zone) {
  if (mobile) {
    const y = zone ? zone.y : 0.21, w = zone ? zone.w : 0.8;
    return { x: 0.5, y, w, yaw: -0.5, sky: 1, cloud: 1, pitch: 0 };
  }
  return { x: 0.75, y: 0.5, w: 0.29, yaw: -0.22, sky: 1, cloud: 1, pitch: 0 };
}

function buildWorld(renderer, assets, { mobile, quality }) {
  const scene = new Scene();
  const pm = new PMREMGenerator(renderer);
  assets.hdr.mapping = EquirectangularReflectionMapping;
  scene.environment = pm.fromEquirectangular(assets.hdr).texture; pm.dispose();
  scene.environmentIntensity = 0.6;
  const sky = new Mesh(new SphereGeometry(400, 32, 16), skyMaterial()); sky.renderOrder = -10; scene.add(sky);
  scene.add(new HemisphereLight(0xb4c4ec, 0x2c2630, 0.6));
  const sun = new DirectionalLight(0xfff0e0, 2.6); sun.position.copy(SUN).multiplyScalar(40).add(new Vector3(0, 12, 26)); scene.add(sun);
  const rim = new DirectionalLight(0xffb878, 1.4); rim.position.copy(SUN).multiplyScalar(40); scene.add(rim);
  if (quality) {
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera; sc.left = sc.bottom = -8; sc.right = sc.top = 8; sc.near = 1; sc.far = 120;
  }
  const { holder, nozzles, local, mats, twins } = prepareJet(assets.gltf, { shadows: quality, mobile });
  const jet = new Group(); jet.add(holder); scene.add(jet);
  sun.target = jet; rim.target = jet;
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const clouds = makeClouds(mobile ? 34 : 70, rand); scene.add(clouds.mesh);
  const trails = [makeTrail(mobile ? 40 : 70), makeTrail(mobile ? 40 : 70)]; trails.forEach((t) => scene.add(t.mesh));
  return { scene, sky, jet, holder, nozzles, local, mats, twins, clouds, trails, sun };
}

const CORNERS = [...Array(8)].map(() => new Vector3());
function createSim(world, camera, { getTrack, getTextRects = () => [], mobile, size }) {
  const { jet, holder, clouds, trails, nozzles, local, mats, twins, sky } = world;
  let C = cameraFor(camera.aspect);
  const ref = new PerspectiveCamera(FOV, camera.aspect, 0.1, 900);
  const relayout = () => { C = cameraFor(camera.aspect); ref.aspect = camera.aspect; ref.position.copy(C.cam); ref.lookAt(C.look); ref.updateProjectionMatrix(); ref.updateMatrixWorld(); };
  relayout();
  const T = { ...getTrack() }; const V = { x: 0, y: 0, w: 0, yaw: 0 };
  const pointer = { x: 0, y: 0 }, camOff = new Vector3(), camV = new Vector3();
  const q = new Quaternion(), qt = new Quaternion(), e = new Euler(0, 0, 0, 'YXZ');
  const baseYaw = Math.atan2(FWD.x, FWD.z);
  const prev = new Vector3(), vel = new Vector3(), tmp = new Vector3(), dir = new Vector3(), fwdRef = new Vector3(), sunV = new Vector3(), jf = new Vector3();
  let t = 0, speed = 16, yawPrev = T.yaw, yawRate = 0, alpha = 1, bounds = null, first = true;
  const out = { alpha: 1, bounds: null };

  function place(target, x, y, w) {        // screen-space placement -> world position on the reference camera
    const visW = 2 * Math.tan((FOV * Math.PI) / 360) * ref.aspect;
    const d = (JET_LEN * C.scale * 0.6) / Math.max(0.05, w * visW);
    dir.set(x * 2 - 1, 1 - y * 2, 0.5).unproject(ref).sub(ref.position).normalize();
    ref.getWorldDirection(fwdRef);
    return target.copy(ref.position).addScaledVector(dir, d / Math.max(0.2, dir.dot(fwdRef)));
  }
  const P3 = new Vector3();
  function footprint(W, H) {               // projected footprint of the jet, in CSS px of the canvas
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    jet.updateWorldMatrix(true, true);
    const M = holder.matrixWorld;
    for (let i = 0; i < local.length; i += 3) {
      const c = P3.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(M).project(camera);
      const sx = ((c.x + 1) / 2) * W, sy = ((1 - c.y) / 2) * H;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
    return { x0, y0, x1, y1 };
  }
  function step(dt, wall = dt) {          // wall: real elapsed time (uncapped), used for the readability fade
    t += dt;
    const g = getTrack();
    const st = mobile ? 0.5 : 0.62;                      // eased, critically damped: no overshoot, no snapping
    for (const k of ['x', 'y', 'w', 'yaw']) { const [p, v] = damp(T[k], g[k], V[k], k === 'yaw' ? 0.9 : st, dt); T[k] = p; V[k] = v; }
    T.sky = g.sky; T.cloud = g.cloud;
    // gentle wander so the jet is always flying, even when the page is still
    const wx = (Math.sin(t * 0.21) * 0.012 + Math.sin(t * 0.087 + 1.3) * 0.008) * (mobile ? 0.6 : 1);
    const wy = Math.sin(t * 0.33 + 0.7) * 0.011;
    place(tmp, T.x + wx, T.y + wy, T.w);
    if (first) { prev.copy(tmp); first = false; }
    vel.subVectors(tmp, prev).divideScalar(Math.max(dt, 1e-3)); prev.copy(tmp);
    jet.position.copy(tmp); jet.scale.setScalar(C.scale);
    yawRate += ((T.yaw - yawPrev) / Math.max(dt, 1e-3) - yawRate) * (1 - Math.exp(-dt * 6)); yawPrev = T.yaw;
    const bank = clamp(-yawRate * 0.9 + 0.12, -0.75, 0.75);           // bank into the turn
    const pitch = -clamp(vel.y * 0.05 + (g.pitch || 0), -0.32, 0.32); // nose up on climb, down on descent
    qt.setFromEuler(e.set(pitch, baseYaw + T.yaw, bank));
    q.slerp(qt, 1 - Math.exp(-dt * 4)); jet.quaternion.copy(q);
    // camera: fixed frame + soft pointer parallax
    tmp.set(pointer.x * 0.8, -pointer.y * 0.4, 0);
    for (const k of ['x', 'y', 'z']) { const [p, v] = damp(camOff[k], tmp[k], camV[k], 0.8, dt); camOff[k] = p; camV[k] = v; }
    camera.position.copy(C.cam).add(camOff); camera.lookAt(C.look);
    camera.updateMatrixWorld();
    // sky + clouds
    sky.visible = T.sky > 0.002; sky.material.uniforms.uAlpha.value = T.sky;
    clouds.mesh.visible = T.cloud > 0.002; clouds.mesh.material.uniforms.uVis.value = T.cloud;
    speed += ((16 + (1 - T.sky) * 8) - speed) * (1 - Math.exp(-dt * 2));
    const flow = speed * dt;
    const arr = clouds.off;
    clouds.items.forEach((it, i) => {
      it.s -= flow * (it.layer === 'high' ? 0.6 : 1);
      if (it.s < -60) respawn(it, Math.random, false);
      tmp.copy(FWD).multiplyScalar(it.s).addScaledVector(new Vector3().crossVectors(FWD, UP).normalize(), -it.lat).setY(it.y);
      arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z;
    });
    clouds.mesh.geometry.attributes.aOff.needsUpdate = true;
    sunV.copy(SUN).transformDirection(camera.matrixWorldInverse);
    clouds.mesh.material.uniforms.uSunV.value.copy(sunV);
    // readability: fade the jet (and its trails) whenever its footprint would cover text
    const W = size().w, H = size().h;
    bounds = footprint(W, H);
    const m = 28; let hit = false;
    const onScreen = bounds.x1 > 0 && bounds.x0 < W && bounds.y1 > 0 && bounds.y0 < H;
    if (onScreen) for (const r of getTextRects()) { if (r.right > bounds.x0 - m && r.left < bounds.x1 + m && r.bottom > bounds.y0 - m && r.top < bounds.y1 + m) { hit = true; break; } }
    const want = hit ? 0.16 : 1;
    alpha += (want - alpha) * (1 - Math.exp(-wall / (want < alpha ? 0.05 : 0.3)));
    if (want < alpha && wall > 0.12) alpha = want;                     // slow frame: never let the jet linger over text
    const transparent = alpha < 0.995;
    if (mats[0].transparent !== transparent) { for (const mt of mats) { mt.transparent = transparent; mt.needsUpdate = true; } for (const tw of twins) tw.visible = transparent; }
    for (const mt of mats) mt.opacity = alpha;
    // contrails from each nacelle exhaust, advected backwards along the jet's heading
    jf.set(0, 0, 1).applyQuaternion(q).normalize();
    trails.forEach((tr, k) => {
      tr.mesh.material.uniforms.uAlpha.value = alpha * (0.55 + 0.45 * T.sky);
      tr.mesh.material.uniforms.uLen.value = 0.3 + 0.7 * T.sky;          // short trails over the page, long in the hero sky
      const nz = nozzles[k]; if (!nz) return;
      nz.updateWorldMatrix(true, false);
      const box = new Box3().setFromObject(nz); const p = box.getCenter(new Vector3());
      p.addScaledVector(jf, -(box.max.x - box.min.x) * 0.55);
      for (let i = tr.n - 1; i > 0; i--) tr.pts[i] = tr.pts[i - 1] ? tr.pts[i - 1].addScaledVector(jf, -flow) : null;
      tr.pts[0] = p;
      const P = tr.mesh.geometry.attributes.position.array; const camPos = camera.position;
      for (let i = 0; i < tr.n; i++) {
        const a = tr.pts[i] || p, b = tr.pts[Math.min(i + 1, tr.n - 1)] || a;
        const d = tmp.copy(b).sub(a); if (d.lengthSq() < 1e-8) d.copy(jf).negate();
        const side = d.cross(new Vector3().subVectors(camPos, a)).normalize().multiplyScalar((0.05 + Math.sqrt(i / tr.n) * 0.4) * C.scale);
        P.set([a.x + side.x, a.y + side.y, a.z + side.z, a.x - side.x, a.y - side.y, a.z - side.z], i * 6);
      }
      tr.mesh.geometry.attributes.position.needsUpdate = true;
    });
    out.alpha = alpha; out.bounds = onScreen ? bounds : null; out.sky = T.sky;
  }
  return { step, relayout, pointer, out };
}

// Fixed full-viewport canvas. Returns a controller, or nothing after calling onFail.
export async function initSky(container, { mobile = false, getTrack, getTextRects, force = false, onFail = () => {}, onReady = () => {}, manual = false } = {}) {
  if (!container) return;
  let renderer;
  try { renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: mobile ? 'low-power' : 'high-performance' }); } catch { onFail(); return; }
  if (!renderer.getContext()) { onFail(); return; }
  const quality = !mobile;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  if (quality) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap; }
  let assets;
  try { assets = await loadAssets(renderer, mobile); } catch (err) { renderer.dispose(); onFail(); return; }
  const world = buildWorld(renderer, assets, { mobile, quality });
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 900);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  let composer = null, bloom = null;
  if (quality) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(world.scene, camera));
    composer.addPass((bloom = new UnrealBloomPass(new Vector2(256, 256), 0.32, 0.55, 0.82)));
    composer.addPass(new OutputPass());
  }
  let W = 1, H = 1;
  const sim = createSim(world, camera, { getTrack, getTextRects, mobile, size: () => ({ w: W, h: H }) });
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    W = w; H = h;
    const cap = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.5, Math.sqrt(2.4e6 / (w * h)));  // bound the pixel count on big screens
    renderer.setPixelRatio(cap); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sim.relayout();
    if (composer) { composer.setPixelRatio(cap); composer.setSize(w, h); }
  };
  resize(); new ResizeObserver(resize).observe(container);
  for (let i = 0; i < 240; i++) sim.step(1 / 60);                       // same settle as the pre-rendered still
  if (!mobile) addEventListener('pointermove', (ev) => { sim.pointer.x = ev.clientX / innerWidth - 0.5; sim.pointer.y = ev.clientY / innerHeight - 0.5; }, { passive: true });

  // optional extra layer drawn into the same canvas (the globe), scissored to its element's box
  let layer = null;
  function draw() {
    if (composer && sim.out.sky > 0.98) { composer.render(); return; }    // hero: bloom; elsewhere: direct (keeps alpha clean)
    renderer.autoClear = false; renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clear();
    if (layer) {
      const r = layer.el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < H && r.width > 0) {
        renderer.setViewport(r.left, H - r.bottom, r.width, r.height); renderer.setScissor(r.left, H - r.bottom, r.width, r.height); renderer.setScissorTest(true);
        layer.render(renderer, r.width / r.height);
        renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.clearDepth();
      }
    }
    renderer.render(world.scene, camera);
    renderer.autoClear = true;
  }
  const api = {
    get state() { return { alpha: sim.out.alpha, bounds: sim.out.bounds, sky: sim.out.sky }; },
    addLayer(l) { layer = l; },
    step(dt = 1 / 30, pointer) { if (pointer) Object.assign(sim.pointer, pointer); if (layer) layer.tick(dt); sim.step(dt); draw(); },
  };
  if (manual) { draw(); onReady(); return api; }

  let running = false, last = performance.now(), frames = 0, slow = 0, shown = false;
  function frame(now) {
    if (!running) return;
    const raw = now - last;
    if (mobile && raw < 30) { requestAnimationFrame(frame); return; }     // ~30fps on phones
    last = now;
    const dt = Math.min(0.05, raw / 1000);
    if (layer) layer.tick(dt);
    sim.step(dt, raw / 1000); draw();
    frames++;
    if (!shown) { shown = true; onReady(); }
    if (!force && frames > 5 && frames < 60) { if (raw > 60) slow++; if (slow > 30) { running = false; renderer.dispose(); container.replaceChildren(); onFail(); return; } }
    requestAnimationFrame(frame);
  }
  const update = () => { const want = !document.hidden; if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!want) running = false; };
  document.addEventListener('visibilitychange', update);                // pauses when the tab is hidden
  update();
  return api;
}

// Pre-rendered still from the real scene (no-WebGL / software GL / reduced motion / Save-Data).
export async function renderStill(w = 1920, h = 1080) {
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  const assets = await loadAssets(renderer, false);
  const world = buildWorld(renderer, assets, { mobile: false, quality: true });
  const camera = new PerspectiveCamera(FOV, w / h, 0.1, 900);
  const mobile = w < h;
  const sim = createSim(world, camera, { getTrack: () => heroTrack(mobile), mobile, size: () => ({ w, h }) });
  for (let i = 0; i < 240; i++) sim.step(1 / 60);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world.scene, camera));
  composer.addPass(new UnrealBloomPass(new Vector2(w / 2, h / 2), 0.32, 0.55, 0.82));
  composer.addPass(new OutputPass());
  composer.setSize(w, h);
  composer.render();
  return renderer.domElement.toDataURL('image/jpeg', 0.92);
}
