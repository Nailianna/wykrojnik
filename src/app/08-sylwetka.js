  // sylwetka: siatka bazowa MakeHuman (CC0), dopasowywana do wzrostu i obwodów modelki
  let FIG = null;
  function figData() {
    if (FIG || !window.WYKROJ_FIG) return FIG;
    const F = window.WYKROJ_FIG, dec = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
    const q = new Int16Array(dec(F.P)), P = new Float32Array(q.length); for (let i = 0; i < q.length; i++) P[i] = q[i] / 2000;
    FIG = { P, T: new Uint16Array(dec(F.T)), H: F.H, lv: F.lv, n: F.n, half: F.half, zc: F.zc };
    return FIG;
  }
  const pw = (knots) => (x) => { if (x <= knots[0][0]) return knots[0][1]; for (let i = 1; i < knots.length; i++) if (x <= knots[i][0]) return knots[i - 1][1] + ((x - knots[i - 1][0]) / (knots[i][0] - knots[i - 1][0])) * (knots[i][1] - knots[i - 1][1]); return knots[knots.length - 1][1]; };
  function init3d() {
    if (g3 || !T3) return !!g3;
    try {
      const canvas = $('gl'), renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new T3.Scene(), camera = new T3.PerspectiveCamera(32, 1, 30, 1500);
      scene.add(new T3.HemisphereLight(0xfff4e6, 0x20242e, 0.95));
      const d1 = new T3.DirectionalLight(0xffffff, 0.75); d1.position.set(120, 200, 180); scene.add(d1);
      const d2 = new T3.DirectionalLight(0x9fb4ff, 0.3); d2.position.set(-160, 60, -120); scene.add(d2);
      g3 = { canvas, renderer, scene, camera, group: null, mid: 0 };
      let dr = null;
      canvas.addEventListener('pointerdown', (e) => { dr = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
      canvas.addEventListener('pointermove', (e) => { if (!dr) return; cam.yaw = dr.yaw - (e.clientX - dr.x) * 0.008; cam.pitch = Math.max(-0.3, Math.min(1.1, dr.pitch + (e.clientY - dr.y) * 0.006)); paint3d(); });
      const end = () => { dr = null; canvas.classList.remove('drag'); };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(80, Math.min(700, cam.dist * Math.exp(e.deltaY * 0.0012))); paint3d(); showZoom(); }, { passive: false });
      return true;
    } catch (e) { g3 = null; return false; }
  }
  function paint3d() {
    const r = g3.canvas.getBoundingClientRect(); if (r.width < 2) return;
    g3.renderer.setSize(r.width, r.height, false); g3.camera.aspect = r.width / r.height; g3.camera.updateProjectionMatrix();
    const cp = Math.cos(cam.pitch);
    g3.camera.position.set(Math.sin(cam.yaw) * cp * cam.dist, g3.mid + Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * cp * cam.dist);
    g3.camera.lookAt(0, g3.mid, 0); g3.renderer.render(g3.scene, g3.camera); blTouch();
  }
