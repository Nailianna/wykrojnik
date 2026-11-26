  // ---------- podgląd 3D (manekin + bryła ubrania, bez symulacji tkaniny) ----------
  const T3 = window.THREE;
  let g3 = null;
  const cam = { yaw: 0.55, pitch: 0.12, dist: 230 };
  const ellA = (C, k) => C / (Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k))));
  const ellP = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  const sstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  function bodyFn(m, a) {
    const nr = a.os / (2 * Math.PI), yb = a.Dps - a.Wg;
    const under = isFinite(m.opx) ? Math.min(m.opx, m.og - 2) : m.og - 14, bh = Math.max(1.5, Math.min(8, 0.28 * (m.og - under) + 0.5));
    const L = [
      { y: a.Dts + 6, a: nr * 0.95, b: nr * 0.95, z: 0 }, { y: a.Dts + 0.8, a: nr * 1.12, b: nr * 1.02, z: 0 },
      { y: a.Dts - 1.9, a: (a.Sb / 2) * 0.6, b: (a.Sb / 2) * 0.37, z: 0 }, { y: a.Dts - 4.6, a: (a.Sb / 2) * 0.97, b: (a.Sb / 2) * 0.4, z: 0 },
      { y: Math.max(yb + 5, a.Dts - a.Gp + 1.5), C: m.og * 0.97 - bh * 0.5, k: 0.68, z: 0.3 }, { y: yb, C: m.og - bh * 1.1, k: 0.71, z: 0.5 },
      { y: yb - 8, C: isFinite(m.opx) ? Math.min(m.opx, m.og - 2) : m.og * 0.5 + m.ot * 0.47, k: 0.74, z: 0.6 }, { y: 0, C: m.ot, k: 0.76, z: 0 },
      { y: -m.wb * 0.5, C: (m.ot + m.ob) / 2 + 3, k: 0.74, z: -0.3 }, { y: -m.wb, C: m.ob, k: 0.72, z: -0.8 }, { y: -m.wb - 9, C: m.ob * 0.95, k: 0.72, z: -0.5 },
    ].map((l) => (l.C ? { y: l.y, a: ellA(l.C, l.k), b: ellA(l.C, l.k) * l.k, z: l.z } : l));
    // sklejana krzywa Hermite'a z nachyleniami liczonymi po rzeczywistych odstępach poziomów (bez załamań)
    const n = L.length, tan = {};
    for (const k of ['a', 'b', 'z']) {
      tan[k] = L.map((l, i) => {
        if (i === 0) return (L[1][k] - l[k]) / (L[1].y - l.y);
        if (i === n - 1) return (l[k] - L[i - 1][k]) / (l.y - L[i - 1].y);
        const h0 = L[i - 1].y - l.y, h1 = l.y - L[i + 1].y, d0 = (l[k] - L[i - 1][k]) / -h0, d1 = (L[i + 1][k] - l[k]) / -h1;
        return d0 * d1 <= 0 ? 0 : (d0 * h1 + d1 * h0) / (h0 + h1);
      });
    }
    const f = (y) => {
      y = Math.max(L[n - 1].y, Math.min(L[0].y, y));
      let i = 0; while (i < n - 2 && y < L[i + 1].y) i++;
      const h = L[i + 1].y - L[i].y, t = (y - L[i].y) / h, t2 = t * t, t3 = t2 * t;
      const g = (k) => (2 * t3 - 3 * t2 + 1) * L[i][k] + (t3 - 2 * t2 + t) * h * tan[k][i] + (-2 * t3 + 3 * t2) * L[i + 1][k] + (t3 - t2) * h * tan[k][i + 1];
      return { a: Math.max(1, g('a')), b: Math.max(1, g('b')), z: g('z') };
    };
    f.top = L[0].y; f.bottom = L[L.length - 1].y; f.yb = yb; f.bh = bh;
    // wypukłość piersi; bridge = tkanina napięta między piersiami
    const xc = a.Rg / 2, rx = Math.max(4.2, xc * 0.72);
    f.butt = (x, y, sn, aHip) => { // wypukłość pośladków (tył)
      if (sn >= 0) return 0; const dy = y + m.wb - 1.5; if (Math.abs(dy) > 16) return 0;
      return 2.4 * Math.sqrt(m.ob / 90) * Math.exp(-Math.pow(dy / 7.5, 2) - Math.pow((Math.abs(x) - aHip * 0.42) / (aHip * 0.38), 2)) * sstep(-sn * 3);
    };
    f.bump = (x, y, sn, bridge) => {
      if (sn <= 0) return 0;
      const dy = y - yb; if (dy > 16 || dy < -20) return 0;
      const gy = Math.exp(-Math.pow(dy / (dy > 0 ? 7.5 : bridge ? 9.5 : 5), 2)), ax = Math.abs(x);
      let gx = Math.exp(-Math.pow((ax - xc) / rx, 2)); if (bridge && ax < xc) gx = 0.82 + 0.18 * gx;
      return bh * gy * gx * sstep(sn * 4);
    };
    return f;
  }

