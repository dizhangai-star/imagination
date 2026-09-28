// "cg-lab" style pack (three.js 3D), from vfx-creature. Load after engine/core.js, as a classic script; the film's
// module script imports three and passes it in:  const S = Kit.styles.cgLab(x, { THREE }).
// three.js renders each frame offscreen (WebGL2, ACES, sRGB, PCF shadows, local clipping); it is copied into #cv, then
// 2D overlays are drawn in 640×360 logical units (×3 → 1080p): vignette, grain, 2.39:1 letterbox bars, captions in the
// lower bar, a DCC-style HUD in the top bar, CLIP.overlay, fades from/to black.
// Contract: S.frame(A, t, T, E) is a pure function of t. CLIP.setup(E) builds scene objects once (first frame of a
// clip); CLIP.draw(t, E, T) sets every transform / uniform / camera value from t alone.
Kit.styles.cgLab = (x, o = {}) => {
  const THREE = o.THREE;
  if (!THREE) throw new Error('Kit.styles.cgLab needs { THREE } (import * as THREE from "three")');
  const { seg, R } = Kit.math;
  const EN = o.EN ?? '"Cinzel", serif', ZH = o.ZH ?? '"Noto Serif TC", serif', MONO = o.MONO ?? '"JetBrains Mono", monospace';
  const W = o.W ?? 1920, H = o.H ?? 1080, BAR = o.BAR ?? 46;   // 2.39:1 letterbox → 268 logical px of picture, 46 px bars
  const FOV = o.fov ?? 32;

  const gl = document.createElement('canvas'); gl.width = W; gl.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(o.background ?? '#050608');
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 400);

  // Film grain: 8 pre-baked noise tiles (seeded), picked by frame index, so grain is deterministic.
  const grain = [...Array(8)].map((_, k) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), d = g.createImageData(256, 256), r = R(101 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  });

  // ---- 2D overlay helpers (logical units) ----
  const alphaIn = (t, a, b, fade = 0.45) => seg(t, a, a + fade) * (1 - seg(t, b - fade, b));
  function text(s, px, py, font, color, a = 1, align = 'center', spacing = 0) {
    if (a <= 0) return;
    x.save(); x.globalAlpha = a; x.font = font; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle';
    if (spacing) x.letterSpacing = `${spacing}px`;
    x.fillText(s, px, py); x.restore();
  }
  // Caption in the lower bar: English (Cinzel, tracked) over 中文.
  function caption(en, zh, a) {
    text(en.toUpperCase(), 320, 360 - BAR + 16, `600 10px ${EN}`, '#e9e2d0', a, 'center', 3);
    text(zh, 320, 360 - BAR + 31, `400 9px ${ZH}`, '#b9b2a2', a, 'center', 2);
  }
  // HUD in the top bar: stage counter, label, timecode (DCC viewport feel).
  function hud(h, t, a) {
    if (!h || a <= 0) return;
    const tc = (s) => { const f = Math.floor(s * 30); return [Math.floor(f / 1800), Math.floor(f / 30) % 60, f % 30].map((n) => String(n).padStart(2, '0')).join(':'); };
    text(h.stage ?? '', 20, 23, `400 6.5px ${MONO}`, '#8a8f96', a, 'left', 1);
    text(h.label ?? '', 320, 23, `400 6.5px ${MONO}`, '#8a8f96', a, 'center', 1.5);
    text(`TC ${tc((h.tc0 ?? 0) + t)}`, 620, 23, `400 6.5px ${MONO}`, '#8a8f96', a, 'right', 1);
    x.save(); x.globalAlpha = a * 0.9; x.fillStyle = '#c0392b'; x.beginPath(); x.arc(12, 23, 1.6, 0, 7); x.fill(); x.restore();
  }
  function finish(A, t, T, E) {
    // vignette
    const v = x.createRadialGradient(320, 180, 120, 320, 180, 380);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${A.vignette ?? 0.55})`);
    x.fillStyle = v; x.fillRect(0, 0, 640, 360);
    // grain
    x.save(); x.globalAlpha = A.grain ?? 0.07; x.globalCompositeOperation = 'overlay';
    const g = grain[Math.floor(t * 30) % 8], p = x.createPattern(g, 'repeat');
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = p; x.fillRect(0, 0, W, H); x.restore();
    x.setTransform(3, 0, 0, 3, 0, 0);
    // letterbox
    if (A.letterbox !== false) { x.fillStyle = '#000'; x.fillRect(0, 0, 640, BAR); x.fillRect(0, 360 - BAR, 640, BAR); }
    // captions + HUD
    for (const [a0, a1, en, zh] of A.caps || []) caption(en, zh, alphaIn(t, a0, a1));
    hud(A.hud, t, alphaIn(t, 0.3, T.fade[0] + 0.3));
    A.overlay?.(t, E, T);
    // fades from/to the bare ground (black)
    const f = Math.max(1 - seg(t, T.fadeIn[0], T.fadeIn[1]), seg(t, T.fade[0], T.fade[1]));
    if (f > 0) { x.globalAlpha = f; x.fillStyle = '#000'; x.fillRect(0, 0, 640, 360); x.globalAlpha = 1; }
  }

  // ---- shared studio pieces ----
  function studio({ grid = true, floor = '#15171b' } = {}) {
    const grp = new THREE.Group();
    const fl = new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.92 }));
    fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; grp.add(fl);
    if (grid) {
      const gh = new THREE.GridHelper(40, 80, '#2c3440', '#1c2129'); gh.position.y = 0.002;
      gh.material.transparent = true; gh.material.opacity = 0.55; grp.add(gh);
    }
    return grp;
  }
  function lights({ key = '#ffd9b0', rim = '#7fb2ff', keyI = 2.6, rimI = 3.2, fill = 0.35 } = {}) {
    const grp = new THREE.Group();
    const k = new THREE.DirectionalLight(key, keyI); k.position.set(4, 7, 5); k.castShadow = true;
    k.shadow.mapSize.set(2048, 2048); Object.assign(k.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
    k.shadow.bias = -0.0004; k.shadow.radius = 4;
    const r = new THREE.DirectionalLight(rim, rimI); r.position.set(-5, 4, -6);
    const h = new THREE.HemisphereLight('#9fb6d6', '#1a1512', fill);
    grp.add(k, r, h); grp.userData = { key: k, rim: r, hemi: h }; return grp;
  }
  // Orbit camera: angle (rad), radius, height, look-at target.
  function orbit(ang, rad, hgt, target = [0, 1, 0], fov) {
    cam.position.set(target[0] + Math.sin(ang) * rad, hgt, target[2] + Math.cos(ang) * rad);
    cam.lookAt(target[0], target[1], target[2]);
    if (fov && cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  // Optional HDR accumulation (opt-in: o.hdr, o.samples or the page's ?samples=N): the scene renders n times into a
  // linear half-float MSAA target — each sub-frame at a time inside the shutter (motion blur) with a sub-pixel
  // camera jitter (supersampling) — the average is tone-mapped once. n = 1 without o.hdr keeps the plain path.
  const qSamples = +new URLSearchParams(location.search).get('samples') || 0;
  const SAMPLES = Math.max(1, qSamples || o.samples || 1), SHUTTER = o.shutter ?? 0.5, FPS = o.fps ?? 30;
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  let hdr = null;
  function hdrPipe() {
    if (hdr) return hdr;
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    const sum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
    const add = new THREE.ShaderMaterial({ uniforms: { tex: { value: rt.texture }, k: { value: 1 } }, vertexShader: vs,
      fragmentShader: 'uniform sampler2D tex; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * k, 1.); }',
      blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const out = new THREE.ShaderMaterial({ uniforms: { tex: { value: sum.texture } }, vertexShader: vs,
      fragmentShader: 'uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), add); quad.frustumCulled = false;
    const qs = new THREE.Scene(); qs.add(quad);
    return (hdr = { rt, sum, add, out, quad, qs, qcam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) });
  }
  function renderHdr(A, t, T, n) {
    const P = hdrPipe(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    for (let i = 0; i < n; i++) {
      A.draw(n > 1 ? t + ((i + 0.5) / n - 0.5) * SHUTTER / FPS : t, E0, T);
      if (n > 1) cam.setViewOffset(W, H, halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5, W, H);
      renderer.setRenderTarget(P.rt); renderer.render(scene, cam);
      if (n > 1) cam.clearViewOffset();
      renderer.setRenderTarget(P.sum); renderer.autoClear = false;
      if (i === 0) { renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.setClearColor(cc, ca); }
      P.quad.material = P.add; P.add.uniforms.k.value = 1 / n; renderer.render(P.qs, P.qcam);
      renderer.autoClear = true;
    }
    renderer.setRenderTarget(null); P.quad.material = P.out; renderer.render(P.qs, P.qcam);
  }

  // One frame: setup once per clip → clip fov → draw → 3D render → copy into #cv → overlays.
  let built = null, E0 = null;
  function frame(A, t, T, E) {
    if (built !== A) { A.setup?.(E); built = A; }
    if (cam.fov !== (A.fov ?? FOV)) { cam.fov = A.fov ?? FOV; cam.updateProjectionMatrix(); }
    const n = A.samples ?? SAMPLES;
    if (n > 1 || o.hdr) { E0 = E; renderHdr(A, t, T, n); }
    else { A.draw(t, E, T); renderer.render(scene, cam); }
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(gl, 0, 0, W, H); x.setTransform(3, 0, 0, 3, 0, 0);
    finish(A, t, T, E);
  }

  // Kit.boot options for this look: the fonts every clip needs (captions, HUD) + CJK subsetting.
  const boot = {
    cjkFamily: 'Noto Serif TC', cjkWeights: ['400'],
    zhText: (A) => (A.caps || []).map((c) => c[3]).join('') + (A.glyphs ?? ''),
    fonts: (A, zh) => {
      const en = (A.caps || []).map((c) => c[2].toUpperCase()).join('') + (A.glyphsEn ?? '') + 'STAGE0123456789';
      return [[`600 10px ${EN}`, en], [`400 9px ${ZH}`, zh || '字'], [`400 6.5px ${MONO}`, 'TC0123456789:/ ABCDEFGHIJKLMNOPQRSTUVWXYZ']];
    },
  };

  return { renderer, scene, cam, gl, W, H, BAR, EN, ZH, MONO, studio, lights, orbit, text, caption, hud, alphaIn, finish, frame, boot };
};
