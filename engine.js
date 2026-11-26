/* Wykrojnik: silnik konstrukcji. Jednostki: cm, oś y w dół, talia na y = 0. */
(function (root) {
  'use strict';

  // ---------- geometria ----------
  function cubic(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    return out;
  }
  const add = (a, b, k) => [a[0] + b[0] * (k === undefined ? 1 : k), a[1] + b[1] * (k === undefined ? 1 : k)];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  function rot(p, c, t) {
    const dx = p[0] - c[0], dy = p[1] - c[1], co = Math.cos(t), si = Math.sin(t);
    return [c[0] + dx * co - dy * si, c[1] + dx * si + dy * co];
  }
  function plen(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return s;
  }
  function yAtX(pts, x) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if ((a[0] <= x && x <= b[0]) || (b[0] <= x && x <= a[0])) {
        const d = b[0] - a[0];
        return Math.abs(d) < 1e-9 ? a[1] : a[1] + ((x - a[0]) / d) * (b[1] - a[1]);
      }
    }
    return pts[pts.length - 1][1];
  }
  function xAtY(pts, y) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if ((a[1] <= y && y <= b[1]) || (b[1] <= y && y <= a[1])) {
        const d = b[1] - a[1];
        return Math.abs(d) < 1e-9 ? a[0] : a[0] + ((y - a[1]) / d) * (b[0] - a[0]);
      }
    }
    return pts[pts.length - 1][0];
  }
  function splitAtY(pts, y) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a[1] <= y && y <= b[1] && b[1] > a[1]) {
        const t = (y - a[1]) / (b[1] - a[1]), s = [a[0] + t * (b[0] - a[0]), y];
        return [pts.slice(0, i).concat([s]), [s].concat(pts.slice(i))];
      }
    }
    return [pts, [pts[pts.length - 1]]];
  }
  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return { x0, y0, x1, y1 };
  }

  /* Odsunięcie zamkniętego konturu o zapas na szew; sa[i] dotyczy odcinka i -> i+1. */
  function offsetClosed(pts, sa) {
    const n = pts.length;
    let A = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
    const sg = A > 0 ? 1 : -1;
    const L = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = (sg * dy) / l, ny = (-sg * dx) / l;
      L.push({ px: a[0] + nx * sa[i], py: a[1] + ny * sa[i], qx: b[0] + nx * sa[i], qy: b[1] + ny * sa[i], dx: dx / l, dy: dy / l });
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = L[(i - 1 + n) % n], c = L[i];
      const cr = p.dx * c.dy - p.dy * c.dx;
      const lim = 2 * Math.max(sa[(i - 1 + n) % n], sa[i]) + 0.3; // ostre narożniki zapasu są ścinane, nie wyciągane w szpic
      let done = false;
      if (Math.abs(cr) > 1e-6) {
        const t = ((c.px - p.px) * c.dy - (c.py - p.py) * c.dx) / cr;
        const x = p.px + p.dx * t, y = p.py + p.dy * t;
        if (Math.hypot(x - pts[i][0], y - pts[i][1]) <= lim) { out.push([x, y]); done = true; }
      }
      if (!done) {
        out.push([p.qx, p.qy]);
        if (Math.hypot(p.qx - c.px, p.qy - c.py) > 1e-6) out.push([c.px, c.py]);
      }
    }
    return out;
  }

  // ---------- element wykroju ----------
  // o: {id, name, lines[], edges:[{pts, sa, fold}], extra:[prims], label:[x,y], grain:{x,y0,y1}, foldText:[x,y], mirror}
  function mkPiece(o) {
    const pts = [], sa = [];
    for (const e of o.edges) for (let i = 0; i < e.pts.length - 1; i++) {
      const a = e.pts[i], b = e.pts[i + 1];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) continue;
      pts.push(a); sa.push(e.sa);
    }
    /** @type {WPrim[]} */
    const prims = [{ t: 'poly', s: 'cut', closed: true, pts: offsetClosed(pts, sa) }];
    for (const e of o.edges) prims.push({ t: 'poly', s: e.fold ? 'fold' : 'sew', pts: e.pts });
    for (const q of o.extra || []) prims.push(q);
    const hemIn = [];
    if (!o.small) { // podpisy krawędzi: w połowie długości, po wewnętrznej stronie, wzdłuż linii
      let A = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; A += a[0] * b[1] - b[0] * a[1]; }
      const sg = A > 0 ? 1 : -1;
      for (const ed of o.edges) if (ed.lab === 'dół') { // linia 3 cm nad dołem, rysowana gdy jest podszewka
        const q = []; for (let i = 0; i < ed.pts.length; i++) { const a = ed.pts[Math.max(0, i - 1)], b = ed.pts[Math.min(ed.pts.length - 1, i + 1)], d = unit(sub(b, a)); q.push([ed.pts[i][0] - sg * d[1] * 3, ed.pts[i][1] + sg * d[0] * 3]); }
        hemIn.push(q);
      }
      for (const ed of o.edges) {
        if (!ed.lab || plen(ed.pts) < 6) continue;
        const half = plen(ed.pts) / 2; let acc = 0;
        for (let i = 1; i < ed.pts.length; i++) {
          const a = ed.pts[i - 1], b = ed.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (acc + l >= half) {
            const t = (half - acc) / (l || 1), d = unit(sub(b, a)), off = ed.labOff || 0.95;
            let ang = (Math.atan2(d[1], d[0]) * 180) / Math.PI; if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
            prims.push({ t: 'text', x: a[0] + (b[0] - a[0]) * t - sg * d[1] * off, y: a[1] + (b[1] - a[1]) * t + sg * d[0] * off + 0.25, text: ed.lab, size: 'S', anchor: 'middle', rot: Math.round(ang), lab: true });
            break;
          }
          acc += l;
        }
      }
    }
    if (o.grain) {
      const g = o.grain;
      prims.push({ t: 'poly', s: 'grain', pts: [[g.x, g.y0], [g.x, g.y1]] });
      prims.push({ t: 'poly', s: 'grain', pts: [[g.x - 0.5, g.y0 + 1], [g.x, g.y0], [g.x + 0.5, g.y0 + 1]] });
      prims.push({ t: 'poly', s: 'grain', pts: [[g.x - 0.5, g.y1 - 1], [g.x, g.y1], [g.x + 0.5, g.y1 - 1]] });
      if (g.y1 - g.y0 > 9) prims.push({ t: 'text', x: g.x - 0.5, y: (g.y0 + g.y1) / 2, text: 'nitka prosta', size: 'S', anchor: 'middle', rot: -90 });
    }
    if (o.small) { // wąskie elementy: drobny opis wzdłuż elementu
      const r = o.labelRot || 0;
      [o.name].concat(o.lines.filter(Boolean)).forEach((ln, i) => prims.push({ t: 'text', x: o.label[0] + (r ? i * 0.95 : 0), y: o.label[1] + (r ? 0 : i * 0.95), text: ln, size: 'S', anchor: 'middle', rot: r }));
    } else {
      prims.push({ t: 'text', x: o.label[0], y: o.label[1], text: o.name, size: 'L', anchor: 'middle' });
      o.lines.filter(Boolean).forEach((ln, i) => prims.push({ t: 'text', x: o.label[0], y: o.label[1] + 1.4 + i * 1.1, text: ln, size: 'S', anchor: 'middle' }));
    }
    if (o.foldText) prims.push({ t: 'text', x: o.foldText[0], y: o.foldText[1], text: 'złożenie tkaniny', size: 'S', anchor: 'middle', rot: -90 });
    if (o.mirror) for (const q of hemIn) for (const a of q) a[0] = -a[0];
    if (o.mirror) for (const q of prims) {
      if (q.t === 'poly') q.pts = q.pts.map((a) => [-a[0], a[1]]);
      else { q.x = -q.x; if (q.lab && q.rot) q.rot = -q.rot; if (q.anchor === 'start') q.anchor = 'end'; else if (q.anchor === 'end') q.anchor = 'start'; }
    }
    const nl = o.small ? 0 : o.lines.filter(Boolean).length;
    // krawędzie z oznaczeniem roli (dekolt, ramię, pacha, bok, dół, środek, zaszewka): z nich podgląd 3D zszywa ubranie
    const LT = { 'dekolt': 'neck', 'ramię': 'shoulder', 'pacha': 'arm', 'szew boczny': 'side', 'talia': 'bottom', 'dół': 'bottom', 'środek przodu': 'center', 'środek tyłu': 'center', 'szew rękawa': 'underF' }, ed = [];
    for (const e of o.edges) { const tag = e.tag || (e.fold ? 'center' : LT[e.lab]) || 'free'; if (e.split) ed.push({ pts: e.pts.slice(0, e.split + 1), tag: 'capB' }, { pts: e.pts.slice(e.split), tag: 'capF' }); else ed.push({ pts: e.pts, tag }); }
    return { ed, id: o.id, name: o.name, cut: o.lines[0] || '', hemIn, prims, box: bbox(prims[0].pts), noteAt: o.small ? null : [o.mirror ? -o.label[0] : o.label[0], o.label[1] + 1.4 + nl * 1.1] };
  }
  const notch = (p, dir, len) => ({ t: 'poly', s: 'notch', pts: [p, add(p, dir, len)] });
  const txt = (x, y, text, anchor, r) => ({ t: 'text', x, y, text, size: 'S', anchor: anchor || 'middle', rot: r || 0 });
  const lab = (x, y, text, r) => ({ t: 'text', x, y, text, size: 'S', anchor: 'middle', rot: r || 0, lab: true });

  // prostokątny element z zapasami w wymiarze (falbanki, paski)
  function rectPc(id, name, w, h, line) {
    const pc = mkPiece({ id, name, small: true, lines: [line], edges: [{ pts: [[0, 0], [w, 0]], sa: 0 }, { pts: [[w, 0], [w, h]], sa: 0 }, { pts: [[w, h], [0, h]], sa: 0 }, { pts: [[0, h], [0, 0]], sa: 0 }], label: [w / 2, h / 2 - 0.6] });
    pc.part = 'top'; return pc;
  }
  // zamek: ząbki wzdłuż szwu po stronie elementu i podpis z długością rozcięcia
  function zipMark(a, b, n) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 3) return [];
    const d = unit(sub(b, a)), k = Math.max(4, Math.round(L / 0.8)), pts = [];
    for (let i = 0; i <= k; i++) pts.push(add(add(a, d, (L * i) / k), n, i % 2 ? 0.75 : 0.3));
    let ang = (Math.atan2(d[1], d[0]) * 180) / Math.PI; if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
    const mid = add(add(a, d, L / 2), n, 1.55);
    return [{ t: 'poly', s: 'zip', pts }, { t: 'text', x: mid[0], y: mid[1] + 0.25, text: 'zamek kryty, rozcięcie ' + Math.round(L) + ' cm', size: 'S', anchor: 'middle', rot: Math.round(ang), lab: true }];
  }

  // ---------- dół: bok od talii do dołu i linia dołu ----------
  function sideLower(xw, hq, wb, D, flare, vert) {
    // pełna szerokość bioder trzymana do linii bioder; poszerzenie albo zwężenie zaczyna się dopiero poniżej
    const hipY = wb - 1.5, L = Math.max(1, D - wb), phi = Math.atan2(flare, L), dir = [Math.sin(phi), Math.cos(phi)];
    const hip = [hq, hipY];
    const c = cubic([xw, 0], vert ? [xw, hipY * 0.4] : [xw + (hq - xw) * 0.35, hipY * 0.33], [hq, hipY * 0.6], hip, 24);
    const E = add([hq, wb], dir, L);
    return { side: c.concat([[hq, wb], E]), E, phi, dirDown: dir };
  }
  function hemCurve(E, perp, D) {
    return cubic(E, add(E, perp, E[0] * 0.45), [E[0] * 0.35, D], [0, D], 24);
  }

  // ---------- spódnice z siatki (prosta, ołówkowa, trapezowa) ----------
  const DROP = 1;
  function skirtPanel(c) {
    const xs = c.hw - c.side, th = c.theta || 0, pv = c.pivot;
    let waist, Wp = [xs, 0];
    const lo = sideLower(xs, c.hw, c.wb, c.D, c.flare, false);
    let side = lo.side, E = lo.E, perp = [-Math.cos(lo.phi), Math.sin(lo.phi)];
    if (th) {
      Wp = rot(Wp, pv, -th);
      const de = rot(unit([0.2 * xs, -0.15 * DROP]), [0, 0], -th);
      waist = cubic([0, DROP], [xs * 0.5, DROP], add(Wp, de, -0.25 * xs), Wp, 32);
      side = side.map((p) => rot(p, pv, -th)); E = rot(E, pv, -th); perp = rot(perp, [0, 0], -th);
    } else waist = cubic([0, DROP], [xs * 0.5, DROP], [xs * 0.8, DROP * 0.15], Wp, 32);
    const hem = hemCurve(E, perp, c.D);
    const dartW = c.darts.reduce((s, d) => s + d.w, 0);
    return { waist, side, hem, xs, measure: plen(waist) - dartW, hemLen: plen(hem), sideLen: plen(side) };
  }
  /** @param {WMeas} m @param {WParams} p */
  function skirtPiece(g, c, isFront, m, p, title) {
    const extra = [], sa = p.saTalia;
    for (const d of c.darts) {
      const a = [d.pos - d.w / 2, yAtX(g.waist, d.pos - d.w / 2)], b = [d.pos + d.w / 2, yAtX(g.waist, d.pos + d.w / 2)];
      extra.push({ t: 'poly', s: 'dart', pts: [[a[0], a[1] - sa], a, [d.pos, yAtX(g.waist, d.pos) + d.len], b, [b[0], b[1] - sa]] }, lab(d.pos + d.w / 2 + 0.7, d.len * 0.55, 'zaszewka', -90));
    }
    const hx = xAtY(g.side, c.wb);
    extra.push({ t: 'poly', s: 'aux', pts: [[0, c.wb], [hx, c.wb]] }, txt(c.hw * 0.5, c.wb - 0.4, 'linia bioder'));
    extra.push(notch([hx, c.wb], [1, 0], Math.min(0.7, p.saSzew)));
    if (!isFront) {
      const zy = Math.min(c.wb, c.D - 5);
      extra.push(notch([0, zy], [-1, 0], Math.min(0.7, p.saSzew)), txt(0.6, zy + 0.9, 'koniec zamka', 'start'), ...zipMark([0, DROP], [0, zy], [1, 0]));
      if (p.rozp > 0 && c.D - p.rozp > zy + 4) extra.push(notch([0, c.D - p.rozp], [-1, 0], Math.min(0.7, p.saSzew)), txt(0.6, c.D - p.rozp - 0.4, 'początek rozporka', 'start'));
    }
    extra.push({ t: 'poly', s: 'grid', closed: true, pts: [[0, 0], [c.hw, 0], [c.hw, c.D], [0, c.D]] });
    return mkPiece({
      id: isFront ? 'przod' : 'tyl', name: isFront ? 'PRZÓD' : 'TYŁ',
      lines: [isFront ? 'wytnij 1× ze złożenia' : 'wytnij 2×', title, m.name],
      edges: [{ pts: g.waist, sa: p.saTalia, lab: 'talia' }, { pts: g.side, sa: p.saSzew, lab: 'szew boczny' }, { pts: g.hem, sa: p.saDol, lab: 'dół' },
        { pts: [[0, c.D], [0, DROP]], sa: isFront ? 0 : p.saSzew, fold: isFront || !!p.knit, lab: isFront ? 'środek przodu' : 'środek tyłu', labOff: 2.3 }],
      extra, label: [c.hw * 0.36, c.wb + 6], grain: { x: c.hw * 0.72, y0: c.wb + 4, y1: Math.max(c.wb + 12, c.D - 8) },
      foldText: isFront ? [1.1, c.D * 0.8] : null, mirror: !isFront,
    });
  }
  function bisect(f, lo, hi) {
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /** @param {WMeas} m @param {WParams} p */
  function draftSkirt(m, p, trapez, title) {
    const H = (m.ob + p.luzB) / 2, T = (m.ot + p.luzT) / 2, hw = H / 2, diff = Math.max(0, H - T);
    let fd = 0, bd = 0;
    if (diff >= 4) { const sn = Math.min(diff / 4, 4), rem = diff - 2 * sn; fd = rem / 3; bd = (rem * 2) / 3; }
    const fLen = Math.max(7, m.wb - 9), bLen = Math.max(8, m.wb - 8);
    const mk = (total, xs, len, shift) => {
      if (trapez || total < 0.3) return [];
      if (total > (shift ? 3 : 4.5)) return [{ pos: xs / 3 + shift, w: total / 2, len }, { pos: (xs * 2) / 3 + shift * 0.5, w: total / 2, len: len - 2 }];
      return [{ pos: xs / 2 + shift, w: total, len }];
    };
    const theta = trapez ? Math.atan(fd / 2 / fLen) + Math.atan(bd / 2 / bLen) : 0;
    const cfg = (isFront, side) => ({
      hw, wb: m.wb, D: p.dl, side, flare: p.flare, theta, pivot: [hw * 0.5 - 1, m.wb - 5],
      darts: mk(isFront ? fd : bd, hw - side, isFront ? fLen : bLen, isFront ? 1 : 0),
    });
    const side = bisect((s) => skirtPanel(cfg(true, s)).measure + skirtPanel(cfg(false, s)).measure - T, -3, hw - 2);
    const cf = cfg(true, side), cb = cfg(false, side), gf = skirtPanel(cf), gb = skirtPanel(cb);
    const hemC = 2 * (gf.hemLen + gb.hemLen), hipC = 2 * (xAtY(gf.side, m.wb) + xAtY(gb.side, m.wb));
    const pasek = p.pasek > 0 ? [m.ot + p.luzT + 3 + 2 * p.saSzew, 2 * p.pasek + 2 * p.saTalia] : null;
    const dn = (list) => list.length ? list.length + ' × ' + fmt(list[0].w) + ' cm' : 'brak';
    const cut = [['Przód', '1 × ze złożenia'], ['Tył', '2 ×']];
    if (pasek) cut.push(['Pasek, prostokąt', fmt(pasek[0]) + ' × ' + fmt(pasek[1]) + ' cm']);
    return {
      pieces: [skirtPiece(gf, cf, true, m, p, title), skirtPiece(gb, cb, false, m, p, title)],
      info: {
        rows: [['Talia w wykroju', 2 * (gf.measure + gb.measure), m.ot + p.luzT], ['Biodra w wykroju', hipC, m.ob + p.luzB], ['Obwód dołu', hemC, null], ['Szew boczny: przód i tył', gf.sideLen, gb.sideLen]],
        darts: [['Przód (na połowę)', dn(cf.darts)], ['Tył (na połowę)', dn(cb.darts)], ['Wcięcie w boku', fmt(side) + ' cm']],
        cut,
        warn: trapez ? '' : diff < 4 ? 'Różnica między biodrami a talią jest mała, więc dopasowanie robi sam szew boczny, bez zaszewek.' :
          side > 4.6 ? 'Wcięcie w boku wychodzi duże. Rozważ fason trapezowy albo cięcia pionowe.' : '',
      },
      sil: { top: 'waist', lower: trapez ? 'trapez' : 'straight', hemC, hipC, seams: { side: true, cb: true } },
    };
  }

  // ---------- klosz: element z koła (ćwiartka na złożeniu) ----------
  /** @param {WMeas} m @param {WParams} p @param {string} [nameOv] @param {string} [idOv] */
  function circlePiece(T, D, frac, m, p, title, zipAt, nameOv, idOv) {
    const r = T / (2 * Math.PI * frac), R = r + D, arc = (rad, rev) => {
      const o = []; for (let i = 0; i <= 40; i++) { const a = ((rev ? 40 - i : i) / 40) * Math.PI / 2; o.push([rad * Math.sin(a), rad * Math.cos(a)]); } return o;
    };
    const mid = r + D * 0.5, s2 = Math.SQRT1_2;
    const extra = [];
    if (zipAt) extra.push(notch([r + zipAt, 0], [0, -1], Math.min(0.7, p.saSzew)), txt(r + zipAt + 0.4, 1.2, 'koniec zamka', 'start'), ...zipMark([r, 0], [r + zipAt, 0], [0, 1]));
    const pc = mkPiece({
      id: idOv || 'klosz', name: nameOv ? nameOv : frac === 2 ? 'DÓŁ Z DWÓCH KÓŁ' : frac === 1 ? 'DÓŁ Z KOŁA' : 'DÓŁ Z PÓŁKOLA',
      lines: ['wytnij ' + Math.round(frac * 2) + '× ze złożenia', title, m.name],
      edges: [{ pts: arc(r, false), sa: p.saTalia, lab: 'talia' }, { pts: [[r, 0], [R, 0]], sa: p.saSzew, lab: 'szew' }, { pts: arc(R, true), sa: Math.min(p.saDol, 1.5), lab: 'dół' },
        { pts: [[0, R], [0, r]], sa: 0, fold: true }],
      extra, label: [mid * s2, mid * s2], grain: { x: 3.2, y0: r + 3, y1: Math.max(r + 12, R - 6) }, foldText: [1.1, r + D * 0.75],
    });
    return { piece: pc, r, waist: (Math.PI / 2) * r * 4 * frac, hemC: 2 * Math.PI * R * frac };
  }
  /** @param {WMeas} m @param {WParams} p */
  function draftCircle(m, p, frac, title) {
    const T = m.ot + p.luzT, c = circlePiece(T, p.dl, frac, m, p, title, Math.min(m.wb, p.dl - 5));
    const pasek = p.pasek > 0 ? [T + 3 + 2 * p.saSzew, 2 * p.pasek + 2 * p.saTalia] : null;
    const cut = [['Dół', Math.round(frac * 2) + ' × ze złożenia']];
    if (pasek) cut.push(['Pasek, prostokąt', fmt(pasek[0]) + ' × ' + fmt(pasek[1]) + ' cm']);
    return {
      pieces: [c.piece],
      info: {
        rows: [['Talia w wykroju', c.waist, T], ['Promień talii', c.r, null], ['Obwód dołu', c.hemC, null]],
        darts: [], cut,
        warn: (frac === 2 ? 'Cztery półkola zszywasz czterema szwami. Promień talii jest mały, więc ponacinaj zapas w talii przed wszyciem paska. ' : '') + 'Talia w kloszu leży po skosie i lubi się wyciągać. Przed wszyciem paska odwieś spódnicę na dobę i wyrównaj dół.',
      },
      sil: { top: 'waist', lower: 'circle', frac, hemC: c.hemC, seams: frac === 0.5 ? { cb: true } : frac === 1 ? { side: true } : { side: true, cb: true, cf: true } },
    };
  }

  // ---------- wymiary szczegółowe góry (szacowane z obwodu biustu i wzrostu) ----------
  const ADV = ['os', 'Dt', 'Dts', 'Dps', 'Wg', 'Rg', 'Gp', 'Sb', 'St', 'Sp'];
  function estimate(m) {
    const d = m.og - 88, k = (m.wzrost || 168) / 168 - 1;
    const Dts = 39 + 39 * k + d * 0.05;
    // miseczka: różnica biust minus pod biustem, 15 cm to B; większa miseczka wydłuża przód i obniża szczyt biustu
    const cup = isFinite(m.opx) && m.opx !== null ? Math.max(-6, Math.min(12, m.og - m.opx - 15)) : 0;
    return {
      os: 37.5 + d * 0.2, Dt: 36.5 + 36.5 * k, Dts, Dps: Dts + 2 + d * 0.12 + cup * 0.25, Wg: 26 + d * 0.15 + k * 10 + cup * 0.12,
      Rg: 18 + d * 0.08, Gp: 21.5 + d * 0.08 + k * 10, Sb: 39 + d * 0.1, St: 36 + d * 0.15, Sp: 34 + d * 0.18,
    };
  }
  // Baza podręcznikowa: odcinki siatki bluzki według E. Stark, B. Tymolewska, „Modelowanie form odzieży damskiej", tabela 6.
  // Z wzrostu (ZWo) i obwodu klatki piersiowej (opx) liczone są: głębokość pachy SP, połowa szerokości tyłu P1P2,
  // połowa szerokości przodu P3P4 i połowa szerokości międzypiersiowej P4P5. Wymiary zmierzone na modelce mają pierwszeństwo.
  function starkBase(m) {
    const e = estimate(m), ZWo = m.wzrost || 168, opx = m.og, SP = ZWo / 15 + opx / 10 + 0.5;
    return { SP, TB: ZWo / 10 + 3, adv: { Gp: e.Dts - e.Dt + SP, St: 2 * (opx / 8 + 5), Sp: 2 * (opx / 4 - 4), Rg: opx / 5 } };
  }
  function withStark(m) {
    const sb = starkBase(m), adv = Object.assign({}, m.adv || {});
    for (const k in sb.adv) if (!(isFinite(adv[k]) && adv[k] !== null && adv[k] !== '')) adv[k] = sb.adv[k];
    return Object.assign({}, m, { adv });
  }
  function full(m) {
    const e = estimate(m), a = m.adv || {}, o = {};
    for (const k of ADV) o[k] = isFinite(a[k]) && a[k] !== null && a[k] !== '' ? +a[k] : e[k];
    return o;
  }

  // ---------- góra (bluzka podstawowa bez rękawów) ----------
  const BETA = { back: (18.8 * Math.PI) / 180, front: (29 * Math.PI) / 180 };
  // linia dekoltu od środka do punktu przy szyi
  function neckCurve(C, NP, shape) {
    const xn = NP[0], yc = C[1], h = C[1] - NP[1];
    if (shape === 'v') return [C, NP];
    if (shape === 'karo') return [C, [xn * 0.8, yc], NP];
    if (shape === 'lodka') return cubic(C, [xn * 0.6, yc], [xn * 0.92, yc - h * 0.35], NP, 20);
    if (shape === 'serce') {
      // łuki nad biustem mają stałą, niewielką wysokość: przy głębokim dekolcie nie robią się z nich zęby
      const R = Math.min(0.3 * h, 0.5 * xn), Q = [xn * 0.8, yc - 0.8 * R];
      return cubic(C, [xn * 0.22, yc - R * 0.75], [xn * 0.55, yc - R * 1.25], Q, 14).concat(cubic(Q, [xn * 0.97, Q[1] - (h - 0.8 * R) * 0.15], [xn - 0.2, NP[1] + h * 0.45], NP, 14).slice(1));
    }
    return cubic(C, [xn * 0.55, yc], [xn - 0.3, NP[1] + h * 0.45], NP, 20);
  }
  /** @param {WMeas} m @param {WParams} p */
  function bodice(m, a, p, isFront, toHip) {
    const q = (m.og + p.luzG) / 4, e = p.luzG / 8, lower = Math.min(2, Math.max(0, p.luzG / 2));
    const top = isFront ? -a.Dps : -a.Dts, yg = -(a.Dps - a.Wg), yp = Math.min(yg - 0.5, -(a.Dts - a.Gp) + lower);
    const rem = p.knitStraight ? 0 : (m.og + p.luzG) / 2 - (m.ot + p.luzT) / 2;
    const dartW = p.knit ? 0 : rem > 0 ? Math.min(0.3 * rem, 4) : 0, s = (rem - 2 * dartW) / 2;
    const Wp = [q - s, 0], U = [q - s + (s * yp) / yg, yp];
    const beta = isFront ? BETA.front : BETA.back, dir = [Math.cos(beta), Math.sin(beta)];
    const r = (a.Sb / 2 - a.os / 5) / Math.cos(BETA.back);
    // p.bok > 0: wąskie ramię (bokserka), liczone od dekoltu; pacha podchodzi wtedy bliżej szyi
    const NP0 = [a.os / 5, top], nw = Math.min(p.nw, r - 3), NP = add(NP0, dir, nw), rs = p.bok > 0 ? Math.max(1.5, Math.min(p.bok, r - nw)) : r - nw, SP = add(NP, dir, rs);
    const C = [0, Math.max(NP[1] + 1, isFront ? top + a.os / 5 + p.nd : -a.Dt + (p.nb || 0))];
    const neck = neckCurve(C, NP, (isFront ? p.nk : p.nkb) || 'okragly');
    const M = isFront ? [a.Sp / 2 + e, yg - a.Wg / 3] : [a.St / 2 + e, yg - ((a.Dts - (a.Dps - a.Wg)) / 2 - 2)];
    M[1] = Math.min(yp - 3, Math.max(SP[1] + 4, M[1]));
    // zaszewka piersiowa: z pachy przeniesiona na szew boczny
    const B = [a.Rg / 2, yg], d = a.Dps - a.Dts;
    let alpha = 0;
    if (isFront && d > 0.3 && !p.knit) {
      const t = (M[0] - B[0]) / (U[0] - B[0]), P23 = add(B, sub(U, B), t), P24 = [P23[0], P23[1] - d];
      alpha = Math.atan2(P24[1] - B[1], P24[0] - B[0]) - Math.atan2(U[1] - B[1], U[0] - B[0]);
    }
    const Ue = alpha ? rot(U, B, alpha) : U, td = rot([1, 0], [0, 0], alpha);
    const k1 = (M[1] - SP[1]) * 0.33;
    const armA = cubic(SP, add(SP, [-dir[1], dir[0]], k1), [M[0], M[1] - k1], M, 16);
    const armB = cubic(M, [M[0], M[1] + (Ue[1] - M[1]) * 0.6], add(Ue, td, -(Ue[0] - M[0]) * 0.65), Ue, 16);
    const arm = armA.concat(armB.slice(1));
    // bok
    let side, lo = null;
    if (toHip) {
      lo = sideLower(Wp[0], (m.ob + p.luzB) / 4, m.wb, p.dl, p.flare, true);
      const G = [q, yg]; // bok przechodzi dokładnie przez szerokość biustu, dopiero niżej schodzi łukiem do talii
      side = [U].concat(cubic(G, add(G, unit(sub(G, U)), -yg * 0.3), [Wp[0], yg * 0.3], Wp, 16), lo.side.slice(1));
    } else side = [U, Wp];
    const sideRaw = side;
    const extra = [];
    let edgesSide;
    if (alpha) {
      const sp = splitAtY(side, yp + 5), topPart = sp[0].map((pt) => rot(pt, B, alpha)), S = sp[0][sp[0].length - 1], S2 = topPart[topPart.length - 1];
      const apex = add(B, unit(sub([(S[0] + S2[0]) / 2, (S[1] + S2[1]) / 2], B)), 2.5);
      extra.push({ t: 'poly', s: 'dart', pts: [S2, apex, S] });
      { const mid = [(apex[0] + S[0] + S2[0]) / 3, (apex[1] + S[1] + S2[1]) / 3 + 1.4]; let ang = (Math.atan2(S[1] - apex[1], S[0] - apex[0]) * 180) / Math.PI; extra.push(lab(mid[0], mid[1], 'zaszewka piersiowa', Math.round(ang))); }
      edgesSide = [{ pts: topPart, sa: p.saSzew, tag: 'side' }, { pts: [S2, S], sa: p.saSzew, tag: 'mouth' }, { pts: sp[1], sa: p.saSzew, lab: 'szew boczny' }];
    } else edgesSide = [{ pts: side, sa: p.saSzew, lab: 'szew boczny' }];
    const dart = { pos: isFront ? a.Rg / 2 : a.St / 4 + e / 2, w: dartW, top: isFront ? yg + 2 : yg };
    const out = { neck, NP, SP, arm, armA, armB, M, B, alpha, Ue, edgesSide, sideRaw, Wp, U, C, yg, yp, q, extra, dart, lo, r: rs, bustX: xAtY(sideRaw, yg) };
    if (isFront && alpha && p.gora !== 'bez' && (p.zp === 'pacha' || p.zp === 'ramie' || p.zp === 'dekolt')) {
      // przeniesienie zaszewki piersiowej: część między szwem bocznym a nowym miejscem obraca się wokół szczytu biustu, bok się zamyka
      const Rm = (pt) => rot(pt, B, -alpha), armB0 = armB.map(Rm), eT = [], ex = [];
      const dartAt = (X) => { const X2 = Rm(X), ap = add(B, unit(sub([(X[0] + X2[0]) / 2, (X[1] + X2[1]) / 2], B)), 2.5); ex.push({ t: 'poly', s: 'dart', pts: [X, ap, X2] }, lab(ap[0] + 0.4, ap[1] + 1.6, 'zaszewka piersiowa')); eT.push({ pts: [X, X2], sa: p.saTalia, tag: 'mouth' }); return X2; };
      const armAll = { pts: armA.map(Rm).concat(armB0.slice(1)), sa: p.saTalia, lab: 'pacha' };
      if (p.zp === 'pacha') { eT.push({ pts: neck, sa: p.saTalia, lab: 'dekolt' }, { pts: [NP, SP], sa: p.saSzew, lab: 'ramię' }, { pts: armA, sa: p.saTalia, lab: 'pacha' }); dartAt(M); eT.push({ pts: armB0, sa: p.saTalia, tag: 'arm' }); }
      else if (p.zp === 'ramie') { const Xs = [(NP[0] + SP[0]) / 2, (NP[1] + SP[1]) / 2]; eT.push({ pts: neck, sa: p.saTalia, lab: 'dekolt' }, { pts: [NP, Xs], sa: p.saSzew, tag: 'shoulder' }); const X2 = dartAt(Xs); eT.push({ pts: [X2, Rm(SP)], sa: p.saSzew, lab: 'ramię' }, armAll); }
      else { const nA = alongPts(neck, plen(neck) * 0.55), Xn = nA[nA.length - 1], rest = [Xn].concat(neck.slice(nA.length - 1)); eT.push({ pts: nA, sa: p.saTalia, lab: 'dekolt' }); dartAt(Xn); eT.push({ pts: rest.map(Rm), sa: p.saTalia, tag: 'neck' }, { pts: [Rm(NP), Rm(SP)], sa: p.saSzew, lab: 'ramię' }, armAll); }
      out.edgesTop = eT; out.edgesSideMain = [{ pts: side, sa: p.saSzew, lab: 'szew boczny' }]; out.extraMain = ex;
    }
    if (p.gora === 'bez') {
      // bez ramiączek: zamiast dekoltu, ramienia i pachy jedna górna krawędź od środka do szczytu szwu bocznego
      const bh = Math.max(2, Math.min(12, p.bh || 6)), heart = isFront && p.bk === 'serce';
      const C2 = isFront ? [0, Math.min(yg - 1.5, yg - bh + (heart ? 3.5 : 0))] : [0, Math.min(-1, yp + 1.5)];
      let topL;
      if (!isFront) topL = cubic(C2, [Ue[0] * 0.4, C2[1]], [Ue[0] * 0.75, Ue[1] + 0.3], Ue, 24);
      else if (heart) { const Qh = [B[0], yg - bh - 1]; topL = cubic(C2, [B[0] * 0.3, C2[1] - 2.5], [B[0] * 0.65, Qh[1]], Qh, 12).concat(cubic(Qh, [B[0] + (Ue[0] - B[0]) * 0.45, Qh[1]], [Ue[0] - (Ue[0] - B[0]) * 0.3, Ue[1] - 0.8], Ue, 14).slice(1)); }
      else if (p.ram === 'cienkie' || p.ram === 'szyja' || p.bk === 'luk') {
        // z ramiączkami: krawędź biegnie poziomo między ramiączkami (albo łagodnym łukiem w dół) i dopiero za nimi schodzi pod pachę
        const xs = dart.pos, drop = p.bk === 'luk' ? 2.5 : 0, Qs = [xs, C2[1]], C3 = [0, Math.min(yg - 1.5, C2[1] + drop)];
        topL = (drop ? cubic(C3, [xs * 0.55, C3[1]], [xs * 0.85, Qs[1] + 0.2], Qs, 12) : [C3, [xs * 0.5, C3[1]], Qs]).concat(cubic(Qs, [xs + (Ue[0] - xs) * 0.5, Qs[1] + 0.2], [Ue[0] - (Ue[0] - xs) * 0.25, Ue[1] - 0.6], Ue, 14).slice(1)); C2[1] = C3[1];
      }
      else topL = cubic(C2, [Ue[0] * 0.45, C2[1]], [Ue[0] * 0.8, Ue[1] - 0.6], Ue, 24);
      const xq = dart.pos, Q = [xq, yAtX(topL, xq)];
      const nA = topL.filter((pt) => pt[0] < xq - 0.05).concat([Q]), nB = [Q].concat(topL.filter((pt) => pt[0] > xq + 0.05));
      if (p.ram === 'cienkie' || (p.ram === 'szyja' && isFront)) extra.push(notch(Q, [0, -1], Math.min(0.7, p.saTalia)), lab(Q[0], Q[1] + 1.3, 'ramiączko'));
      Object.assign(out, { neck: nA, NP: Q, SP: Q, arm: nB, armA: [Q, Q], armB: nB, M: Q, C: C2, r: 0, strapless: true, strapL: (isFront ? a.Dps : a.Dts) + Q[1] });
    }
    return out;
  }
  /** @param {WMeas} m @param {WParams} p */
  function topPiece(m, a, p, isFront, toHip, title) {
    const wrap = isFront && !toHip && !!p.kop && p.gora !== 'bez';
    if (wrap) p = Object.assign({}, p, { zp: 'bok' });
    const b = bodice(m, a, p, isFront, toHip), extra = b.extraMain || b.extra, D = p.dl, dt = b.dart;
    const fLen = Math.max(7, m.wb - (isFront ? 9 : 8));
    if (dt.w > 0.2) {
      if (toHip) extra.push({ t: 'poly', s: 'dart', closed: true, pts: [[dt.pos, dt.top], [dt.pos - dt.w / 2, 0], [dt.pos, fLen], [dt.pos + dt.w / 2, 0]] }, lab(dt.pos + dt.w / 2 + 0.8, fLen * 0.5, 'zaszewka w talii', -90));
      else if (isFront && p.marsz) extra.push(notch([dt.pos - dt.w / 2 - 3, 0], [0, 1], Math.min(0.7, p.saTalia)), notch([dt.pos + dt.w / 2 + 3, 0], [0, 1], Math.min(0.7, p.saTalia)), txt(dt.pos, -1.2, 'marszczyć między nacinkami, zebrać ' + fmt(dt.w) + ' cm'));
      else extra.push({ t: 'poly', s: 'dart', pts: [[dt.pos - dt.w / 2, p.saTalia], [dt.pos - dt.w / 2, 0], [dt.pos, dt.top], [dt.pos + dt.w / 2, 0], [dt.pos + dt.w / 2, p.saTalia]] }, lab(dt.pos + dt.w / 2 + 0.8, dt.top * 0.45, 'zaszewka w talii', -90));
    }
    extra.push({ t: 'poly', s: 'aux', pts: [[0, b.yg], [b.bustX, b.yg]] }, txt(b.q * 0.6, b.yg - 0.4, 'linia biustu'));
    if (p.sciag) { const yU = Math.min(-2.5, b.yg + 7); extra.push({ t: 'poly', s: 'fold', pts: [[0, yU], [b.bustX * 0.97, yU]] }, txt(b.q * 0.35, yU + 0.9, 'tunel na gumkę pod biustem')); }
    const csa = isFront || p.knit ? 0 : p.saSzew, onFold = isFront || !!p.knit;
    const edges = (b.edgesTop || [{ pts: b.neck, sa: p.saTalia, lab: 'dekolt' }, { pts: [b.NP, b.SP], sa: p.saSzew, lab: 'ramię' }, { pts: b.arm, sa: p.saTalia, lab: 'pacha' }]).concat(b.edgesSideMain || b.edgesSide);
    let label, grain, hemLen = 0, kEff = 0, cropW = null;
    const shortTop = toHip && D < m.wb + 1;
    if (shortTop) {
      // top krótszy niż do bioder: szew boczny i zaszewka ucięte na długości, dół prosty
      const le = edges[edges.length - 1], P0 = le.pts, kept = P0.filter((q) => q[1] <= D - 1e-6), A = kept[kept.length - 1], Bq = P0[kept.length] || P0[P0.length - 1], S = [A[0] + ((Bq[0] - A[0]) * (D - A[1])) / (Bq[1] - A[1] || 1), D];
      edges[edges.length - 1] = Object.assign({}, le, { pts: kept.concat([S]) });
      let hw = 0; for (let i = extra.length - 1; i >= 0; i--) if (extra[i].s === 'dart' && extra[i].closed && D < fLen - 0.3) { hw = (dt.w / 2) * (1 - D / fLen); extra[i] = { t: 'poly', s: 'dart', pts: [[dt.pos - hw, D], [dt.pos - dt.w / 2, 0], [dt.pos, dt.top], [dt.pos + dt.w / 2, 0], [dt.pos + hw, D]] }; }
      hemLen = S[0] - 2 * hw;
      edges.push({ pts: [S, [0, D]], sa: Math.min(p.saDol, 2.5), lab: 'dół' }, { pts: [[0, D], b.C], sa: csa, fold: isFront || !!p.knit, lab: isFront ? 'środek przodu' : 'środek tyłu', labOff: 2.3 });
      extra.push({ t: 'poly', s: 'aux', pts: [[0, 0], [b.Wp[0], 0]] }, txt(b.Wp[0] * 0.75, -0.4, 'linia talii'), notch([b.Wp[0], 0], [1, 0], Math.min(0.7, p.saSzew)));
      if (!isFront && !p.knit) extra.push(...zipMark(b.C, [0, D], [1, 0]));
      label = [b.q * 0.42, b.strapless ? b.yg + 3 : Math.min(-7, Math.max(b.yg - 7, b.C[1] + 2.5))]; grain = { x: b.q * 0.8, y0: b.yg + 2, y1: Math.max(b.yg + 6, D - 2) };
    } else if (toHip) {
      let hem = hemCurve(b.lo.E, [-Math.cos(b.lo.phi), Math.sin(b.lo.phi)], D);
      if (!isFront && p.tren > 0) { const xs = Math.max(1, hem[0][0]); hem = hem.map((q) => [q[0], q[1] + p.tren * (0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, q[0] / xs))))]); } // tren: tył wydłużony na środku, do zera przy szwie bocznym
      hemLen = plen(hem);
      edges.push({ pts: hem, sa: p.saDol, lab: 'dół' }, { pts: [[0, hem[hem.length - 1][1]], b.C], sa: csa, fold: isFront || !!p.knit, lab: isFront ? 'środek przodu' : 'środek tyłu', labOff: 2.3 });
      const hx = xAtY(b.lo.side, m.wb);
      extra.push({ t: 'poly', s: 'aux', pts: [[0, 0], [b.Wp[0], 0]] }, txt(b.Wp[0] * 0.75, -0.4, 'linia talii'));
      extra.push({ t: 'poly', s: 'aux', pts: [[0, m.wb], [hx, m.wb]] }, txt(hx * 0.6, m.wb - 0.4, 'linia bioder'));
      extra.push(notch([b.Wp[0], 0], [1, 0], Math.min(0.7, p.saSzew)), notch([hx, m.wb], [1, 0], Math.min(0.7, p.saSzew)));
      if (!isFront && !p.knit) extra.push(notch([0, m.wb], [-1, 0], Math.min(0.7, p.saSzew)), txt(0.6, m.wb + 0.9, 'koniec zamka', 'start'), ...zipMark(b.C, [0, m.wb], [1, 0]));
      if (!isFront && p.rozp > 0 && D - p.rozp > m.wb + 4) extra.push(notch([0, D - p.rozp], [-1, 0], Math.min(0.7, p.saSzew)), txt(0.6, D - p.rozp - 0.4, 'początek rozporka', 'start'));
      label = [hx * 0.42, m.wb + 6]; grain = { x: hx * 0.75, y0: m.wb + 4, y1: Math.max(m.wb + 12, D - 8) };
    } else {
      if (wrap) {
        // przód kopertowy: krawędź biegnie od ramienia skosem przez środek przodu do talii po drugiej stronie
        const ext = b.Wp[0] * 0.72, Cw = [-ext, 0], g = unit([-(b.NP[1] - Cw[1]), b.NP[0] - Cw[0]]), at = (t, o) => [Cw[0] + (b.NP[0] - Cw[0]) * t + g[0] * o, Cw[1] + (b.NP[1] - Cw[1]) * t + g[1] * o];
        const neckW = cubic(Cw, at(0.33, 1.2), at(0.66, 1.4), b.NP, 26), yCross = yAtX(neckW, 0);
        edges.splice(0, edges.length, { pts: neckW, sa: p.saTalia }, { pts: [b.NP, b.SP], sa: p.saSzew, lab: 'ramię' }, { pts: b.arm, sa: p.saTalia, lab: 'pacha' }, ...b.edgesSide, { pts: [b.Wp, Cw], sa: p.saTalia, lab: 'talia' });
        extra.push({ t: 'poly', s: 'aux', pts: [[0, yCross], [0, 0]] }, txt(0.5, yCross * 0.45, 'środek przodu', 'start'), notch([0, 0], [0, 1], Math.min(0.7, p.saTalia)));
        { const pm = at(0.42, 3), an = (Math.atan2(b.NP[1] - Cw[1], b.NP[0] - Cw[0]) * 180) / Math.PI; extra.push(lab(pm[0], pm[1], 'krawędź kopertowa', Math.round(an))); }
        b.wrap = { ext, yCross, neckW };
      } else if (p.crop > 0) {
        // krótki top: dół wypada nad talią, więc szew boczny i zaszewka są ucięte na tej wysokości
        const le = edges[edges.length - 1], P0 = le.pts; kEff = Math.max(0, Math.min(p.crop, -P0[0][1] - 2, -b.C[1] - 4)); const yk = -kEff, kept = P0.filter((q) => q[1] <= yk - 1e-6);
        const A = kept[kept.length - 1], Bq = P0[kept.length] || b.Wp, S = [A[0] + ((Bq[0] - A[0]) * (yk - A[1])) / (Bq[1] - A[1] || 1), yk]; edges[edges.length - 1] = Object.assign({}, le, { pts: kept.concat([S]) });
        edges.push({ pts: [S, [0, yk]], sa: p.saDol > 2 ? 2 : p.saDol, lab: 'dół' }, { pts: [[0, yk], b.C], sa: csa, fold: isFront || !!p.knit, lab: isFront ? 'środek przodu' : 'środek tyłu', labOff: 2.3 });
        for (let i = extra.length - 1; i >= 0; i--) if (extra[i].s === 'dart' && extra[i].pts.length === 5) { // zaszewka w talii zwęża się ku górze, więc na uciętym dole jest węższa
          const hw = dt.top < yk - 0.5 ? (dt.w / 2) * (1 - yk / dt.top) : 0; if (hw > 0.1) extra[i] = { t: 'poly', s: 'dart', pts: [[dt.pos - hw, yk + p.saTalia], [dt.pos - hw, yk], [dt.pos, dt.top], [dt.pos + hw, yk], [dt.pos + hw, yk + p.saTalia]] }; else extra.splice(i, 1); cropW = S[0] - 2 * hw; }
        if (cropW === null) cropW = S[0];
      } else edges.push({ pts: [b.Wp, [0, 0]], sa: p.saTalia, lab: 'talia' }, { pts: [[0, 0], b.C], sa: csa, fold: isFront || !!p.knit, lab: isFront ? 'środek przodu' : 'środek tyłu', labOff: 2.3 });
      if (!isFront && !p.knit) extra.push(...zipMark(b.C, [0, -kEff], [1, 0]));
      label = [b.q * 0.42, b.strapless ? b.yg + 3 : Math.min(-7, Math.max(b.yg - 7, b.C[1] + 2.5))]; grain = { x: b.q * 0.8, y0: b.yg + 2, y1: Math.max(b.yg + 6, -2 - kEff) };
    }
    const pc = mkPiece({
      id: isFront ? 'przod' : 'tyl', name: b.wrap ? 'PRZÓD KOPERTOWY' : isFront ? 'PRZÓD' : 'TYŁ',
      lines: [b.wrap ? 'wytnij 2× (lewy i prawy)' : onFold ? 'wytnij 1× ze złożenia' : 'wytnij 2×', title, m.name],
      edges, extra, label, grain, foldText: onFold && !b.wrap ? [isFront ? 1.1 : -1.1, toHip && !shortTop ? D * 0.8 : b.yg / 2] : null, mirror: !isFront,
    });
    return { pc, b, hemLen, kEff, cropW };
  }
  /** @param {WMeas} m @param {WParams} p */
  function draftDress(m, p, lower, title) {
    const a = full(m), toHip = lower === 'straight', none = lower === 'none';
    let F = topPiece(m, a, p, true, toHip, title), Bk = topPiece(m, a, p, false, toHip, title);
    if (p.crop > 0 && Math.abs(F.kEff - Bk.kEff) > 1e-6) { p = Object.assign({}, p, { crop: Math.min(F.kEff, Bk.kEff) }); F = topPiece(m, a, p, true, toHip, title); Bk = topPiece(m, a, p, false, toHip, title); }
    const crop = p.crop > 0 ? F.kEff : 0, pieces = [F.pc, Bk.pc];
    if (!toHip) { F.pc.part = 'top'; Bk.pc.part = 'top'; }
    const waist = 2 * (F.b.Wp[0] + Bk.b.Wp[0] - F.b.dart.w - Bk.b.dart.w);
    const rows = [['Biust w wykroju', 2 * (F.b.bustX + Bk.b.bustX), m.og + p.luzG], ['Talia w wykroju', waist, p.knitStraight ? null : m.ot + p.luzT]];
    const cut = [['Przód', '1 × ze złożenia'], ['Tył', '2 ×']];
    let hemC, frac = 0, pleat = false;
    if (toHip && p.dl < m.wb + 1) hemC = 2 * (F.hemLen + Bk.hemLen);
    else if (toHip) { rows.push(['Biodra w wykroju', 2 * (xAtY(F.b.lo.side, m.wb) + xAtY(Bk.b.lo.side, m.wb)), m.ob + p.luzB]); hemC = 2 * (F.hemLen + Bk.hemLen); }
    else if (none) hemC = crop > 0 ? 2 * (F.cropW + Bk.cropW) : waist;
    else if (lower === 'zakl') {
      // dół z zakładkami: prostokątne panele, w talii nadmiar tkaniny złożony w zakładki skierowane do boku
      const k = Math.max(1.6, Math.min(3.5, p.zakK || 2.5)), Wq = waist / 4, wq = Wq * k, n = 3, depth = (wq - Wq) / n, sp = Wq / n, zl = Math.min(m.wb, p.dl - 5);
      for (const isFront of [true, false]) {
        const extra = [];
        for (let i = 0; i < n; i++) { const xa = sp * (i + 0.5) + depth * i; extra.push({ t: 'poly', s: 'dart', pts: [[xa, 0], [xa, 7]] }, { t: 'poly', s: 'dart', pts: [[xa + depth, 0], [xa + depth, 7]] }, { t: 'poly', s: 'aux', pts: [[xa + 0.6, 3], [xa + depth - 0.6, 3]] }, txt(xa + depth / 2, 2.4, 'zakładka'), txt(xa + depth - 1.2, 3.3, '>')); }
        if (!isFront) extra.push(notch([0, zl], [-1, 0], Math.min(0.7, p.saSzew)), txt(0.6, zl + 0.9, 'koniec zamka', 'start'), ...zipMark([0, 0], [0, zl], [1, 0]));
        pieces.push(mkPiece({
          id: isFront ? 'dol-przod' : 'dol-tyl', name: isFront ? 'DÓŁ PRZÓD' : 'DÓŁ TYŁ', lines: [isFront ? 'wytnij 1× ze złożenia' : 'wytnij 2×', title, m.name], foldText: isFront ? [1.1, p.dl * 0.6] : null,
          edges: [{ pts: [[0, 0], [wq, 0]], sa: p.saTalia, lab: 'talia' }, { pts: [[wq, 0], [wq, p.dl]], sa: p.saSzew, lab: 'szew boczny' }, { pts: !isFront && p.tren > 0 ? Array.from({ length: 21 }, (_, i) => { const x = wq * (1 - i / 20); return [x, p.dl + p.tren * (0.5 + 0.5 * Math.cos((Math.PI * x) / wq))]; }) : [[wq, p.dl], [0, p.dl]], sa: p.saDol, lab: 'dół' }, isFront ? { pts: [[0, p.dl], [0, 0]], sa: 0, fold: true } : { pts: [[0, p.dl + (p.tren > 0 ? p.tren : 0)], [0, 0]], sa: p.saSzew, lab: 'środek tyłu' }],
          extra, label: [wq * 0.5, p.dl * 0.45], grain: { x: wq * 0.82, y0: 10, y1: p.dl - 6 },
        }));
      }
      hemC = 4 * wq; pleat = true; frac = Math.max(0.1, (hemC - waist) / (2 * Math.PI * p.dl));
      cut.push(['Dół przód', '1 × ze złożenia'], ['Dół tył', '2 ×']);
      rows.push(['Talia dołu po złożeniu zakładek', 4 * Wq, waist], ['Głębokość jednej zakładki', depth, null]);
    }
    else {
      frac = lower === 'kolo2' ? 2 : lower === 'kolo' ? 1 : 0.5;
      const c = circlePiece(waist, p.dl, frac, m, p, title, Math.min(m.wb, p.dl - 5)); pieces.push(c.piece); hemC = c.hemC;
      cut.push(['Dół', Math.round(frac * 2) + ' × ze złożenia']);
    }
    const neckGap = F.b.wrap ? F.b.yg - F.b.wrap.yCross : F.b.yg - F.b.C[1];
    if (F.b.wrap) cut[0] = ['Przód kopertowy', '2 × (lewy i prawy)'];
    const sl = (b) => b.edgesSide.reduce((s, ed, i) => s + (b.alpha && i === 1 ? 0 : plen(ed.pts)), 0);
    rows.push(['Obwód dołu', hemC, null], ['Długość ramienia', F.b.r, null], ['Dekolt nad linią biustu', neckGap, null]); if (!(crop > 0 || (toHip && p.dl < m.wb + 1))) rows.push(['Szew boczny: przód i tył', sl(F.b), sl(Bk.b)]);
    const dw = (b) => (b.dart.w > 0.2 ? '1 × ' + fmt(b.dart.w) + ' cm' : 'brak');
    const est = ADV.filter((k) => !(m.adv && isFinite(m.adv[k]) && m.adv[k] !== null && m.adv[k] !== '')).length;
    return {
      pieces,
      info: {
        rows, cut,
        darts: [['Talia, przód', dw(F.b)], ['Talia, tył', dw(Bk.b)], ['Piersiowa', a.Dps - a.Dts > 0.3 ? 'z boku, ' + fmt(a.Dps - a.Dts) + ' cm na linii przodu' : 'brak']],
        warn: (neckGap < 3 ? 'Dekolt kończy się ' + (neckGap < 0 ? fmt(-neckGap) + ' cm poniżej linii biustu' : 'tylko ' + fmt(neckGap) + ' cm nad linią biustu') + '. Tak głęboki dekolt wymaga podtrzymania albo będzie odstawał. ' : '') + (est ? 'Góra korzysta z ' + est + ' wymiarów oszacowanych z obwodu biustu i wzrostu. Zmierz modelkę i uszyj próbę z surówki, zanim potniesz właściwą tkaninę.' : ''),
      },
      bod: [F.b, Bk.b],
      sil: { top: 'dress', lower: toHip ? 'straight' : none ? 'none' : 'circle', crop, frac, hemC, pleat, a, neckGap, seams: frac === 2 ? { side: true, cb: true, cf: true, rings: [0] } : { side: true, cb: true, rings: toHip || none ? [] : [0] }, lowerArm: Math.min(2, Math.max(0, p.luzG / 2)) },
    };
  }

  // ---------- princeska: cięcia pionowe przez biust zamiast zaszewek; mer = rybka z klinów ----------
  /** @param {WMeas} m @param {WParams} p */
  function draftPrincess(m, p, title, mer) {
    p = Object.assign({}, p, { zp: 'bok' }); // w princesce zaszewka piersiowa znika w cięciu
    const a = full(m), D = p.dl, pieces = [], rows = [];
    const kn = mer ? Math.max(35, Math.min(p.kn || 55, D - 15)) : 0, L = D - kn, gf = mer ? Math.max(2, Math.min(p.gf || 9, L * 0.7)) : 0;
    const ye = mer ? kn + Math.sqrt(L * L - gf * gf) : D, phiG = mer ? Math.asin(gf / L) : 0;
    const pb = mer ? Object.assign({}, p, { dl: kn, flare: Math.min(p.flare, 0) }) : p, pf = mer ? 0 : Math.max(0, p.flare) * 0.5;
    const flareSeg = (P, sg) => cubic(P, [P[0], P[1] + L * 0.25], [P[0] + sg * gf * 0.35, P[1] + L * 0.5], [P[0] + sg * gf, P[1] + (ye - kn)], 10);
    const half = (P, xm) => { const k = Math.abs(P[0] - xm), sg = P[0] > xm ? -1 : 1; return cubic(P, add(P, [sg * Math.cos(phiG), Math.sin(phiG)], k * 0.45), [xm - sg * k * 0.35, D], [xm, D], 12); };
    const arcHem = (P1, P2) => { if (!mer) return [P1, P2]; const xm = (P1[0] + P2[0]) / 2; return half(P1, xm).concat(half(P2, xm).reverse().slice(1)); };
    let hemHalf = 0, waist = 0, bust = 0, rr = 0, gap = 0, kneeHalf = 0, prF = 0, prB = 0, hipHalf = 0; const bod = [];
    const sideLen = [];
    for (const isFront of [true, false]) {
      const b = bodice(m, a, pb, isFront, true), dt = b.dart, pos = dt.pos, w = dt.w, fLen = Math.max(7, m.wb - (isFront ? 9 : 8));
      bod.push(b);
      const apex = isFront ? b.B : [pos, b.yg], nsa = Math.min(0.7, p.saSzew);
      const up = b.strapless ? cubic(b.M, [b.M[0], b.M[1] + (apex[1] - b.M[1]) * 0.35], [apex[0], apex[1] - (apex[1] - b.M[1]) * 0.35], apex, 14)
        : cubic(b.M, [b.M[0] - 0.4, b.M[1] + (apex[1] - b.M[1]) * 0.5], [apex[0] + 1.2, apex[1] - 4], apex, 14);
      const down = (sg) => {
        const W1 = [pos + (sg * w) / 2, 0], A2 = [pos, fLen], hipY = Math.max(fLen, m.wb);
        const base = cubic(apex, [apex[0], apex[1] * 0.55], [W1[0], apex[1] * 0.3], W1, 12).concat(cubic(W1, [W1[0], fLen * 0.4], [pos, fLen * 0.6], A2, 12).slice(1), hipY > fLen ? [[pos, hipY]] : []);
        return mer ? base.concat(flareSeg([pos, kn], -sg)) : base.concat([[pos - sg * pf, D]]);
      };
      const dc = down(-1), ds = down(1), csa = isFront ? 0 : p.saSzew, E = b.sideRaw[b.sideRaw.length - 1];
      const side = mer ? b.sideRaw.concat(flareSeg(E, 1).slice(1)) : b.sideRaw, Es = side[side.length - 1];
      const R = (pt) => (b.alpha ? rot(pt, b.B, -b.alpha) : pt), upS = up.map(R), armS = b.armB.map(R);
      const hx = xAtY(b.sideRaw, m.wb), lines = (n) => [n, title, m.name];
      const seamC = up.concat(dc.slice(1)), seamS = upS.concat(ds.slice(1)), cEnd = dc[dc.length - 1], sEnd = ds[ds.length - 1];
      // panel środkowy
      /** @type {WPrim[]} */
      const exC = [notch([pos - w / 2, 0], [1, 0], nsa), notch(apex, [1, 0], nsa), { t: 'poly', s: 'aux', pts: [[0, 0], [pos - w / 2, 0]] }, { t: 'poly', s: 'aux', pts: [[0, m.wb], [pos, m.wb]] }];
      if (!isFront) exC.push(notch([0, m.wb], [-1, 0], nsa), txt(0.6, m.wb + 0.9, 'koniec zamka', 'start'), ...zipMark(b.C, [0, m.wb], [1, 0]));
      if (mer) exC.push(notch([pos, kn], [1, 0], nsa), { t: 'poly', s: 'aux', pts: [[0, kn], [pos, kn]] }, txt(pos * 0.5, kn - 0.4, 'linia kolan'));
      let hemC, cEdge;
      if (mer && !isFront) { const cb = flareSeg([0, kn], -1); hemC = arcHem(cEnd, cb[cb.length - 1]); cEdge = cb.slice().reverse().concat([b.C]); }
      else { hemC = mer ? half(cEnd, 0) : [cEnd, [0, D]]; cEdge = [[0, D], b.C]; }
      pieces.push(mkPiece({
        id: isFront ? 'przod-srodek' : 'tyl-srodek', name: isFront ? 'PRZÓD ŚRODEK' : 'TYŁ ŚRODEK', lines: lines(isFront ? 'wytnij 1× ze złożenia' : 'wytnij 2×'),
        edges: [{ pts: b.neck, sa: p.saTalia, lab: 'dekolt' }, { pts: [b.NP, b.SP], sa: p.saSzew, lab: 'ramię' }, { pts: b.armA, sa: p.saTalia, lab: 'pacha' }, { pts: seamC, sa: p.saSzew, lab: 'cięcie princeski' }, { pts: hemC, sa: mer ? Math.min(p.saDol, 1.5) : p.saDol, lab: 'dół' }, { pts: cEdge, sa: csa, fold: isFront || !!p.knit, lab: isFront ? 'środek przodu' : 'środek tyłu', labOff: 2.3 }],
        extra: exC, label: [pos * 0.5, m.wb + 6], grain: { x: pos * 0.5, y0: m.wb + 12, y1: Math.max(m.wb + 20, (mer ? kn : D) - 6) }, foldText: isFront ? [1.1, D * 0.8] : null, mirror: !isFront,
      }));
      // panel boczny (zaszewka piersiowa zamknięta w cięciu)
      const exS = [notch([pos + w / 2, 0], [-1, 0], nsa), notch(apex, [-1, 0], nsa), notch([b.Wp[0], 0], [1, 0], nsa), notch([hx, m.wb], [1, 0], nsa),
        { t: 'poly', s: 'aux', pts: [[pos + w / 2, 0], [b.Wp[0], 0]] }, { t: 'poly', s: 'aux', pts: [[pos, m.wb], [hx, m.wb]] }];
      if (mer) exS.push(notch([pos, kn], [-1, 0], nsa), notch(E, [1, 0], nsa), { t: 'poly', s: 'aux', pts: [[pos, kn], E] });
      const hemS = arcHem(Es, sEnd);
      pieces.push(mkPiece({
        id: isFront ? 'przod-bok' : 'tyl-bok', name: isFront ? 'PRZÓD BOK' : 'TYŁ BOK', lines: lines('wytnij 2×'),
        edges: [{ pts: armS, sa: p.saTalia, lab: 'pacha' }, { pts: side, sa: p.saSzew, lab: 'szew boczny' }, { pts: hemS, sa: mer ? Math.min(p.saDol, 1.5) : p.saDol, lab: 'dół' }, { pts: seamS.slice().reverse(), sa: p.saSzew, lab: 'cięcie princeski' }],
        extra: exS, label: [(pos + hx) / 2, m.wb + 6], grain: { x: (pos + hx) / 2, y0: m.wb + 12, y1: Math.max(m.wb + 20, (mer ? kn : D) - 6) }, mirror: !isFront,
      }));
      hemHalf += plen(hemC) + plen(hemS); kneeHalf += E[0]; hipHalf += hx; waist += b.Wp[0] - w; bust += b.bustX; rr = b.r; if (isFront) gap = b.yg - b.C[1];
      sideLen.push(plen(side));
      rows.push([isFront ? 'Cięcie przodu: środek i bok' : 'Cięcie tyłu: środek i bok', plen(seamC), plen(seamS)]);
      if (isFront) prF = pos; else prB = pos;
    }
    const head = [['Biust w wykroju', 2 * bust, m.og + p.luzG], ['Talia w wykroju', 2 * waist, m.ot + p.luzT], ['Biodra w wykroju', 2 * hipHalf, m.ob + p.luzB]];
    if (mer) head.push(['Obwód na kolanach', 2 * kneeHalf, null]);
    head.push(['Obwód dołu', 2 * hemHalf, null], ['Dekolt nad linią biustu', gap, null], ['Szew boczny: przód i tył', sideLen[0], sideLen[1]]);
    const sil = { top: 'dress', frac: 0, hemC: 2 * hemHalf, a, neckGap: gap, lowerArm: Math.min(2, Math.max(0, p.luzG / 2)), seams: { side: true, cb: true, pr: [prF, prB] } };
    if (mer) Object.assign(sil, { lower: 'mermaid', kn, kneeC: 2 * kneeHalf, grow: (2 * hemHalf - 2 * kneeHalf) / L }); else Object.assign(sil, { lower: 'straight', flareK: 1.6 });
    return {
      pieces, bod,
      info: {
        rows: head.concat(rows),
        darts: [['Zaszewki', 'brak, kształt dają cięcia']],
        cut: [['Przód środek', '1 × ze złożenia'], ['Przód bok', '2 ×'], ['Tył środek', '2 ×'], ['Tył bok', '2 ×']],
        warn: (mer ? 'Obwód na kolanach to ' + fmt(2 * kneeHalf) + ' cm, więc krok będzie krótki. ' : '') + 'Cięcia zszywaj od nacinek na linii biustu, talii' + (mer ? ' i kolan' : '') + '. Łuk nad biustem na panelu bocznym przypnij gęsto przed szyciem.',
      },
      sil,
    };
  }

  // ---------- empire: odcięcie pod biustem ----------
  /** @param {WMeas} m @param {WParams} p */
  function draftEmpire(m, p, title) {
    const a = full(m), drop = 7.5, pieces = [], tops = [];
    const under = (isFinite(m.opx) ? m.opx : m.og - 14) + Math.max(2, p.luzT);
    const parts = [true, false].map((isFront) => {
      const b = bodice(m, a, p, isFront, false), yE = b.yg + drop, dt = b.dart, we = dt.w * Math.max(0, (yE - dt.top) / (0 - dt.top));
      return { isFront, b, yE, we, xs: xAtY(b.sideRaw, yE) };
    });
    const cur = 2 * parts.reduce((s, q) => s + q.xs - q.we, 0), adj = (cur - under) / 4;
    for (const q of parts) {
      const b = q.b, yE = q.yE, dt = b.dart, we = Math.max(0, Math.min(5, q.we + adj)), isFront = q.isFront;
      const es = (b.edgesSideMain || b.edgesSide).slice(), last = es[es.length - 1];
      es[es.length - 1] = { pts: splitAtY(last.pts, yE)[0], sa: last.sa };
      const extra = (b.extraMain || b.extra).slice();
      if (we > 0.2) extra.push({ t: 'poly', s: 'dart', pts: [[dt.pos - we / 2, yE + p.saTalia], [dt.pos - we / 2, yE], [dt.pos, dt.top], [dt.pos + we / 2, yE], [dt.pos + we / 2, yE + p.saTalia]] }, lab(dt.pos + we / 2 + 0.8, (dt.top + yE) / 2 + 1, 'zaszewka', -90));
      extra.push({ t: 'poly', s: 'aux', pts: [[0, b.yg], [b.bustX, b.yg]] }, txt(b.q * 0.6, b.yg - 0.4, 'linia biustu'));
      if (!isFront && !p.knit) extra.push(...zipMark(b.C, [0, yE], [1, 0]));
      pieces.push(mkPiece({
        id: isFront ? 'stanik-przod' : 'stanik-tyl', name: isFront ? 'STANIK PRZÓD' : 'STANIK TYŁ', lines: [isFront ? 'wytnij 1× ze złożenia' : 'wytnij 2×', title, m.name],
        edges: (b.edgesTop || [{ pts: b.neck, sa: p.saTalia, lab: 'dekolt' }, { pts: [b.NP, b.SP], sa: p.saSzew, lab: 'ramię' }, { pts: b.arm, sa: p.saTalia, lab: 'pacha' }]).concat(es, [{ pts: [[q.xs, yE], [0, yE]], sa: p.saTalia, lab: 'odcięcie pod biustem' }, { pts: [[0, yE], b.C], sa: isFront ? 0 : p.saSzew, fold: isFront }]),
        extra, label: [b.C[1] > b.yg - 8 && !b.strapless ? b.q * 0.62 : b.q * 0.42, b.strapless ? b.yg - 1.2 : b.yg - 7], grain: { x: b.q * 0.8, y0: b.strapless ? b.yg - 1 : b.yg - 6, y1: yE - 1.5 }, foldText: isFront ? [1.1, (b.C[1] + yE) / 2] : null, mirror: !isFront,
      }));
      tops.push({ isFront, wt: q.xs - we, yE, b });
    }
    const hq = (m.ob + p.luzB) / 4;
    let hemHalf = 0, seam = 0;
    for (const t of tops) {
      const Ls = -t.yE + p.dl, yh = -t.yE + m.wb, k = Math.max((hq + 1.5 - t.wt) / yh, 0.1), hemX = t.wt + k * Ls + Math.max(0, p.flare);
      const phi = Math.atan2(hemX - t.wt, Ls), E = [t.wt + Ls * Math.sin(phi), Ls * Math.cos(phi)], hem = hemCurve(E, [-Math.cos(phi), Math.sin(phi)], Ls);
      const extra = [{ t: 'poly', s: 'aux', pts: [[0, yh], [t.wt + (E[0] - t.wt) * (yh / E[1]), yh]] }, txt(t.wt * 0.6, yh - 0.4, 'linia bioder')];
      if (!t.isFront) extra.push(notch([0, yh], [-1, 0], Math.min(0.7, p.saSzew)), txt(0.6, yh + 0.9, 'koniec zamka', 'start'), ...zipMark([0, 0], [0, yh], [1, 0]));
      pieces.push(mkPiece({
        id: t.isFront ? 'dol-przod' : 'dol-tyl', name: t.isFront ? 'DÓŁ PRZÓD' : 'DÓŁ TYŁ', lines: [t.isFront ? 'wytnij 1× ze złożenia' : 'wytnij 2×', title, m.name],
        edges: [{ pts: [[0, 0], [t.wt, 0]], sa: p.saTalia, lab: 'odcięcie pod biustem' }, { pts: [[t.wt, 0], E], sa: p.saSzew, lab: 'szew boczny' }, { pts: hem, sa: p.saDol, lab: 'dół' }, { pts: [[0, Ls], [0, 0]], sa: t.isFront ? 0 : p.saSzew, fold: t.isFront, lab: t.isFront ? 'środek przodu' : 'środek tyłu', labOff: 2.3 }],
        extra, label: [t.wt * 0.55, yh + 8], grain: { x: t.wt * 0.8, y0: yh + 14, y1: Math.max(yh + 22, Ls - 6) }, foldText: t.isFront ? [1.1, Ls * 0.75] : null, mirror: !t.isFront,
      }));
      hemHalf += plen(hem); seam += t.wt;
    }
    const F = tops[0].b, gap = F.yg - F.C[1], est = ADV.filter((k) => !(m.adv && isFinite(m.adv[k]) && m.adv[k] !== null && m.adv[k] !== '')).length;
    return {
      pieces,
      info: {
        rows: [['Biust w wykroju', 2 * (tops[0].b.bustX + tops[1].b.bustX), m.og + p.luzG], ['Odcięcie pod biustem', 2 * seam, null], ['Obwód dołu', 2 * hemHalf, null], ['Długość ramienia', F.r, null], ['Dekolt nad linią biustu', gap, null]],
        darts: [['Pod biustem', 'po 1 na połowę przodu i tyłu'], ['Piersiowa', a.Dps - a.Dts > 0.3 ? 'z boku' : 'brak']],
        cut: [['Stanik przód', '1 × ze złożenia'], ['Stanik tył', '2 ×'], ['Dół przód', '1 × ze złożenia'], ['Dół tył', '2 ×']],
        warn: (isFinite(m.opx) ? '' : 'Obwód pod biustem jest oszacowany. Wpisz zmierzony w profilu modelki, bo od niego zależy, czy odcięcie będzie leżało. ') + (est ? 'Góra korzysta z ' + est + ' wymiarów oszacowanych, uszyj próbę z surówki.' : ''),
      },
      bod: [tops[0].b, tops[1].b],
      sil: { top: 'dress', lower: 'empire', frac: 0, hemC: 2 * hemHalf, seamC: 2 * seam, yE: -tops[0].yE, seams: { side: true, cb: true, rings: [-tops[0].yE] }, a, neckGap: gap, lowerArm: Math.min(2, Math.max(0, p.luzG / 2)) },
    };
  }

  // ---------- rybka: dopasowana do kolan, niżej falbana z koła ----------
  /** @param {WMeas} m @param {WParams} p */
  function draftMermaid(m, p, title) {
    const a = full(m), kn = Math.max(35, Math.min(p.kn || 55, p.dl - 12)), ps = Object.assign({}, p, { dl: kn, flare: Math.min(p.flare, 2), saDol: p.saSzew, rozp: 0, tren: 0 });
    const F = topPiece(m, a, ps, true, true, title), Bk = topPiece(m, a, ps, false, true, title);
    const ff = p.ff === 0.5 || p.ff === 2 ? p.ff : 1;
    const kneeC = 2 * (F.hemLen + Bk.hemLen), fl = circlePiece(kneeC, p.dl - kn, ff, m, p, title, 0, ff === 2 ? 'FALBANA Z DWÓCH KÓŁ' : ff === 1 ? 'FALBANA Z KOŁA' : 'FALBANA Z PÓŁKOLA');
    const waist = 2 * (F.b.Wp[0] + Bk.b.Wp[0] - F.b.dart.w - Bk.b.dart.w), gap = F.b.yg - F.b.C[1];
    const dw = (b) => (b.dart.w > 0.2 ? '1 × ' + fmt(b.dart.w) + ' cm' : 'brak');
    return {
      pieces: [F.pc, Bk.pc, fl.piece],
      info: {
        rows: [['Biust w wykroju', 2 * (F.b.bustX + Bk.b.bustX), m.og + p.luzG], ['Talia w wykroju', waist, m.ot + p.luzT], ['Biodra w wykroju', 2 * (xAtY(F.b.lo.side, m.wb) + xAtY(Bk.b.lo.side, m.wb)), m.ob + p.luzB],
          ['Obwód na odcięciu', kneeC, null], ['Obwód dołu', fl.hemC, null], ['Dekolt nad linią biustu', gap, null]],
        darts: [['Talia, przód', dw(F.b)], ['Talia, tył', dw(Bk.b)]],
        cut: [['Przód', '1 × ze złożenia'], ['Tył', '2 ×'], ['Falbana', Math.round(ff * 2) + ' × ze złożenia']],
        warn: 'Obwód na odcięciu to ' + fmt(kneeC) + ' cm, więc krok będzie krótki. Jeśli modelka ma w tym chodzić, a nie tylko stać, podnieś odcięcie albo dodaj rozporek.',
      },
      bod: [F.b, Bk.b],
      sil: { top: 'dress', lower: 'mermaid', frac: ff, kn, kneeC, hemC: fl.hemC, grow: 2 * Math.PI * ff, seams: { side: true, cb: true, rings: [-kn] }, a, neckGap: gap, lowerArm: Math.min(2, Math.max(0, p.luzG / 2)) },
    };
  }

  // ---------- gorset pod biust: panele liczone z obwodów na trzech poziomach (góra, talia, dół) ----------
  const CW = {
    5: { t: [0.2, 0.2, 0.2, 0.2, 0.2], w: [0.23, 0.19, 0.17, 0.19, 0.22], h: [0.19, 0.2, 0.22, 0.21, 0.18] },
    6: { t: [0.17, 0.165, 0.165, 0.17, 0.17, 0.16], w: [0.19, 0.16, 0.15, 0.15, 0.165, 0.185], h: [0.16, 0.165, 0.18, 0.18, 0.165, 0.15] },
  };
  const CNAME = { 5: ['środek przodu', 'przód bok', 'bok', 'tył bok', 'środek tyłu'], 6: ['środek przodu', 'przód bok', 'bok przód', 'bok tył', 'tył bok', 'środek tyłu'] };
  /** @param {WMeas} m @param {WParams} p */
  function draftCorset(m, p, title, over) {
    const a = full(m), n = p.gp === 5 ? 5 : 6, Wt = CW[n];
    const gr = Math.max(0, Math.min(15, p.gr == null ? 5 : p.gr)), gg = Math.max(0, Math.min(10, p.gg == null ? 5 : p.gg));
    const gh = Math.max(5, Math.min(14, p.gh || 9)), gd = Math.max(5, Math.min(Math.max(6, m.wb - 2), p.gd || 11));
    const under = isFinite(m.opx) && m.opx !== null ? m.opx : m.og - 14, hU = Math.max(6, a.Dps - a.Wg - 7);
    // nad biust: górna krawędź biegnie nad biustem z przodu, pod pachą z boku i niżej z tyłu; panele mają dodatkowy poziom na linii biustu
    const hb = a.Dps - a.Wg, bhO = Math.max(2, Math.min(12, p.bh || 6)), hSide = Math.min(hb + bhO, a.Dts - a.Gp - 2.5), hBack = Math.max(8, hSide - 2.5);
    const fS = Math.max(0.5, Math.min(0.6, 0.5 + (m.og - under - 12) / (3.2 * m.og))), nf = n === 5 ? 2.5 : 3; // udział przodu w obwodzie biustu rośnie z miseczką
    const WB = Array.from({ length: n }, (_, i) => { const fr = Math.max(0, Math.min(1, nf - i)), sF = Wt.t.reduce((s2, v, j) => s2 + v * Math.max(0, Math.min(1, nf - j)), 0), sB = 1 - sF; return Wt.t[i] * (fr * fS / sF + (1 - fr) * (1 - fS) / sB); });
    const WB2 = WB.map((v, i) => (i === 1 ? v * 1.1 : i === 0 ? v * 0.93 : v)), wbS = WB2.reduce((s2, v) => s2 + v, 0), CtopO = m.og * 0.955 - (m.og - under) * 0.12;
    const Ctop = over ? CtopO : m.ot + (under - m.ot) * Math.min(1.15, gh / hU), Cw = m.ot - gr;
    const hipAt = (h) => m.ot + (m.ob - m.ot) * Math.pow(Math.min(1, Math.max(0, h) / m.wb), 0.8) + 1;
    const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    const Tof = over ? (u) => (u < 0.5 ? hSide + (hb + bhO - hSide) * (1 - sm((u - 0.12) / 0.38)) : hSide + (hBack - hSide) * sm((u - 0.5) / 0.4)) : (u) => gh + (u > 0.7 ? ((u - 0.7) / 0.3) * 1.2 : 0), Bof = (u) => gd - 3.5 * Math.sin(Math.PI * u) - 1.5 * u;
    const TL = [], TR = [], P = [];
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, bm = (Bof(u0) + Bof(u1)) / 2;
      P.push({ wb: (WB2[i] / wbS) * (m.og - gg) / 2, wt: (over ? WB2[i] / wbS : Wt.t[i]) * (Ctop - gg) / 2, ww: Wt.w[i] * (Cw - gg) / 2, wh: Wt.h[i] * (hipAt(bm) - gg) / 2, b0: Bof(u0), b1: Bof(u1) });
      TL.push(Tof(u0)); TR.push(Tof(u1));
    }
    // krawędź panelu od góry przez talię do dołu; straight = środek przodu albo tyłu
    const edge = (q, right, T, B, i) => {
      const st = (i === 0 && !right) || (i === n - 1 && right), sg = right ? 1 : -1, k = (i === 0 || i === n - 1) ? 1 : 0.5;
      if (st) return [[0, -T], [0, B]];
      const off = (i === 0 || i === n - 1) ? -sg * q.ww / 2 : 0; // panele skrajne: cały kształt po jednej stronie
      const xw = off + sg * q.ww * k, xh = off + sg * q.wh * k, xb = off + sg * q.wb * k;
      let xt = off + sg * q.wt * k, up;
      if (over && T > hb + 1) up = cubic([xt, -T], [xt, -T + (T - hb) * 0.45], [xb, -hb - (T - hb) * 0.35], [xb, -hb], 8).concat(cubic([xb, -hb], [xb, -hb * 0.62], [xw, -hb * 0.33], [xw, 0], 12).slice(1)).filter((_, j) => j !== 7 || true);
      else { if (over) xt = xw + (xb - xw) * sm(T / hb); up = cubic([xt, -T], [xt, -T * 0.55], [xw, -T * 0.35], [xw, 0], 19); }
      return up.concat(cubic([xw, 0], [xw, B * 0.35], [xh, B * 0.5], [xh, B], 14).slice(1));
    };
    for (let it = 0; it < 4; it++) for (let s2 = 1; s2 < n; s2++) { // wyrównanie długości zszywanych krawędzi
      const la = plen(edge(P[s2 - 1], true, TR[s2 - 1], P[s2 - 1].b1, s2 - 1)), lb = plen(edge(P[s2], false, TL[s2], P[s2].b0, s2));
      if (la < lb) TR[s2 - 1] += lb - la; else TL[s2] += la - lb;
    }
    const pieces = [], rows = [], bones = [];
    let sumT = 0, sumW = 0, sumH = 0;
    P.forEach((q, i) => {
      const L = edge(q, false, TL[i], q.b0, i), R = edge(q, true, TR[i], q.b1, i), sh = i === 0 ? q.ww / 2 : i === n - 1 ? -q.ww / 2 : 0;
      const mv = (pts) => pts.map((c) => [c[0] + sh, c[1]]), Lm = mv(L), Rm = mv(R);
      const wi = (pts) => { let b = 0; for (let j = 1; j < pts.length; j++) if (Math.abs(pts[j][1]) < Math.abs(pts[b][1])) b = j; return pts[b][0]; }, xl = wi(Lm), xr = wi(Rm), x0 = i === 0 ? Lm[0][0] : xl, x1 = i === n - 1 ? Rm[0][0] : xr;
      const extra = /** @type {WPrim[]} */ ([{ t: 'poly', s: 'aux', pts: [[x0, 0], [x1, 0]] }]).concat(over && Math.min(TL[i], TR[i]) > hb + 1 ? [{ t: 'poly', s: 'aux', pts: [[Lm.reduce((b, c) => (Math.abs(c[1] + hb) < Math.abs(b[1] + hb) ? c : b))[0], -hb], [Rm.reduce((b, c) => (Math.abs(c[1] + hb) < Math.abs(b[1] + hb) ? c : b))[0], -hb]] }, txt(x1 - 0.5, -hb - 0.4, 'biust', 'end')] : []).concat([ notch([x1, 0], [1, 0], Math.min(0.7, p.saSzew)), notch([x0, 0], [-1, 0], Math.min(0.7, p.saSzew)), txt(x1 - 0.5, -0.4, 'talia', 'end')]);
      if (i === n - 1) { // oczka wzdłuż środka tyłu
        for (let y = -TR[i] + 1.5; y <= q.b1 - 1.2; y += 2.5) extra.push({ t: 'poly', s: 'notch', pts: [[x1 - 1.5, y], [x1 - 1.1, y]] });
        extra.push(lab(x1 - 2.6, (q.b1 - TR[i]) / 2 + 3, 'oczka co 2,5 cm', -90));
      }
      const lastCb = i === n - 1, first = i === 0;
      const pc = mkPiece({
        id: 'gorset-' + (i + 1), name: 'PANEL ' + (i + 1) + ' · ' + CNAME[n][i], small: true, labelRot: -90,
        lines: ['wytnij 2× z każdej warstwy · ' + m.name],
        edges: [{ pts: [Lm[0], Rm[0]], sa: p.saTalia }, { pts: Rm, sa: lastCb ? 3 : p.saSzew }, { pts: [Rm[Rm.length - 1], Lm[Lm.length - 1]], sa: p.saTalia }, { pts: Lm.slice().reverse(), sa: first ? p.saSzew : p.saSzew }],
        extra, label: [x0 + 1.2, (q.b0 + q.b1) / 4 - gh / 4 + 1.5], grain: { x: x0 + Math.max(3.6, (x1 - x0) * 0.62), y0: -(over ? Math.min(TL[i], TR[i]) : gh) + 1.5, y1: Math.min(q.b0, q.b1) - 1.5 },
      });
      pieces.push(pc);
      sumT += q.wt; sumW += q.ww; sumH += q.wh; bones.push(plen(R));
      if (i < n - 1) rows.push(['Szew ' + (i + 1) + '/' + (i + 2), plen(R), plen(edge(P[i + 1], false, TL[i + 1], P[i + 1].b0, i + 1))]);
    });
    if (over) rows.unshift(['Biust po zasznurowaniu', 2 * P.reduce((s2, q) => s2 + q.wb, 0) + gg, m.og]);
    rows.unshift(['Góra po zasznurowaniu', 2 * sumT + gg, Ctop], ['Talia po zasznurowaniu', 2 * sumW + gg, Cw], ['Dół po zasznurowaniu', 2 * sumH + gg, null], ['Talia gorsetu na płasko', 2 * sumW, null]);
    const hCb = TR[n - 1] + P[n - 1].b1, eyelets = 2 * (Math.floor((hCb - 2.7) / 2.5) + 1);
    return {
      pieces,
      info: {
        rows, darts: [], cut: [['Panele 1 do ' + n, 'po 2 × z każdej warstwy']],
        warn: (over ? 'Gorset nad biust z paneli, bez osobnych miseczek: biust mieści się w wybrzuszeniu szwów między panelami 1, 2 i 3. Przy dużej miseczce koniecznie uszyj próbę. ' : '') + 'Talia modelki ' + fmt(m.ot) + ' cm, w gorsecie ' + fmt(Cw) + ' cm' + (gr > 8 ? '. Redukcja powyżej 8 cm to już gorset modelujący, a nie kostiumowy' : '') + '. Najpierw uszyj próbny gorset z płótna i przymierz. Szyj z dwóch warstw: sztywnej (drelich gorsetowy) i wierzchniej. ' + (isFinite(m.opx) && m.opx !== null ? '' : 'Obwód pod biustem jest oszacowany, wpisz zmierzony w profilu modelki.'),
      },
      sil: { top: 'corset', lower: 'corset', hemC: 0, seams: { corset: Array.from({ length: n - 1 }, (_, i) => { let acc = 0; for (let j = 0; j <= i; j++) acc += P[j].ww; return acc / (sumW + gg / 2); }) }, c: { T: Tof, B: Bof, gap: (gg / 2) / (sumW + gg / 2), gr, waist: Cw } },
      corset: { n, bones, hCb, eyelets, gg, top: 2 * sumT, bottom: 2 * sumH },
    };
  }

  // ---------- odszycia dekoltu i pach (kroją się z tych samych linii co sukienka) ----------
  function alongPts(pts, dist) { // punkt i początek łamanej do zadanej długości
    let acc = 0; const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc + l >= dist) { const t = (dist - acc) / (l || 1); out.push([pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])]); return out; }
      acc += l; out.push(pts[i]);
    }
    return out;
  }
  function insetCurve(pts, w) { // linia równoległa po stronie ubrania, bez pętli na ciasnych łukach
    const dense = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 4; k++) dense.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / 4, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / 4]);
    dense.push(pts[pts.length - 1]);
    const out = [];
    for (let i = 0; i < dense.length; i++) {
      const a = dense[Math.max(0, i - 1)], b = dense[Math.min(dense.length - 1, i + 1)], d = unit(sub(b, a)), q = [dense[i][0] - d[1] * w, dense[i][1] + d[0] * w];
      let ok = true; for (let j = 0; j < dense.length; j += 2) if (Math.hypot(q[0] - dense[j][0], q[1] - dense[j][1]) < w * 0.97) { ok = false; break; }
      if (ok) out.push(q);
    }
    return out;
  }
  /** @param {WMeas} m @param {WParams} p */
  function facingPieces(b, isFront, p, m) {
    const w = Math.max(3, Math.min(p.facW || 5, 8)), out = [], csa = isFront ? 0 : p.saSzew, side0 = b.alpha ? b.edgesSide[0].pts : b.sideRaw;
    const sideTop = alongPts(side0, Math.min(w, 4)), S2 = sideTop[sideTop.length - 1], Ue = side0[0], who = isFront ? 'PRZÓD' : 'TYŁ', cutN = isFront ? 'wytnij 1× ze złożenia' : 'wytnij 2×';
    const sdir = unit(sub(b.SP, b.NP)), shLen = Math.hypot(b.SP[0] - b.NP[0], b.SP[1] - b.NP[1]);
    if (p.fac === 'osobne') {
      const ws = Math.min(w, shLen / 2 - 0.3), S1 = add(b.NP, sdir, ws), S3 = add(b.SP, sdir, -ws);
      const below = (q) => (q[0] - b.NP[0]) * sdir[1] - (q[1] - b.NP[1]) * sdir[0] < -0.2; // po stronie ubrania względem linii ramienia
      const inN = insetCurve(b.neck, ws).filter((q) => q[0] > 0.05 && below(q)), yIn = inN.length ? inN[0][1] : b.C[1] + ws;
      out.push(mkPiece({
        id: 'odsz-dekolt-' + (isFront ? 'p' : 't'), name: 'Odszycie dekoltu, ' + who.toLowerCase(), lines: [cutN], small: true,
        edges: [{ pts: b.neck, sa: p.saTalia }, { pts: [b.NP, S1], sa: p.saSzew }, { pts: [S1].concat(inN.slice().reverse(), [[0, yIn]]), sa: 0 }, { pts: [[0, yIn], b.C], sa: csa, fold: isFront }],
        label: [b.NP[0] * 0.42, yIn - ws * 0.55], mirror: !isFront,
      }));
      const inA = insetCurve(b.arm, ws).filter((q) => below(q));
      out.push(mkPiece({
        id: 'odsz-pacha-' + (isFront ? 'p' : 't'), name: 'Odszycie pachy, ' + who.toLowerCase() + ' · wytnij 2×', lines: [], small: true, labelRot: -90,
        edges: [{ pts: b.arm, sa: p.saTalia }, { pts: sideTop, sa: p.saSzew }, { pts: [S2].concat(inA.slice().reverse(), [S3]), sa: 0 }, { pts: [S3, b.SP], sa: p.saSzew }],
        label: [b.M[0] - ws * 0.45, (b.SP[1] + S2[1]) / 2 - 1], mirror: !isFront,
      }));
    } else {
      const yIn = Math.max(b.C[1] + w, S2[1] - 4), inner = cubic(S2, [S2[0] * 0.6, S2[1]], [S2[0] * 0.35, yIn], [0, yIn], 16);
      out.push(mkPiece({
        id: 'odszycie-' + (isFront ? 'p' : 't'), name: 'ODSZYCIE ' + who, lines: [cutN + ', podklej fizeliną', m.name],
        edges: [{ pts: b.neck, sa: p.saTalia }, { pts: [b.NP, b.SP], sa: p.saSzew }, { pts: b.arm, sa: p.saTalia }, { pts: sideTop, sa: p.saSzew }, { pts: inner, sa: 0 }, { pts: [[0, yIn], b.C], sa: csa, fold: isFront }],
        label: [S2[0] * 0.5, yAtX(inner, S2[0] * 0.5) - 3.4], grain: { x: S2[0] * 0.82, y0: b.SP[1] + 3, y1: S2[1] - 1 }, mirror: !isFront,
      }));
    }
    return out;
  }

  // ---------- warstwy: co z której tkaniny i w jakiej kolejności ----------
  const ROLES = {
    wierzch: 'Wierzch', podszewka: 'Podszewka', narzutka: 'Warstwa wierzchnia', halka: 'Halka z tiulu', usztywnienie: 'Usztywnienie stanika',
  };
  function partOf(id) { return id.indexOf('odsz') === 0 ? 'facing' : id.indexOf('stanik') === 0 ? 'top' : id.indexOf('dol') === 0 || id === 'klosz' ? 'bottom' : 'both'; }
  /** @param {WMeas} m @param {WParams} p */
  function buildLayers(layers, d, m, p, fabName) {
    const isDress = !!d.bod, pieces = d.pieces, out = { cut: [], steps: [], notes: {} };
    const scope = (L) => (!isDress ? 'dol' : L.role === 'usztywnienie' ? 'gora' : L.role === 'halka' ? 'dol' : L.zakres || 'calosc');
    const applies = (L, pc) => {
      const pt = pc.part || partOf(pc.id), sc = scope(L);
      if (L.role === 'halka') return false;
      if (pc.part === 'overlay') return pc.layer === L;
      if (L.role === 'narzutka' && L.own && pt !== 'top' && sc !== 'gora') return pt === 'both' && sc === 'calosc';
      if (pt === 'facing') return L.role === 'wierzch';
      if (L.role === 'usztywnienie') return pt === 'top' || pt === 'both';
      return sc === 'calosc' || (sc === 'gora' && pt !== 'bottom') || (sc === 'dol' && pt !== 'top');
    };
    const has = (r) => layers.some((L) => L.role === r), hasScope = (r, pt) => layers.some((L) => L.role === r && (scope(L) === 'calosc' || scope(L) === pt));
    for (const L of layers) {
      const items = [], sc = scope(L), fab = fabName(L.fabric);
      for (const pc of pieces) if (applies(L, pc)) {
        const ownTop = L.role === 'narzutka' && L.own && (pc.part || partOf(pc.id)) === 'both';
        const pt = pc.part || partOf(pc.id), part = !isDress ? '' : ownTop ? ', tylko góra do linii talii + 1,5 cm zapasu' : pt === 'both' && sc === 'gora' ? ', tylko góra do linii talii + 1,5 cm zapasu' : pt === 'both' && sc === 'dol' ? ', tylko dół od linii talii + 1,5 cm zapasu' : '';
        items.push(pc.name.charAt(0) + pc.name.slice(1).toLowerCase() + ': ' + pc.cut + part);
        (out.notes[pc.id] = out.notes[pc.id] || []).push(ROLES[L.role].toLowerCase());
      }
      const notes = [];
      if (L.role === 'podszewka') notes.push('Dół skróć o 3 cm względem linii dołu na wykroju.', 'Zaszewki zaszyj tylko na 2 do 3 cm od brzegu jako zakładki, podszewka potrzebuje luzu.', isDress ? 'Odszycia możesz pominąć albo naszyć je na podszewkę, żeby przy dekolcie było widać tkaninę wierzchu.' : 'Wszyj ją w pasek razem z wierzchem.');
      if (L.role === 'narzutka' && L.gather) items.push('Dół marszczony: prostokąt ' + L.gather[0] + ' × ' + L.gather[1] + ' cm, zmarszczony do ' + L.gather[2] + ' cm (zszyj z brytów).');
      if (L.role === 'narzutka') notes.push('Krój dokładnie i bez przesuwania, najlepiej pojedynczo, nie ze złożenia podwójnej warstwy.', 'Szwy francuskie, dół podwinięty na 0,5 cm.');
      if (L.role === 'usztywnienie') notes.push('Krój bez zapasów na szwy, jeśli to fizelina. Organzę albo płótno krój z zapasami.');
      if (L.role === 'halka') {
        const len = Math.max(20, p.dl - 6), h1 = Math.round(len * 0.4), w1 = Math.round((m.ob + 8) * 1.3), w2 = w1 * 2;
        items.push('Karczek: z form dołu, od talii na 12 cm, z podszewki albo siatki.', 'Falbana górna: prostokąt ' + w1 + ' × ' + (h1 + 2) + ' cm.', 'Falbana dolna: prostokąt ' + w2 + ' × ' + (len - h1 + 2) + ' cm (zszyj z kilku brytów).');
        notes.push('Tiulu nie trzeba obrzucać. Dla większej objętości powtórz obie falbany dwa albo trzy razy.');
      }
      out.cut.push({ name: ROLES[L.role], fabric: fab, scope: !isDress || L.role === 'halka' || L.role === 'usztywnienie' ? '' : sc === 'gora' ? 'góra' : sc === 'dol' ? 'dół' : 'całość', items, notes });
    }
    const S = out.steps, seamAt = d.sil.lower === 'empire' ? 'w odcięciu pod biustem' : (d.sil.seams && d.sil.seams.rings && d.sil.seams.rings.length) ? 'w szwie odcięcia' : 'w talii';
    S.push('Wytnij elementy każdej warstwy według listy. Nacinki i zaszewki przenieś na każdą warstwę osobno.');
    if (has('usztywnienie')) S.push('Usztywnienie przyklej albo przyfastryguj do lewej strony elementów stanika z wierzchu.');
    if (isDress && hasScope('narzutka', 'gora')) S.push('Warstwę wierzchnią stanika ułóż na wierzchu, sfastryguj po obwodzie i dalej szyj obie jak jedną tkaninę, razem z zaszewkami.');
    S.push(isDress ? 'Wierzch: zaszyj zaszewki albo cięcia, potem szwy boczne i ramiona. Zamek wszyj w środek tyłu.' : 'Wierzch: zaszyj zaszewki, szwy boczne i wszyj zamek w środek tyłu.');
    if (hasScope('narzutka', 'dol')) S.push('Dół warstwy wierzchniej zszyj osobno i połącz z wierzchem ' + seamAt + (isDress && seamAt === 'w talii' ? '. Jeśli sukienka nie ma odcięcia, przyfastryguj warstwy wzdłuż dekoltu i pach' : '') + '.');
    if (has('halka')) S.push('Halka: zmarszcz falbanę dolną do górnej, górną do karczka. Wszyj ją ' + seamAt + ', między wierzch a podszewkę.');
    if (has('podszewka')) S.push(isDress ? 'Podszewkę zszyj tak samo jak wierzch, zostawiając środek tyłu otwarty na długość zamka. Połącz z wierzchem prawą stroną do prawej wzdłuż dekoltu i pach, wywróć i przestębnuj podszewkę przy krawędzi.' : 'Podszewkę zszyj tak samo jak wierzch, zostawiając otwór na zamek, i wszyj w pasek razem z wierzchem.');
    else if (isDress && p.fac !== 'brak') S.push('Wszyj odszycia dekoltu i pach, wywróć i przestębnuj przy krawędzi.');
    S.push('Doły podwiń osobno dla każdej warstwy' + (has('podszewka') ? ', podszewkę o 3 cm krócej' : '') + '. Klosze przed podwinięciem odwieś na dobę.');
    return out;
  }

  // ---------- fasony ----------
  const STYLES = [
    { id: 'sk_prosta', group: 'Spódnice', name: 'Prosta (podstawowa)', flare: 0 },
    { id: 'sk_olowkowa', group: 'Spódnice', name: 'Ołówkowa', flare: -2 },
    { id: 'sk_trapez', group: 'Spódnice', name: 'Trapezowa', flare: 0 },
    { id: 'sk_polkole', group: 'Spódnice', name: 'Z półkola' },
    { id: 'sk_kolo', group: 'Spódnice', name: 'Z koła' },
    { id: 'sk_2kola', group: 'Spódnice', name: 'Z dwóch kół' },
    { id: 'su_dopasowana', group: 'Sukienki', name: 'Dopasowana (podstawowa)', flare: 0 },
    { id: 'su_trapez', group: 'Sukienki', name: 'Litera A (trapezowa)', flare: 7 },
    { id: 'su_princeska', group: 'Sukienki', name: 'Princeska', flare: 4 },
    { id: 'su_empire', group: 'Sukienki', name: 'Empire', flare: 0 },
    { id: 'su_rybka_kliny', group: 'Sukienki', name: 'Rybka z klinów', flare: 0, dl: 105 },
    { id: 'su_rybka', group: 'Sukienki', name: 'Rybka z falbaną', flare: -2, dl: 105 },
    { id: 'su_polkole', group: 'Sukienki', name: 'Odcinana, dół z półkola' },
    { id: 'su_kolo', group: 'Sukienki', name: 'Odcinana, dół z koła' },
    { id: 'su_2kola', group: 'Sukienki', name: 'Odcinana, dół z dwóch kół' },
    { id: 'su_zakl', group: 'Sukienki', name: 'Odcinana, dół z zakładkami' },
    { id: 'to_klasyczny', group: 'Topy', name: 'Klasyczny', dl: 25, preset: { gora: 'ramiona', nk: 'okragly', nkb: 'okragly', nd: 2, nw: 1, nb: 0, bok: 0, kol: 'brak', ram: 'brak', rek: 'brak' } },
    { id: 'to_bokserka', group: 'Topy', name: 'Bokserka', dl: 25, preset: { gora: 'ramiona', nk: 'okragly', nkb: 'okragly', nd: 7, nw: 3, nb: 6, bok: 4, kol: 'brak', ram: 'brak', rek: 'brak' } },
    { id: 'to_ramiaczka', group: 'Topy', name: 'Na cienkich ramiączkach', dl: 25, preset: { gora: 'bez', bk: 'prosta', bh: 8, ram: 'cienkie', ramW: 1, bok: 0, kol: 'brak' } },
    { id: 'to_tshirt_k', group: 'Topy', name: 'T-shirt z krótkim rękawem', dl: 27, preset: { gora: 'ramiona', nk: 'okragly', nkb: 'okragly', nd: 2, nw: 1.5, nb: 1, bok: 0, kol: 'brak', ram: 'brak', rek: 'krotki', fit: 'regular', luzG: 6, luzT: 8, luzB: 4, flare: 0 } },
    { id: 'to_tshirt', group: 'Topy', name: 'T-shirt z długim rękawem', dl: 27, preset: { gora: 'ramiona', nk: 'okragly', nkb: 'okragly', nd: 2, nw: 1.5, nb: 1, bok: 0, kol: 'brak', ram: 'brak', rek: 'dlugi', fit: 'regular', luzG: 6, luzT: 8, luzB: 4, flare: 0 } },
    { id: 'to_tshirt_s', group: 'Topy', name: 'Top bez rękawów ze stójką', dl: 25, preset: { gora: 'ramiona', nk: 'okragly', nkb: 'okragly', nd: 1, nw: 0.5, nb: 0.5, bok: 0, kol: 'stojka', kolW: 4, ram: 'brak', rek: 'brak', fit: 'slim', luzG: -4, luzT: 0, luzB: -4, flare: 0 } },
    { id: 'to_stanik', group: 'Topy', name: 'Dopasowany do talii', preset: { gora: 'ramiona', nk: 'okragly', nkb: 'okragly', nd: 2, nw: 1, nb: 0, bok: 0, kol: 'brak', ram: 'brak', rek: 'brak' } },
    { id: 'go_pod', group: 'Gorsety', name: 'Pod biust' },
    { id: 'go_nad', group: 'Gorsety', name: 'Nad biust' },
  ];
  /** @param {WMeas} m @param {WParams} p */
  function draft(m, p, style) {
    const st = STYLES.find((s) => s.id === style) || STYLES[0];
    const title = (st.group === 'Spódnice' ? 'spódnica ' : st.group === 'Gorsety' ? 'gorset ' : st.group === 'Topy' ? 'top ' : 'sukienka ') + st.name.toLowerCase().replace(/ \(.*\)/, '');
    const trenOk = ['su_dopasowana', 'su_trapez', 'su_zakl'].includes(style);
    if (p.tren > 0 && !trenOk) p = Object.assign({}, p, { tren: 0 });
    if (style.indexOf('to_') === 0 && p.rozp > 0) p = Object.assign({}, p, { rozp: 0 }); // top nie ma rozporka
    if (p.gora === 'bez' && (p.marsz || p.kop)) p = Object.assign({}, p, { marsz: false, kop: false }); // marszczenie i kopertę ma tylko stanik z ramionami
    if ((style === 'su_rybka' || style === 'su_rybka_kliny') && !(p.dl >= 50)) p = Object.assign({}, p, { dl: 50 }); // rybka potrzebuje miejsca na falbanę poniżej kolan
    let d;
    const stark = p.baza === 'stark' && /^(su_|to_)/.test(style), mOwn = m; if (stark) m = withStark(m);
    if (style.indexOf('to_tshirt') === 0) { // t-shirt z dzianiny: bez zaszewek (przód tej samej długości co tył), tył ze złożenia, bez zamka
      // krój: slim idzie po talii, regular i oversize mają prosty bok, a dół nie jest węższy niż klatka
      const straight = p.fit !== 'slim'; m = Object.assign({}, m, { adv: Object.assign({}, m.adv, { Dps: full(m).Dts + 0.5 }) }); p = Object.assign({}, p, straight ? { luzB: Math.max(p.luzB, m.og + p.luzG - m.ob), flare: Math.max(0, p.flare) } : {}, { knitStraight: straight, knit: true, gora: 'ramiona', kop: false, marsz: false, zp: 'bok', fac: 'brak', kol: p.kol === 'stojka' ? 'stojka' : 'brak', rozp: 0, sciag: false }); // z kołnierzy dzianina ma tylko stójkę
    }
    if (style === 'go_pod' || style === 'go_nad') d = draftCorset(m, p, title, style === 'go_nad');
    else if (style === 'sk_polkole') d = draftCircle(m, p, 0.5, title);
    else if (style === 'sk_kolo') d = draftCircle(m, p, 1, title);
    else if (style === 'sk_2kola') d = draftCircle(m, p, 2, title);
    else if (style === 'su_polkole') d = draftDress(m, p, 'polkole', title);
    else if (style === 'su_kolo') d = draftDress(m, p, 'kolo', title);
    else if (style === 'su_2kola') d = draftDress(m, p, 'kolo2', title);
    else if (style === 'su_zakl') d = draftDress(m, p, 'zakl', title);
    else if (style === 'to_stanik') d = draftDress(m, p, 'none', title);
    else if (style.indexOf('to_') === 0) d = p.dl < 4 ? draftDress(m, Object.assign({}, p, { crop: Math.max(0, -p.dl), kop: false }), 'none', title) : draftDress(m, p, 'straight', title); // krótki top kończy się w talii albo nad nią
    else if (style === 'su_princeska') d = draftPrincess(m, p, title, false);
    else if (style === 'su_rybka_kliny') d = draftPrincess(m, p, title, true);
    else if (style === 'su_empire') d = draftEmpire(m, p, title);
    else if (style === 'su_rybka') d = draftMermaid(m, p, title);
    else if (style.indexOf('su_') === 0) d = draftDress(m, p, 'straight', title);
    else d = draftSkirt(m, p, style === 'sk_trapez', title);
    const strapless = !!(d.bod && p.gora === 'bez');
    if (strapless) {
      for (const pc of d.pieces) pc.prims = pc.prims.filter((q) => !(q.t === 'text' && q.lab && (q.text === 'pacha' || q.text === 'ramię'))).map((q) => (q.t === 'text' && q.lab && q.text === 'dekolt' ? Object.assign(q, { text: 'górna krawędź' }) : q));
      d.info.rows = d.info.rows.filter((r) => r[0] !== 'Długość ramienia').map((r) => (r[0] === 'Dekolt nad linią biustu' ? ['Góra nad linią biustu, środek', r[1], r[2]] : r));
      d.info.warn = 'Góra bez ramiączek trzyma się tylko na dopasowaniu. Ustaw luz w biuście i w talii na 0 albo ujemny, wszyj fiszbiny w szwy boczne i zaszewki, a górę odszyj podszewką z taśmą silikonową przy krawędzi. ' + (d.info.warn || '').replace(/Dekolt kończy się[^.]*\. Tak głęboki dekolt[^.]*\. /, '');
    }
    if (strapless && (p.ram === 'cienkie' || p.ram === 'szyja')) {
      // ramiączka: prostokąt składany wzdłuż na pół, zapasy są już w wymiarze
      const w = Math.max(0.5, Math.min(4, p.ramW || 1)), halter = p.ram === 'szyja', a2 = full(m);
      const L = halter ? d.bod[0].strapL + a2.os * 0.5 + 25 : d.bod[0].strapL + d.bod[1].strapL + 6, cw = 2 * w + 1.4;
      const pc = mkPiece({ id: 'stanik-ramiaczko', name: halter ? 'RAMIĄCZKO NA SZYJĘ' : 'RAMIĄCZKO', small: true, labelRot: -90, lines: ['wytnij 2× · zapasy w wymiarze'],
        edges: [{ pts: [[0, 0], [cw, 0]], sa: 0 }, { pts: [[cw, 0], [cw, L]], sa: 0 }, { pts: [[cw, L], [0, L]], sa: 0 }, { pts: [[0, L], [0, 0]], sa: 0 }],
        extra: [{ t: 'poly', s: 'aux', pts: [[cw / 2, 0], [cw / 2, L]] }], label: [cw / 2 - 0.5, L / 2] });
      pc.part = 'top'; d.pieces.push(pc);
      d.info.cut.push([halter ? 'Ramiączko na szyję' : 'Ramiączko', '2 × ' + fmt(cw) + ' × ' + fmt(L) + ' cm']);
      d.info.rows.push([halter ? 'Ramiączko z wiązaniem' : 'Ramiączko z zapasem 6 cm', L, null]);
      d.sil.strap = { type: p.ram, w };
    }
    const wrapOn = !!(d.bod && d.bod[0].wrap);
    if (wrapOn) {
      d.info.warn = 'Krawędź kopertowa biegnie po skosie, więc wszyj w nią taśmę stabilizującą i odszyj podszewką albo lamówką. ' + (d.info.warn || '');
      d.sil.wrap = { ext: d.bod[0].wrap.ext, yCross: d.bod[0].wrap.yCross };
      if (p.kol === 'szal') { // kołnierz szalowy: pas wzdłuż krawędzi kopertowej i dekoltu tyłu, zwężony do zera przy talii
        const Fw = d.bod[0].wrap, Bk = d.bod[1], Lf = plen(Fw.neckW), Lb = plen(Bk.neck), w = Math.max(4, Math.min(12, p.kolW || 7));
        let tail = cubic([Lf, 0], [Lf + Lb * 0.4, 0], [Lf + Lb * 0.8, -Lb * 0.15], [Lf + Lb * 0.95, -Lb * 0.33], 14); const kt = Lb / plen(tail); tail = tail.map((q) => [Lf + (q[0] - Lf) * kt, q[1] * kt]);
        const base = []; for (let i = 0; i <= 20; i++) base.push([(Lf * i) / 20, 0]); base.push(...tail.slice(1));
        let acc = 0; const outer = base.map((q, i) => { if (i) acc += Math.hypot(q[0] - base[i - 1][0], q[1] - base[i - 1][1]); const a0 = base[Math.max(0, i - 1)], b0 = base[Math.min(base.length - 1, i + 1)], dd = unit(sub(b0, a0)), t = Math.min(1, acc / (Lf * 0.6)), ww = w * t * t * (3 - 2 * t); return [q[0] - dd[1] * ww, q[1] + dd[0] * ww]; });
        const e = base.length - 1;
        const pc = mkPiece({ id: 'stanik-kolnierz', name: 'KOŁNIERZ SZALOWY', small: true, lines: ['wytnij 4×'],
          edges: [{ pts: base, sa: p.saTalia }, { pts: [base[e], outer[e]], sa: p.saSzew }, { pts: outer.slice(1).reverse().concat([base[0]]), sa: p.saTalia }],
          extra: [notch([Lf, 0], [0, -1], Math.min(0.7, p.saTalia)), txt(Lf, 1.2, 'ramię'), txt(Lf * 0.45, -0.5, 'do krawędzi kopertowej'), txt(base[e][0] - 0.6, base[e][1] + w / 2, 'środek tyłu', 'end')], label: [Lf * 0.7, w * 0.55] });
        pc.part = 'top'; d.pieces.push(pc); d.info.cut.push(['Kołnierz szalowy', '4 ×']); d.info.rows.push(['Kołnierz szalowy: długość wszycia', plen(base), Lf + Lb]);
        d.sil.collar = { type: 'szal', w };
      }
    }
    if (d.bod && p.fac !== 'brak' && !strapless && !wrapOn) {
      const sep = p.fac === 'osobne';
      d.pieces = d.pieces.concat(facingPieces(d.bod[0], true, p, m), facingPieces(d.bod[1], false, p, m));
      d.info.cut = d.info.cut.concat(sep ? [['Odszycie dekoltu przód', '1 × ze złożenia'], ['Odszycie dekoltu tył', '2 ×'], ['Odszycia pach', 'przód 2 ×, tył 2 ×']] : [['Odszycie przód', '1 × ze złożenia'], ['Odszycie tył', '2 ×']]);
    }
    if (d.bod && !strapless && !wrapOn && !p.knit && (p.kol === 'stojka' || p.kol === 'bebe')) {
      const F = d.bod[0], Bk = d.bod[1], Lf = plen(F.neck), Ln = Lf + plen(Bk.neck);
      if (p.kol === 'stojka') { // stójka: pasek długości dekoltu, podniesiony na końcu, żeby górna krawędź była krótsza
        const h = Math.max(2, Math.min(6, p.kolW || 3)); let base = cubic([0, 0], [Ln * 0.45, 0], [Ln * 0.75, -0.4], [Ln, -1.5], 24);
        const k = Ln / plen(base); base = base.map((q) => [q[0] * k, q[1] * k]);
        const top = base.map((q, i) => { const a0 = base[Math.max(0, i - 1)], b0 = base[Math.min(base.length - 1, i + 1)], dd = unit(sub(b0, a0)); return [q[0] + dd[1] * h, q[1] - dd[0] * h]; });
        const sh = alongPts(base, Lf), S = sh[sh.length - 1], e = base.length - 1;
        d.pieces.push(mkPiece({ id: 'stanik-kolnierz', name: 'STÓJKA', small: true, lines: ['wytnij 2× ze złożenia'],
          edges: [{ pts: top, sa: p.saTalia }, { pts: [top[e], base[e]], sa: p.saSzew }, { pts: base.slice().reverse(), sa: p.saTalia }, { pts: [base[0], top[0]], sa: 0, fold: true }],
          extra: [notch(S, [0, 1], Math.min(0.7, p.saTalia)), txt(S[0], S[1] - 0.5, 'ramię'), txt(Ln - 0.6, base[e][1] - h / 2, 'środek tyłu', 'end'), txt(0.5, -h / 2 + 0.2, 'złożenie', 'start'), txt(Ln * 0.3, -0.4, 'do dekoltu')], label: [Ln * 0.62, -h / 2 - 0.3] }));
        d.info.cut.push(['Stójka', '2 × ze złożenia']); d.info.rows.push(['Długość dekoltu (połowa)', Ln, null]);
        if (F.C[1] - F.NP[1] > 9 || p.nw > 2) d.info.warn = 'Stójka pasuje do dekoltu przy szyi. Przy tym dekolcie będzie odstawać, zmniejsz jego głębokość i szerokość. ' + (d.info.warn || '');
      } else { // kołnierz bebe: leży płasko, rysowany na dekolcie przodu i tyłu złożonych ramionami
        const w = Math.max(3, Math.min(12, p.kolW || 6)), fl = (q) => [q[0], -q[1]], o = fl(Bk.NP), rl = Math.hypot(Bk.SP[0] - Bk.NP[0], Bk.SP[1] - Bk.NP[1]) || 1;
        const ang = BETA.front + BETA.back + Math.atan(1.5 / rl), T = (q) => add(F.NP, rot(sub(fl(q), o), [0, 0], ang));
        const N = F.neck.concat(Bk.neck.slice().reverse().map(T).slice(1)), e = N.length - 1;
        let outer = insetCurve(N, w).filter((q, i, arr) => i === 0 || i === arr.length - 1 || i % 3 === 0); // rzadsze punkty i wygładzenie, żeby na złożeniu ramion nie było załamania
        for (let it = 0; it < 6; it++) outer = outer.map((q, i) => (i === 0 || i === outer.length - 1 ? q : [(outer[i - 1][0] + 2 * q[0] + outer[i + 1][0]) / 4, (outer[i - 1][1] + 2 * q[1] + outer[i + 1][1]) / 4]));
        const oe = outer.length - 1;
        if (outer.length > 4) {
          const mi = Math.floor(e * 0.45), mo = Math.floor(oe * 0.45);
          d.pieces.push(mkPiece({ id: 'stanik-kolnierz', name: 'KOŁNIERZ BEBE', small: true, lines: ['wytnij 4×'],
            edges: [{ pts: N, sa: p.saTalia }, { pts: [N[e], outer[oe]], sa: p.saSzew }, { pts: outer.slice().reverse(), sa: p.saTalia }, { pts: [outer[0], N[0]], sa: p.saTalia }],
            extra: [notch(F.NP, unit(sub(F.NP, outer[Math.floor(oe * Lf / Ln)])), Math.min(0.7, p.saTalia)), txt(F.NP[0] + 1.2, F.NP[1] + 0.3, 'ramię', 'start')], label: [(N[mi][0] + outer[mo][0]) / 2, (N[mi][1] + outer[mo][1]) / 2] }));
          d.info.cut.push(['Kołnierz bebe', '4 ×']); d.info.rows.push(['Długość dekoltu (połowa)', Ln, null]);
        }
      }
    }
    if (d.bod && !strapless && !(p.bok > 0) && (p.rek === 'krotki' || p.rek === '34' || p.rek === 'dlugi' || p.rek === 'bufka')) {
      // rękaw wszywany: główka liczona z długości pachy przodu i tyłu, z wdaniem 2 cm
      const F = d.bod[0], Bk = d.bod[1], AHf = plen(F.arm), AHb = plen(Bk.arm), AH = AHf + AHb, ease = p.knit ? 0 : 2, chord = (q) => Math.hypot(q[q.length - 1][0] - q[0][0], q[q.length - 1][1] - q[0][1]), cS = chord(F.arm) + chord(Bk.arm),
        // szerokość rękawa z podręcznika: szerokość pachy plus 4 cm, liczona na połowie rękawa; główka jest obniżana, jeśli rękaw wyszedłby od niej węższy
        wSt = m.og / 4 + 12 + Math.max(0, p.luzG - 6) / 2, capW = (hh) => { const cp = (k) => { const wf = Math.sqrt(Math.max(4, AHf * AHf * k * k - hh * hh)), wb = Math.sqrt(Math.max(4, AHb * AHb * k * k - hh * hh)); return [wf + wb, plen(cubic([-wb, hh], [-wb * 0.55, hh], [-wb * 0.42, 0], [0, 0], 22)) + plen(cubic([0, 0], [wf * 0.4, 0], [wf * 0.5, hh], [wf, hh], 22))]; }; let lo2 = 0.6, hi2 = 1.6; for (let it = 0; it < 30; it++) { const k = (lo2 + hi2) / 2; if (cp(k)[1] < AH + 2) lo2 = k; else hi2 = k; } return cp((lo2 + hi2) / 2)[0]; },
        hSt = (() => { let h = Math.max(AH * 0.27, Math.min(AH * 0.4, 0.45 * cS - 2)); for (let it = 0; it < 12 && h > AH * 0.27 && capW(h) < wSt * 0.95; it++) h -= 0.4; return h; })(),
        H = p.knit ? AH * 0.26 : stark ? hSt : AH * 0.31, // podręcznik: wysokość główki = połowa sumy cięciw pachy minus jedna dwudziesta tej sumy minus 2 cm
         armL = 0.345 * (m.wzrost || 168);
      const puff = p.rek === 'bufka', L = Math.max(H + 6, puff ? 21 : p.rekL > 0 ? Math.min(armL + 8, p.rekL) : p.rek === 'krotki' ? 22 : p.rek === '34' ? armL * 0.75 : armL); // długość rękawa od ramienia: własna albo domyślna dla rodzaju
      const capOf = (k) => {
        const wf = Math.sqrt(Math.max(4, AHf * AHf * k * k - H * H)), wb = Math.sqrt(Math.max(4, AHb * AHb * k * k - H * H));
        const back = cubic([-wb, H], [-wb * 0.55, H], [-wb * 0.42, 0], [0, 0], 22), front = cubic([0, 0], [wf * 0.4, 0], [wf * 0.5, H], [wf, H], 22);
        return { wf, wb, back, front, len: plen(back) + plen(front) };
      };
      let lo = 0.6, hi = 1.6; for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (capOf(mid).len < AH + ease) lo = mid; else hi = mid; }
      const c = capOf((lo + hi) / 2), bic0 = c.wf + c.wb;
      if (puff) { // bufka: rękaw poszerzony o 9 cm i podniesiony w główce o 3,5 cm, nadmiar marszczy się w główce i przy dole
        const kx = (bic0 + 9) / bic0, up = (q) => [q[0] * kx, q[1] - 3.5 * (1 - q[1] / H)]; c.back = c.back.map(up); c.front = c.front.map(up); c.wf *= kx; c.wb *= kx; c.len = plen(c.back) + plen(c.front);
      }
      const topP = c.front[0], bic = c.wf + c.wb, hemW = puff ? bic : Math.min(bic - 1, p.rek === 'krotki' ? bic - 3 : p.rek === '34' ? Math.max(26, bic * 0.72) : 24), t = (bic - hemW) / 2;
      const cuff = p.rek === '34' && p.mank, nf = c.front[Math.round(c.front.length * 0.62)], nb1 = c.back[Math.round(c.back.length * 0.36)], nb2 = c.back[Math.round(c.back.length * 0.42)];
      const pc = mkPiece({
        id: 'stanik-rekaw', name: 'RĘKAW', lines: ['wytnij 2×', title, m.name],
        edges: [{ pts: c.back.concat(c.front.slice(1)), sa: p.saSzew, lab: 'główka', split: c.back.length - 1 }, { pts: [[c.wf, H], [c.wf - t, L]], sa: p.saSzew, lab: 'szew rękawa' }, { pts: [[c.wf - t, L], [-c.wb + t, L]], sa: cuff ? p.saSzew : 3, lab: 'dół' }, { pts: [[-c.wb + t, L], [-c.wb, H]], sa: p.saSzew, tag: 'underB' }],
        extra: (stark && L - H > 25 ? [{ t: 'poly', s: 'aux', pts: [[-c.wb + t * ((L - H) / 2 - 2) / (L - H), H + (L - H) / 2 - 2], [c.wf - t * ((L - H) / 2 - 2) / (L - H), H + (L - H) / 2 - 2]] }, txt(0, H + (L - H) / 2 - 2.4, 'linia łokcia')] : []).concat([{ t: 'poly', s: 'aux', pts: [[-c.wb, H], [c.wf, H]] }, notch(topP, [0, -1], Math.min(0.7, p.saSzew)), txt(0, topP[1] + 1.4, 'ramię'), notch(nf, [0.6, -0.8], Math.min(0.7, p.saSzew)), notch(nb1, [-0.6, -0.8], Math.min(0.7, p.saSzew)), notch(nb2, [-0.6, -0.8], Math.min(0.7, p.saSzew)),
          txt(c.wf * 0.55, H - 0.6, 'przód'), txt(-c.wb * 0.55, H - 0.6, 'tył')]),
        label: [0, H + (L - H) * 0.45], grain: { x: Math.min(c.wf, c.wb) * 0.45, y0: H + 2, y1: L - 2.5 },
      });
      pc.part = 'top'; d.pieces.push(pc); d.info.cut.push(['Rękaw', '2 ×']);
      if (puff) { d.info.rows.push(['Główka bufki: do zmarszczenia między nacinkami', c.len - AH, null], ['Dół bufki: zebrać do', bic0 - 3, null], ['Długość bufki od ramienia', L + 3.5, null]); d.info.cut.push(['Lamówka dołu bufki', '2 × ' + fmt(bic0 - 3 + 2 * p.saSzew) + ' × 5 cm']); }
      else d.info.rows.push(['Główka rękawa z wdaniem ' + ease + ' cm', c.len, AH + ease], ['Rękaw w bicepsie', bic, null], ['Długość rękawa od ramienia', L, null]);
      if (p.falR) { const Lr = (puff ? bic0 - 3 : hemW) * 1.8; d.pieces.push(rectPc('stanik-falbanka-rekaw', 'FALBANKA RĘKAWA', Lr, 7, 'wytnij 2× · marszczyć do ' + fmt(puff ? bic0 - 3 : hemW, 0) + ' cm')); d.info.cut.push(['Falbanka rękawa', '2 × ' + fmt(Lr, 0) + ' × 7 cm']); }
      if (cuff) {
        const cw = hemW + 2 * p.saSzew, ch = 12 + 2 * p.saSzew;
        const pk = mkPiece({ id: 'stanik-mankiet', name: 'MANKIET', small: true, lines: ['wytnij 2× · zapasy w wymiarze'], edges: [{ pts: [[0, 0], [cw, 0]], sa: 0 }, { pts: [[cw, 0], [cw, ch]], sa: 0 }, { pts: [[cw, ch], [0, ch]], sa: 0 }, { pts: [[0, ch], [0, 0]], sa: 0 }], extra: [{ t: 'poly', s: 'aux', pts: [[0, ch / 2], [cw, ch / 2]] }], label: [cw / 2, ch / 2 - 1.2] });
        pk.part = 'top'; d.pieces.push(pk); d.info.cut.push(['Mankiet', '2 × ' + fmt(cw) + ' × ' + fmt(ch) + ' cm']);
      }
      d.sil.sleeve = { L, bic, hem: puff ? bic0 - 3 : hemW, H, puff, ruf: p.falR ? 5 : 0 };
    }
    if (d.bod && p.pasT > 0 && d.sil.lower === 'circle') {
      // pasek w talii: połowa obwodu od złożenia na środku przodu do zamka z tyłu, naszywany na szew talii
      const h = Math.max(2, Math.min(12, p.pasT)), Lp = (m.ot + p.luzT) / 2;
      const pk = mkPiece({ id: 'pasek-talia', name: 'PASEK W TALII', small: true, lines: ['wytnij 2× ze złożenia'],
        edges: [{ pts: [[0, 0], [Lp, 0]], sa: p.saTalia }, { pts: [[Lp, 0], [Lp, h]], sa: p.saSzew }, { pts: [[Lp, h], [0, h]], sa: p.saTalia }, { pts: [[0, h], [0, 0]], sa: 0, fold: true }],
        extra: [notch([Lp / 2, 0], [0, -1], Math.min(0.7, p.saTalia)), txt(Lp / 2, 1, 'szew boczny'), txt(0.5, h / 2 + 0.3, 'złożenie', 'start'), txt(Lp - 0.5, h / 2 + 0.3, 'środek tyłu', 'end')], label: [Lp * 0.3, h / 2 + 0.1] });
      d.pieces.push(pk); d.info.cut.push(['Pasek w talii', '2 × ze złożenia (wierzch i spód)']); d.sil.band = h;
      d.info.rows.push(['Pasek w talii', 2 * Lp, m.ot + p.luzT]);
    }
    if (d.bod && p.falN) { // falbanka przy dekolcie: prostokąt 1,8 raza dłuższy od krawędzi, marszczony
      const F = d.bod[0], Bk = d.bod[1], Ln2 = 2 * (strapless ? plen(F.neck) + plen(F.arm) + plen(Bk.neck) + plen(Bk.arm) : (F.wrap ? plen(F.wrap.neckW) : plen(F.neck)) + plen(Bk.neck)), parts = Ln2 * 1.8 > 140 ? 2 : 1, Lr = (Ln2 * 1.8) / parts;
      d.pieces.push(rectPc('stanik-falbanka-dekolt', 'FALBANKA DEKOLTU', Lr, 7, 'wytnij ' + parts + '× · marszczyć do ' + fmt(Ln2 / parts, 0) + ' cm')); d.info.cut.push(['Falbanka dekoltu', parts + ' × ' + fmt(Lr, 0) + ' × 7 cm']);
      if (!strapless) d.sil.ruffN = 5;
    }
    if (d.bod && p.sciag) d.sil.sciag = -Math.min(-2.5, d.bod[0].yg + 7);
    if (p.tren > 0 && trenOk) { d.sil.tren = p.tren; d.info.rows.push(['Tren: wydłużenie na środku tyłu', p.tren, null]); }
    if (d.bod && !strapless) { // informacje dla podglądu 3D: kołnierz i położenie zaszewki piersiowej
      if (p.bok > 0) d.sil.bok = d.bod[0].r;
      if (!wrapOn && d.pieces.some((pc) => pc.id === 'stanik-kolnierz')) d.sil.collar = { type: p.kol, w: p.kol === 'stojka' ? Math.max(2, Math.min(6, p.kolW || 3)) : Math.max(3, Math.min(12, p.kolW || 6)) };
      if (d.bod[0].edgesTop) d.sil.zp = p.zp; else if (d.bod[0].alpha && !(d.sil.seams && d.sil.seams.pr)) d.sil.zp = 'bok';
    }
    if (p.layers && p.layers.length > 1) {
      // warstwa wierzchnia może mieć własny, obfitszy dół: z koła, z półkola albo marszczony prostokąt
      const emp = d.sil.lower === 'empire', attC = emp ? d.sil.seamC : m.ot + p.luzT, attL = (emp ? d.sil.yE + p.dl : p.dl) + 1;
      p.layers.forEach((L, i) => {
        L.own = false; L.gather = null;
        if (L.role !== 'narzutka' || (d.bod && L.zakres === 'gora') || !L.forma || L.forma === 'te_same') return;
        L.own = true;
        if (L.forma === 'marszczona') { L.gather = [Math.round(attC * 1.8), Math.round(attL + 2), Math.round(attC)]; return; }
        const c = circlePiece(attC, attL, L.forma === 'kolo' ? 1 : 0.5, m, p, title, 0, 'WARSTWA WIERZCHNIA: DÓŁ', 'narzutka-dol-' + i);
        c.piece.part = 'overlay'; c.piece.layer = L; d.pieces.push(c.piece);
      });
      d.layers = buildLayers(p.layers, d, m, p, p.fabName || ((x) => x));
      if (p.layers.some((L) => L.role === 'podszewka' && (!d.bod || L.zakres !== 'gora'))) for (const pc of d.pieces) if (pc.part !== 'overlay') for (const q of pc.hemIn || []) {
        const mid = q[Math.floor(q.length / 2)];
        pc.prims.push({ t: 'poly', s: 'aux', pts: q }, { t: 'text', x: mid[0], y: mid[1] - 0.4, text: 'dół podszewki', size: 'S', anchor: 'middle', lab: true });
      }
      for (const pc of d.pieces) { const n = d.layers.notes[pc.id]; if (n && pc.noteAt) pc.prims.push({ t: 'text', x: pc.noteAt[0], y: pc.noteAt[1], text: 'krój z: ' + n.join(', '), size: 'S', anchor: 'middle' }); }
    }
    { // dodatki opisowe: prostokąty liczone z wymiarów wykroju (falbany, paski, szarfy, kokardy, lamówki)
      const F = d.bod && d.bod[0], Bk = d.bod && d.bod[1], stl = !!(d.bod && p.gora === 'bez');
      d.bases = {
        talia: d.corset ? d.sil.c.waist : m.ot + (p.luzT || 0), biodra: m.ob + (p.luzB || 0), biust: m.og + (p.luzG || 0), dol: d.sil.hemC || 0,
        dekolt: F ? 2 * (stl ? plen(F.neck) + plen(F.arm) + plen(Bk.neck) + plen(Bk.arm) : (F.wrap ? plen(F.wrap.neckW) : plen(F.neck)) + plen(Bk.neck)) : 0,
        pacha: F && !stl ? plen(F.arm) + plen(Bk.arm) : 0, rekaw: d.sil.sleeve ? d.sil.sleeve.hem : 0, stala: 0,
      };
      (Array.isArray(p.extras) ? p.extras : []).slice(0, 12).forEach((ex, i) => {
        if (!ex || !(ex.base in d.bases)) return; const base = d.bases[ex.base]; if (ex.base !== 'stala' && !(base > 0)) return;
        const k = Math.max(0.2, Math.min(4, +ex.k || 1)), fin = Math.max(3, Math.min(600, base * 1)), Ltot = Math.max(3, Math.min(900, base * k + (+ex.plus || 0))), w = Math.max(1, Math.min(60, +ex.w || 5)), n = Math.max(1, Math.min(8, Math.round(+ex.n || 1)));
        const parts = Math.ceil(Ltot / 150), Lp = Ltot / parts, h = w + 2, name = String(ex.name || 'Dodatek').slice(0, 40);
        const pc = rectPc('dodatek-' + (i + 1), name.toUpperCase(), Lp, h, 'wytnij ' + n * parts + '×' + (k > 1.05 && ex.base !== 'stala' ? ' · marszczyć do ' + fmt(fin / parts, 0) + ' cm' : '') + ' · zapasy w wymiarze'); pc.part = 'both';
        d.pieces.push(pc); d.info.cut.push([name, n * parts + ' × ' + fmt(Lp, 0) + ' × ' + fmt(h) + ' cm']);
      });
    }
    if (['sk_prosta', 'sk_olowkowa', 'sk_trapez'].includes(style) && m.ot + p.luzT > m.ob + p.luzB + 0.2) d.info.warn = 'Talia z luzem wychodzi szersza niż biodra z luzem, więc wykrój trzyma szerokość bioder i nie zgadza się w talii. Zmniejsz luz w talii albo zwiększ luz w biodrach. ' + (d.info.warn || '');
    if (p.knit && d.bod) { // ściągacz dekoltu: pasek krótszy od krawędzi, wszywany z naciągiem
      const neckL = 2 * (plen(d.bod[0].neck) + plen(d.bod[1].neck)), stand = p.kol === 'stojka'; let note = '';
      d.info.cut = d.info.cut.map((c) => (c[0] === 'Tył' ? ['Tył', '1 × ze złożenia'] : c));
      if (stand) { // stójka z dzianiny: pas złożony na pół wzdłuż, nieco krótszy od dekoltu
        const h = Math.max(2, Math.min(12, p.kolW || 4)), Ln = neckL * 0.9, pc = rectPc('stanik-kolnierz', 'STÓJKA', Ln + 2, 2 * h + 2, 'wytnij 1× w poprzek dzianiny · złóż na pół wzdłuż · wszyć z lekkim naciągiem'); d.pieces.push(pc);
        d.info.cut.push(['Stójka', '1 × ' + fmt(Ln + 2, 0) + ' × ' + fmt(2 * h + 2, 0) + ' cm']); d.sil.collar = { type: 'stojka', w: h };
        if (neckL < 56) note = 'Dekolt ma ' + fmt(neckL, 0) + ' cm, a głowa około 56 cm, więc dzianina musi się rozciągać co najmniej o ' + Math.ceil(((56 / neckL - 1) * 100) / 5) * 5 + '%. Przy sztywniejszej poszerz dekolt albo dodaj rozcięcie na karku. ';
      } else { const Ln = d.bases.dekolt * 0.85, pc = rectPc('sciagacz-dekolt', 'ŚCIĄGACZ DEKOLTU', Ln + 2, 5, 'wytnij 1× w poprzek dzianiny · wszyć z naciągiem'); d.pieces.push(pc); d.info.cut.push(['Ściągacz dekoltu', '1 × ' + fmt(Ln + 2, 0) + ' × 5 cm']); }
      if (!d.pieces.some((q) => q.id === 'stanik-rekaw')) { // bez rękawów: pachy wykańcza lamówka z tej samej dzianiny
        const La = (plen(d.bod[0].arm) + plen(d.bod[1].arm)) * 0.9, pc = rectPc('lamowka-pachy', 'LAMÓWKA PACHY', La + 2, 4, 'wytnij 2× w poprzek dzianiny · wszyć z naciągiem'); d.pieces.push(pc); d.info.cut.push(['Lamówka pachy', '2 × ' + fmt(La + 2, 0) + ' × 4 cm']);
      }
      d.info.warn = 'Wykrój na dzianinę: bez zaszewek i bez zamka, przód i tył ze złożenia. Luz 0 albo ujemny dla elastycznej dzianiny. Szyj ściegiem elastycznym albo na overlocku. ' + note + (d.info.warn || '').replace(/Góra korzysta[^.]*\.\s*/, '');
      d.knit = true;
    }
    if (stark && d.bod) { const sb = starkBase(mOwn), a2 = full(m); d.info.rows.push(['Głębokość pachy od karku (podręcznik)', a2.Gp - (a2.Dts - a2.Dt), sb.SP], ['Szerokość tyłu, połowa (podręcznik)', a2.St / 2, null], ['Szerokość przodu, połowa (podręcznik)', a2.Sp / 2, null]); d.baza = 'stark'; }
    d.title = title.charAt(0).toUpperCase() + title.slice(1);
    d.notions = notions(d, m, p);
    for (const pc of d.pieces) declutter(pc);
    return d;
  }

  // ---------- podpisy: rozsuwanie nachodzących na siebie, w ostateczności pominięcie ----------
  function tbox(q) {
    const w = q.text.length * (q.size === 'L' ? 0.85 : 0.4), h = q.size === 'L' ? 1.6 : 0.85, x0 = q.anchor === 'middle' ? -w / 2 : q.anchor === 'end' ? -w : 0;
    const r = ((q.rot || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), lx = x0 + w / 2, ly = -h * 0.35;
    const cx = q.x + lx * c - ly * s, cy = q.y + lx * s + ly * c, hw = (w * Math.abs(c) + h * Math.abs(s)) / 2, hh = (w * Math.abs(s) + h * Math.abs(c)) / 2;
    return [cx - hw, cy - hh, cx + hw, cy + hh];
  }
  function declutter(pc) {
    const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const texts = pc.prims.filter((q) => q.t === 'text'), placed = texts.filter((q) => !q.lab).map(tbox), drop = new Set();
    for (const q of texts.filter((t) => t.lab)) {
      const r = ((q.rot || 0) * Math.PI) / 180, d = [Math.cos(r), Math.sin(r)], x = q.x, y = q.y; let ok = false;
      for (const k of [0, 1.6, -1.6, 3.2, -3.2, 4.8, -4.8, 6.4, -6.4]) {
        q.x = x + d[0] * k; q.y = y + d[1] * k; const bx = tbox(q);
        if (!placed.some((o) => hit(bx, o))) { placed.push(bx); ok = true; break; }
      }
      if (!ok) drop.add(q);
    }
    if (drop.size) pc.prims = pc.prims.filter((q) => !drop.has(q));
  }

  // ---------- dodatki krawieckie ----------
  const ZIPS = [12, 16, 18, 20, 22, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
  /** @param {WMeas} m @param {WParams} p */
  function notions(d, m, p) {
    if (d.knit) return [['Nici elastyczne albo overlock', '1 komplet'], ['Igła do dzianin (jersey albo stretch)', '1 szt.'], ['Taśma stabilizująca na szwy ramion', fmt(Math.round(2 * d.bod[0].r + 6), 0) + ' cm']];
    if (d.corset) {
      const c = d.corset, bl = (v) => Math.floor((v - 2) * 2) / 2, mm = (v) => fmt(v / 100, 1) + ' m';
      const per = c.bones.slice(0, c.n - 1).map((v) => fmt(bl(v))).join(', ');
      return [['Fiszbiny spiralne w szwach', 2 * (c.n - 1) + ' szt.: po 2 × ' + per + ' cm'], ['Fiszbiny płaskie przy oczkach', '4 szt. po ' + fmt(bl(c.hCb)) + ' cm'],
        ['Zapięcie z przodu', 'brykla ' + fmt(Math.floor(bl(c.bones[0] + 1))) .replace(',0', '') + ' cm albo przód zszyty i 2 fiszbiny płaskie'], ['Oczka z podkładkami', c.eyelets + ' szt.'],
        ['Sznurek', mm(Math.ceil((c.eyelets * (c.gg + 9) + 160) / 50) * 50)], ['Taśma na tunele', mm(Math.ceil((2 * c.bones.reduce((s, v) => s + v, 0) + 4 * c.hCb) / 10) * 10 + 20)],
        ['Lamówka na górę i dół', mm(Math.ceil((c.top + c.bottom) / 10) * 10 + 30)], ['Taśma w talii (stabilizująca)', mm(Math.ceil(d.info.rows[3][1] / 10) * 10 + 10)], ['Drelich gorsetowy na warstwę spodnią', 'około 0,5 m'], ['Mocne nici', '1 szpulka']];
    }
    const out = [], dress = !!d.bod, open = dress ? -d.bod[1].C[1] + (d.sil.lower === 'none' ? -(d.sil.crop || 0) : d.sil.lower === 'circle' ? Math.min(m.wb, p.dl - 5) : Math.min(m.wb, Math.max(0, p.dl))) : Math.min(m.wb, p.dl - 5);
    const zip = ZIPS.find((z) => z >= open - 0.5) || Math.ceil(open);
    out.push([d.sil.lower === 'none' ? 'Zamek rozdzielczy' : 'Zamek kryty', zip + ' cm (rozcięcie ' + Math.round(open) + ' cm)']);
    d.zip = { open, len: zip };
    if (!dress && p.pasek > 0) out.push(['Fizelina na pasek', fmt(m.ot + p.luzT + 3, 0) + ' × ' + fmt(p.pasek) + ' cm'], ['Haftka albo guzik do paska', '1 szt.']);
    if (dress && p.gora === 'bez') out.push(['Fiszbiny do wszycia', '6 do 8 szt., długość od górnej krawędzi do talii'], ['Taśma silikonowa', fmt((m.og + p.luzG) / 100, 1) + ' m'], ['Podszewka na górę', 'około 0,5 m']);
    else if (dress && p.fac !== 'brak') out.push(['Fizelina na odszycia', 'około 0,4 m']);
    if (dress) out.push(['Haftka nad zamkiem', '1 szt.']);
    if (dress && p.sciag) out.push(['Guma pod biust', fmt(Math.round((isFinite(m.opx) && m.opx !== null ? m.opx : m.og - 14) * 0.85), 0) + ' cm, szerokość 1 cm']);
    out.push(['Nici w kolorze tkaniny', (d.sil.hemC || 0) > 300 ? '2 szpulki' : '1 szpulka']);
    return out;
  }

  // ---------- zużycie tkaniny: półki wzdłuż długości, nitka prosta zachowana ----------
  function usage(pieces, width) {
    const items = pieces.map((pc) => { const mt = /(\d+)\s*×/.exec(pc.cut || ''); return { w: pc.box.x1 - pc.box.x0, h: pc.box.y1 - pc.box.y0, cnt: mt ? +mt[1] : 1, fold: /złożenia/.test(pc.cut || ''), name: pc.name }; });
    const run = (folded) => {
      const Wd = folded ? width / 2 : width, rects = [];
      for (const it of items) {
        const n = folded ? (it.fold ? it.cnt : Math.ceil(it.cnt / 2)) : it.cnt; let w = !folded && it.fold ? 2 * it.w : it.w, h = it.h;
        if (w > Wd + 0.01 && h <= Wd && /KOŁ|KÓŁ|KOLA|FALBANA|WARSTWA/.test(it.name)) { const t = w; w = h; h = t; } // klosze można obrócić
        for (let i = 0; i < n; i++) rects.push({ w, h });
      }
      if (rects.some((r) => r.w > Wd + 0.01)) return null;
      rects.sort((a, b) => b.h - a.h); const rows = [];
      for (const r of rects) { const row = rows.find((q) => q.used + r.w <= Wd + 0.01); if (row) row.used += r.w + 1; else rows.push({ used: r.w + 1, h: r.h }); }
      return rows.reduce((s, q) => s + q.h + 1, 0) * 1.05;
    };
    const a = run(true), b = run(false);
    if (a === null && b === null) return { len: null, wide: items.filter((it) => it.w > width).map((it) => it.name) };
    const folded = a !== null && (b === null || a <= b * 1.15);
    return { len: folded ? a : b, folded };
  }

  // ---------- układ i podział na strony ----------
  function layout(pieces, gap, maxW) {
    const prims = [], boxes = [];
    const list = maxW ? pieces.slice().sort((a, b) => (b.box.y1 - b.box.y0) - (a.box.y1 - a.box.y0)) : pieces;
    let x = 0.5, y = 0.5, rowH = 0, w = 0, col = null;
    for (const pc of list) {
      const pw = pc.box.x1 - pc.box.x0, ph = pc.box.y1 - pc.box.y0; let px, py;
      if (maxW && col && pw <= col.w + 0.01 && col.y + ph <= y + rowH + 0.01) { px = col.x; py = col.y; col.y += ph + gap; }
      else {
        if (maxW && x > 0.5 && x + pw > maxW) { x = 0.5; y += rowH + gap; rowH = 0; }
        px = x; py = y; col = { x, w: pw, y: y + ph + gap }; x += pw + gap; rowH = Math.max(rowH, ph); w = Math.max(w, x - gap);
      }
      const dx = px - pc.box.x0, dy = py - pc.box.y0;
      for (const q of pc.prims) {
        if (q.t === 'poly') prims.push(Object.assign({}, q, { pts: q.pts.map((a) => [a[0] + dx, a[1] + dy]) }));
        else prims.push(Object.assign({}, q, { x: q.x + dx, y: q.y + dy }));
      }
      boxes.push({ id: pc.id, x0: px, y0: py, x1: px + pw, y1: py + ph });
    }
    return { prims, boxes, w: w + 0.5, h: y + rowH + 0.5 };
  }
  const A4 = { w: 21, h: 29.7, margin: 1 };
  const PAPER = { a4: { w: 21, h: 29.7 }, a3: { w: 29.7, h: 42 } };
  // układ oszczędzający papier: próbuje kilku szerokości rzędu i bierze ten z najmniejszą liczbą kartek
  function pack(pieces, gap, fmtId) {
    let best = null;
    const P = PAPER[fmtId] || PAPER.a4, cand = [0];
    for (let k = 1; k <= 14; k++) cand.push(k * (P.w - 2) + 0.4, k * (P.h - 2) + 0.4);
    for (const mw of cand) {
      const lay = layout(pieces, gap, mw || undefined), n = tiles(lay, fmtId).pages.length, area = lay.w * lay.h;
      if (!best || n < best.n || (n === best.n && area < best.area)) best = { lay, n, area };
    }
    return best.lay;
  }
  function tiles(lay, fmtId) {
    if (fmtId === 'one') return { fmt: 'one', single: true, landscape: lay.w > lay.h, tw: lay.w, th: lay.h, cols: 1, rows: 1, pages: [{ r: 0, c: 0, x: 0, y: 0, label: 'A1' }] };
    const P = PAPER[fmtId] || PAPER.a4;
    const mk = (landscape) => {
      const tw = (landscape ? P.h : P.w) - 2 * A4.margin, th = (landscape ? P.w : P.h) - 2 * A4.margin;
      const cols = Math.ceil(lay.w / tw - 1e-6), rows = Math.ceil(lay.h / th - 1e-6), pages = [];
      // kartka jest potrzebna tylko wtedy, gdy faktycznie przechodzi przez nią jakaś linia albo opis
      const used = new Set(), mark = (x, y) => used.add(Math.min(rows - 1, Math.max(0, Math.floor(y / th))) * 1000 + Math.min(cols - 1, Math.max(0, Math.floor(x / tw))));
      for (const q of lay.prims) {
        if (q.t !== 'poly') { mark(q.x, q.y); continue; }
        if (q.s === 'grid') continue;
        const n = q.pts.length, mm = q.closed ? n : n - 1;
        for (let i = 0; i < mm; i++) { const a = q.pts[i], b = q.pts[(i + 1) % n], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.8)); for (let j = 0; j <= k; j++) mark(a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k); }
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (used.has(r * 1000 + c)) pages.push({ r, c, x: c * tw, y: r * th, label: String.fromCharCode(65 + r) + (c + 1) });
      return { fmt: PAPER[fmtId] ? fmtId : 'a4', landscape, tw, th, cols, rows, pages };
    };
    const a = mk(false), b = mk(true);
    return b.pages.length < a.pages.length ? b : a;
  }
  function clipPoly(pts, closed, r) {
    const runs = [];
    let cur = null;
    const n = pts.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1];
      let t0 = 0, t1 = 1, ok = true;
      const P = [-dx, dx, -dy, dy], Q = [a[0] - r.x0, r.x1 - a[0], a[1] - r.y0, r.y1 - a[1]];
      for (let k = 0; k < 4; k++) {
        if (Math.abs(P[k]) < 1e-12) { if (Q[k] < 0) { ok = false; break; } }
        else { const t = Q[k] / P[k]; if (P[k] < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; } else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; } }
      }
      if (!ok) { cur = null; continue; }
      const s = [a[0] + dx * t0, a[1] + dy * t0], e = [a[0] + dx * t1, a[1] + dy * t1];
      if (cur && t0 === 0) cur.push(e); else { cur = [s, e]; runs.push(cur); }
      if (t1 < 1) cur = null;
    }
    return runs;
  }

  // ---------- PDF ----------
  const STY = {
    zip: { w: 0.3, c: [20, 24, 40] }, cut: { w: 0.5, c: [20, 24, 40] }, sew: { w: 0.25, c: [20, 24, 40], dash: [3, 2] }, fold: { w: 0.5, c: [20, 24, 40], dash: [8, 2, 1.5, 2] },
    dart: { w: 0.3, c: [20, 24, 40] }, notch: { w: 0.5, c: [20, 24, 40] }, aux: { w: 0.2, c: [110, 115, 130], dash: [1.2, 1.5] }, grain: { w: 0.35, c: [20, 24, 40] },
  };
  function fmt(v, d) { return v.toFixed(d === undefined ? 1 : d).replace('.', ','); }

  function makePdf(jsPDF, fontB64, lay, tl, meta) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    doc.addFileToVFS('w.ttf', fontB64); doc.addFont('w.ttf', 'W', 'normal'); doc.setFont('W');
    const path = (pts, st, closed) => {
      doc.setLineWidth(st.w); doc.setDrawColor(st.c[0], st.c[1], st.c[2]); doc.setLineDashPattern(st.dash || [], 0);
      doc.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
      if (closed) doc.close();
      doc.stroke();
    };
    doc.setTextColor(20, 24, 40); doc.setFontSize(20); doc.text(meta.title, 15, 22);
    doc.setFontSize(10); doc.setTextColor(90, 95, 110); doc.text(meta.sub, 15, 29);
    let y = 40;
    for (const row of meta.rows) {
      doc.setTextColor(90, 95, 110); doc.text(row[0], 15, y); doc.setTextColor(20, 24, 40);
      const w = doc.splitTextToSize(row[1], 135); doc.text(w, 62, y); y += 5.2 * w.length + 0.8;
    }
    y += 5; doc.setFontSize(12); doc.text('Zanim zaczniesz ciąć', 15, y); y += 7; doc.setFontSize(10);
    for (const ln of meta.howto) { const w = doc.splitTextToSize(ln, 180); doc.text(w, 15, y); y += 5.2 * w.length + 1.5; }
    y += 4; doc.setFontSize(12); doc.text('Schemat sklejania', 15, y); y += 5;
    const sc = Math.min(180 / (tl.cols * tl.tw), (285 - y) / (tl.rows * tl.th));
    const X = (v) => 15 + v * sc, Y = (v) => y + v * sc;
    for (const t of tl.pages) {
      doc.setLineDashPattern([], 0); doc.setLineWidth(0.2); doc.setDrawColor(150, 155, 170);
      doc.rect(X(t.x), Y(t.y), tl.tw * sc, tl.th * sc);
      doc.setFontSize(Math.max(5, Math.min(11, tl.tw * sc * 0.28))); doc.setTextColor(150, 155, 170); doc.text(t.label, X(t.x) + 1, Y(t.y) + tl.th * sc * 0.3);
    }
    for (const q of lay.prims) if (q.t === 'poly' && q.s === 'cut') path(q.pts.map((a) => [X(a[0]), Y(a[1])]), { w: 0.4, c: [20, 24, 40] }, true);

    for (const sec of meta.extra || []) { // strony z instrukcją (warstwy, kolejność szycia)
      doc.addPage('a4', 'portrait'); let yy = 22;
      doc.setTextColor(20, 24, 40); doc.setFontSize(16); doc.text(sec.title, 15, yy); yy += 10;
      for (const blk of sec.blocks) {
        if (yy > 265) { doc.addPage('a4', 'portrait'); yy = 20; }
        if (blk.h) { doc.setFontSize(11.5); doc.setTextColor(20, 24, 40); doc.text(blk.h, 15, yy); yy += 6; }
        doc.setFontSize(9.5);
        for (const ln of blk.lines) { const w = doc.splitTextToSize(ln, 176); if (yy + 4.6 * w.length > 285) { doc.addPage('a4', 'portrait'); yy = 20; } doc.setTextColor(60, 64, 80); doc.text(w, 19, yy); yy += 4.6 * w.length + 1.2; }
        yy += 4;
      }
    }
    const mg = A4.margin * 10;
    for (const t of tl.pages) {
      doc.addPage(tl.single ? [(tl.tw + 2) * 10, (tl.th + 2) * 10] : tl.fmt, tl.landscape ? 'landscape' : 'portrait');
      const r = { x0: t.x, y0: t.y, x1: t.x + tl.tw, y1: t.y + tl.th };
      const TX = (v) => mg + (v - t.x) * 10, TY = (v) => mg + (v - t.y) * 10, W = tl.tw * 10, Hh = tl.th * 10;
      doc.setLineDashPattern([], 0); doc.setLineWidth(0.15); doc.setDrawColor(150, 155, 170); doc.rect(mg, mg, W, Hh);
      const dia = (cx, cy) => path([[cx - 3, cy], [cx, cy - 3], [cx + 3, cy], [cx, cy + 3]], { w: 0.15, c: [150, 155, 170] }, true);
      const has = (rr, cc) => tl.pages.some((u) => u.r === rr && u.c === cc);
      doc.setFontSize(8); doc.setTextColor(150, 155, 170);
      if (has(t.r, t.c + 1)) { dia(mg + W, mg + Hh / 2); doc.text(String.fromCharCode(65 + t.r) + (t.c + 2), mg + W - 4, mg + Hh / 2 - 5, { align: 'right' }); }
      if (has(t.r, t.c - 1)) { dia(mg, mg + Hh / 2); doc.text(String.fromCharCode(65 + t.r) + t.c, mg + 4, mg + Hh / 2 - 5); }
      if (has(t.r + 1, t.c)) { dia(mg + W / 2, mg + Hh); doc.text(String.fromCharCode(66 + t.r) + (t.c + 1), mg + W / 2 + 5, mg + Hh - 3); }
      if (has(t.r - 1, t.c)) { dia(mg + W / 2, mg); doc.text(String.fromCharCode(64 + t.r) + (t.c + 1), mg + W / 2 + 5, mg + 5); }
      doc.setFontSize(16); doc.text(t.label, mg + 4, mg + 9);
      const bx = mg + 4, by = mg + Hh - 5;
      doc.setLineWidth(0.2); doc.setDrawColor(120, 125, 140); doc.line(bx, by, bx + 100, by);
      for (let i = 0; i <= 10; i++) doc.line(bx + i * 10, by, bx + i * 10, by - (i % 5 === 0 ? 3 : 1.5));
      doc.setFontSize(7); doc.text('odcinek kontrolny 10 cm', bx + 103, by);
      for (const q of lay.prims) {
        if (q.t === 'poly') {
          const st = STY[q.s]; if (!st) continue;
          for (const run of clipPoly(q.pts, q.closed, r)) path(run.map((a) => [TX(a[0]), TY(a[1])]), st, false);
        } else if ((!q.lab || meta.labels !== false) && q.x >= r.x0 && q.x <= r.x1 && q.y >= r.y0 && q.y <= r.y1) {
          doc.setTextColor(20, 24, 40); doc.setFontSize(q.size === 'L' ? 14 : 8);
          if (q.rot) { // obrócony tekst: wyrównanie liczone ręcznie wzdłuż kierunku tekstu
            const w = doc.getTextWidth(q.text), k = q.anchor === 'middle' ? 0.5 : q.anchor === 'end' ? 1 : 0, th = (q.rot * Math.PI) / 180;
            doc.text(q.text, TX(q.x) - Math.cos(th) * w * k, TY(q.y) - Math.sin(th) * w * k, { angle: -q.rot });
          } else doc.text(q.text, TX(q.x), TY(q.y), { align: q.anchor === 'middle' ? 'center' : q.anchor === 'end' ? 'right' : 'left' });
        }
      }
    }
    return doc.output('arraybuffer');
  }

  const api = { starkBase, withStark, draft, STYLES, ADV, ROLES, estimate, full, layout, pack, usage, tiles, makePdf, fmt, A4 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Wykroj = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
