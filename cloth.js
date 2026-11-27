/* Zszywanie ubrania z elementów wykroju i układanie go na sylwetce.
   Elementy (przód, tył, rękaw) są zamieniane na siatki trójkątów w ich płaskim kształcie z wykroju,
   zszywane wzdłuż szwów i zaszewek, a potem tkanina opada na ciało pod własnym ciężarem.
   Długości w siatce pochodzą z wykroju, więc podgląd pokazuje to, co naprawdę wyjdzie z tych elementów. */
(function (root) {
  'use strict';
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const plen = (p) => { let l = 0; for (let i = 1; i < p.length; i++) l += dist(p[i - 1], p[i]); return l; };
  function ptAt(pts, s) {
    let a = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = dist(pts[i - 1], pts[i]);
      if (a + l >= s - 1e-9 || i === pts.length - 1) { const t = l > 0 ? Math.min(1, Math.max(0, (s - a) / l)) : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
      a += l;
    }
    return pts[pts.length - 1].slice();
  }
  function sub(pts, s0, s1) { // fragment łamanej między długościami s0 i s1
    const out = [ptAt(pts, s0)]; let acc = 0;
    for (let i = 1; i < pts.length; i++) { acc += dist(pts[i - 1], pts[i]); if (acc > s0 + 1e-6 && acc < s1 - 1e-6) out.push(pts[i].slice()); }
    out.push(ptAt(pts, s1)); return out;
  }
  function locate(pts, p) { // długość wzdłuż łamanej do punktu p i odległość od niej
    let best = 1e9, bs = 0, acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], l = dist(a, b), t = l > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (l * l))) : 0;
      const d = Math.hypot(a[0] + (b[0] - a[0]) * t - p[0], a[1] + (b[1] - a[1]) * t - p[1]);
      if (d < best) { best = d; bs = acc + l * t; }
      acc += l;
    }
    return [bs, best];
  }
  function inPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }

  // triangulacja Delaunaya (Bowyer-Watson); punktów jest kilkaset na element, więc wystarcza prosta wersja
  function delaunay(P) {
    const n = P.length; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const dm = Math.max(x1 - x0, y1 - y0) * 20, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, V = P.concat([[mx - dm, my - dm], [mx + dm, my - dm], [mx, my + dm]]);
    const circ = (a, b, c) => { const A = V[a], B = V[b], C = V[c], d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])); if (Math.abs(d) < 1e-12) return [0, 0, -1];
      const ux = ((A[0] * A[0] + A[1] * A[1]) * (B[1] - C[1]) + (B[0] * B[0] + B[1] * B[1]) * (C[1] - A[1]) + (C[0] * C[0] + C[1] * C[1]) * (A[1] - B[1])) / d, uy = ((A[0] * A[0] + A[1] * A[1]) * (C[0] - B[0]) + (B[0] * B[0] + B[1] * B[1]) * (A[0] - C[0]) + (C[0] * C[0] + C[1] * C[1]) * (B[0] - A[0])) / d;
      return [ux, uy, (A[0] - ux) * (A[0] - ux) + (A[1] - uy) * (A[1] - uy)]; };
    let T = [{ v: [n, n + 1, n + 2], c: circ(n, n + 1, n + 2) }];
    for (let i = 0; i < n; i++) {
      const p = V[i], bad = [], keep = [];
      for (const t of T) { const c = t.c; if (c[2] >= 0 && (p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]) < c[2] - 1e-10) bad.push(t); else keep.push(t); }
      const E = new Map();
      for (const t of bad) for (let k = 0; k < 3; k++) { const a = t.v[k], b = t.v[(k + 1) % 3], key = a < b ? a * 100000 + b : b * 100000 + a; if (E.has(key)) E.set(key, null); else E.set(key, [a, b]); }
      T = keep; E.forEach((e) => { if (e) T.push({ v: [e[0], e[1], i], c: circ(e[0], e[1], i) }); });
    }
    return T.filter((t) => t.v[0] < n && t.v[1] < n && t.v[2] < n).map((t) => t.v);
  }

  // obrys elementu jako pierścień łańcuchów; każdy łańcuch ma rolę (tag)
  function ringOf(pc) {
    const ch = []; for (const e of pc.ed) { const pts = e.pts.map((p) => [p[0], p[1]]); if (plen(pts) > 1e-6) ch.push({ pts, tag: e.tag }); }
    return ch;
  }
  function clipRing(ch, axis, val, keepLess, newTag) {
    const ins = (p) => (keepLess ? p[axis] <= val + 1e-9 : p[axis] >= val - 1e-9), cut = (a, b) => { const t = (val - a[axis]) / (b[axis] - a[axis]); const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; q[axis] = val; return q; };
    const V = []; for (const c of ch) for (let i = 0; i < c.pts.length - 1; i++) V.push({ a: c.pts[i], b: c.pts[i + 1], tag: c.tag, c });
    if (V.every((e) => ins(e.a))) return ch;
    let st = V.findIndex((e) => ins(e.a) && ins(e.b)); if (st < 0) return ch;
    const out = []; let cur = null, exit = null;
    const add = (a, b, tag, src) => { if (dist(a, b) < 1e-7) return; if (cur && cur.tag === tag && cur.src === src) cur.pts.push(b); else { cur = { pts: [a, b], tag, src }; out.push(cur); } };
    for (let k = 0; k < V.length; k++) {
      const e = V[(st + k) % V.length], ia = ins(e.a), ib = ins(e.b);
      if (ia && ib) add(e.a, e.b, e.tag, e.c);
      else if (ia && !ib) { const X = cut(e.a, e.b); add(e.a, X, e.tag, e.c); exit = X; }
      else if (!ia && ib) { const X = cut(e.a, e.b); if (exit) add(exit, X, newTag, null); exit = null; add(X, e.b, e.tag, e.c); }
    }
    if (out.length > 1 && out[0].tag === out[out.length - 1].tag && out[0].src === out[out.length - 1].src) { const l = out.pop(); out[0].pts = l.pts.concat(out[0].pts.slice(1)); }
    return out.map((c) => ({ pts: c.pts, tag: c.tag }));
  }
  // zaszewki: klin z ujściem na krawędzi staje się wcięciem w obrysie, romb w środku elementu staje się otworem; ich boki są potem zszywane
  function notch(ch, darts, flipX) {
    const holes = []; let k = 0;
    for (const d0 of darts) {
      const D = d0.pts.map((p) => [flipX ? -p[0] : p[0], p[1]]), n = D.length;
      if (d0.closed && n === 4) { holes.push({ left: [D[0], D[1], D[2]], right: [D[0], D[3], D[2]] }); continue; }
      const find = (A, B) => { for (let i = 0; i < ch.length; i++) { const la = locate(ch[i].pts, A), lb = locate(ch[i].pts, B); if (la[1] < 0.02 && lb[1] < 0.02 && !/^d[LR]/.test(ch[i].tag)) return [i, la[0], lb[0]]; } return null; };
      let lo = 0, hi = n - 1, f = find(D[0], D[n - 1]); if (!f && n >= 5) { lo = 1; hi = n - 2; f = find(D[1], D[n - 2]); }
      if (!f) continue;
      const mid = Math.floor(n / 2), c = ch[f[0]], L = plen(c.pts), fwd = f[1] <= f[2], s1 = Math.min(f[1], f[2]), s2 = Math.max(f[1], f[2]);
      const legA = D.slice(lo, mid + 1), legB = D.slice(mid, hi + 1), first = fwd ? legA : legB.slice().reverse(), second = fwd ? legB : legA.slice().reverse();
      const rep = []; if (s1 > 0.05) rep.push({ pts: sub(c.pts, 0, s1), tag: c.tag });
      rep.push({ pts: first, tag: 'dL' + k }, { pts: second, tag: 'dR' + k }); if (L - s2 > 0.05) rep.push({ pts: sub(c.pts, s2, L), tag: c.tag });
      if (c.tag === 'mouth') rep.forEach((r) => { if (r.tag === 'mouth') r.tag = 'free'; });
      ch.splice(f[0], 1, ...rep); k++;
    }
    for (const c of ch) if (c.tag === 'mouth') c.tag = 'free';
    return holes;
  }

  function build(d, o) {
    const h = o.h || 1.6, pcs = {}; for (const pc of d.pieces) if (pc.ed) pcs[pc.id] = pc;
    const srcF = pcs['przod'] || pcs['stanik-przod'], srcB = pcs['tyl'] || pcs['stanik-tyl'], srcS = o.sleeve ? pcs['stanik-rekaw'] : null;
    if (!srcF || !srcB) return null;
    const parts = {};
    const prep = (pc, key, half) => {
      let ch = ringOf(pc);
      const darts = pc.prims.filter((q) => q.s === 'dart' && q.pts && q.pts.length >= 3);
      let x0 = 1e9, x1 = -1e9; for (const c of ch) for (const p of c.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
      const dneg = darts.length && darts.every((q) => q.pts.every((p) => p[0] <= 0.01)), flip = half && dneg && x1 > 1;
      if (half) ch = clipRing(ch, 0, 0, false, 'center');
      if (half && o.cutY != null) ch = clipRing(ch, 1, o.cutY, true, 'bottom');
      const holes = notch(ch, darts, flip).filter((hh) => o.cutY == null || hh.left[2][1] < o.cutY - 0.3);
      ch = ch.filter((c) => plen(c.pts) > 1e-4); ch.forEach((c) => { c.len = plen(c.pts); c.segs = []; });
      parts[key] = { key, ch, holes, half };
    };
    prep(srcF, 'F', true); prep(srcB, 'B', true); if (srcS) prep(srcS, 'S', false);
    // pary zszywanych krawędzi; podział na wspólne odcinki, żeby po obu stronach szwu wypadło tyle samo węzłów
    const N = {}, side = (pk, tag, rev) => { let cs = parts[pk].ch.filter((c) => c.tag === tag); if (rev) cs = cs.slice().reverse(); return { cs, rev }; };
    const pair = (id, A, B) => {
      if (!A.cs.length || !B.cs.length) return false;
      const fr = (S) => { const T = S.cs.reduce((s, c) => s + c.len, 0); let a = 0; const out = []; for (const c of S.cs) { out.push([a / T, (a + c.len) / T, c]); a += c.len; } return out; };
      const fa = fr(A), fb = fr(B); let U = [0, 1]; for (const r of fa.concat(fb)) U.push(r[0], r[1]); U.sort((x, y) => x - y); U = U.filter((v, i) => i === 0 || v - U[i - 1] > 0.035); U[U.length - 1] = 1;
      const seg = [];
      for (const [S, R, nm] of [[A, fa, 'a'], [B, fb, 'b']]) for (let k = 0; k < U.length - 1; k++) {
        const m = (U[k] + U[k + 1]) / 2, r = R.find((q) => m >= q[0] - 1e-9 && m <= q[1] + 1e-9) || R[R.length - 1], c = r[2];
        const l0 = Math.max(0, Math.min(c.len, ((U[k] - r[0]) / (r[1] - r[0])) * c.len)), l1 = Math.max(0, Math.min(c.len, ((U[k + 1] - r[0]) / (r[1] - r[0])) * c.len));
        c.segs.push(S.rev ? { s0: c.len - l1, s1: c.len - l0, key: id + ':' + k, sd: nm, rev: true } : { s0: l0, s1: l1, key: id + ':' + k, sd: nm, rev: false });
        seg[k] = (seg[k] || 0) + (l1 - l0) / 2;
      }
      seg.forEach((l, k) => { N[id + ':' + k] = Math.max(1, Math.round(l / h)); });
      return true;
    };
    pair('sh', side('F', 'shoulder'), side('B', 'shoulder')); pair('sd', side('F', 'side'), side('B', 'side'));
    if (parts.S) { pair('cf', side('S', 'capF'), side('F', 'arm')); pair('cb', side('S', 'capB', true), side('B', 'arm')); pair('un', side('S', 'underF'), side('S', 'underB', true)); }
    // węzły na obrysie, w otworach i w środku; triangulacja
    for (const pk in parts) {
      const P = parts[pk], pts = [], ring = [], seam = {}, legs = {}, bot = [];
      const put = (p) => { pts.push([p[0], p[1]]); return pts.length - 1; };
      let firstId = -1, prev = -1;
      P.ch.forEach((c, ci) => {
        let segs = c.segs.slice().sort((a, b) => a.s0 - b.s0);
        if (!segs.length) segs = [{ s0: 0, s1: c.len, n: Math.max(1, Math.round(c.len / h)) }];
        segs[0].s0 = 0; segs[segs.length - 1].s1 = c.len; for (let i = 1; i < segs.length; i++) segs[i].s0 = segs[i - 1].s1;
        const ids = [];
        segs.forEach((sg, si) => {
          const n = sg.key ? N[sg.key] : sg.n, loc = [];
          for (let i = 0; i <= n; i++) {
            let id;
            if (i === 0 && si === 0) id = prev >= 0 ? prev : (firstId = put(c.pts[0]));
            else if (i === 0) id = ids[ids.length - 1];
            else if (i === n && si === segs.length - 1 && ci === P.ch.length - 1) id = firstId;
            else id = put(ptAt(c.pts, sg.s0 + ((sg.s1 - sg.s0) * i) / n));
            loc.push(id); if (!(i === 0 && ids.length)) ids.push(id);
          }
          if (sg.key) seam[sg.key + sg.sd] = sg.rev ? loc.slice().reverse() : loc;
        });
        prev = ids[ids.length - 1]; c.ids = ids;
        for (let i = 0; i < ids.length - 1; i++) ring.push(ids[i]);
        if (/^d[LR]/.test(c.tag)) legs[c.tag] = ids;
      });
      const holePolys = [], weld = [];
      for (const k in legs) if (k[1] === 'L') { const L = legs[k], R = legs['dR' + k.slice(2)]; if (R && R.length === L.length) for (let i = 0; i < L.length; i++) weld.push([L[i], R[R.length - 1 - i]]); }
      for (const hh of P.holes) {
        const mk = (path, share) => { const out = []; for (let s = 0; s < 2; s++) { const a = path[s], b = path[s + 1], n = Math.max(1, Math.round(dist(a, b) / h)); for (let i = s ? 1 : 0; i <= n; i++) { const t = i / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; };
        const lp = mk(hh.left), rp = mk(hh.right), li = lp.map(put), ri = rp.map((p, i) => (i === 0 ? li[0] : i === rp.length - 1 ? li[li.length - 1] : put(p)));
        if (li.length === ri.length) for (let i = 1; i < li.length - 1; i++) weld.push([li[i], ri[i]]);
        holePolys.push(lp.concat(rp.slice(1, -1).reverse()));
      }
      const poly = ring.map((i) => pts[i]), nb = pts.length;
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for (const p of poly) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
      const bsegs = []; for (let i = 0; i < ring.length; i++) bsegs.push([pts[ring[i]], pts[ring[(i + 1) % ring.length]]]); for (const hp of holePolys) for (let i = 0; i < hp.length; i++) bsegs.push([hp[i], hp[(i + 1) % hp.length]]);
      const dy = h * 0.866; let row = 0;
      for (let y = by0 + dy * 0.5; y < by1; y += dy, row++) for (let x = bx0 + (row % 2 ? h * 0.5 : h * 0.02); x < bx1; x += h) {
        const p = [x + ((pts.length * 7919) % 13 - 6) * 2e-4, y + ((pts.length * 104729) % 11 - 5) * 2e-4];
        if (!inPoly(p, poly) || holePolys.some((hp) => inPoly(p, hp))) continue;
        let near = false; for (const s of bsegs) { const a = s[0], b = s[1], l2 = (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]), t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2)) : 0; if (Math.hypot(a[0] + (b[0] - a[0]) * t - p[0], a[1] + (b[1] - a[1]) * t - p[1]) < h * 0.55) { near = true; break; } }
        if (!near) pts.push(p);
      }
      const tris = delaunay(pts).filter((t) => {
        const A = pts[t[0]], B = pts[t[1]], C = pts[t[2]], c = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3], ar = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]));
        return ar > 1e-3 && inPoly(c, poly) && !holePolys.some((hp) => inPoly(c, hp));
      });
      // węzły dolnej krawędzi z położeniem od środka do boku (do przypięcia w talii albo na biodrach)
      { const bc = P.ch.filter((c) => c.tag === 'bottom'); let tot = bc.reduce((s, c) => s + c.len, 0), acc = 0; const first = bc[0];
        if (bc.length && P.half) { const centerFirst = Math.abs(first.pts[0][0]) < Math.abs(bc[bc.length - 1].pts[bc[bc.length - 1].pts.length - 1][0]);
          for (const c of bc) { const m = c.ids.length - 1; for (let i = 0; i <= m; i++) { const s = (acc + (c.len * i) / m) / tot; bot.push([c.ids[i], centerFirst ? s : 1 - s]); } acc += c.len; } } }
      // szerokość elementu na danej wysokości (do wstępnego ułożenia wokół ciała)
      let sideTop = null, sideX = null;
      if (P.half) { const sc = P.ch.filter((c) => c.tag === 'side' || /^d[LR]/.test(c.tag) && false), sp = []; for (const c of sc) for (const p of c.pts) sp.push(p); sp.sort((a, b) => a[1] - b[1]);
        if (sp.length) { sideTop = sp[0][1]; sideX = (y) => { if (y <= sp[0][1]) return sp[0][0]; for (let i = 1; i < sp.length; i++) if (y <= sp[i][1]) { const t = (y - sp[i - 1][1]) / (sp[i][1] - sp[i - 1][1] || 1); return sp[i - 1][0] + (sp[i][0] - sp[i - 1][0]) * t; } return sp[sp.length - 1][0]; }; } }
      Object.assign(P, { pts, nb, tris, seam, weld, bot, top: by0, sideTop, sideX, box: [bx0, by0, bx1, by1] });
    }
    // egzemplarze: przód i tył z dwóch lustrzanych połówek, rękawy prawy i lewy
    const inst = [], gid = []; let ng = 0;
    const addInst = (pk, sx) => {
      const P = parts[pk], map = new Int32Array(P.pts.length), I = { pk, sx, P, map, base: ng };
      for (let i = 0; i < P.pts.length; i++) { const twin = P.half && sx < 0 && Math.abs(P.pts[i][0]) < 1e-6 ? inst.find((q) => q.pk === pk && q.sx > 0) : null; if (twin) map[i] = twin.map[i]; else { map[i] = ng++; gid.push([pk, sx, P.pts[i][0], P.pts[i][1]]); } }
      inst.push(I); return I;
    };
    const F1 = addInst('F', 1), F2 = addInst('F', -1), B1 = addInst('B', 1), B2 = addInst('B', -1), S1 = parts.S ? addInst('S', 1) : null, S2 = parts.S ? addInst('S', -1) : null;
    const par = new Int32Array(ng); for (let i = 0; i < ng; i++) par[i] = i;
    const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }, uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[Math.max(a, b)] = Math.min(a, b); };
    for (const I of inst) for (const w of I.P.weld) uni(I.map[w[0]], I.map[w[1]]);
    const sew = (IA, IB, id) => { for (const k in IA.P.seam) if (k.indexOf(id + ':') === 0 && k[k.length - 1] === 'a') { const a = IA.P.seam[k], b = IB.P.seam[k.slice(0, -1) + 'b']; if (b && a.length === b.length) for (let i = 0; i < a.length; i++) uni(IA.map[a[i]], IB.map[b[i]]); } };
    sew(F1, B1, 'sh'); sew(F2, B2, 'sh'); sew(F1, B1, 'sd'); sew(F2, B2, 'sd');
    if (S1) { sew(S1, F1, 'cf'); sew(S1, B1, 'cb'); sew(S1, S1, 'un'); sew(S2, F2, 'cf'); sew(S2, B2, 'cb'); sew(S2, S2, 'un'); }
    const sid = new Int32Array(ng).fill(-1); let ns = 0; for (let i = 0; i < ng; i++) { const r = find(i); if (sid[r] < 0) sid[r] = ns++; sid[i] = sid[r]; }
    // siatka do rysowania zachowuje osobne wierzchołki po obu stronach szwu (każdy element ma własny układ nitek), symulacja liczy na zszytych
    const rmap = [], ruv = [], tri = [], grp = [], meta = new Array(ns), pin = new Float32Array(ns).fill(-1), E = new Map(), TE = new Map();
    for (const I of inst) {
      const off = rmap.length, P = I.P;
      for (let i = 0; i < P.pts.length; i++) { const s = sid[I.map[i]]; rmap.push(s); ruv.push(P.pts[i][0] * I.sx, P.pts[i][1]); if (!meta[s]) meta[s] = { pk: I.pk, sx: I.sx, u: P.pts[i][0], v: P.pts[i][1] }; }
      for (const b of P.bot) pin[sid[I.map[b[0]]]] = b[1];
      const t0 = tri.length / 3;
      for (const t of P.tris) {
        const a = off + t[0], b = off + (I.sx > 0 ? t[1] : t[2]), c = off + (I.sx > 0 ? t[2] : t[1]); tri.push(a, b, c);
        const loc = I.sx > 0 ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]];
        for (let k = 0; k < 3; k++) {
          const i0 = loc[k], i1 = loc[(k + 1) % 3], s0 = sid[I.map[i0]], s1 = sid[I.map[i1]]; if (s0 === s1) continue;
          const key = s0 < s1 ? s0 * 65536 + s1 : s1 * 65536 + s0, len = dist(P.pts[i0], P.pts[i1]), e = E.get(key);
          if (e) { e[2] = (e[2] * e[3] + len) / (e[3] + 1); e[3]++; } else E.set(key, [Math.min(s0, s1), Math.max(s0, s1), len, 1]);
          const opp = loc[(k + 2) % 3], A = P.pts[i0], Bp = P.pts[i1], O = P.pts[opp], hgt = Math.abs((Bp[0] - A[0]) * (O[1] - A[1]) - (Bp[1] - A[1]) * (O[0] - A[0])) / (len || 1), te = TE.get(key); if (te) te.push([I, opp, hgt]); else TE.set(key, [[I, opp, hgt]]);
        }
      }
      grp.push({ pk: I.pk, sx: I.sx, t0, t1: tri.length / 3, v0: off, v1: rmap.length });
    }
    // marszczenie: dolna krawędź elementu ściągnięta do krótszej długości (dół rękawa wszyty w mankiet)
    if (o.gather) for (const I of inst) { const k = o.gather[I.pk]; if (!(k > 0 && k < 1)) continue; for (const c of I.P.ch) if (c.tag === 'bottom' && c.ids) for (let i = 0; i < c.ids.length - 1; i++) { const s0 = sid[I.map[c.ids[i]]], s1 = sid[I.map[c.ids[i + 1]]]; if (s0 === s1) continue; const e = E.get(s0 < s1 ? s0 * 65536 + s1 : s1 * 65536 + s0); if (e) e[2] *= k; } }
    const edges = Array.from(E.values()).map((e) => [e[0], e[1], Math.max(0.05, e[2])]), bends = [];
    // zgięcie przez krawędź: odległość wierzchołków naprzeciw niej po rozłożeniu na płasko; przez szew liczona z wysokości obu trójkątów, bo elementy leżą w wykroju osobno
    TE.forEach((l) => { if (l.length !== 2) return; const s0 = sid[l[0][0].map[l[0][1]]], s1 = sid[l[1][0].map[l[1][1]]]; if (s0 === s1) return; const flat = l[0][2] + l[1][2], same = l[0][0] === l[1][0] ? dist(l[0][0].P.pts[l[0][1]], l[1][0].P.pts[l[1][1]]) : 1e9; bends.push([s0, s1, same < flat * 1.25 ? same : flat * 0.97]); });
    // linie szwów do narysowania
    const seams = [], chain = (I, ids) => ids.map((i) => sid[I.map[i]]);
    for (const I of [F1, F2]) { for (const k in I.P.seam) if (/^(sh|sd):/.test(k)) seams.push(chain(I, I.P.seam[k])); for (const c of I.P.ch) if (/^dL/.test(c.tag)) seams.push(chain(I, c.ids)); }
    for (const I of [B1, B2]) for (const c of I.P.ch) if (/^dL/.test(c.tag)) seams.push(chain(I, c.ids));
    { const c = B1.P.ch.find((q) => q.tag === 'center'); if (c) seams.push(chain(B1, c.ids)); }
    if (S1) for (const I of [S1, S2]) for (const k in I.P.seam) if (/^(cf|cb|un):.*a$/.test(k)) seams.push(chain(I, I.P.seam[k]));
    // linia dekoltu jako zamknięta pętla węzłów: środek przodu, prawe ramię, środek tyłu, lewe ramię
    const neck = []; { const nk = (I, rev) => { let tags = I.P.ch.filter((q) => q.tag === 'neck'); if (!tags.length && I.pk === 'F') tags = I.P.ch.filter((q) => q.tag === 'free'); let ids = []; for (const q of tags) ids = ids.concat(q.ids); if (rev) ids.reverse(); for (const i of ids) { const s = sid[I.map[i]]; if (neck[neck.length - 1] !== s) neck.push(s); } };
      nk(F1, false); nk(B1, true); nk(B2, false); nk(F2, true); if (neck.length > 2 && neck[0] === neck[neck.length - 1]) neck.pop(); }
    const hold = []; for (const I of [F1, F2, B1, B2]) for (const c of I.P.ch) if (c.tag === 'neck' || c.tag === 'arm') for (const i of c.ids) hold.push(sid[I.map[i]]);
    const info = { F: { top: parts.F.top, sideTop: parts.F.sideTop, sideX: parts.F.sideX }, B: { top: parts.B.top, sideTop: parts.B.sideTop, sideX: parts.B.sideX }, S: parts.S ? { box: parts.S.box } : null };
    return { h, hold, neck, ns, nr: rmap.length, rmap: Int32Array.from(rmap), ruv: Float32Array.from(ruv), tri: Int32Array.from(tri), grp, meta, pin, edges, bends, seams, info };
  }

  // układanie tkaniny: XPBD z małymi krokami czasu (wzorem solvera seamer-studio).
  // Jednostki: centymetry i sekundy. Krawędzie siatki trzymają długości z wykroju z podatnością zależną od tkaniny,
  // zgięcia stawiają opór tylko przy składaniu, ciało odpycha tkaninę i hamuje ją tarciem.
  // Z GarmentCode: najpierw kilka klatek bez grawitacji (szwy się schodzą), przytrzymanie wskazanych węzłów na wysokości, zatrzymanie po uspokojeniu.
  function sim(g, o) {
    const n = g.ns, X = new Float32Array(n * 3), Pv = new Float32Array(n * 3), V = new Float32Array(n * 3), w = new Uint8Array(n).fill(1), kind = new Uint8Array(n), holdY = new Float32Array(n).fill(-1e9), CN = new Float32Array(n * 3), hitF = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const m = g.meta[i], p = o.init(m, g.pin[i]); X[i * 3] = p[0]; X[i * 3 + 1] = p[1]; X[i * 3 + 2] = p[2]; kind[i] = m.pk === 'S' ? 1 : 0;
      if (o.pinned && g.pin[i] >= 0 && m.pk !== 'S') { const q = o.pinPos(m, g.pin[i]); if (q) { X[i * 3] = q[0]; X[i * 3 + 1] = q[1]; X[i * 3 + 2] = q[2]; w[i] = 0; } } }
    if (o.hold && g.hold) for (const i of g.hold) holdY[i] = X[i * 3 + 1] - (o.holdSlack || 0);
    const E = g.edges, B = g.bends, ne = E.length, nb = B.length, ei = new Int32Array(ne * 2), er = new Float32Array(ne), bi = new Int32Array(nb * 2), br = new Float32Array(nb);
    for (let k = 0; k < ne; k++) { ei[k * 2] = E[k][0]; ei[k * 2 + 1] = E[k][1]; er[k] = E[k][2]; } for (let k = 0; k < nb; k++) { bi[k * 2] = B[k][0]; bi[k * 2 + 1] = B[k][1]; br[k] = B[k][2]; }
    const sub = o.subSteps || 14, dt = 1 / 60 / sub, G = (o.gravity || 981) * dt * dt, zeroG = o.zeroGravityFrames == null ? 8 : o.zeroGravityFrames;
    const aS = (o.stretchCompliance == null ? 2e-8 : o.stretchCompliance) / (dt * dt), aC = (o.compressCompliance == null ? 2e-6 : o.compressCompliance) / (dt * dt), aB = (o.bendCompliance == null ? 1e-5 : o.bendCompliance) / (dt * dt);
    const mu = o.friction == null ? 0.4 : o.friction, damp = 1 - (o.damping == null ? 0.012 : o.damping), maxMove = (o.maxVelocity || 220) * dt;
    const S = { X, steps: 0, done: false, max: o.steps || 150, moved: 1 }, q = [0, 0, 0];
    const substep = (gs) => {
      // przewidywanie położeń
      for (let i = 0; i < n; i++) { if (!w[i]) continue; const j = i * 3; Pv[j] = X[j]; Pv[j + 1] = X[j + 1]; Pv[j + 2] = X[j + 2]; let vx = V[j], vy = V[j + 1] - G * gs, vz = V[j + 2]; const l = Math.sqrt(vx * vx + vy * vy + vz * vz); if (l > maxMove) { const k = maxMove / l; vx *= k; vy *= k; vz *= k; } X[j] += vx; X[j + 1] += vy; X[j + 2] += vz; }
      // długości krawędzi: rozciąganie prawie niemożliwe, ściskanie miękkie (tkanina się marszczy, a nie skraca)
      for (let k = 0; k < ne; k++) {
        const a = ei[k * 2] * 3, b = ei[k * 2 + 1] * 3, dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-7) continue;
        const wa = w[a / 3], wb = w[b / 3], ws = wa + wb; if (!ws) continue; const C = d - er[k], lam = C / ((ws + (C > 0 ? aS : aC)) * d), cx = dx * lam, cy = dy * lam, cz = dz * lam;
        if (wa) { X[a] += cx; X[a + 1] += cy; X[a + 2] += cz; } if (wb) { X[b] -= cx; X[b + 1] -= cy; X[b + 2] -= cz; }
      }
      // zgięcia: wierzchołki naprzeciw wspólnej krawędzi trzymają odległość z płaskiego wykroju, opór tylko przy składaniu
      for (let k = 0; k < nb; k++) {
        const a = bi[k * 2] * 3, b = bi[k * 2 + 1] * 3, dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-7 || d >= br[k]) continue;
        const wa = w[a / 3], wb = w[b / 3], ws = wa + wb; if (!ws) continue; const lam = (d - br[k]) / ((ws + aB) * d), cx = dx * lam, cy = dy * lam, cz = dz * lam;
        if (wa) { X[a] += cx; X[a + 1] += cy; X[a + 2] += cz; } if (wb) { X[b] -= cx; X[b + 1] -= cy; X[b + 2] -= cz; }
      }
      // ciało: wypchnięcie na powierzchnię i tarcie (ruch wzdłuż skóry maleje o współczynnik tarcia razy głębokość wejścia)
      for (let i = 0; i < n; i++) {
        if (!w[i]) continue; const j = i * 3; hitF[i] = 0;
        if (X[j + 1] < holdY[i]) X[j + 1] = holdY[i];
        q[0] = X[j]; q[1] = X[j + 1]; q[2] = X[j + 2]; if (!o.collide(q, kind[i])) continue;
        let nx = q[0] - X[j], ny = q[1] - X[j + 1], nz = q[2] - X[j + 2]; const pen = Math.sqrt(nx * nx + ny * ny + nz * nz); if (pen < 1e-9) continue;
        if (pen > 2.5) { q[0] = Pv[j]; q[1] = Pv[j + 1]; q[2] = Pv[j + 2]; o.collide(q, kind[i]); X[j] = q[0]; X[j + 1] = q[1]; X[j + 2] = q[2]; Pv[j] = q[0]; Pv[j + 1] = q[1]; Pv[j + 2] = q[2]; continue; } // głębokie wejście: powrót do poprzedniego położenia, żeby tkanina nie przeszła przez ciało na wylot
        nx /= pen; ny /= pen; nz /= pen; X[j] = q[0]; X[j + 1] = q[1]; X[j + 2] = q[2];
        CN[j] = nx; CN[j + 1] = ny; CN[j + 2] = nz; hitF[i] = 1;
        const mx = X[j] - Pv[j], my = X[j + 1] - Pv[j + 1], mz = X[j + 2] - Pv[j + 2], dn = mx * nx + my * ny + mz * nz, tx = mx - nx * dn, ty = my - ny * dn, tz = mz - nz * dn, tl = Math.sqrt(tx * tx + ty * ty + tz * tz); if (tl < 1e-9) continue;
        const f = Math.min(tl, mu * pen) / tl; X[j] -= tx * f; X[j + 1] -= ty * f; X[j + 2] -= tz * f;
      }
      // prędkości z przesunięć
      let mv = 0; for (let i = 0; i < n; i++) { if (!w[i]) continue; const j = i * 3; V[j] = (X[j] - Pv[j]) * damp; V[j + 1] = (X[j + 1] - Pv[j + 1]) * damp; V[j + 2] = (X[j + 2] - Pv[j + 2]) * damp;
        if (hitF[i]) { const vn = V[j] * CN[j] + V[j + 1] * CN[j + 1] + V[j + 2] * CN[j + 2]; if (vn > 0) { V[j] -= CN[j] * vn; V[j + 1] -= CN[j + 1] * vn; V[j + 2] -= CN[j + 2] * vn; } } // wypchnięcie z ciała nie nadaje prędkości na zewnątrz: tkanina nie odbija się od skóry
        mv += Math.abs(V[j]) + Math.abs(V[j + 1]) + Math.abs(V[j + 2]); }
      return mv / n;
    };
    // kontakt tkaniny z tkaniną (wzorem silnika Przymiarki): punkt nie może przejść przez trójkąt, który nie jest jego sąsiadem w wykroju.
    // Punkty trafiają do siatki haszującej, każdy trójkąt sprawdza komórki, które przecina; strona, po której punkt był klatkę wcześniej, zostaje zachowana.
    const selfOn = !!o.selfContact && g.tri && g.rmap, skin = o.skin || 0.3; let FT = null, excl = null;
    if (selfOn) {
      const set = new Set(), fl = []; for (let t = 0; t < g.tri.length; t += 3) { const a = g.rmap[g.tri[t]], b = g.rmap[g.tri[t + 1]], c = g.rmap[g.tri[t + 2]]; if (a === b || b === c || a === c) continue; const k = [a, b, c].sort((x, y) => x - y).join(','); if (set.has(k)) continue; set.add(k); fl.push(a, b, c); }
      FT = Int32Array.from(fl); excl = Array.from({ length: n }, () => new Set());
      const link = (a, b) => { excl[a].add(b); excl[b].add(a); }; for (let k = 0; k < ne; k++) link(ei[k * 2], ei[k * 2 + 1]); for (let k = 0; k < nb; k++) link(bi[k * 2], bi[k * 2 + 1]);
      for (let i = 0; i < n; i++) { const two = new Set(excl[i]); for (const j of excl[i]) for (const k of excl[j]) two.add(k); two.add(i); excl[i] = two; } // sąsiedzi do drugiego rzędu: przy szwach i zaszewkach tkanina i tak się styka
    }
    const selfContact = () => {
      const cell = Math.max(2.5, (g.h || 2) * 1.5), hash = new Map(), key = (i, j, k) => ((i + 512) * 1024 + j + 512) * 1024 + k + 512;
      for (let i = 0; i < n; i++) { const k = key(Math.floor(X[i * 3] / cell), Math.floor(X[i * 3 + 1] / cell), Math.floor(X[i * 3 + 2] / cell)); let b = hash.get(k); if (!b) hash.set(k, b = []); b.push(i); }
      for (let t = 0; t < FT.length; t += 3) {
        const ia = FT[t], ib = FT[t + 1], ic = FT[t + 2], a = ia * 3, b = ib * 3, c = ic * 3, ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2], vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nn = Math.sqrt(nx * nx + ny * ny + nz * nz); if (nn < 1e-6) continue; nx /= nn; ny /= nn; nz /= nn;
        const uu = ux * ux + uy * uy + uz * uz, uv = ux * vx + uy * vy + uz * vz, vv = vx * vx + vy * vy + vz * vz, den = uu * vv - uv * uv; if (Math.abs(den) < 1e-9) continue;
        const x0 = Math.floor((Math.min(X[a], X[b], X[c]) - skin) / cell), x1 = Math.floor((Math.max(X[a], X[b], X[c]) + skin) / cell), y0 = Math.floor((Math.min(X[a + 1], X[b + 1], X[c + 1]) - skin) / cell), y1 = Math.floor((Math.max(X[a + 1], X[b + 1], X[c + 1]) + skin) / cell), z0 = Math.floor((Math.min(X[a + 2], X[b + 2], X[c + 2]) - skin) / cell), z1 = Math.floor((Math.max(X[a + 2], X[b + 2], X[c + 2]) + skin) / cell);
        for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let k = z0; k <= z1; k++) {
          const bucket = hash.get(key(i, j, k)); if (!bucket) continue;
          for (const ip of bucket) {
            const ex = excl[ip]; if (ex.has(ia) || ex.has(ib) || ex.has(ic)) continue; const p = ip * 3, x = X[p] - X[a], y = X[p + 1] - X[a + 1], z = X[p + 2] - X[a + 2], d = x * nx + y * ny + z * nz; if (Math.abs(d) >= skin) continue;
            const u = x * ux + y * uy + z * uz, v = x * vx + y * vy + z * vz, wb = (vv * u - uv * v) / den, wc = (uu * v - uv * u) / den, wa = 1 - wb - wc; if (wa < 0.001 || wb < 0.001 || wc < 0.001) continue;
            const prev = (SP[p] - wa * SP[a] - wb * SP[b] - wc * SP[c]) * nx + (SP[p + 1] - wa * SP[a + 1] - wb * SP[b + 1] - wc * SP[c + 1]) * ny + (SP[p + 2] - wa * SP[a + 2] - wb * SP[b + 2] - wc * SP[c + 2]) * nz, sign = prev > 0 ? 1 : prev < 0 ? -1 : d >= 0 ? 1 : -1;
            const mp = w[ip], ma = w[ia], mb = w[ib], mc = w[ic], total = mp + wa * wa * ma + wb * wb * mb + wc * wc * mc; if (!total) continue; const step = 0.65 * (skin * sign - d) / total;
            const mv = (q, wt) => { if (!wt) return; const dx = wt * step * nx, dy = wt * step * ny, dz = wt * step * nz; X[q] += dx; X[q + 1] += dy; X[q + 2] += dz; };
            mv(p, mp); mv(a, -wa * ma); mv(b, -wb * mb); mv(c, -wc * mc);
          }
        }
      }
    };
    const SP = selfOn ? new Float32Array(n * 3) : null; if (SP) SP.set(X);
    S.step = (frames) => {
      for (let f = 0; f < frames && !S.done; f++) {
        const gs = S.steps < zeroG ? 0 : Math.min(1, (S.steps - zeroG + 1) / 10); let mv = 0;
        for (let s = 0; s < sub; s++) mv = substep(gs);
        if (selfOn && S.steps >= zeroG + 6) { const B0 = X.slice(); selfContact(); for (let i = 0; i < n * 3; i++) V[i] *= 0.98; SP.set(B0); for (let i = 0; i < n; i++) { if (!w[i]) continue; const j = i * 3; q[0] = X[j]; q[1] = X[j + 1]; q[2] = X[j + 2]; if (o.collide(q, kind[i])) { X[j] = q[0]; X[j + 1] = q[1]; X[j + 2] = q[2]; } } } else if (SP) SP.set(X);
        S.steps++; S.moved = mv / dt; // średnia prędkość węzła w cm/s
        if (S.steps >= S.max || (S.steps > zeroG + 45 && S.moved < (o.staticThreshold || 0.6))) S.done = true;
      }
    };
    return S;
  }

  // pole odległości od ciała (ze znakiem) na siatce wokseli: jedna, jednolita kolizja dla tułowia, barków, szyi, pach i rąk
  function sdf(pos, idx, lo, hi, cell) {
    const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1, ny = Math.ceil((hi[1] - lo[1]) / cell) + 1, nz = Math.ceil((hi[2] - lo[2]) / cell) + 1, N = nx * ny * nz, sxy = nx * ny;
    const D = new Float32Array(N).fill(1e6), Sg = new Int8Array(N); // Sg: 0 nietknięty, 1 na zewnątrz, -1 w środku (z płaszczyzny najbliższego trójkąta)
    const touch = (ix, iy, iz, px, py, pz, ax, ay, az) => {
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return; const k = ix + iy * nx + iz * sxy, cx = lo[0] + ix * cell - px, cy = lo[1] + iy * cell - py, cz = lo[2] + iz * cell - pz, d = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (d < D[k]) { D[k] = d; Sg[k] = cx * ax + cy * ay + cz * az >= 0 ? 1 : -1; }
    };
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      if (Math.max(pos[a + 1], pos[b + 1], pos[c + 1]) < lo[1] - cell || Math.min(pos[a + 1], pos[b + 1], pos[c + 1]) > hi[1] + cell) continue;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      let ax = uy * vz - uz * vy, ay = uz * vx - ux * vz, az = ux * vy - uy * vx; const al = Math.sqrt(ax * ax + ay * ay + az * az); if (al < 1e-9) continue; ax /= al; ay /= al; az /= al;
      const n = Math.max(1, Math.ceil(Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(ux - vx, uy - vy, uz - vz)) / (0.45 * cell)));
      for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) {
        const s = i / n, r = j / n, px = pos[a] + ux * s + vx * r, py = pos[a + 1] + uy * s + vy * r, pz = pos[a + 2] + uz * s + vz * r;
        const ix = Math.round((px - lo[0]) / cell), iy = Math.round((py - lo[1]) / cell), iz = Math.round((pz - lo[2]) / cell);
        for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) touch(ix + dx, iy + dy, iz + dz, px, py, pz, ax, ay, az);
      }
    }
    // na zewnątrz jest to, do czego da się dojść od ścian bocznych obszaru, nie przechodząc przez woksele po wewnętrznej stronie skóry
    const out = new Uint8Array(N), st = [];
    const seed = (k) => { if (!out[k] && Sg[k] >= 0) { out[k] = 1; st.push(k); } };
    for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) { seed(iy * nx + iz * sxy); seed(nx - 1 + iy * nx + iz * sxy); }
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) { seed(ix + iy * nx); seed(ix + iy * nx + (nz - 1) * sxy); }
    while (st.length) { const k = st.pop(), ix = k % nx, iy = ((k - ix) / nx) % ny, iz = (k - ix - iy * nx) / sxy; if (ix > 0) seed(k - 1); if (ix < nx - 1) seed(k + 1); if (iy > 0) seed(k - nx); if (iy < ny - 1) seed(k + nx); if (iz > 0) seed(k - sxy); if (iz < nz - 1) seed(k + sxy); }
    // odległość dalej od skóry: przybliżenie dwoma przejściami po sąsiadach
    const W1 = cell, W2 = cell * 1.4142, W3 = cell * 1.7321, relax = (k, j, w) => { const v = D[j] + w; if (v < D[k]) D[k] = v; };
    for (let pass = 0; pass < 2; pass++) {
      const fw = pass === 0;
      for (let q = 0; q < N; q++) {
        const k = fw ? q : N - 1 - q, ix = k % nx, iy = ((k - ix) / nx) % ny, iz = (k - ix - iy * nx) / sxy, s = fw ? -1 : 1;
        const xm = ix + s >= 0 && ix + s < nx, ym = iy + s >= 0 && iy + s < ny, zm = iz + s >= 0 && iz + s < nz, xp = ix - s >= 0 && ix - s < nx, yp = iy - s >= 0 && iy - s < ny;
        if (xm) relax(k, k + s, W1); if (ym) relax(k, k + s * nx, W1); if (zm) relax(k, k + s * sxy, W1);
        if (xm && ym) relax(k, k + s + s * nx, W2); if (xp && ym) relax(k, k - s + s * nx, W2); if (xm && zm) relax(k, k + s + s * sxy, W2); if (xp && zm) relax(k, k - s + s * sxy, W2); if (ym && zm) relax(k, k + s * nx + s * sxy, W2); if (yp && zm) relax(k, k - s * nx + s * sxy, W2);
        if (xm && ym && zm) relax(k, k + s + s * nx + s * sxy, W3); if (xp && ym && zm) relax(k, k - s + s * nx + s * sxy, W3); if (xm && yp && zm) relax(k, k + s - s * nx + s * sxy, W3); if (xp && yp && zm) relax(k, k - s - s * nx + s * sxy, W3);
      }
    }
    for (let k = 0; k < N; k++) if (Sg[k] < 0 || (Sg[k] === 0 && !out[k])) D[k] = -D[k];
    const val = (x, y, z) => {
      const fx = Math.max(0, Math.min(nx - 1.001, (x - lo[0]) / cell)), fy = Math.max(0, Math.min(ny - 1.001, (y - lo[1]) / cell)), fz = Math.max(0, Math.min(nz - 1.001, (z - lo[2]) / cell)), ix = fx | 0, iy = fy | 0, iz = fz | 0, tx = fx - ix, ty = fy - iy, tz = fz - iz, k = ix + iy * nx + iz * sxy;
      const c00 = D[k] * (1 - tx) + D[k + 1] * tx, c10 = D[k + nx] * (1 - tx) + D[k + nx + 1] * tx, c01 = D[k + sxy] * (1 - tx) + D[k + sxy + 1] * tx, c11 = D[k + sxy + nx] * (1 - tx) + D[k + sxy + nx + 1] * tx;
      return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
    };
    const inBox = (x, y, z) => x > lo[0] && x < hi[0] && y > lo[1] && y < hi[1] && z > lo[2] && z < hi[2];
    // wypchnięcie punktu na odległość e od skóry, wzdłuż kierunku najszybszego wzrostu odległości
    const push = (q, e) => {
      if (!inBox(q[0], q[1], q[2])) return false; const d = val(q[0], q[1], q[2]); if (d >= e) return false;
      const h = cell * 0.6; let gx = val(q[0] + h, q[1], q[2]) - val(q[0] - h, q[1], q[2]), gy = val(q[0], q[1] + h, q[2]) - val(q[0], q[1] - h, q[2]), gz = val(q[0], q[1], q[2] + h) - val(q[0], q[1], q[2] - h); const gl = Math.sqrt(gx * gx + gy * gy + gz * gz); if (gl < 1e-6) return false;
      const k = (e - d) / gl; q[0] += gx * k; q[1] += gy * k; q[2] += gz * k; return true;
    };
    return { val, push, inBox, nx, ny, nz };
  }

  const api = { build, sim, delaunay, sdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Cloth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
