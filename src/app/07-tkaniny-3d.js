  // ---------- symulacja tkaniny (PBD): siatka o wymiarach z wykroju, grawitacja, zginanie zależne od tkaniny, kolizja z ciałem ----------
  function makeSim(spec, key, seed, collide, floorY, fab) {
    const NU = 72, NV = Math.max(12, Math.min(48, Math.round(spec.L / 1.6))), n = NU * (NV + 1), dv = spec.L / NV;
    const P = new Float32Array(n * 3), Q = new Float32Array(n * 3), Wt = new Float32Array(n);
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NU; i++) { const q = seed(spec.yPin - dv * j, (i / NU) * Math.PI * 2), k = (j * NU + i) * 3; P[k] = Q[k] = q[0]; P[k + 1] = Q[k + 1] = q[1]; P[k + 2] = Q[k + 2] = q[2]; Wt[j * NU + i] = j === 0 ? 0 : 1; }
    const c1 = [], c2 = [], cr = [], ck = [], add = (a, b, r, k) => { c1.push(a); c2.push(b); cr.push(r); ck.push(k); };
    const kb = Math.min(0.7, 0.02 + 0.55 * fab.st * fab.st * (1 - 0.4 * fab.wt)), h = []; for (let j = 0; j <= NV; j++) h.push(spec.C(dv * j) / NU);
    for (let j = 0; j <= NV; j++) for (let i = 0; i < NU; i++) {
      const a = j * NU + i, r = j * NU + ((i + 1) % NU);
      if (j > 0) { add(a, r, h[j], 1); add(a, j * NU + ((i + 2) % NU), 2 * h[j], kb); }
      if (j < NV) { const hm = (h[j] + h[j + 1]) / 2, dg = Math.hypot(hm, dv); add(a, a + NU, dv, 1); add(a, r + NU, dg, 0.5); add(r, a + NU, dg, 0.5); }
      if (j < NV - 1) add(a, a + 2 * NU, 2 * dv, kb);
    }
    const C1 = Int32Array.from(c1), C2 = Int32Array.from(c2), CR = Float32Array.from(cr), CK = Float32Array.from(ck), tmp = [0, 0, 0];
    const sim = { key, yPin: spec.yPin, L: spec.L, steps: 0, ready: false, done: false };
    sim.step = (count) => {
      let move = 0;
      for (let s = 0; s < count; s++) {
        for (let v = NU; v < n; v++) { const k = v * 3; for (let c = 0; c < 3; c++) { const vel = (P[k + c] - Q[k + c]) * 0.9; Q[k + c] = P[k + c]; P[k + c] += vel; } P[k + 1] -= 0.27; }
        for (let it = 0; it < 10; it++) for (let c = 0; c < C1.length; c++) {
          const a = C1[c] * 3, b = C2[c] * 3, wa = Wt[C1[c]], wb = Wt[C2[c]], w = wa + wb; if (!w) continue;
          const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = ((len - CR[c]) / len) * CK[c] / w;
          P[a] += dx * f * wa; P[a + 1] += dy * f * wa; P[a + 2] += dz * f * wa; P[b] -= dx * f * wb; P[b + 1] -= dy * f * wb; P[b + 2] -= dz * f * wb;
        }
        // tkanina nie rozciąga się pod własnym ciężarem: żaden punkt nie odejdzie od przypiętej krawędzi dalej, niż pozwala długość wykroju
        for (let j = 1; j <= NV; j++) { const mx = dv * j; for (let i = 0; i < NU; i++) { const k = (j * NU + i) * 3, t = i * 3, dx = P[k] - P[t], dy = P[k + 1] - P[t + 1], dz = P[k + 2] - P[t + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz); if (len > mx) { const f = mx / len; P[k] = P[t] + dx * f; P[k + 1] = P[t + 1] + dy * f; P[k + 2] = P[t + 2] + dz * f; } } }
        move = 0;
        for (let v = NU; v < n; v++) { // kolizja z ciałem i podłogą; przy kontakcie tkanina wytraca prędkość (tarcie)
          const k = v * 3; tmp[0] = P[k]; tmp[1] = P[k + 1]; tmp[2] = P[k + 2];
          if (tmp[1] < floorY + 0.4) { tmp[1] = floorY + 0.4; }
          collide(tmp);
          if (tmp[0] !== P[k] || tmp[2] !== P[k + 2] || tmp[1] !== P[k + 1]) { P[k] = tmp[0]; P[k + 1] = tmp[1]; P[k + 2] = tmp[2]; Q[k] += (P[k] - Q[k]) * 0.6; Q[k + 1] += (P[k + 1] - Q[k + 1]) * 0.6; Q[k + 2] += (P[k + 2] - Q[k + 2]) * 0.6; }
          move = Math.max(move, Math.abs(P[k] - Q[k]) + Math.abs(P[k + 1] - Q[k + 1]) + Math.abs(P[k + 2] - Q[k + 2]));
        }
        sim.steps++;
      }
      if (sim.steps >= 240 || (sim.steps > 60 && move < 0.02)) sim.done = true;
    };
    sim.sample = (phi, d) => {
      const TAU2 = Math.PI * 2, fu = ((((phi % TAU2) + TAU2) % TAU2) / TAU2) * NU, i0 = Math.floor(fu) % NU, i1 = (i0 + 1) % NU, tu = fu - Math.floor(fu);
      const fv = Math.max(0, Math.min(NV, (d / spec.L) * NV)), j0 = Math.min(NV - 1, Math.floor(fv)), tv = fv - j0;
      const a = (j0 * NU + i0) * 3, b = (j0 * NU + i1) * 3, c = a + NU * 3, e = b + NU * 3, o = [0, 0, 0];
      for (let k = 0; k < 3; k++) o[k] = (P[a + k] * (1 - tu) + P[b + k] * tu) * (1 - tv) + (P[c + k] * (1 - tu) + P[e + k] * tu) * tv;
      return o;
    };
    return sim;
  }
  function topRun(tp) {
    const quiet = () => { clearTimeout(tp.bzT); tp.bzT = 0; if (tp.bz) { busyOff(tp.bz); tp.bz = null; } }; // wskaźnik pracy pojawia się dopiero, gdy układanie trwa dłużej niż pół sekundy
    if (!g3 || g3.top !== tp || state.view !== '3d') { tp.run = false; quiet(); return; }
    if (!tp.run && !tp.bzT && !tp.bz) tp.bzT = setTimeout(() => { tp.bzT = 0; if (tp.run) tp.bz = busyOn('Układam tkaninę na sylwetce.'); }, 500);
    tp.run = true; tp.S.step(3); tp.done = tp.S.done;
    if (tp.done || tp.S.steps % 24 === 0) { tp.ready = true; render3d(); }
    if (!tp.done) requestAnimationFrame(() => topRun(tp)); else { tp.run = false; quiet(); }
  }
  function simRun(sim) {
    if (!g3 || g3.sim !== sim || state.view !== '3d') return;
    sim.step(8);
    if (sim.done || sim.steps % 24 === 0) { sim.ready = true; render3d(); }
    if (!sim.done) requestAnimationFrame(() => simRun(sim));
  }
  function surface(nu, nv, fn, mat) {
    const nc = nu + 1, pos = new Float32Array(nc * nv * 3), uv = new Float32Array(nc * nv * 2), cutV = new Uint8Array(nc * nv), idx = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nc; i++) {
      const p = fn(i / nu, j / (nv - 1)), q = j * nc + i;
      pos[q * 3] = p[0]; pos[q * 3 + 1] = p[1]; pos[q * 3 + 2] = p[2]; cutV[q] = p[3] ? 1 : 0; uv[q * 2] = p[4] || 0; uv[q * 2 + 1] = p[5] || 0;
    }
    const tri = (x, y, z) => { if (!(cutV[x] && cutV[y] && cutV[z])) idx.push(x, y, z); };
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu; i++) { const x = j * nc + i, y = x + 1, c = x + nc, d = y + nc; tri(x, y, c); tri(y, d, c); } // kolejność wierzchołków: lico na zewnątrz
    const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T3.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const nr = geo.attributes.normal.array; // sklejenie normalnych na szwie powłoki
    for (let j = 0; j < nv; j++) {
      const p = j * nc * 3, q = (j * nc + nu) * 3, x = nr[p] + nr[q], y = nr[p + 1] + nr[q + 1], z = nr[p + 2] + nr[q + 2], l = Math.hypot(x, y, z) || 1;
      nr[p] = nr[q] = x / l; nr[p + 1] = nr[q + 1] = y / l; nr[p + 2] = nr[q + 2] = z / l;
    }
    return new T3.Mesh(geo, mat);
  }
  // tekstury splotów rysowane w locie (kafelek powtarzalny, skala w cm)
  const texCache = {};
  function fabTex(id) {
    if (texCache[id]) return texCache[id];
    const N = 256, mk = (fn) => {
      const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = Math.max(0, Math.min(255, fn(x, y))), q = (y * N + x) * 4; im.data[q] = im.data[q + 1] = im.data[q + 2] = v; im.data[q + 3] = 255; }
      g.putImageData(im, 0, 0);
      const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = g3 ? g3.renderer.capabilities.getMaxAnisotropy() : 4; return t;
    };
    const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const weave = (cell) => (x, y) => { const i = Math.floor(x / cell), j = Math.floor(y / cell), fx = (x % cell) / cell - 0.5, fy = (y % cell) / cell - 0.5, over = (i + j) % 2; return 150 + (over ? 105 * (1 - 4 * fy * fy) : 70 * (1 - 4 * fx * fx)) + rnd(x, y) * 12; };
    const D = {
      bawelna: { tile: 3.6, rough: 0.92, metal: 0, bump: 0.16, map: weave(8) },
      szyfon: { tile: 1.6, rough: 0.55, metal: 0, bump: 0.05, opacity: 0.78, map: weave(4) },
      wiskoza: { tile: 5, rough: 0.72, metal: 0, bump: 0.1, map: (x, y) => 175 + 80 * (0.5 * rnd(x >> 1, y >> 1) + 0.5 * rnd(x >> 2, (y >> 2) + 9)) },
      dzersej: { tile: 3.4, rough: 0.86, metal: 0, bump: 0.16, map: (x, y) => { const fx = (x % 8) / 8, s = Math.abs(fx - 0.5) * 2; return 150 + 105 * (1 - s) * (0.75 + 0.25 * Math.cos((2 * Math.PI * (y + 6 * s)) / 8)) + rnd(x, y) * 6; } },
      welna: { tile: 4.6, rough: 0.98, metal: 0, bump: 0.2, map: (x, y) => 150 + (((x + y) % 8) < 4 ? 95 : 10) * (0.8 + 0.2 * Math.cos((2 * Math.PI * x) / 4)) + rnd(x, y) * 16 },
      tafta: { tile: 6, rough: 0.3, metal: 0.1, bump: 0.02, map: (x, y) => 232 + 16 * rnd(0, y >> 1) + 5 * rnd(x, y) },
      tiul: { tile: 7, rough: 0.8, metal: 0, bump: 0, opacity: 1, net: true, map: () => 255,
        alpha: (x, y) => { const a = (x + y) % 16, b = (x - y + 256) % 16, d = Math.min(a, 16 - a, b, 16 - b); return d < 1.8 ? 255 : 30; } },
    };
    const d = D[id] || D.bawelna, out = { tile: d.tile, rough: d.rough, metal: d.metal, bump: d.bump, opacity: d.opacity, net: d.net, map: mk(d.map), alpha: d.alpha ? mk(d.alpha) : null };
    return (texCache[id] = out);
  }
  // wzór + splot w jednym kafelku (wspólna skala), żeby nadruk i faktura trzymały się razem
  let printSet = null;
  function printTex(tx) {
    const key = [state.fabric, state.print, state.color, state.color2, state.print === 'wlasny' ? customImg && customImg._id : ''].join('|');
    if (printSet && printSet.key === key) return printSet;
    if (printSet) for (const t of [printSet.map, printSet.bumpT, printSet.alpha]) if (t) t.dispose();
    const N = 512, pr = P.LIST.find((q) => q.id === state.print), tile = pr ? pr.tile : 22;
    const src = state.print === 'wlasny' ? customImg : P.render(state.print, state.color, state.color2, N);
    const reps = Math.max(1, Math.round(tile / tx.tile)), sc = N / reps / 256;
    const layer = (img, base, over) => {
      const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
      if (base) g.drawImage(base, 0, 0, N, N);
      const pat = g.createPattern(img, 'repeat'); pat.setTransform(new DOMMatrix().scale(sc)); if (over) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; }
      g.fillStyle = pat; g.fillRect(0, 0, N, N);
      const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = g3.renderer.capabilities.getMaxAnisotropy(); return t;
    };
    printSet = { key, tile, map: layer(tx.map.image, src, true), bumpT: tx.bump ? layer(tx.map.image) : null, alpha: tx.alpha ? layer(tx.alpha.image) : null };
    return printSet;
  }
