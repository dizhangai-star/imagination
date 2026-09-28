// _ocean.js — FFT ocean (Tessendorf) for the 恐惧 series world: a JONSWAP wind sea + a narrow swell, directional,
// synthesised on the GPU as 3 cascades of 256² (inverse FFT by Stockham radix-2 passes on float render targets).
// Stateless: every frame is h̃(k, t) = h0(k)e^{iωt} + h0*(−k)e^{−iωt} → IFFT, so any t renders alone (sub-frames too).
// Per cascade it outputs two mipmapped, tiling half-float textures (world uv = xz / L):
//   disp  = (Dx, h, Dz, ∂Dx/∂x + ∂Dz/∂z)   choppy displacement (m) + divergence (< 0 where crests pinch → foam)
//   slope = (sx, sz, sx², sz²)             slopes and their squares: the mips give the sub-pixel slope variance
// Axes: x along the shore, z inland (waves travelling +z come ashore). uses: ['_ocean', '_world'].
(function () {
  const N = 256, LOG = 8, G = 9.81, TAU = Math.PI * 2;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // h0 for one cascade: only wavenumbers kLo ≤ |k| < kHi (the cascades split the spectrum without overlap)
  function spectrum(R, L, kLo, kHi, o) {
    const U = o.wind ?? 5, F = o.fetch ?? 6e4, th = o.dir ?? 0, s = o.spread ?? 6, dk = TAU / L;
    const alpha = 0.076 * Math.pow(U * U / (F * G), 0.22), wp = 22 * Math.pow(G * G / (U * F), 1 / 3), gam = 3.3;
    const S = (w) => { const sg = w <= wp ? 0.07 : 0.09, r = Math.exp(-((w - wp) ** 2) / (2 * sg * sg * wp * wp));
      return alpha * G * G / w ** 5 * Math.exp(-1.25 * (wp / w) ** 4) * gam ** r; };
    let Q = 0; for (let i = 0; i < 3600; i++) { const a = -Math.PI + (i + 0.5) * TAU / 3600; Q += Math.abs(Math.cos(a / 2)) ** (2 * s) * TAU / 3600; }
    const D = (a) => Math.abs(Math.cos(a / 2)) ** (2 * s) / Q;
    const sw = o.swell, gs = (x, sd) => Math.exp(-0.5 * (x / sd) ** 2) / (Math.sqrt(TAU) * sd);
    const gauss = () => { const u = Math.max(R(), 1e-9), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    const h0 = new Float32Array(N * N * 4); let varH = 0, varS = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const gr = gauss(), gi = gauss();
      const kx = dk * (i < N / 2 ? i : i - N), kz = dk * (j < N / 2 ? j : j - N), k = Math.hypot(kx, kz);
      if (k === 0 || k < kLo || k >= kHi) continue;
      const w = Math.sqrt(G * k), dir = Math.atan2(kx, kz);                   // direction of travel, 0 = shoreward (+z)
      let Sk = S(w) * (G / (2 * w)) / k * D(wrap(dir - th));
      if (o.damp) Sk *= Math.exp(-((k / o.damp) ** 2));                    // light air: short ripples suppressed (glassy)
      if (sw) { const ks = TAU / sw.len; Sk += (sw.hs * sw.hs / 16) * gs(k - ks, 0.1 * ks) / k * gs(wrap(dir - sw.dir), sw.spread); }
      const amp = Math.sqrt(Sk * dk * dk / 2) / Math.SQRT2, p = (j * N + i) * 4;
      h0[p] = gr * amp; h0[p + 1] = gi * amp;
      varH += Sk * dk * dk; varS += k * k * Sk * dk * dk;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {                // zw = conj(h0(−k))
      const p = (j * N + i) * 4, q = (((N - j) % N) * N + (N - i) % N) * 4;
      h0[p + 2] = h0[q]; h0[p + 3] = -h0[q + 1];
    }
    return { h0, varH, varS };
  }

  const VS = 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }';
  const HEAD = `precision highp float; precision highp int; precision highp sampler2D;
    layout(location = 0) out highp vec4 o0; layout(location = 1) out highp vec4 o1;
    vec2 cm(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
    vec2 pk(vec2 a, vec2 b){ return vec2(a.x - b.y, a.y + b.x); }          // spectra of two real fields a, b → a + i·b
  `;
  // h̃(k,t) and its derivatives, packed two real fields per complex pair (8 fields in 2 RGBA targets)
  const SPEC = HEAD + `uniform sampler2D uH0; uniform float uL, uT, uChop;
    void main(){
      ivec2 ij = ivec2(gl_FragCoord.xy); vec4 H = texelFetch(uH0, ij, 0);
      vec2 m = vec2(ij); m -= step(${N / 2}., m) * ${N}.;
      vec2 k = 6.28318530718 * m / uL; float kl = max(length(k), 1e-6); vec2 n = k / kl;
      float ph = mod(sqrt(9.81 * kl) * uT, 6.28318530718); vec2 e = vec2(cos(ph), sin(ph));
      vec2 h = cm(H.xy, e) + cm(H.zw, vec2(e.x, -e.y)), ih = vec2(-h.y, h.x);
      vec2 Dx = uChop*n.x*ih, Dz = uChop*n.y*ih, hx = k.x*ih, hz = k.y*ih;          // x' = x + D: crests pinch
      vec2 Dxx = -uChop*k.x*n.x*h, Dzz = -uChop*k.y*n.y*h, Dxz = -uChop*k.x*n.y*h;
      o0 = vec4(pk(h, Dx), pk(Dz, hx)); o1 = vec4(pk(hz, Dxx), pk(Dzz, Dxz));
    }`;
  // one Stockham radix-2 stage (inverse, natural order in and out), rows (uHor = 1) or columns
  const FFT = HEAD + `uniform sampler2D uA, uB; uniform float uSub; uniform int uHor;
    void main(){
      ivec2 ij = ivec2(gl_FragCoord.xy); float fi = float(uHor == 1 ? ij.x : ij.y), hf = uSub * 0.5;
      int ev = int(floor(fi / uSub) * hf + mod(fi, hf));
      ivec2 pe = uHor == 1 ? ivec2(ev, ij.y) : ivec2(ij.x, ev), po = pe + (uHor == 1 ? ivec2(${N / 2}, 0) : ivec2(0, ${N / 2}));
      float a = 6.28318530718 * fi / uSub; vec2 tw = vec2(cos(a), sin(a));
      vec4 E = texelFetch(uA, pe, 0), O = texelFetch(uA, po, 0);
      o0 = vec4(E.xy + cm(tw, O.xy), E.zw + cm(tw, O.zw));
      E = texelFetch(uB, pe, 0); O = texelFetch(uB, po, 0);
      o1 = vec4(E.xy + cm(tw, O.xy), E.zw + cm(tw, O.zw));
    }`;
  const COMPOSE = HEAD + `uniform sampler2D uA, uB;
    void main(){
      ivec2 ij = ivec2(gl_FragCoord.xy); vec4 a = texelFetch(uA, ij, 0), b = texelFetch(uB, ij, 0);
      // a = (h, Dx, Dz, hx), b = (hz, Dxx, Dzz, Dxz)
      o0 = vec4(a.y, a.x, a.z, b.y + b.z);
      float sx = a.w / max(1. + b.y, 0.3), sz = b.x / max(1. + b.z, 0.3);
      o1 = vec4(sx, sz, sx*sx, sz*sz);
    }`;

  function make(E, o = {}) {
    const { THREE, renderer } = E;
    const L = o.L ?? [317, 53.3, 9.1], cut = o.cut ?? [0.6, 3.5];            // cascade sizes (m); band edges (rad/m)
    const bands = [[0, cut[0]], [cut[0], cut[1]], [cut[1], 1e9]];
    const R = E.R(o.seed ?? 5), stats = { varH: 0, varS: 0 };
    const mat = (fs, uniforms) => new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: fs, uniforms,
      depthTest: false, depthWrite: false, toneMapped: false });
    const pp = [0, 1].map(() => new THREE.WebGLRenderTarget(N, N, { count: 2, type: THREE.FloatType, minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false }));
    const cas = L.map((Lc, c) => {
      const sp = spectrum(R, Lc, bands[c][0], bands[c][1], o); stats.varH += sp.varH; stats.varS += sp.varS;
      const h0 = new THREE.DataTexture(sp.h0, N, N, THREE.RGBAFormat, THREE.FloatType); h0.needsUpdate = true;
      const out = new THREE.WebGLRenderTarget(N, N, { count: 2, type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
      out.textures.forEach((t) => { t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter; });
      return { L: Lc, h0, out };
    });
    const spec = mat(SPEC, { uH0: { value: null }, uL: { value: 1 }, uT: { value: 0 }, uChop: { value: o.chop ?? 0.8 } });
    const fft = mat(FFT, { uA: { value: null }, uB: { value: null }, uSub: { value: 2 }, uHor: { value: 1 } });
    const comp = mat(COMPOSE, { uA: { value: null }, uB: { value: null } });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), spec); quad.frustumCulled = false;
    const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(qs, qc); };

    function update(t) {
      const prev = renderer.getRenderTarget(), ac = renderer.autoClear; renderer.autoClear = false;
      for (const c of cas) {
        spec.uniforms.uH0.value = c.h0; spec.uniforms.uL.value = c.L; spec.uniforms.uT.value = t;
        pass(spec, pp[0]);
        let src = 0;
        for (const hor of [1, 0]) for (let s = 0; s < LOG; s++) {
          fft.uniforms.uA.value = pp[src].textures[0]; fft.uniforms.uB.value = pp[src].textures[1];
          fft.uniforms.uSub.value = 2 << s; fft.uniforms.uHor.value = hor;
          pass(fft, pp[1 - src]); src = 1 - src;
        }
        comp.uniforms.uA.value = pp[src].textures[0]; comp.uniforms.uB.value = pp[src].textures[1];
        pass(comp, c.out);
      }
      renderer.setRenderTarget(prev); renderer.autoClear = ac;
    }
    return {
      L, update, stats, hs: 4 * Math.sqrt(stats.varH),
      disp: cas.map((c) => c.out.textures[0]), slope: cas.map((c) => c.out.textures[1]),
      // debug: read one cascade's raw IFFT result back (Float32, RGBA × N²): [tex0 (h, Dx, Dz, hx), tex1 (hz, Dxx, Dzz, Dxz)]
      readRaw(t, c = 0) {
        const k = cas[c], prev = renderer.getRenderTarget();
        spec.uniforms.uH0.value = k.h0; spec.uniforms.uL.value = k.L; spec.uniforms.uT.value = t; pass(spec, pp[0]);
        let src = 0;
        for (const hor of [1, 0]) for (let s = 0; s < LOG; s++) {
          fft.uniforms.uA.value = pp[src].textures[0]; fft.uniforms.uB.value = pp[src].textures[1];
          fft.uniforms.uSub.value = 2 << s; fft.uniforms.uHor.value = hor; pass(fft, pp[1 - src]); src = 1 - src;
        }
        const a = new Float32Array(N * N * 4), b = new Float32Array(N * N * 4);
        renderer.readRenderTargetPixels(pp[src], 0, 0, N, N, a, undefined, 0);
        renderer.readRenderTargetPixels(pp[src], 0, 0, N, N, b, undefined, 1);
        renderer.setRenderTarget(prev); return [a, b];
      },
    };
  }
  window.OCEAN = { make, N };
})();
