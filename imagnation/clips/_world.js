// _world.js — the dream beach, reusable across the 恐惧 series: physics, sky, ocean (planar reflection + shore
// swash/foam + far ridge), sand (wet/dry, ripples), planet (procedural gas giant / moon).
// Units: metres. Viewer near the origin looking −z out to sea; sand rises inland (+z): y = SLOPE · z.
// Everything that changes with t is set by W.update(E, s) — no state between frames.
(function () {
  const RE = 6371, ME = 5.972e24, MJ = 1.898e27, RJ = 69911, MMOON = 7.342e22, DMOON = 384400, RMOON = 1737;
  const DJMIN = 5.88e8, JANG = 50.1 / 3600 * Math.PI / 180;   // Earth–Jupiter closest approach (km); its apparent size then (50.1″)
  const SLOPE = 0.035, FAR = 30000;          // beach slope; planet/moon placement distance (m) — size set by angle

  // ---- physics (real numbers for the readout) ----
  const physics = (d, M = MJ, R = RJ) => {
    const ang = 2 * Math.atan(R / d);                                  // apparent diameter, rad
    return {
      d, ang, deg: ang * 180 / Math.PI, moons: ang / (2 * Math.atan(RMOON / DMOON)),
      tide: 1.5 * (M / ME) * RE * 1e3 * Math.pow(RE / d, 3),          // equilibrium tide, m
      ld: d / DMOON,
      jd: DJMIN / d,                                                   // how many times closer than Jupiter ever comes
      jx: ang / JANG,                                                  // × Jupiter's largest apparent size from Earth
    };
  };
  // dream approach, film seconds → distance (km): log-interpolated keys (TREATMENT.md §3)
  const KEYS = [[0, 4.27e6], [7, 3.0e6], [15, 1.5e6], [24, 0.923e6], [30, 0.8e6]];
  const distAt = (T) => {
    for (let i = 1; i < KEYS.length; i++) {
      const [t0, d0] = KEYS[i - 1], [t1, d1] = KEYS[i];
      if (T <= t1 || i === KEYS.length - 1) { const k = Math.min(1, Math.max(0, (T - t0) / (t1 - t0))); return Math.exp(Math.log(d0) + k * (Math.log(d1) - Math.log(d0))); }
    }
  };

  // ---- shared GLSL ----
  const NOISE = /* glsl */`
    // integer PCG hash (exact in WebGL2; float hashes broke into speckle/blocks at world-scale coordinates)
    uint pcg(uint v){ uint st = v*747796405u + 2891336453u; uint w = ((st >> ((st >> 28u) + 4u)) ^ st) * 277803737u; return (w >> 22u) ^ w; }
    float h21(vec2 p){ ivec2 i = ivec2(floor(p)); return float(pcg(uint(i.x) + pcg(uint(i.y)))) / 4294967295.; }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }
  `;
  // swash lobes along the shore (x, t) → how far (m of depth) the waterline retreats: tongues ~8 m, cusps ~20 m, bays ~35 m
  const SWASH = /* glsl */`
    float swashRetreat(float x, float t){
      float lob = 0.5*fbm(vec2(x*0.12, t*0.06 + 3.)) + 0.2*(0.5 + 0.5*sin(x*0.31 + 1.7*sin(x*0.045) + t*0.2)) + 0.5*fbm(vec2(x*0.03, 11.3));
      return 0.35 * pow(clamp((lob - 0.45) / 0.4, 0., 1.), 1.5);
    }`;
  const NOISE3 = /* glsl */`
    uint pcg3(uint v){ uint st = v*747796405u + 2891336453u; uint w = ((st >> ((st >> 28u) + 4u)) ^ st) * 277803737u; return (w >> 22u) ^ w; }
    float h31(vec3 p){ ivec3 i = ivec3(floor(p)); return float(pcg3(uint(i.x) + pcg3(uint(i.y) + pcg3(uint(i.z))))) / 4294967295.; }
    float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm3(vec3 p, int oct){ float a = .5, s = 0.; for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a*vn3(p); p = p*2.02 + 11.7; a *= .5; } return s; }
  `;

  // gas-giant albedo baked once into an equirect texture (u = longitude, v = latitude): sharp at 135 mm, cheap per frame
  function bakeGiant(E) {
    const { THREE, renderer } = E, W = 4096, H = 2048;
    const rt = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.NoColorSpace });
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `precision highp float; precision highp int;
        varying vec2 vUv; ${NOISE3}
        // anisotropic noise: features stretched along latitude circles (zonal winds)
        float zn(vec3 p, float s, int o){ return fbm3(vec3(p.x*s, p.y*s*3.2, p.z*s), o); }
        void main(){
          float lon = (vUv.x - 0.5) * 6.28318, lat = (vUv.y - 0.5) * 3.14159;
          vec3 p = vec3(cos(lat)*cos(lon), sin(lat), cos(lat)*sin(lon));
          // domain warp, strongest at band edges
          vec3 w1 = vec3(zn(p, 2.0, 5), zn(p + 5.2, 2.0, 5), zn(p + 9.1, 2.0, 5)) - 0.5;
          vec3 q = p + 0.10*w1;
          float y = q.y + 0.018*(zn(q, 9., 4) - 0.5);                   // ≤ texel frequency: no aliasing speckle
          // irregular zonal bands
          float b = y*7.5 + 0.9*fbm3(vec3(y*3.0, 0.0, 1.7), 3);
          float band = 0.5 + 0.5*sin(b*3.14159);
          float edge = pow(abs(cos(b*3.14159)), 6.);                 // band boundaries: shear zones
          // shear-zone eddies: wavy rolls along the boundaries
          float roll = sin(lon*38. + 7.*zn(q, 6., 4) + b*2.) * edge;
          y += 0.006*roll;
          b = y*7.5 + 0.9*fbm3(vec3(y*3.0, 0.0, 1.7), 3);
          band = 0.5 + 0.5*sin(b*3.14159 + 0.7*sin(b*1.13 + 1.));
          band *= 0.75 + 0.25*sin(b*0.61 + 2.);
          vec3 cream = vec3(0.84, 0.76, 0.62), umber = vec3(0.42, 0.27, 0.16), rust = vec3(0.72, 0.50, 0.32), ochre = vec3(0.78, 0.63, 0.42);
          vec3 col = mix(umber, cream, smoothstep(0.15, 0.85, band));
          col = mix(col, ochre, smoothstep(0.4, 0.8, zn(q*1.3, 3., 4))*0.45);
          col = mix(col, rust, smoothstep(0.55, 0.8, zn(q + 3.3, 5., 5))*0.35*(1. - band));
          // fine turbulent filaments (7 octaves) — the detail a long lens resolves
          float fil = fbm3(vec3(q.x*22., q.y*22.*4., q.z*22.) + 1.1, 3);        // zonal streaks; top octave ≈ 350/unit < texels (650/unit)
          float fil2 = fbm3(vec3(q.x*6., q.y*6.*5., q.z*6.) + 4.4, 4);
          col *= 0.80 + 0.26*fil + 0.18*(fil2 - 0.5);
          col = mix(col, cream*1.05, clamp((fil - 0.45)*2.2, 0., 1.)*edge*0.45);
          // festoons: dark blue-grey plumes trailing from the equatorial boundary
          float fes = smoothstep(0.55, 0.75, zn(vec3(p.x, p.y*0.4, p.z)*vec3(1.,1.,1.) + 7.7, 7., 5)) * exp(-pow((lat - 0.12)/0.05, 2.));
          col = mix(col, vec3(0.30, 0.34, 0.40), fes*0.55);
          // a row of small white ovals in the southern belt
          for (int i = 0; i < 9; i++){
            float lo = -3.0 + float(i)*0.68 + 0.2*sin(float(i)*3.1);
            vec2 d = vec2((lon - lo)*cos(-0.52)*1.0, (lat + 0.52)*1.9) / 0.035;
            float r = dot(d, d);
            col = mix(col, vec3(0.94, 0.91, 0.85), exp(-r*1.4)*0.85);
            col = mix(col, umber*0.8, exp(-pow(sqrt(r) - 1.35, 2.)*6.)*0.35);
          }
          // the storm: a pale blue-grey oval with spiral arms (original design)
          vec2 sc = vec2((lon - 0.55)*1.1, (lat + 0.26)*2.6);
          float rr = length(sc), an = atan(sc.y, sc.x);
          float arms = 0.5 + 0.5*sin(an*2. + rr*70. + 4.*zn(p*2., 6., 4));
          float st = exp(-pow(rr/0.11, 2.));
          col = mix(col, mix(vec3(0.55, 0.61, 0.67), vec3(0.80, 0.84, 0.86), arms), st*0.9);
          col = mix(col, umber*0.7, exp(-pow((rr - 0.125)/0.018, 2.))*0.5);
          gl_FragColor = vec4(col, 1.);
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), sc = new THREE.Scene(); sc.add(quad);
    const prev = renderer.getRenderTarget(), tm = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(rt); renderer.render(sc, new THREE.Camera()); renderer.setRenderTarget(prev);
    renderer.toneMapping = tm;
    mat.dispose(); quad.geometry.dispose();
    // render-target mips were never built (sampling any LOD returned the base → 2:1 minification speckle):
    // read back once and upload as a DataTexture with a real mip chain (~45 MB incl. mips)
    const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); rt.dispose();
    const tex = new THREE.DataTexture(buf, W, H);
    tex.wrapS = THREE.RepeatWrapping; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter; tex.anisotropy = 8; tex.needsUpdate = true;
    return tex;
  }

  // tileable water normal map from integer-frequency waves (seeded, built once)
  function waterNormals(THREE, R) {
    const N = 256, r = R(7), data = new Uint8Array(N * N * 4), waves = [];
    for (let i = 0; i < 64; i++) { const sc = i < 24 ? 24 : 90, kx = Math.round((r() - 0.5) * sc), ky = Math.round((r() - 0.3) * sc * 0.75) || 1; waves.push([kx, ky, r() * 6.283, 1 / Math.hypot(kx, ky)]); }   // swell-scale + fine chop
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let dx = 0, dy = 0;
      for (const [kx, ky, ph, a] of waves) { const c = Math.cos(6.2832 * (kx * x + ky * y) / N + ph) * a; dx += c * kx; dy += c * ky; }
      const nx = -dx * 0.05, ny = -dy * 0.05, l = Math.hypot(nx, ny, 1), o = (y * N + x) * 4;
      data[o] = (nx / l * 0.5 + 0.5) * 255; data[o + 1] = (ny / l * 0.5 + 0.5) * 255; data[o + 2] = (1 / l * 0.5 + 0.5) * 255; data[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, N, N); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 8; tex.needsUpdate = true;
    return tex;
  }

  // water grid: dense near the viewer, exponential out to the horizon (local XY plane, rotated to XZ)
  function waterGeometry(THREE) {
    const xs = [], zs = [], n = 120;
    for (let i = -n; i <= n; i++) { const s = Math.sign(i) * (Math.pow(1.075, Math.abs(i)) - 1) * 2.5; xs.push(s); }
    for (let j = 0; j <= 560; j++) zs.push(60 - (Math.pow(1.0172, j) - 1) * 1.2);   // z from +60 (inland) to ~−19 km; ~150 m rows at 9 km
    const pos = [], idx = [];
    for (const z of zs) for (const x of xs) pos.push(x, -z, 0);                        // local y = −world z
    const w = xs.length;
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < w - 1; i++) { const a = j * w + i; idx.push(a, a + 1, a + w, a + 1, a + w + 1, a + w); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, k) => (k % 3 === 2 ? 1 : 0)), 3));
    g.computeBoundingSphere(); return g;
  }

  // sea surface height above the still level (world xz, t): swash surge near shore (the tidal ridge is its own mesh,
  // makeWall; uniforms uT uSurge are declared by each shader)
  const SURFACE = /* glsl */`
    float surf(vec2 w){
      return uSurge * (0.55*sin(uT*0.9 + w.y*0.05 + 0.3*sin(w.x*0.021)) + 0.45*sin(uT*1.37 + w.x*0.013 + w.y*0.03 + 1.7));
    }`;
  // the ridge's height along the shore (× uRidge.y): long swells of the crest line
  const RIDGE = /* glsl */`
    float ridgeAlong(float x){
      return (0.85 + 0.15*sin(x*0.0007 + 1.3)) * (1. + 0.05*sin(x*0.0041 + 0.7) + 0.035*sin(x*0.0093 + 2.1*sin(x*0.0023)) + 0.02*sin(x*0.017 + 1.));
    }`;

  // the tidal wall's face, shaded as water (used for the wall AND its reflection in the sea):
  // relief of the sheet pouring down the face in METRES (x along the ridge, v = height above level + flow·t), so detail
  // keeps its size as the wall grows and fades out by pixel footprint with range; Fresnel reflection of the sky
  // (uSkyCube) off the relief normal over a dark lit body; light through the thin lip; foam as a lit rough layer;
  // aerial perspective (Beer–Lambert toward the horizon sky in the view direction).
  const FACE = /* glsl */`
    uniform samplerCube uSkyCube; uniform float uHazeL;
    vec3 vnoiseD(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f), du = 6.*f*(1.-f);
      float a = h21(i), b = h21(i+vec2(1,0)), c = h21(i+vec2(0,1)), d = h21(i+vec2(1,1)), k4 = a - b - c + d;
      return vec3(a + (b-a)*u.x + (c-a)*u.y + k4*u.x*u.y, du * vec2(b - a + k4*u.y, c - a + k4*u.x)); }
    // streaks: long along the flow (v), narrow across (x); returns slope (dh/dx, dh/dv) and a 0..1 streak value
    vec3 wallRelief(float x, float v, float fx, float fv){
      vec2 g = vec2(0.); float val = 0., wsum = 0., px = 140.;
      float warp = 30. * (vnoise(vec2(x/400., v/900.)) - 0.5);
      for (int i = 0; i < 5; i++){
        float pv = px * (i == 0 ? 2.5 : 4.);
        float k = (1. - smoothstep(0.3, 0.6, fx / px)) * (1. - smoothstep(0.3, 0.6, fv / pv));
        vec3 n = vnoiseD(vec2((x + warp) / px, v / pv) + float(i) * 7.3);
        g += k * (i == 0 ? 0.08 : i == 1 ? 0.05 : 0.025) * n.yz / vec2(1., pv / px);          // slope ≈ amplitude(∝ px) · dn / period
        val += k * (n.x - 0.5) * (i < 2 ? 1. : 0.6); wsum += (i < 2 ? 1. : 0.6);
        px *= 0.42; warp *= 0.5;
      }
      return vec3(g, val / wsum);
    }
    // P: shaded point; x: along-ridge coord (skewed); hM: height above level (m); H: ridge height; N0: base normal;
    // E: unit vector point → eye; fx, fv: pixel footprint (m) for detail fade; det: 1 wall, 0 soft (reflection)
    vec3 wallShade(vec3 P, float x, float hM, float H, vec3 N0, vec3 E, float fx, float fv, float det, out float foamOut){
      float hN = clamp(hM / max(H, 1.), 0., 1.), dist = length(P - eye);
      float v = hM + 18. * uT;                                                   // the sheet pours down at ~18 m/s
      vec3 rel = wallRelief(x, v, fx, fv);
      vec3 N = normalize(N0 + vec3(-rel.x, 0., 0.) * 1.6 + vec3(0., 0.3, 1.) * rel.y * 1.2);
      vec3 V = -E;
      // sky reflection (Fresnel), blur with the sub-pixel roughness left over
      vec3 R = reflect(V, N); R.y = abs(R.y) + 0.01;
      float cosI = clamp(dot(N, E), 0.02, 1.), F = 0.02 + 0.98 * pow(1. - cosI, 5.);
      vec3 sky = textureLod(uSkyCube, normalize(R), mix(4.5, 2.5, det)).rgb;
      // body: deep water lit by the low sun behind the camera + sky ambient
      float ndl = max(dot(N, sunDirection), 0.);
      vec3 amb = textureLod(uSkyCube, vec3(0., 1., 0.), 6.).rgb;
      vec3 body = vec3(0.020, 0.040, 0.046) * (0.35 + 1.4 * ndl * sunColor) + vec3(0.02, 0.035, 0.04) * amb;
      // the face is concave: a reflected ray lower than the crest (seen from here) hits the wall itself, not the sky
      // (tested with the smooth profile normal, softened by the relief, or its edge turns into a sawtooth)
      vec3 R0 = reflect(V, N0);
      float occE = (H - hM) / max(uRidge.z * sqrt(-log(max(hN, 1e-3))), 1.), rE = mix(R0.y / max(length(R0.xz), 1e-3), R.y / max(length(R.xz), 1e-3), 0.5);
      sky = mix(body * 1.3, sky, max(smoothstep(occE - 0.09, occE + 0.09, rE), smoothstep(0.9, 1., hN)));
      // light through the thinning lip: the sky behind the wall, filtered green-grey by the water
      vec3 behind = textureLod(uSkyCube, normalize(vec3(V.x, 0.08, V.z)), 3.).rgb;
      float thin = pow(smoothstep(0.6, 0.995, hN), 2.) * (0.7 + 0.6 * rel.z);
      body += behind * vec3(0.10, 0.30, 0.26) * thin;
      vec3 col = mix(body, sky, F);
      // foam: aerated streaks (metric), spilling at the crest, churn at the foot; mean coverage where sub-pixel
      float fk = 1. - smoothstep(0.4, 0.9, fx / 12.);
      float fn = fbm(vec2(x / 45., v / 220.) + rel.z * 0.8 + vec2(0.4, 0.) * fbm(vec2(x / 12., v / 60.)));
      float streak = mix(0.1, smoothstep(0.55, 0.85, fn), fk);
      float crest = smoothstep(H - 18. - 0.05*H, H - 2., hM) * mix(0.6, smoothstep(0.35, 0.6, fbm(vec2(x / 14., (hM - uT*6.) / 10.))), fk);
      float churn = 0.4 * (1. - smoothstep(4., 40. + 0.04*H, hM)) * mix(0.45, smoothstep(0.3, 0.7, fbm(vec2(x / 30., (hM + uT*3.) / 9.) + 2.3)), fk);
      float foam = clamp(streak * smoothstep(0.1, 0.5, hN) * 0.4 + crest + churn, 0., 1.) * mix(0.6, 1., det);
      vec3 Nf = normalize(N + 0.35 * vec3(rel.x, 0., rel.y));
      vec3 foamCol = 0.6 * (1.1 * max(dot(Nf, sunDirection), 0.) * sunColor + 0.5 * amb);
      col = mix(col, foamCol, foam);
      foamOut = foam;
      // aerial perspective: extinction toward the horizon sky in this direction
      vec3 haze = textureLod(uSkyCube, normalize(vec3(V.x, 0.015, V.z)), 2.).rgb;
      return mix(haze, col, exp(-dist / uHazeL));
    }`;

  // the tidal wall: its own mesh, a grid (x across the view × profile parameter s, crest at s = 0, front s > 0) laid
  // over the ridge profile each frame. Rows are dense at the crest; columns span only what the camera sees (uX).
  // Displaced in metres: bulges and gullies moving down the face with the flow, a crest torn by noise, spilling
  // lobes that lean forward (uLean pushes the whole top in the last second). Shaded by wallShade (FACE).
  function makeWall(E, sunDir, sky) {
    const { THREE } = E, NX = 720, NF = 170, NB = 50;
    const prm = [], idx = [];
    const ss = [];
    for (let j = NB; j > 0; j--) ss.push(-j / NB);
    for (let j = 0; j <= NF; j++) ss.push(j / NF);
    for (let j = 0; j < ss.length; j++) for (let i = 0; i < NX; i++) prm.push(i / (NX - 1), ss[j], 0);
    for (let j = 0; j < ss.length - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i; idx.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(prm, 3)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uLevel: { value: 0 }, uRidge: { value: new THREE.Vector4(-9e4, 0, 1000, 0) }, uX: { value: new THREE.Vector2(-5000, 10000) },
        uLean: { value: 0 }, uSkyCube: { value: sky }, uHazeL: { value: 24000 },
        sunDirection: { value: sunDir.clone() }, sunColor: { value: new THREE.Color(0xffe2c4) } },
      vertexShader: `precision highp float; precision highp int;
        uniform float uT, uLevel, uLean; uniform vec4 uRidge; uniform vec2 uX;
        varying vec3 vP, vN; varying float vHM, vHL, vX;
        ${NOISE} ${RIDGE}
        // height of the local crest (m): the ridge profile along x, torn by metric noise
        // (broad: the whole face follows it; tear: only the top, g → 1, so crest bumps don't groove the face below)
        float crestH(float x, float g){ return uRidge.y * ridgeAlong(x) * (1. + 0.09*(fbm(vec2(x/650., 3.1)) - 0.5)
          + pow(g, 12.) * (0.05*(fbm(vec2(x/170., uT*0.04 + 1.7)) - 0.5) + 0.025*(fbm(vec2(x/45., uT*0.15 + 4.2)) - 0.5))); }
        vec3 wallPos(float x, float s, out float hL){
          float rw = uRidge.z, rs = s > 0. ? rw : rw * 4.;
          float dz = sign(s) * rs * 2.4 * pow(abs(s), 1.6);
          float g = exp(-pow(dz / rs, 2.));
          float xs = x + dz * uRidge.w;                    // skewed like the shading: features run straight down the screen
          hL = crestH(xs, 1.); float h = crestH(xs, g) * g;
          float v = h + 18.*uT, front = smoothstep(-0.03, 0.03, s) * smoothstep(0.01, 0.15, g);
          float bul = (fbm(vec2(xs/420., v/650.)) - 0.5) * 0.06 * uRidge.y + (fbm(vec2(xs/90., v/380.) + 5.) - 0.5) * 0.018 * uRidge.y;
          float lobe = smoothstep(0.5, 0.78, fbm(vec2(x/320., uT*0.06 + 9.)));
          float lean = smoothstep(0.75, 1., g) * (0.06 * lobe + uLean) * uRidge.y;
          return vec3(x, uLevel + h, uRidge.x + dz + bul * front + lean);
        }
        void main(){
          float x = uX.x + position.x * uX.y, s = position.y, hL, h1, h2;
          float ex = uX.y / ${NX - 1}., es = 0.004;
          vec3 P = wallPos(x, s, hL), Px = wallPos(x + ex, s, h1), Ps = wallPos(x, s + es, h2);
          vN = normalize(cross(Ps - P, Px - P));
          if (vN.y < 0.) vN = -vN;
          vP = P; vHM = P.y - uLevel; vHL = hL; vX = x + (P.z - uRidge.x) * uRidge.w;      // skew so the streaks run down the screen
          gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.);
        }`,
      fragmentShader: `precision highp float; precision highp int;
        uniform float uT, uLevel; uniform vec4 uRidge; uniform vec3 sunDirection, sunColor;
        varying vec3 vP, vN; varying float vHM, vHL, vX;
        #define eye cameraPosition
        ${NOISE} ${FACE}
        void main(){
          vec3 N = normalize(vN), E = normalize(eye - vP);
          float f; vec3 c = wallShade(vP, vX, vHM, vHL, N, E, fwidth(vX), fwidth(vHM), 1., f);
          gl_FragColor = vec4(c, smoothstep(0.3, 3., vHM));                // melts into the sea at the foot
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: true, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 1;
    return m;
  }

  // the sea: three's Water (planar mirror) with its shaders rewritten around the FFT ocean (_ocean.js):
  // choppy displacement (2 coarse cascades, mip picked by mesh spacing) + per-pixel slopes (3 cascades) whose mip
  // variance is the sub-pixel roughness → the mirror is sampled along the view's vertical with masked, Fresnel-weighted
  // taps (glitter column, blur with range); Beer–Lambert transmission to the real sand below through alpha.
  function makeWater(E, sunDir, ocean) {
    const { THREE, Water, R } = E;
    const water = new Water(waterGeometry(THREE), {
      textureWidth: 1920, textureHeight: 1080, waterNormals: waterNormals(THREE, R),
      sunDirection: sunDir.clone(), sunColor: 0xffe2c4, waterColor: 0x0a1c26, distortionScale: 1.6, fog: false, alpha: 1,
    });
    water.rotation.x = -Math.PI / 2;
    const m = water.material, u = m.uniforms, mt = u.mirrorSampler.value;
    mt.generateMipmaps = true; mt.minFilter = THREE.LinearMipmapLinearFilter;          // blurred reflections read the mips
    const O = ocean;
    Object.assign(u, { uT: { value: 0 }, uSurge: { value: 0.07 }, uLevel: { value: 0 }, uRidge: { value: new THREE.Vector4(-9e4, 0, 1000, 0) },
      uSlope: { value: SLOPE }, uFoam: { value: 1 },
      uD0: { value: O.disp[0] }, uD1: { value: O.disp[1] }, uD2: { value: O.disp[2] },
      uS0: { value: O.slope[0] }, uS1: { value: O.slope[1] }, uS2: { value: O.slope[2] }, uOL: { value: new THREE.Vector3(...O.L) },
      uSubVar: { value: 0.0006 }, uTanH: { value: 0.3 }, uAspect: { value: 16 / 9 }, uMirrorW: { value: 1920 }, uRSign: { value: 1 },
      uAbsorb: { value: new THREE.Vector3(0.62, 0.22, 0.2) }, uDeep: { value: new THREE.Color(0x0a1c26) }, uSSS: { value: new THREE.Color(0x0f3a36) },
      uHs: { value: Math.max(O.hs, 0.1) }, uSkyCube: { value: null }, uHazeL: { value: 24000 }, uSand: { value: new THREE.Color(0.47, 0.40, 0.32).multiplyScalar(0.35) } });
    const DISP = /* glsl */`
      uniform sampler2D uD0, uD1, uD2, uS0, uS1, uS2; uniform vec3 uOL;
      float shoal(float still){ return smoothstep(0.05, 1.6, still); }      // waves die out toward the waterline`;
    m.vertexShader = m.vertexShader
      .replace('varying vec4 worldPosition;', `varying vec4 worldPosition; varying float vH, vFH; varying vec2 vXZ;
        uniform float uT, uSurge, uLevel, uSlope; uniform vec4 uRidge; ${SURFACE} ${DISP}`)
      .replace(/mirrorCoord = modelMatrix \* vec4\( position, 1\.0 \);[\s\S]*?gl_Position = projectionMatrix \* mvPosition;/,
        `vec4 w0 = modelMatrix * vec4(position, 1.0); vXZ = w0.xz;
         float kS = shoal(uLevel - uSlope * w0.z);
         float sp = max(0.01705 * (61.2 - w0.z), 0.0723 * (abs(w0.x) + 2.5));               // mesh spacing here (m)
         vec4 d0 = textureLod(uD0, w0.xz / uOL.x, max(0., log2(sp * 256. / uOL.x) + 1.));   // no wave shorter than 2 rows
         vec4 d1 = textureLod(uD1, w0.xz / uOL.y, max(0., log2(sp * 256. / uOL.y) + 1.));
         vec3 D = (d0.xyz + d1.xyz) * kS;
         vH = surf(w0.xz); vFH = D.y;
         vec3 pd = position + vec3(D.x, -D.z, D.y + vH);                                  // local (x, −z, y)
         mirrorCoord = modelMatrix * vec4(pd, 1.0); worldPosition = mirrorCoord; mirrorCoord = textureMatrix * mirrorCoord;
         vec4 mvPosition = modelViewMatrix * vec4(pd, 1.0); gl_Position = projectionMatrix * mvPosition;`);
    m.fragmentShader = m.fragmentShader
      .replace('varying vec4 worldPosition;', `varying vec4 worldPosition; varying float vH, vFH; varying vec2 vXZ;
        uniform float uT, uSlope, uFoam, uLevel, uSurge, uSubVar, uTanH, uAspect, uMirrorW, uRSign, uHs; uniform vec4 uRidge;
        uniform vec3 uAbsorb, uDeep, uSSS, uSand; ${NOISE} ${SWASH} ${FACE} ${DISP}`)
      .replace(/void main\(\) \{[\s\S]*$/, `void main() {
        #include <logdepthbuf_fragment>
        vec3 worldToEye = eye - worldPosition.xyz; float distance = length(worldToEye); vec3 eyeDirection = worldToEye / distance;
        float sandY = uSlope * worldPosition.z, depth = worldPosition.y - sandY;
        // swash lobes and cusps: the waterline wanders seaward in tongues (it can only retreat — the mesh can't climb the sand)
        float stillS = uLevel - uSlope * worldPosition.z;
        depth -= swashRetreat(worldPosition.x, uT) * exp(-max(stillS, 0.) / 0.9);
        // ---- FFT slopes: filtered mean (resolved facets) + mip variance (sub-pixel roughness) ----
        float kS = shoal(stillS);
        vec2 q0 = vXZ / uOL.x, q1 = vXZ / uOL.y, q2 = vXZ / uOL.z;
        vec4 s0 = texture2D(uS0, q0), s1 = texture2D(uS1, q1), s2 = texture2D(uS2, q2);
        vec2 sl = (s0.xy + s1.xy + s2.xy) * kS;
        vec2 vr = (max(s0.zw - s0.xy*s0.xy, 0.) + max(s1.zw - s1.xy*s1.xy, 0.) + max(s2.zw - s2.xy*s2.xy, 0.)) * kS*kS + uSubVar*kS;
        float div = (texture2D(uD0, q0).w + texture2D(uD1, q1).w + texture2D(uD2, q2).w) * kS;
        vec3 surfaceNormal = normalize(vec3(-sl.x, 1., -sl.y));
        // ---- reflection: taps across the sub-pixel slope distribution along the view direction ----
        vec3 V = -eyeDirection; vec2 fw = normalize(V.xz + vec2(1e-6)), sd = vec2(-fw.y, fw.x);
        float el = max(-V.y, 0.001);                                        // depression of the view ray
        float sF = dot(sl, fw), sS = dot(sl, sd), vF = dot(vr, fw*fw), vS = dot(vr, sd*sd), sgF = sqrt(vF);
        vec2 muv = mirrorCoord.xy / mirrorCoord.w;
        sF = max(sF, -0.45 * el);                                           // back faces are hidden behind the crest in front
        float su = sqrt(vS) * sin(el) / (uTanH * uAspect);                  // sideways blur (uv)
        float lod = log2(max(su * uMirrorW, 1.));
        vec3 refl = vec3(0.); float wsum = 0., fsum = 0.;
        for (int i = 0; i < 12; i++){
          float o = (float(i) - 5.5) / 2.2;                                   // −2.5σ … +2.5σ
          float s = sF + o * sgF;                                           // facet slope toward the viewer
          float vis = max(el + s, 0.) * step(0., el + 2.*s);                // foreshortened; masked if the ray goes into the sea
          float wt = exp(-0.5*o*o) * vis;
          float ci = clamp(sin(el + s), 0., 1.), Fr = 0.02 + 0.98 * pow(1. - ci, 5.);
          vec2 tuv = clamp(muv, 0., 1.) + vec2(sS * sin(el) / (uTanH * uAspect), uRSign * s / uTanH);
          refl += textureLod(mirrorSampler, tuv, lod).rgb * Fr * wt; fsum += Fr * wt; wsum += wt;
        }
        vec3 reflectionSample = refl / max(fsum, 1e-5); float F = fsum / max(wsum, 1e-5);
        // ---- body: Beer–Lambert down to the sand and back; in-scatter; light through thin crests ----
        float cosI = clamp(dot(eyeDirection, surfaceNormal), 0.05, 1.), sinT = sqrt(1. - cosI*cosI) / 1.333, cosT = sqrt(1. - sinT*sinT);
        vec3 T = exp(-uAbsorb * max(depth, 0.) * (1. + 1. / cosT));
        float crest = clamp(vFH / uHs, 0., 1.) * (1. - F);
        vec3 inscat = uDeep + uSSS * crest * crest;
        float Tm = dot(T, vec3(0.3, 0.5, 0.2));
        // alpha blending over the rendered sand: out = F·refl + (1−F)(T·sand + (1−T)·inscat)
        float a = 1. - (1. - F) * Tm;
        vec3 outgoingLight = (F * reflectionSample + (1. - F) * ((1. - T) * inscat + (T - Tm) * uSand)) / max(a, 1e-3);
        // whitecaps where the crests pinch (Jacobian divergence)
        float white = smoothstep(-0.35, -0.6, div) * smoothstep(0.3, 0.7, fbm(vXZ * 0.9 + uT * 0.1));
        // ---- tidal ridge: calm water in front of it mirrors the ridge, not the sky behind it ----
        float hasR = step(1.0, uRidge.y);
        vec3 vd = worldPosition.xyz - eye;
        float reflElev = -vd.y / max(length(vd.xz), 1.0);
        float distR = worldPosition.z - uRidge.x;
        float ridgeElev = distR > 0. ? (uRidge.y*0.95 - worldPosition.y) / distR : -1.;
        float fwz = fwidth(worldPosition.z);
        float aaT = 1. - smoothstep(0.1, 0.35, 0.15 * fwz), aaL = 1. - smoothstep(0.1, 0.35, 0.02 * fwz);
        float tearN = (fbm(worldPosition.xz * vec2(0.08, 0.15) + vec2(0., uT*0.3)) - 0.5) * aaT
                    + (fbm(worldPosition.xz * vec2(0.01, 0.02) + vec2(4.1, uT*0.05)) - 0.5) * aaL;
        float tearX = (fbm(worldPosition.xz * vec2(0.03, 0.25) + vec2(2.7, -uT*0.3)) - 0.5) * aaT;
        float reflElevD = reflElev + 2. * sF + tearN * 0.014;
        float hRef = clamp((reflElevD * distR + worldPosition.y) / max(uRidge.y, 1.0), 0., 1.);
        float xWall = eye.x + vd.x * (eye.z - uRidge.x) / max(-vd.z, 1.);             // where the reflected ray meets the wall
        // the wall as the sea mirrors it: same shading seen from the mirrored eye, soft (coarse octaves only)
        float fR, sR = 2. * hRef * sqrt(-log(max(hRef, 1e-3))) * uRidge.y / uRidge.z;   // front-profile slope at that height
        vec3 Pw = vec3(xWall, uLevel + hRef * uRidge.y, uRidge.x), Em = normalize(vec3(eye.x, 2.*uLevel - eye.y, eye.z) - Pw);   // toward the mirrored eye
        vec3 ridgeCol = wallShade(Pw, xWall + surfaceNormal.x*40. + tearX*60., hRef * uRidge.y, uRidge.y, normalize(vec3(0., 1., sR)),
                                  Em, 30. + fwidth(xWall), 60., 0., fR);
        ridgeCol *= 0.8;
        float occ = hasR * smoothstep(-0.0012, 0.0012, ridgeElev - reflElevD);
        float over = reflElevD - ridgeElev;
        float sprayR = hasR * (1. - occ) * exp(-max(over, 0.) / 0.005)
                     * (0.35 + 0.65*smoothstep(0.3, 0.7, fbm(vec2(worldPosition.x*0.0035 - uT*0.02, over*300. - uT*0.35))));
        outgoingLight = mix(outgoingLight, vec3(0.55, 0.52, 0.55)*(0.5 + 0.5*sunColor), sprayR*0.45);
        outgoingLight = mix(outgoingLight, mix(outgoingLight*0.15, ridgeCol, 0.92), occ);
        // ---- shore: foam line + lace + a spilling break ----
        float lace = fbm(worldPosition.xz*vec2(1.3, 2.2) + vec2(uT*0.15, uT*0.4));
        float lace2 = fbm(worldPosition.xz*vec2(3.1, 5.3) + vec2(-uT*0.1, uT*0.5));
        float edge = (1. - smoothstep(0.0, 0.012 + 0.025*lace, depth)) * (0.45 + 0.55*smoothstep(0.35, 0.6, lace2));
        float band = smoothstep(0.52, 0.72, lace2) * smoothstep(0.0, 0.01, depth) * (1. - smoothstep(0.04, 0.2, depth));
        float still = stillS;
        float brD = 0.35 + 0.12*sin(uT*0.9 + worldPosition.z*0.05 + 0.3*sin(worldPosition.x*0.021) - 1.2)
                  + 0.22*(fbm(vec2(worldPosition.x*0.025, uT*0.05 + 7.)) - 0.5) + 0.35*(fbm(vec2(worldPosition.x*0.009, 3.3)) - 0.5);
        float brk = exp(-pow((still - brD) / 0.06, 2.)) * smoothstep(0.35, 0.7, fbm(worldPosition.xz*vec2(0.6, 1.8) + vec2(uT*0.2, 0.)));
        float trail = exp(-pow((still - brD + 0.12) / 0.1, 2.)) * smoothstep(0.55, 0.8, lace) * 0.5;
        float foam = clamp(edge*0.9 + band*0.6 + brk*0.8 + trail + white*0.6, 0., 1.) * uFoam;
        outgoingLight = mix(outgoingLight, vec3(0.92, 0.9, 0.88)*(0.35 + 0.5*sunColor), foam);
        a *= smoothstep(-0.002, 0.03 + 0.05*lace, depth) * mix(0.55, 1., smoothstep(0.02, 0.25, depth));   // the sheet thins out; grains break it
        gl_FragColor = vec4(outgoingLight, max(a, foam*step(0.0, depth)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`);
    m.transparent = true; m.depthWrite = true;
    return water;
  }

  function makeSand(E, prints = []) {
    const { THREE } = E;
    const g = new THREE.PlaneGeometry(1600, 1400, 400, 350); g.rotateX(-Math.PI / 2); g.translate(0, 0, 100);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, Math.max(SLOPE * z, -18)); }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9b596, roughness: 0.9, metalness: 0 });
    // footprints: [x, z, heading (rad, 0 = +x), side ±1] — up to 24, fixed for the clip
    const P = Array.from({ length: 24 }, (_, i) => new THREE.Vector4(...(prints[i] ?? [0, 1e6, 0, 1])));
    const U = { uWet: { value: 0.12 }, uLevel: { value: 0 }, uT: { value: 0 }, uPrint: { value: P }, uPrintN: { value: Math.min(24, prints.length) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW; uniform float uWet, uLevel, uT; uniform vec4 uPrint[24]; uniform int uPrintN;\n${NOISE}\n${SWASH}
        // sand relief in metres: shore-parallel ripples (λ 12 cm, wandering), broad undulation, grain; aR/aG fade
        // the ripple/grain terms out where a pixel spans their period (no moiré at range)
        float sandH(vec2 p, float aR, float aG){
          float rip = sin(6.2832*(p.y + 0.3*vnoise(p*vec2(0.5, 1.4)) + 0.05*vnoise(p*3.5))/0.12) * (0.3 + 0.7*vnoise(p*vec2(0.35, 0.9) + 5.));
          return 0.0022*rip*aR + 0.012*vnoise(p*vec2(0.25, 0.7)) + 0.0007*vnoise(p*45.)*aG; }
        // footprint relief (m): heel + ball + toe pads pressed ~2 cm, a low pushed-up rim
        float footH(vec2 q){ float h = 0.;
          for (int i = 0; i < 24; i++){ if (i >= uPrintN) break; vec4 P = uPrint[i]; vec2 d = q - P.xy; if (dot(d, d) > 0.09) continue;
            vec2 f = vec2(cos(P.z), sin(P.z)), l = vec2(dot(d, vec2(-f.y, f.x)) * P.w, dot(d, f));
            vec2 a = vec2(0., -0.085), b = vec2(0.012, 0.055), ab = b - a;                 // heel → ball, outer edge kept (arch)
            float k = clamp(dot(l - a, ab) / dot(ab, ab), 0., 1.);
            float sole = length(l - a - ab*k) - mix(0.036, 0.047, k) + 0.012*smoothstep(0.3, 0.6, k)*smoothstep(0.9, 0.6, k)*smoothstep(-0.02, 0.02, -l.x);
            float toe = length((l - vec2(0.018, 0.122))/vec2(1., 0.42)) - 0.042;
            float sd = min(sole, toe + 0.004);
            h += -0.014*smoothstep(0.006, -0.012, sd) + 0.003*exp(-pow((sd - 0.012)/0.009, 2.)); }
          return h; }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float wetY = vW.y + 0.8*swashRetreat(vW.x, uT) + 0.04*(fbm(vW.xz*vec2(0.4, 1.5)) - 0.5);   // run-up line follows the swash lobes
          float wet = 1. - smoothstep(uLevel + uWet*0.3, uLevel + uWet, wetY);            // below the run-up line: wet
          float big = fbm(vW.xz*0.05), fine = vnoise(vW.xz*18.);
          vec3 dry = vec3(0.86, 0.72, 0.55) * (0.86 + 0.18*big) * (0.93 + 0.1*fine);
          vec3 damp = vec3(0.47, 0.40, 0.32) * (0.9 + 0.12*big);
          diffuseColor.rgb = mix(dry, damp, wet);
          float fH = uPrintN > 0 ? footH(vW.xz) : 0.;
          diffuseColor.rgb *= 1. - 6.*clamp(-fH, 0., 0.02);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          float wetR = wet;
          roughnessFactor = mix(0.92, 0.08 + 0.12*fbm(vW.xz*0.8), wetR);
          // saturated band just above the swash: a film of water in the grains, glossy as the sea itself
          float sat = 1. - smoothstep(uLevel + 0.005, uLevel + 0.09 + 0.05*fbm(vW.xz*vec2(0.3, 2.)), wetY);
          roughnessFactor = mix(roughnessFactor, 0.025, sat);
          // drained flat (below the old run-up line, above the sea): water left standing in shore-parallel runnels
          float drained = smoothstep(uLevel + 0.02, uLevel + 0.15, vW.y) * (1. - smoothstep(uLevel + uWet - 0.3, uLevel + uWet - 0.1, vW.y));
          float sheet = drained * smoothstep(0.5, 0.62, fbm(vW.xz*vec2(0.05, 0.6) + vec2(0., 0.4*fbm(vW.xz*0.1))));
          roughnessFactor = mix(roughnessFactor, 0.015, sheet);
          diffuseColor.rgb *= 1. - 0.5*sheet;`)
        .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
          #ifdef USE_ENVMAP
          radiance *= 1. + 0.8*wet + 1.2*sat;                                     // wet sand mirrors the sky (scene env is at 0.5)
          #endif`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { vec2 q = vW.xz; float e = 0.004, fw = length(fwidth(q));
            float aR = 1. - smoothstep(0.02, 0.06, fw), aG = 1. - smoothstep(0.004, 0.012, fw), h0 = sandH(q, aR, aG);
            vec2 gr = vec2(sandH(q + vec2(e, 0.), aR, aG) - h0, sandH(q + vec2(0., e), aR, aG) - h0) / e;
            float wetN = wet;
            gr *= mix(1., 0.3, wetN);
            if (uPrintN > 0) { float e2 = 0.006; gr += vec2(footH(q + vec2(e2, 0.)) - fH, footH(q + vec2(0., e2)) - fH) / e2; }
            normal = normalize(normal + (viewMatrix * vec4(-gr.x, 0., -gr.y, 0.)).xyz); }`);
    };
    const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.userData.U = U;
    return mesh;
  }

  // crest spray: a raymarched volume. Proxy = a vertical plane standing one ridge-width shoreward of the crest; each
  // pixel marches from it back through the slab behind (to 0.7 rw past the crest), stopping at the water. Density:
  // 3D fbm advected shoreward and up (metres), confined above the local surface and around the crest. Sun single
  // scattering (two-lobe HG: the sun is behind us, so mostly back-scatter) with a short light march for self-shadow,
  // sky ambient, aerial haze like the wall. Output is the volume's colour + opacity over what the depth test left.
  function makeSpray(E, sunDir, sky) {
    const { THREE } = E;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uOn: { value: 1 }, uLevel: { value: 0 }, uRidge: { value: new THREE.Vector4(-9e4, 0, 1000, 0) },
        uSkyCube: { value: sky }, uHazeL: { value: 24000 }, sunDirection: { value: sunDir.clone() }, sunColor: { value: new THREE.Color(0xffe2c4) } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `precision highp float; precision highp int;
        uniform float uT, uA, uOn, uLevel, uHazeL; uniform vec4 uRidge; uniform vec3 sunDirection, sunColor; uniform samplerCube uSkyCube;
        varying vec3 vW; ${NOISE} ${NOISE3} ${RIDGE}
        float surfY(vec3 p){ float rs = p.z > uRidge.x ? uRidge.z : uRidge.z*4.; float d = (p.z - uRidge.x)/rs;
          return uLevel + uRidge.y * ridgeAlong(p.x + (p.z - uRidge.x)*uRidge.w) * exp(-d*d); }
        float dens(vec3 p, int oct, float burst){
          float H = uRidge.y, above = p.y - surfY(p);
          if (above < 0.) return 0.;                    // (the wall mesh occludes by depth; its torn crest differs from this profile)
          float zc = (p.z - uRidge.x - 0.08*uRidge.z) / (0.22*uRidge.z);
          float env = exp(-above / (0.16*H)) * smoothstep(0., 0.015*H, above) * exp(-zc*zc) * smoothstep(0.6*H, 0.85*H, p.y - uLevel);
          env *= burst;
          if (env < 0.01) return 0.;
          vec3 w = p - vec3(0., 10., 16.)*uT; w.z -= 0.6 * above;                        // blown up and shoreward: streamers lean
          vec3 q = w / vec3(90., 150., 140.);
          float n = fbm3(q + 0.6*fbm3(q*vec3(2.1, 1.3, 2.1) + 3.3, 2), oct);
          return env * smoothstep(0.52, 0.7, n);
        }
        float hg(float c, float g){ return (1. - g*g) / pow(1. + g*g - 2.*g*c, 1.5); }   // ×4π: 1 = isotropic
        void main(){
          if (uOn < 0.5 || uA < 0.002) discard;
          vec3 ro = cameraPosition, rd = normalize(vW - ro);
          float zB = uRidge.x - 0.35*uRidge.z;
          float tE = length(vW - ro), tX = rd.z < -1e-4 ? (zB - ro.z) / rd.z : tE;
          float n = 18., dt = max(tX - tE, 1.) / n;
          float t = tE + dt * h21(gl_FragCoord.xy + fract(uT*7.3)*97.);
          vec3 pE = ro + rd*tE;                                                         // bursts along the crest (x barely changes along a ray)
          float burst = smoothstep(0.3, 0.65, fbm(vec2(pE.x/900. - uT*0.03, 2.7)) + 0.25*fbm(vec2(pE.x/260., uT*0.1)));
          if (burst < 0.01 || uA < 0.002) discard;
          float c = dot(rd, sunDirection), ph = 0.35*hg(c, 0.6) + 0.65*hg(c, -0.3);
          vec3 amb = textureLod(uSkyCube, vec3(0., 1., 0.), 6.).rgb, hor = textureLod(uSkyCube, normalize(vec3(rd.x, 0.05, rd.z)), 3.).rgb;
          float sig = 0.02, T = 1.; vec3 L = vec3(0.);
          for (int i = 0; i < 18; i++){
            vec3 p = ro + rd*t; float d = dens(p, 4, burst);
            if (d > 0.002){
              float od = 0.;                                                          // toward the sun: self-shadow
              od = dens(p + sunDirection*90., 2, burst) * 140.;
              vec3 Ls = sunColor * 1.6 * ph * exp(-sig*od) + (amb*0.7 + hor*0.5);
              float a = 1. - exp(-sig*d*dt);
              L += T * a * Ls * 0.4; T *= 1. - a;
              if (T < 0.02) break;
            }
            t += dt;
          }
          float A = (1. - T) * uA;
          if (A < 0.002) discard;
          vec3 C = L / max(1. - T, 1e-4);
          vec3 haze = textureLod(uSkyCube, normalize(vec3(rd.x, 0.015, rd.z)), 2.).rgb;
          C = mix(haze, C, exp(-tE / uHazeL));
          if (!(A > 0.) || any(isnan(C)) || any(isinf(C))) discard;
          gl_FragColor = vec4(min(C, vec3(8.)), clamp(A, 0., 1.));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), mat);   // origin at the bottom edge
    m.frustumCulled = false; m.renderOrder = 2;
    return m;
  }

  // planet: sphere shader, bands in the body frame, lit by the sun, aerial haze toward the horizon
  function makePlanet(E, kind = 'giant') {
    const { THREE } = E;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3() }, uLevel: { value: 0 }, uHaze: { value: new THREE.Color(0xd9a98c) }, uT: { value: 0 },
        uKind: { value: kind === 'giant' ? 0 : 1 }, uBright: { value: 1 }, uAlb: { value: kind === 'giant' ? bakeGiant(E) : null } },
      vertexShader: `precision highp float; varying vec3 vN, vW, vO; void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix)*normal);
        vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `precision highp float; precision highp int;
        uniform vec3 uSun, uHaze; uniform float uLevel, uT, uKind, uBright; uniform sampler2D uAlb; varying vec3 vN, vW, vO; ${NOISE}
        void main(){
          if (vW.y < uLevel) discard;
          vec3 V = normalize(cameraPosition - vW);
          float lat = vO.y, lon = atan(vO.z, vO.x);
          vec3 col;
          if (uKind < 0.5) {
            // equirect lookup; two u parameterisations and the smaller gradient avoid a mip seam at ±180°
            float v = asin(clamp(lat, -1., 1.)) / 3.14159 + 0.5;
            float ur = lon / 6.28318 + 0.5 + uT*0.0006;
            float u1 = fract(ur), u2 = fract(ur + 0.5) - 0.5;              // same point (texture repeats in u), seams apart
            vec2 d1 = vec2(dFdx(u1), dFdy(u1)), d2 = vec2(dFdx(u2), dFdy(u2));
            bool use2 = dot(d2, d2) < dot(d1, d1);
            vec2 uv = vec2(use2 ? u2 : u1, v);
            vec2 dx = vec2(use2 ? d2.x : d1.x, dFdx(v)), dy = vec2(use2 ? d2.y : d1.y, dFdy(v));
            col = pow(textureGrad(uAlb, uv, dx, dy).rgb, vec3(1.25));          // a little more band contrast
          } else {
            float m = fbm(vO.xz*3. + vO.y*2.);
            col = vec3(0.62, 0.60, 0.57) * (0.7 + 0.5*m) * (1. - 0.35*smoothstep(0.45, 0.6, fbm(vO.xy*2.2 + 3.)));
          }
          vec3 N = normalize(vN);
          float lam = max(dot(N, uSun), 0.);
          float mu = max(dot(N, V), 0.);
          float limb = uKind < 0.5 ? pow(mu, 0.45) : pow(mu, 0.2);        // gas giants darken to the limb
          vec3 c = col * lam * limb * 1.05 * uBright;
          c += vec3(0.55, 0.62, 0.75) * pow(1. - mu, 3.) * 0.08 * (uKind < 0.5 ? 1. : 0.);   // thin rim haze
          // Earth's atmosphere between us and it: extinction + warm haze low on the horizon
          float elev = max((vW.y - uLevel) / length(vW - cameraPosition), 0.);
          float air = exp(-elev*28.);
          c = mix(c, uHaze*0.55, air*0.6);
          c *= mix(vec3(1.0), vec3(1.0, 0.72, 0.55), air*0.8);
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128), mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  // ---- the world ----
  function build(E, o = {}) {
    const { THREE, scene, renderer, cam, Sky } = E;
    cam.near = 0.1; cam.far = 120000; cam.updateProjectionMatrix();
    renderer.toneMappingExposure = o.exposure ?? 1.0;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - (o.sunElev ?? 4)), THREE.MathUtils.degToRad(o.sunAz ?? 15));
    const sky = new Sky(); sky.scale.setScalar(100000); sky.renderOrder = -1;
    const su = sky.material.uniforms;
    su.turbidity.value = o.turbidity ?? 1.5; su.rayleigh.value = o.rayleigh ?? 2.0; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.8;
    su.sunPosition.value.copy(sunDir); su.cloudCoverage.value = o.clouds ?? 0.25; su.cloudDensity.value = 0.35; su.showSunDisc.value = 0;
    scene.add(sky);
    // environment from the sky for wet-sand reflections (once)
    const pm = new THREE.PMREMGenerator(renderer), skyScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(1000);
    Object.keys(su).forEach((k) => { if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = su[k].value?.clone ? su[k].value.clone() : su[k].value; });
    skyScene.add(sky2); scene.environment = pm.fromScene(skyScene).texture;
    // the same sky as a plain cube (linear HDR, mipmapped) for the wall face's reflection and aerial haze
    const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    new THREE.CubeCamera(1, 5000, cubeRT).update(renderer, skyScene); scene.environmentIntensity = o.envI ?? 0.5;
    const sun = new THREE.DirectionalLight(0xffb98a, o.sunI ?? 3.2); sun.position.copy(sunDir).multiplyScalar(100);
    const hemi = new THREE.HemisphereLight(0x8fa3c4, 0x3a2f26, o.hemiI ?? 0.35);
    scene.add(sun, hemi);
    const sand = makeSand(E, o.prints); scene.add(sand);
    // dusk calm: light air over a long swell from slightly left of straight inshore (glassy enough to mirror the planet)
    const ocean = OCEAN.make(E, Object.assign({ wind: 2.2, fetch: 2e4, dir: 0.15, spread: 5, chop: 0.9, damp: 2.5,
      swell: { hs: 0.45, len: 55, dir: -0.08, spread: 0.12 } }, o.ocean)); const water = makeWater(E, sunDir, ocean); scene.add(water); water.material.uniforms.uSkyCube.value = cubeRT.texture;
    const spray = makeSpray(E, sunDir, cubeRT.texture); scene.add(spray);
    const wall = makeWall(E, sunDir, cubeRT.texture); scene.add(wall);
    const planet = makePlanet(E, o.kind ?? 'giant'); planet.material.uniforms.uSun.value.copy(sunDir); scene.add(planet);
    planet.rotation.set(0.08, 0.4, -0.12);
    // the spray is skipped in the sea's mirror pass (faked there as sprayR); per draw, since that pass runs nested
    // inside the main render
    spray.onBeforeRender = (r, sc, camera) => { spray.material.uniforms.uOn.value = camera === E.cam ? 1 : 0; };
    const world = { sky, sand, water, spray, wall, planet, sunDir, sun, hemi, ocean };
    // per render (main + mirror pass), from the camera actually used: lens uniforms, the wall's visible x span
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (r, sc, camera, ...rest) {
      if (prev) prev.call(this, r, sc, camera, ...rest);
      if (!camera.isPerspectiveCamera) return;
      const u = water.material.uniforms; u.uTanH.value = Math.tan(camera.fov * Math.PI / 360); u.uAspect.value = camera.aspect;
      const wu = wall.material.uniforms, Rg = wu.uRidge.value;
      if (!wall.visible) return;
      const d = camera.getWorldDirection(new THREE.Vector3()), az = Math.atan2(d.x, -d.z);
      const hf = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect) * 1.25 + 0.02;
      const D = Math.max(camera.position.z - Rg.x, 100), sk = Rg.w * 0;
      const x0 = camera.position.x + D * Math.tan(az - hf) - 200, x1 = camera.position.x + D * Math.tan(az + hf) + 200;
      wu.uX.value.set(x0 + sk, x1 - x0);
    };
    return world;
  }

  // place a body of apparent diameter `ang` (rad) at azimuth az (rad, 0 = straight out to sea, +right),
  // elevation of its centre `elev` (rad, may be negative = partly under the horizon)
  function placeBody(w, ang, az, elev, D = FAR) {
    const r = D * Math.sin(ang / 2);
    w.planet.scale.setScalar(r);
    w.planet.position.set(Math.sin(az) * Math.cos(elev) * D, Math.sin(elev) * D, -Math.cos(az) * Math.cos(elev) * D);
  }

  // per-frame world state
  function update(E, w, s) {
    const u = w.water.material.uniforms;
    w.water.position.y = s.level ?? 0;
    w.ocean.update(s.t);
    u.uT.value = s.t; u.uSurge.value = s.surge ?? 0.07; u.uLevel.value = s.level ?? 0;
    u.uRidge.value.set(s.ridgeZ ?? -9e4, s.ridgeH ?? 0, s.ridgeW ?? 1500, s.ridgeSkew ?? 0);   // skew = tan(view azimuth)
    u.uFoam.value = s.foam ?? 1;
    const wu = w.wall.material.uniforms;
    w.wall.visible = (s.ridgeH ?? 0) > 1;
    wu.uT.value = s.t; wu.uLevel.value = s.level ?? 0; wu.uRidge.value.copy(u.uRidge.value); wu.uLean.value = s.lean ?? 0;
    // spray volume: its proxy plane stands one ridge-width shoreward of the crest, 60 km wide, 0.5 → 1.8 H
    const H = s.ridgeH ?? 0, sp = w.spray, su = sp.material.uniforms;
    sp.visible = H > 5 && (s.spray ?? 1) > 0;
    sp.position.set(0, (s.level ?? 0) + H * 0.5, (s.ridgeZ ?? -9e4) + (s.ridgeW ?? 1500));
    sp.scale.set(60000, H * 1.3, 1);
    su.uT.value = s.t; su.uA.value = Math.min(1, H / 120) * (s.spray ?? 1); su.uLevel.value = s.level ?? 0; su.uRidge.value.copy(u.uRidge.value);
    w.sand.userData.U.uLevel.value = s.level ?? 0; w.sand.userData.U.uWet.value = s.wet ?? 0.14; w.sand.userData.U.uT.value = s.t;
    w.sky.material.uniforms.time.value = s.t;
    w.planet.material.uniforms.uLevel.value = (s.level ?? 0) + (s.ridgeH ?? 0) * 0;
    w.planet.material.uniforms.uT.value = s.t;
    w.planet.material.uniforms.uBright.value = s.bright ?? 1;
  }

  // colour grade (overlay, first call): multiply out the green cast Preetham + ACES leave in twilight skies
  function grade(E, k = 1) {
    const x = E.x; x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = k;
    x.fillStyle = '#ffeaf3'; x.fillRect(0, E.BAR, 640, 360 - 2 * E.BAR); x.restore();
  }

  // physics readout (overlay, logical units): top-left of the picture area
  function readout(E, T, a) {
    if (a <= 0) return;
    const p = physics(distAt(T)), f = (n) => Math.round(n).toLocaleString('en-US');
    const y0 = E.BAR + 14, L = 18, font = `400 6px "JetBrains Mono", "Noto Serif SC", monospace`, dim = '#c9c2b4';
    E.text(`DREAM TIME ${T.toFixed(1).padStart(4, '0')} s   梦中时间`, L, y0, font, '#8a8f96', a * 0.8, 'left', 1);
    const row = (k, label, val, col = dim) => { E.text(label, L, y0 + 10 + 9 * k, font, col, a, 'left', 1); E.text(val, L + 57, y0 + 10 + 9 * k, font, col, a, 'left', 1); };
    row(0, '天体 BODY', `木星质量行星  (${Math.round(MJ / ME)} × 地球质量)`);
    row(1, '距离 DIST', `${f(p.d)} km  (地球离木星最近时的 1/${Math.round(p.jd)})`);
    row(2, '视直径 SIZE', `${p.deg.toFixed(2)}°  (地球上所见木星的 ${Math.round(p.jx)} 倍)`);
    row(3, '潮高 TIDE', `+${f(p.tide)} m`, p.tide > 200 ? '#e8b48a' : dim);
  }

  window.WORLD = { physics, distAt, build, update, placeBody, readout, grade, SLOPE, FAR, KEYS };
})();
