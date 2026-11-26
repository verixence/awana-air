// Procedural business-jet hero: built from primitives, no external models.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, LatheGeometry, Vector2,
  Shape, ExtrudeGeometry, CylinderGeometry, SphereGeometry, BoxGeometry, PlaneGeometry, HemisphereLight, DirectionalLight,
  CanvasTexture, SpriteMaterial, Sprite, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, AdditiveBlending,
  Fog, SRGBColorSpace, DoubleSide, MathUtils,
} from 'three';

function softTexture(draw, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function cloudTexture(seed) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return softTexture((g, n) => {
    for (let i = 0; i < 16; i++) {
      const x = n * (0.2 + rnd() * 0.6), y = n * (0.38 + rnd() * 0.3), r = n * (0.1 + rnd() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, 256);
}
const glowTexture = () => softTexture((g, n) => {
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, 'rgba(255,236,200,1)'); gr.addColorStop(0.25, 'rgba(255,190,110,0.55)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
});
const trailTexture = () => softTexture((g, n) => {
  const gr = g.createLinearGradient(0, 0, n, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,240,215,0.5)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  const v = g.createLinearGradient(0, 0, 0, n); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, n, n);
});

function wing(points, depth) {
  const sh = new Shape(); sh.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) sh.lineTo(points[i][0], points[i][1]);
  sh.closePath();
  return new ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.5, bevelSegments: 2, curveSegments: 2 });
}

function buildJet() {
  const jet = new Group();
  const body = new MeshStandardMaterial({ color: 0xf3f1ec, metalness: 0.25, roughness: 0.32 });
  const trim = new MeshStandardMaterial({ color: 0xd2a75c, metalness: 0.7, roughness: 0.3 });
  const dark = new MeshStandardMaterial({ color: 0x0b1430, metalness: 0.6, roughness: 0.15 });
  const grey = new MeshStandardMaterial({ color: 0xc9cfdb, metalness: 0.45, roughness: 0.35 });

  const prof = [[0.0, -5.0], [0.16, -4.9], [0.34, -4.2], [0.5, -3.2], [0.6, -1.8], [0.63, -0.5], [0.63, 2.2], [0.58, 3.2], [0.46, 3.9], [0.3, 4.45], [0.14, 4.85], [0.0, 5.05]].map(([x, y]) => new Vector2(x, y));
  const fus = new LatheGeometry(prof, 40); fus.rotateZ(-Math.PI / 2);
  jet.add(new Mesh(fus, body));

  // windscreen + cabin windows
  const ws = new Mesh(new SphereGeometry(1, 24, 12), dark); ws.scale.set(0.62, 0.22, 0.44); ws.position.set(3.85, 0.27, 0); jet.add(ws);
  const winGeo = new SphereGeometry(0.075, 10, 8);
  for (let i = 0; i < 7; i++) for (const z of [-1, 1]) { const w = new Mesh(winGeo, dark); w.scale.set(1.25, 1, 0.4); w.position.set(-1.1 + i * 0.52, 0.16, z * 0.615); jet.add(w); }
  for (const z of [-1, 1]) { const s = new Mesh(new BoxGeometry(3.9, 0.04, 0.02), trim); s.position.set(0.6, -0.08, z * 0.625); jet.add(s); }

  // wings (swept, slight dihedral)
  const wPts = (sgn) => [[1.1, 0], [-1.3, 0], [-2.55, sgn * 5.0], [-1.75, sgn * 5.0]];
  for (const sgn of [1, -1]) {
    const g = wing(wPts(sgn), 0.07); g.rotateX(-Math.PI / 2);
    const m = new Mesh(g, body); m.position.set(0.2, -0.3, 0); m.rotation.x = sgn * 0.07; jet.add(m);
    const tipG = wing([[0, 0], [-0.55, 0], [-0.95, 0.85], [-0.6, 0.85]], 0.04);
    const tip = new Mesh(tipG, trim); tip.position.set(-1.55 + 0.2, -0.3, -sgn * 5.0); tip.rotation.x = 0; tip.position.y += sgn * 0.0 - 0.0; jet.add(tip);
  }
  // T-tail: fin + stabilisers
  const fin = new Mesh(wing([[-3.0, 0.3], [-4.35, 0.3], [-5.05, 2.25], [-4.45, 2.25]], 0.07), body); fin.position.z = -0.05; jet.add(fin);
  for (const sgn of [1, -1]) {
    const g = wing([[0.0, 0], [-0.75, 0], [-1.25, sgn * 1.85], [-0.85, sgn * 1.85]], 0.045); g.rotateX(-Math.PI / 2);
    const m = new Mesh(g, body); m.position.set(-4.3, 2.22, 0); jet.add(m);
  }
  // rear-mounted engines
  const nac = new CylinderGeometry(0.33, 0.27, 1.7, 24, 1); nac.rotateZ(Math.PI / 2);
  const intake = new CylinderGeometry(0.27, 0.27, 0.05, 24); intake.rotateZ(Math.PI / 2);
  const glowMat = new SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true });
  const glows = [];
  for (const z of [-1, 1]) {
    const e = new Mesh(nac, grey); e.position.set(-3.0, 0.42, z * 0.98); jet.add(e);
    const ring = new Mesh(intake, dark); ring.position.set(-2.14, 0.42, z * 0.98); jet.add(ring);
    const band = new Mesh(new CylinderGeometry(0.335, 0.335, 0.08, 24), trim); band.rotation.z = Math.PI / 2; band.position.set(-2.4, 0.42, z * 0.98); jet.add(band);
    const py = new Mesh(new BoxGeometry(0.8, 0.08, 0.5), grey); py.position.set(-3.0, 0.4, z * 0.66); jet.add(py);
    const gl = new Sprite(glowMat); gl.position.set(-3.95, 0.42, z * 0.98); gl.scale.set(0.9, 0.9, 1); jet.add(gl); glows.push(gl);
  }
  // soft engine trails
  const trailMat = new MeshBasicMaterial({ map: trailTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, opacity: 0.55 });
  for (const z of [-1, 1]) { const t = new Mesh(new PlaneGeometry(9, 0.32), trailMat); t.position.set(-8.4, 0.42, z * 0.98); jet.add(t); }
  return { jet, glows };
}

export function initHero(container, { mobile = false, getProgress = () => 0 } = {}) {
  if (!container) return;
  const renderer = new WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new Scene();
  scene.fog = new Fog(0x0b1a44, 18, 70);
  const camera = new PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(0, 0.6, 15);

  scene.add(new HemisphereLight(0xa8b8ff, 0x3a2a18, 1.1));
  const key = new DirectionalLight(0xffe0b0, 2.6); key.position.set(6, 6, 8); scene.add(key);
  const rim = new DirectionalLight(0x7f9bff, 1.6); rim.position.set(-8, 3, -6); scene.add(rim);

  // stars
  const nStars = mobile ? 300 : 900; const sp = new Float32Array(nStars * 3);
  for (let i = 0; i < nStars; i++) { sp[i * 3] = (Math.random() - 0.5) * 220; sp[i * 3 + 1] = Math.random() * 70 - 8; sp[i * 3 + 2] = -90 - Math.random() * 30; }
  const sg = new BufferGeometry(); sg.setAttribute('position', new Float32BufferAttribute(sp, 3));
  const stars = new Points(sg, new PointsMaterial({ color: 0xffffff, size: mobile ? 0.5 : 0.4, sizeAttenuation: true, transparent: true, opacity: 0.85, fog: false }));
  scene.add(stars);

  // cloud layers (parallax comes from depth)
  const texes = [cloudTexture(3), cloudTexture(11), cloudTexture(29)];
  const clouds = []; const nClouds = mobile ? 14 : 32; const span = 90;
  for (let i = 0; i < nClouds; i++) {
    const m = new SpriteMaterial({ map: texes[i % 3], transparent: true, depthWrite: false, opacity: 0.35 + Math.random() * 0.4, color: i % 4 === 0 ? 0xffe2bd : 0xc8d2f2 });
    const s = new Sprite(m);
    const z = -55 + Math.random() * 62; const sc = 10 + Math.random() * 16;
    s.scale.set(sc * 1.8, sc * 0.75, 1);
    s.position.set((Math.random() - 0.5) * span, -7 + Math.random() * 7 + (z < -30 ? 3 : 0), z);
    scene.add(s); clouds.push(s);
  }

  const { jet, glows } = buildJet();
  const rig = new Group(); rig.add(jet); scene.add(rig);
  jet.rotation.y = -0.55;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!mobile) addEventListener('pointermove', (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  let w = 0, h = 0, aspect = 1;
  function resize() {
    w = container.clientWidth; h = container.clientHeight; if (!w || !h) return;
    aspect = w / h; renderer.setSize(w, h, false); camera.aspect = aspect; camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  let visible = true, running = false, last = performance.now(), t = 0, first = true, p = 0;
  function frame(now) {
    if (!running) return;
    if (mobile && now - last < 30) { requestAnimationFrame(frame); return; } // ~30fps cap on phones
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    p += (getProgress() - p) * 0.08;
    pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;

    const narrow = aspect < 1;
    const s = narrow ? Math.max(0.3, aspect * 0.62) : Math.min(0.66, 0.42 + aspect * 0.1);
    rig.scale.setScalar(s);
    const baseX = narrow ? 0.5 : 3.8, baseY = narrow ? 3.15 : -0.2;
    rig.position.set(baseX + p * (narrow ? 5 : 7.5), baseY + p * 5.2 + Math.sin(t * 1.1) * 0.12 - pointer.y * 0.6, p * -6);
    rig.rotation.set(-0.12 + Math.sin(t * 0.7) * 0.04 - p * 0.55 + pointer.x * 0.25, 0, 0.04 + p * 0.32 - pointer.y * 0.08);
    camera.position.x = pointer.x * 0.8; camera.position.y = 0.6 - pointer.y * 0.4 + p * 1.5; camera.lookAt(0, p * 1.2, 0);

    const speed = 9 + p * 18;
    for (const c of clouds) { c.position.x -= speed * dt * (1 + c.position.z / 140); if (c.position.x < -span / 2 - 15) c.position.x += span + 30; }
    stars.position.x = -t * 0.15;
    const g = 0.8 + Math.sin(t * 18) * 0.06; glows.forEach((x) => x.scale.set(g, g, 1));

    renderer.render(scene, camera);
    if (first) { first = false; container.classList.add('ready'); container.parentElement.classList.add('live'); }
    requestAnimationFrame(frame);
  }
  function update() {
    const want = visible && !document.hidden;
    if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!want) running = false;
  }
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; update(); }).observe(container);
  document.addEventListener('visibilitychange', update);
  update();
}
