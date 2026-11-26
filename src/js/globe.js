// Dotted globe (Natural Earth land, public domain) with glowing illustrative route arcs.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshBasicMaterial, SphereGeometry, BufferGeometry, Float32BufferAttribute,
  Points, PointsMaterial, ShaderMaterial, AdditiveBlending, BackSide, Vector3, CubicBezierCurve3, TubeGeometry, RingGeometry, DoubleSide, SRGBColorSpace,
} from 'three';

const CITIES = {
  delhi: [28.61, 77.21], mumbai: [19.08, 72.88], bengaluru: [12.97, 77.59], dubai: [25.2, 55.27], london: [51.51, -0.13],
  paris: [48.86, 2.35], singapore: [1.35, 103.82], bangkok: [13.76, 100.5], male: [4.18, 73.51], kathmandu: [27.72, 85.32],
  zurich: [47.37, 8.54], newyork: [40.71, -74.0], colombo: [6.93, 79.86], riyadh: [24.71, 46.68],
};
const ROUTES = [['delhi', 'london'], ['delhi', 'dubai'], ['mumbai', 'male'], ['mumbai', 'singapore'], ['delhi', 'kathmandu'], ['bengaluru', 'colombo'],
  ['dubai', 'paris'], ['delhi', 'bangkok'], ['london', 'newyork'], ['mumbai', 'zurich'], ['dubai', 'riyadh'], ['bangkok', 'singapore']];
const DEG = Math.PI / 180;
const ll = (lat, lng, r = 1) => { const phi = (90 - lat) * DEG, th = (lng + 180) * DEG; return new Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); };

export async function initGlobe(el, { mobile = false, still = false, force = false, onFail = () => {}, size = null } = {}) {
  const res = await fetch('/assets/data/land-dots.bin');
  const dots = new Int16Array(await res.arrayBuffer());

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: !!size });
  renderer.setPixelRatio(size ? 1 : Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  el.append(renderer.domElement);
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 50); camera.position.set(0, 0, 4.6);

  const globe = new Group(); scene.add(globe);
  globe.add(new Mesh(new SphereGeometry(0.995, 48, 32), new MeshBasicMaterial({ color: 0x0a1638 })));
  const pos = new Float32Array((dots.length / 2) * 3);
  for (let i = 0; i < dots.length / 2; i++) { const v = ll(dots[i * 2] / 100, dots[i * 2 + 1] / 100, 1.002); pos.set([v.x, v.y, v.z], i * 3); }
  const dg = new BufferGeometry(); dg.setAttribute('position', new Float32BufferAttribute(pos, 3));
  globe.add(new Points(dg, new PointsMaterial({ color: 0x9fb0d4, size: mobile ? 0.022 : 0.017, transparent: true, opacity: 0.8 })));

  // atmosphere
  const atm = new ShaderMaterial({
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vN; void main(){ float i = pow(clamp(-dot(vN, vec3(0.0,0.0,1.0)), 0.0, 1.0), 1.6) * 0.7; gl_FragColor = vec4(0.79,0.66,0.43,1.0)*i; }',
    side: BackSide, blending: AdditiveBlending, transparent: true, depthWrite: false,
  });
  const atmo = new Mesh(new SphereGeometry(1.18, 48, 32), atm); scene.add(atmo);

  // arcs
  const arcMats = [];
  ROUTES.forEach(([a, b], i) => {
    const A = ll(...CITIES[a], 1.003), B = ll(...CITIES[b], 1.003);
    const d = A.distanceTo(B); const lift = 1 + d * 0.32;
    const m1 = A.clone().lerp(B, 0.25).normalize().multiplyScalar(lift), m2 = A.clone().lerp(B, 0.75).normalize().multiplyScalar(lift);
    const curve = new CubicBezierCurve3(A, m1, m2, B);
    const mat = new ShaderMaterial({
      uniforms: { uT: { value: still ? 0.5 : 0 }, uOff: { value: i * 0.37 }, uStill: { value: still ? 1 : 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uT; uniform float uOff; uniform float uStill; varying vec2 vUv;
        void main(){ float h = fract(uT*0.32 + uOff); float d = h - vUv.x; float head = d >= 0.0 ? exp(-d*9.0) : 0.0;
        float a = mix(0.18 + head*1.4, 0.85, uStill); vec3 c = mix(vec3(0.91,0.76,0.5), vec3(1.0,0.95,0.85), head);
        gl_FragColor = vec4(c, a); }`,
      transparent: true, blending: AdditiveBlending, depthWrite: false,
    });
    arcMats.push(mat);
    globe.add(new Mesh(new TubeGeometry(curve, mobile ? 40 : 64, 0.0055, 5, false), mat));
  });
  // city markers
  const dotMat = new MeshBasicMaterial({ color: 0xf3d79b });
  const ringMat = new MeshBasicMaterial({ color: 0xf3d79b, transparent: true, opacity: 0.6, side: DoubleSide, depthWrite: false });
  const rings = [];
  Object.values(CITIES).forEach(([la, lo], i) => {
    const p = ll(la, lo, 1.004);
    const d = new Mesh(new SphereGeometry(0.014, 8, 6), dotMat); d.position.copy(p); globe.add(d);
    const r = new Mesh(new RingGeometry(0.02, 0.028, 24), ringMat.clone()); r.position.copy(p); r.lookAt(p.clone().multiplyScalar(2)); r.userData.o = i * 0.23; globe.add(r); rings.push(r);
  });

  // face India / Middle East initially
  const base = Math.PI / 2 - (78 + 180) * DEG;
  globe.rotation.set(0.32, base, 0);
  atmo.rotation.copy(globe.rotation);

  function resize() { const w = size || el.clientWidth, h = size || el.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); if (!size) new ResizeObserver(() => { resize(); if (still) renderer.render(scene, camera); }).observe(el);

  // drag to spin
  let drag = null, vel = 0;
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; globe.rotation.y += dx * 0.006; vel = dx * 0.0006; if (still) renderer.render(scene, camera); });
  const end = () => { drag = null; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);

  renderer.render(scene, camera); el.classList.add('ready');
  if (size) return renderer.domElement.toDataURL('image/png');
  if (still) return;

  let visible = true, running = false, last = performance.now(), t = 0, frames = 0, slow = 0;
  function frame(now) {
    if (!running) return;
    const rawMs = now - last; const dt = Math.min(0.05, rawMs / 1000); last = now; t += dt;
    if (!drag) { globe.rotation.y += dt * 0.09 + vel; vel *= 0.95; }
    arcMats.forEach((m) => (m.uniforms.uT.value = t));
    rings.forEach((r) => { const k = (t * 0.6 + r.userData.o) % 1; r.scale.setScalar(1 + k * 2.2); r.material.opacity = 0.7 * (1 - k); });
    renderer.render(scene, camera);
    frames++;
    if (!force && frames > 5 && frames < 50) { if (rawMs > 55) slow++; if (slow > 25) { running = false; renderer.domElement.remove(); el.classList.remove('ready'); onFail(); return; } }
    requestAnimationFrame(frame);
  }
  function update() { const want = visible && !document.hidden; if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!want) running = false; }
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; update(); }).observe(el);
  document.addEventListener('visibilitychange', update);
  update();
}

export async function renderStill(w = 1000) {
  const el = document.createElement('div');
  return initGlobe(el, { size: w, still: true });
}
