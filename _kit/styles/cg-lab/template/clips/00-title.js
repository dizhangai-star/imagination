// 00 · Title — a demo of the cg-lab primitives; replace it with the film's opening.
// A knot on a pedestal in the dark studio, slow push-in orbit, a scan plane sweeps it from wireframe to clay
// (the style's signature transition), HUD in the top bar, caption in the lower bar, a title card at the end.
window.CLIP = {
  id: '00-title',
  duration: 8,
  fov: 32,
  hud: { stage: 'STAGE 01 / 01', label: 'ASSET · DEMO_v001', tc0: 3600 },
  caps: [[1.0, 5.0, 'Modeling', '建模']],
  glyphs: '{{TITLE}}',
  glyphsEn: '{{TITLE}}'.toUpperCase(),
  sfx: [[2.0, 'scan'], [5.6, 'boom']],                              // cue sheet read by audio/music.mjs (clip seconds)
  setup(E) {
    const { THREE, scene } = E;
    scene.add(E.studio(), E.lights());
    scene.fog = new THREE.Fog('#050608', 7, 18);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.3, 64), new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.85 }));
    ped.position.y = 0.15; ped.receiveShadow = ped.castShadow = true; scene.add(ped);
    // one geometry, two materials with opposite clipping planes = the scan-plane look switch
    const geo = new THREE.TorusKnotGeometry(0.42, 0.14, 220, 32);
    this.below = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this.above = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const clay = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.55, clippingPlanes: [this.below] }));
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#5fd4ff', wireframe: true, transparent: true, opacity: 0.55, clippingPlanes: [this.above] }));
    clay.castShadow = true;
    this.obj = new THREE.Group(); this.obj.add(clay, wire); this.obj.position.y = 1.0; scene.add(this.obj);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.76, 96), new THREE.MeshBasicMaterial({ color: '#8fe3ff', transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; scene.add(this.ring);
  },
  draw(t, E) {
    const { seg, eInOut, lerp } = E;
    E.orbit(0.6 + 0.12 * t, lerp(5.2, 4.2, eInOut(seg(t, 0, 8))), 1.7, [0, 0.95, 0]);
    this.obj.rotation.y = 0.3 * t;
    const k = eInOut(seg(t, 2.0, 4.5)), h = lerp(1.7, 0.35, k);           // the scan plane sweeps down: wire → clay
    this.below.constant = -h; this.above.constant = h;
    this.ring.position.y = h; this.ring.material.opacity = Math.sin(Math.PI * k) * 0.9;
  },
  overlay(t, E) {
    const a = E.alphaIn(t, 5.4, 7.6, 0.5);
    E.text('{{TITLE}}'.toUpperCase(), 320, 268, `600 18px ${E.EN}`, '#e9e2d0', a, 'center', 6);
    E.text('A FILM DRAWN IN CODE', 320, 288, `400 6.5px ${E.MONO}`, '#8a8f96', a, 'center', 2);
  },
};
