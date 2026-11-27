  // ---------- plan szycia wczytanego wykroju: szwy wskazane przez analizę zamiast zgadywania kroju z kształtu ----------
  // Każdy element dzieli się w narożnikach na krawędzie (a, b, c…). Analiza mówi, które krawędzie zszywa się ze sobą i która leży na środku przodu.
  // Elementy są potem składane na płasko wzdłuż szwów w jeden arkusz od środka przodu do środka tyłu, a ten arkusz owija się wokół sylwetki.
  const PL_MIN = 6; // krótszych krawędzi nie nazywam: to nacięcia, zakładki i ścięte rogi
  function plEdges(pc) {
    const R = swRing(pc); if (!R) return null;
    const pts = R.pts, n0 = pts.length, cum0 = [0]; for (let i = 1; i <= n0; i++) cum0.push(cum0[i - 1] + Math.hypot(pts[i % n0][0] - pts[i - 1][0], pts[i % n0][1] - pts[i - 1][1]));
    const C = swCorners(pts).idx.slice(), Ltot = cum0[n0], arcD = (i, j) => { const d = Math.abs(cum0[i] - cum0[j]); return Math.min(d, Ltot - d); };
    // podział także tam, gdzie zaczyna się albo kończy długi prosty odcinek: linia środka przechodzi w dekolt łagodnie, bez narożnika
    for (let i = 0; i < n0; i++) { let j = i, len = 0; for (let s = 1; s < n0; s++) { const k = (i + s) % n0, a = pts[i], b = pts[k], ch = Math.hypot(b[0] - a[0], b[1] - a[1]); if (ch < 1e-6) break; let ok = true; for (let q = 1; q < s && ok; q++) { const p = pts[(i + q) % n0]; if (Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / ch > 0.1) ok = false; } if (!ok) break; j = k; len = ch; }
      if (len >= 15) { const prev = pts[(i - 1 + n0) % n0], a = pts[i], b = pts[j], ch = len, dp = Math.abs((b[0] - a[0]) * (prev[1] - a[1]) - (b[1] - a[1]) * (prev[0] - a[0])) / ch; if (dp > 0.1) for (const q of [i, j]) if (!C.some((c) => arcD(c, q) < 3)) C.push(q); } }
    C.sort((a, b) => a - b); let raw;
    if (C.length < 2) raw = [pts.concat([pts[0]])]; else raw = C.map((c, k) => swSub(pts, c, C[(k + 1) % C.length]));
    // krótkie odcinki doklejam do poprzedniej długiej krawędzi, żeby obrys został zamknięty
    const out = []; for (const e of raw) { if (swLen(e) >= PL_MIN || !out.length) out.push(e.slice()); else out[out.length - 1] = out[out.length - 1].concat(e.slice(1)); }
    if (out.length > 1 && swLen(out[0]) < PL_MIN) { const f = out.shift(); out[out.length - 1] = out[out.length - 1].concat(f.slice(1)); }
    return out.map((e, k) => { const L = swLen(e); let acc = 0, mid = e[0]; for (let i = 1; i < e.length; i++) { const d = Math.hypot(e[i][0] - e[i - 1][0], e[i][1] - e[i - 1][1]); if (acc + d >= L / 2) { const t = (L / 2 - acc) / (d || 1); mid = [e[i - 1][0] + (e[i][0] - e[i - 1][0]) * t, e[i - 1][1] + (e[i][1] - e[i - 1][1]) * t]; break; } acc += d; } return { k, id: String.fromCharCode(97 + (k % 26)), pts: e, len: L, mid }; });
  }
  // wszystkie nazwane krawędzie wykroju: do opisania obrazów dla analizy i do odnalezienia krawędzi po zapisanym punkcie
  function plAll(pieces) { const all = []; pieces.forEach((pc, pi) => { let ed = null; try { ed = plEdges(pc); } catch (e) { ed = null; } if (ed) ed.forEach((e) => all.push(Object.assign({ pi }, e))); }); return all; }
  const plNear = (all, at) => { let b = null, bd = 12; if (!at) return null; for (const e of all) { const d = Math.hypot(e.mid[0] - at[0], e.mid[1] - at[1]); if (d < bd) { bd = d; b = e; } } return b; };
  const plAp = (T, p) => [T[0] * p[0] + T[1] * p[1] + T[4], T[2] * p[0] + T[3] * p[1] + T[5]];
  // przekształcenie sztywne (obrót, ewentualnie odbicie), które odcinek q0-q1 kładzie na odcinku p0-p1
  function plFit(q0, q1, p0, p1, flip) {
    const aq = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]), ap = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); let M;
    if (!flip) { const t = ap - aq, c = Math.cos(t), s = Math.sin(t); M = [c, -s, s, c]; } else { const t = ap + aq, c = Math.cos(t), s = Math.sin(t); M = [c, s, s, -c]; }
    const mq = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2], mp = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    return [M[0], M[1], M[2], M[3], mp[0] - (M[0] * mq[0] + M[1] * mq[1]), mp[1] - (M[2] * mq[0] + M[3] * mq[1])];
  }
  const plCen = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; };
  // --- elementy pochodne: rozłożenie ze złożenia, połowa elementu leżącego na środku, łączenie kilku krawędzi w jedną ---
  const plMid = (e) => ptOn(e.pts, 0.5);
  function plUnfold(edges, f) { // odbicie względem krawędzi złożenia; odbite krawędzie mają w nazwie apostrof
    const A = f.pts[0], B = f.pts[f.pts.length - 1], dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1, mir = (p) => { const t = ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / L2, qx = A[0] + dx * t, qy = A[1] + dy * t; return [2 * qx - p[0], 2 * qy - p[1]]; };
    const k = edges.indexOf(f), rest = edges.slice(k + 1).concat(edges.slice(0, k)), out = rest.map((e) => ({ id: e.id, pts: e.pts.slice(), len: e.len }));
    for (let q = rest.length - 1; q >= 0; q--) out.push({ id: rest[q].id + "'", pts: rest[q].pts.map(mir).reverse(), len: rest[q].len });
    return out;
  }
  function plHalve(edges) { // element symetryczny leżący na środku przodu albo tyłu: zostaje połowa, a oś symetrii staje się krawędzią środka
    const all = []; for (const e of edges) { const nS = Math.max(2, Math.round(e.len)); for (let k = 0; k < nS; k++) all.push(ptOn(e.pts, k / nS)); } // punkty co centymetr, żeby gęsto opisany łuk nie przeważył przy szukaniu osi
    const c = plCen(all); let sxx = 0, sxy = 0, syy = 0; for (const p of all) { const x = p[0] - c[0], y = p[1] - c[1]; sxx += x * x; sxy += x * y; syy += y * y; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); let best = null;
    for (const a of [th, th + Math.PI / 2]) { const d = [Math.cos(a), Math.sin(a)], mir = (p) => { const x = p[0] - c[0], y = p[1] - c[1], t = x * d[0] + y * d[1]; return [c[0] + 2 * t * d[0] - x, c[1] + 2 * t * d[1] - y]; };
      let err = 0; for (let q = 0; q < all.length; q += Math.max(1, Math.floor(all.length / 60))) { const mp = mir(all[q]); let bd = 1e9; for (let w = 0; w < all.length; w++) { const p0 = all[w], p1 = all[(w + 1) % all.length], vx = p1[0] - p0[0], vy = p1[1] - p0[1], l2 = vx * vx + vy * vy, t = l2 > 0 ? Math.max(0, Math.min(1, ((mp[0] - p0[0]) * vx + (mp[1] - p0[1]) * vy) / l2)) : 0; bd = Math.min(bd, Math.hypot(p0[0] + vx * t - mp[0], p0[1] + vy * t - mp[1])); } err = Math.max(err, bd); }
      if (!best || err < best.err) best = { err, d, mir }; }
    if (!best || best.err > 2.5) return null;
    const nrm = [-best.d[1], best.d[0]], sd = (p) => (p[0] - c[0]) * nrm[0] + (p[1] - c[1]) * nrm[1], cross = (a, b) => { const sa = sd(a), sb = sd(b), t = sa / (sa - sb); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    const kept = [], alias = {}; // połowa po dodatniej stronie osi
    for (const e of edges) { let cur = null; const runs = []; for (let k = 0; k < e.pts.length; k++) { const p = e.pts[k], ins = sd(p) >= 0; if (k > 0) { const pv = e.pts[k - 1], pin = sd(pv) >= 0; if (pin !== ins) { const x = cross(pv, p); if (ins) cur = [x]; else { cur.push(x); runs.push(cur); cur = null; } } } if (ins) { if (!cur) cur = []; cur.push(p); } } if (cur && cur.length > 1) runs.push(cur);
      if (runs.length) { const pts = runs.sort((a, b) => swLen(b) - swLen(a))[0]; if (swLen(pts) > 0.5) kept.push({ id: e.id, pts, len: swLen(pts), cutA: sd(e.pts[0]) < 0, cutB: sd(e.pts[e.pts.length - 1]) < 0 }); } }
    if (kept.length < 2) return null;
    // kolejność wzdłuż obrysu: od krawędzi przeciętej na początku do krawędzi przeciętej na końcu
    const st = kept.findIndex((e) => e.cutA), ord = st < 0 ? kept : kept.slice(st).concat(kept.slice(0, st)), first = ord[0].pts[0], last = ord[ord.length - 1].pts[ord[ord.length - 1].pts.length - 1];
    ord.push({ id: '=', pts: [last, first], len: Math.hypot(last[0] - first[0], last[1] - first[1]), center: true });
    for (const e of edges) if (!ord.some((q) => q.id === e.id)) { const mm = best.mir(plMid(e)); let b = null, bd = 1e9; for (const q of ord) if (!q.center) { const m2 = plMid(q), dd = Math.hypot(m2[0] - mm[0], m2[1] - mm[1]); if (dd < bd) { bd = dd; b = q; } } if (b) alias[e.id] = b.id; }
    return { edges: ord, alias };
  }
  function plChain(edges, ids) { // kilka krawędzi jednego szwu (także rozdzielonych zaszewką) staje się jedną krawędzią
    const idx = ids.map((id) => edges.findIndex((e) => e.id === id)).filter((k) => k >= 0); if (idx.length < 2) return idx.length ? edges[idx[0]] : null;
    const n = edges.length; let bestS = -1, bestSpan = 1e9; for (const s0 of idx) { let span = 0; for (const k of idx) span = Math.max(span, (k - s0 + n) % n); if (span < bestSpan) { bestSpan = span; bestS = s0; } }
    const seq = idx.slice().sort((a, b) => ((a - bestS + n) % n) - ((b - bestS + n) % n)); let pts = []; for (const k of seq) pts = pts.concat(pts.length ? edges[k].pts.slice(Math.hypot(edges[k].pts[0][0] - pts[pts.length - 1][0], edges[k].pts[0][1] - pts[pts.length - 1][1]) < 0.05 ? 1 : 0) : edges[k].pts);
    const merged = { id: edges[bestS].id, pts, len: swLen(pts) }, drop = new Set(); for (let q = 1; q <= bestSpan; q++) drop.add((bestS + q) % n);
    edges[bestS] = merged; const keep = edges.filter((_, k) => !drop.has(k)); edges.length = 0; keep.forEach((e) => edges.push(e)); return merged;
  }
  // wskazanie z analizy (punkt na arkuszu, numer egzemplarza, czy krawędź odbita) -> krawędź elementu
  const plRef = (r) => (Array.isArray(r) ? { at: r, i: 1, m: false } : r && r.at ? { at: r.at, i: r.i || 1, m: !!r.m, w: !!r.w, r: Array.isArray(r.r) && r.r[1] > r.r[0] ? [Math.max(0, r.r[0]), Math.min(1, r.r[1])] : null } : null);
  // odcinek łamanej między ułamkami jej długości
  function plSub(pts, t0, t1) { const L = swLen(pts), out = [ptOn(pts, t0)]; let acc = 0; for (let i = 1; i < pts.length - 1; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); const f = acc / (L || 1); if (f > t0 + 1e-6 && f < t1 - 1e-6) out.push(pts[i]); } out.push(ptOn(pts, t1)); return out; }
  function impPlan(imp, m) {
    const an = imp && imp.an, pcs = (imp && imp.pieces) || []; if (!an || !an.szwy || !an.szwy.length || !an.srodek || !an.srodek.p) return null;
    const a = W.full(m), all = plAll(pcs), near = (r) => plNear(all, r && r.at), L1 = (v) => (v == null ? [] : Array.isArray(v) && (typeof v[0] === 'number') ? [plRef(v)] : (Array.isArray(v) ? v : [v]).map(plRef).filter(Boolean));
    const cfL = L1(an.srodek.p), cbL = L1(an.srodek.t), cfR = cfL.find((r) => !r.w), cbR = cbL.find((r) => !r.w), cf0 = cfR ? near(cfR) : null, cb0 = cbR ? near(cbR) : null;
    if (!cf0) return { err: 'Nie znalazłam krawędzi środka przodu wskazanej przez analizę.' };
    const foldE = (an.rozloz || []).map((q) => plNear(all, q)).filter(Boolean), centred = cfL.concat(cbL).filter((r) => r.w).map((r) => { const e = near(r); return e ? e.pi + '#' + r.i : ''; });
    // części: egzemplarz elementu po rozłożeniu, przepołowieniu i połączeniu krawędzi
    const parts = {}, part = (pi, inst) => { const key = pi + '#' + inst; if (parts[key]) return parts[key];
      let ed = all.filter((e) => e.pi === pi).map((e) => ({ id: e.id, pts: e.pts.slice(), len: e.len })), alias = {}; const fe = foldE.find((e) => e.pi === pi && !(cf0 && e === cf0) && !(cb0 && e === cb0));
      let unf = null; if (fe) { const f = ed.find((e) => e.id === fe.id); if (f) { unf = [f.pts[0], f.pts[f.pts.length - 1]]; ed = plUnfold(ed, f); } }
      if (centred.includes(key)) { const h = plHalve(ed); if (h) { ed = h.edges; alias = h.alias; } }
      return (parts[key] = { key, pi, ed, alias, unf, depth: 0 }); };
    const edgeOf = (r, cutOk) => { const e0 = near(r); if (!e0) return null; const P = part(e0.pi, r.i), id0 = e0.id + (r.m ? "'" : ''), has = (id) => P.ed.some((e) => e.id === id || (cutOk && e.of === id)), id = has(id0) ? id0 : P.alias[id0] || P.alias[e0.id] || (has(e0.id) ? e0.id : ''); return id ? { P, id } : null; };
    // krawędź wskazana z zakresem procentów jest dzielona na odcinki; najpierw zbieram wszystkie punkty podziału, potem dzielę raz
    const rawSeams = an.szwy.map((s) => (Array.isArray(s) ? { a: [plRef([s[0], s[1]])], b: [plRef([s[2], s[3]])] } : { a: L1(s.a), b: L1(s.b), g: !!s.g })), cuts = new Map();
    for (const s of rawSeams) for (const r of s.a.concat(s.b)) { if (!r.r) continue; const x = edgeOf(r); if (!x) continue; const k = x.P.key + '|' + x.id; if (!cuts.has(k)) cuts.set(k, { P: x.P, id: x.id, at: new Set([0, 1]) }); cuts.get(k).at.add(r.r[0]); cuts.get(k).at.add(r.r[1]); }
    cuts.forEach((c) => { const k = c.P.ed.findIndex((e) => e.id === c.id); if (k < 0) return; const e = c.P.ed[k], fs = Array.from(c.at).sort((x, y) => x - y), segs = []; for (let q = 0; q < fs.length - 1; q++) if (fs[q + 1] - fs[q] > 0.01) { const pts = plSub(e.pts, fs[q], fs[q + 1]); segs.push({ id: c.id + '~' + q, pts, len: swLen(pts), f0: fs[q], f1: fs[q + 1], of: c.id }); } c.P.ed.splice(k, 1, ...segs); });
    const idsOf = (r) => { const x = edgeOf(r, true); if (!x) return null; const segs = x.P.ed.filter((e) => e.of === x.id); if (!segs.length) return { P: x.P, ids: [x.id] }; const t0 = r.r ? r.r[0] : 0, t1 = r.r ? r.r[1] : 1; return { P: x.P, ids: segs.filter((e) => e.f0 >= t0 - 0.005 && e.f1 <= t1 + 0.005).map((e) => e.id) }; };
    const seams = [];
    for (const s of rawSeams) { const sa = s, side = (lst) => { const es = lst.map(idsOf).filter(Boolean); if (!es.length || es.some((e) => e.P !== es[0].P)) return null; const ids = es.reduce((o, x) => o.concat(x.ids), []); if (!ids.length) return null; const e = plChain(es[0].P.ed, ids); return e ? { P: es[0].P, e } : null; };
      const A = side(sa.a), B = side(sa.b); if (!A || !B || A.P === B.P) continue; const q = A.e.len / B.e.len; if (!sa.g && (q < 0.72 || q > 1.4)) continue; seams.push({ a: A, b: B }); }
    if (!seams.length) return { err: 'Analiza nie wskazała szwów, które umiem odnaleźć na elementach.' };
    const F = part(cf0.pi, cfR.i), cfE = F.ed.find((e) => e.id === cf0.id), cbP = cb0 ? parts[cb0.pi + '#' + cbR.i] : null, cbE = cbP ? cbP.ed.find((e) => e.id === cb0.id) : null; if (!cfE) return { err: 'Krawędź środka przodu zniknęła po połączeniu szwów.' };
    const ring = (P) => { const o = []; for (const e of P.ed) for (const p of e.pts) o.push(p); return o; }, T = {};
    { const A = cfE.pts[0], B = cfE.pts[cfE.pts.length - 1], R0 = ring(F), L = Math.hypot(B[0] - A[0], B[1] - A[1]); let t = plFit(A, B, [0, 0], [0, L], false);
      if (plCen(R0.map((p) => plAp(t, p)))[0] < 0) t = plFit(A, B, [0, 0], [0, L], true);
      const Q = R0.map((p) => plAp(t, p)); let w0 = 0, w1 = 0; for (const p of Q) { if (p[1] < L * 0.25) w0 = Math.max(w0, p[0]); if (p[1] > L * 0.75) w1 = Math.max(w1, p[0]); }
      // góra: tam, gdzie do przodu dochodzą szwy z elementami leżącymi niżej (spódnica), jest dół; bez takich szwów węższy koniec jest górą
      const mineE = seams.filter((s) => s.a.P === F || s.b.P === F).map((s) => (s.a.P === F ? s.a.e : s.b.e)), longest = mineE.slice().sort((x, y) => y.len - x.len)[0]; let up = w0 > w1 * 1.15;
      if (mineE.length > 1 && longest) { const others = mineE.filter((e) => e !== longest), mv = others.reduce((s2, e) => s2 + plAp(t, plMid(e))[1], 0) / others.length, sv = plAp(t, plMid(longest))[1]; up = mv < sv; }
      if (up) t = [t[0], t[1], -t[2], -t[3], t[4], L - t[5]];
      if (plCen(R0.map((p) => plAp(t, p)))[0] < 0) t = [-t[0], -t[1], t[2], t[3], -t[4], t[5]];
      T[F.key] = t; }
    const det = (t) => t[0] * t[3] - t[1] * t[2], used = new Set(), order = seams.slice().sort((x, y) => y.a.e.len - x.a.e.len);
    for (let guard = 0; guard < 80; guard++) {
      // kolejność: najpierw elementy bliżej przodu w łańcuchu szwów, a wstawki rozkładane ze złożenia (kliny) na końcu; dzięki temu panele wiszą pod swoim szwem, a nie rozkładają się w wachlarz
      let s = null, sc = 1e9; for (const q of order) { if (used.has(q) || (T[q.a.P.key] !== undefined) === (T[q.b.P.key] !== undefined)) continue; const pP = T[q.a.P.key] !== undefined ? q.a.P : q.b.P, pQ = pP === q.a.P ? q.b.P : q.a.P, v = (pQ.unf ? 1000 : 0) + pP.depth * 10 - q.a.e.len / 1000; if (v < sc) { sc = v; s = q; } }
      if (!s) break; used.add(s);
      const sP = T[s.a.P.key] !== undefined ? s.a : s.b, sQ = sP === s.a ? s.b : s.a, tp = T[sP.P.key], p0 = plAp(tp, sP.e.pts[0]), p1 = plAp(tp, sP.e.pts[sP.e.pts.length - 1]), cP = plCen(ring(sP.P).map((p) => plAp(tp, p))), RQ = ring(sQ.P), eq = sQ.e.pts;
      const sideOf = (c) => Math.sign((p1[0] - p0[0]) * (c[1] - p0[1]) - (p1[1] - p0[1]) * (c[0] - p0[0])), sp = sideOf(cP); let best = null;
      for (const rev of [false, true]) for (const flip of [false, true]) {
        const t = plFit(eq[rev ? eq.length - 1 : 0], eq[rev ? 0 : eq.length - 1], p0, p1, flip); if (sideOf(plCen(RQ.map((p) => plAp(t, p)))) === sp) continue;
        let err = 0; const N = 12; for (let k = 0; k <= N; k++) { const pa = plAp(tp, ptOn(sP.e.pts, k / N)), pb = plAp(t, ptOn(eq, rev ? 1 - k / N : k / N)); err += Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); }
        err = err / (N + 1) + (Math.sign(det(t)) === Math.sign(det(tp)) ? 0 : 0.15);
        if (!best || err < best.err) best = { t, err };
      }
      if (best) { T[sQ.P.key] = best.t; sQ.P.depth = sP.P.depth + 1; sQ.P.via = sQ.e; }
    }
    const placed = Object.keys(T).map((k) => parts[k]); if (placed.length < 2) return { err: 'Szwy wskazane przez analizę nie łączą przodu z żadnym innym elementem.' };
    const E = (P, e) => e.pts.map((p) => plAp(T[P.key], p)), mine = seams.filter((s) => (s.a.P === F || s.b.P === F) && T[s.a.P.key] !== undefined && T[s.b.P.key] !== undefined).map((s) => (s.a.P === F ? s.a.e : s.b.e));
    if (!mine.length) return { err: 'Przód nie ma żadnego szwu z innym elementem.' };
    const pit = a.Dts - a.Gp - 1, cfQ = ring(F).map((p) => plAp(T[F.key], p)), v0 = Math.min(...cfQ.map((p) => p[1])), v1 = Math.max(...cfQ.map((p) => p[1])); let dV;
    const sh = an.trzym === 'ramiona' ? mine.filter((e) => e.len < 32 && plCen(E(F, e))[1] < v0 + 0.25 * (v1 - v0)).sort((x, y) => plCen(E(F, x))[1] - plCen(E(F, y))[1])[0] : null;
    if (sh) { const q = E(F, sh), np = q[0][0] < q[q.length - 1][0] ? q[0] : q[q.length - 1]; dV = -a.Dts - np[1]; }
    else { const sd = mine.slice().sort((x, y) => y.len - x.len)[0], q = E(F, sd), top = q[0][1] < q[q.length - 1][1] ? q[0] : q[q.length - 1]; dV = -(pit - 1.5) - top[1]; }
    for (const P of placed) { const t = T[P.key]; T[P.key] = [t[0], t[1], t[2], t[3], t[4], t[5] + dV]; }
    const cbOk = cbP && cbE && T[cbP.key] !== undefined, cbQ = cbOk ? E(cbP, cbE) : null, Ucb = cbQ ? Math.max(8, plCen(cbQ)[0]) : 0;
    const cbU = (v) => { if (!cbQ) return 1e9; const p0 = cbQ[0], p1 = cbQ[cbQ.length - 1]; return p0[0] + (p1[0] - p0[0]) * Math.max(0, Math.min(1, (v - p0[1]) / (p1[1] - p0[1] || 1))); };
    const tagOf = new Map(), outSeams = []; tagOf.set(cfE, 'center'); if (cbOk) tagOf.set(cbE, 'center'); for (const P of placed) for (const e of P.ed) if (e.center) tagOf.set(e, 'center');
    const key = (u, v) => Math.abs(u[1] - v[1]) + Math.abs(Math.min(Math.abs(u[0]), Ucb ? Math.abs(Ucb - u[0]) : 1e9) - Math.min(Math.abs(v[0]), Ucb ? Math.abs(Ucb - v[0]) : 1e9));
    seams.forEach((s, i) => { if (T[s.a.P.key] === undefined || T[s.b.P.key] === undefined || tagOf.has(s.a.e) || tagOf.has(s.b.e)) return; const qa = E(s.a.P, s.a.e), qb = E(s.b.P, s.b.e), a0 = qa[0], a1 = qa[qa.length - 1], b0 = qb[0], b1 = qb[qb.length - 1], rev = key(a0, b0) + key(a1, b1) > key(a0, b1) + key(a1, b0);
      tagOf.set(s.a.e, 's' + i + 'a'); tagOf.set(s.b.e, 's' + i + 'b'); outSeams.push({ a: { key: 'p' + s.a.P.key, tag: 's' + i + 'a' }, b: { key: 'p' + s.b.P.key, tag: 's' + i + 'b' }, rev }); });
    // wstawka: element rozłożony ze złożenia, wszyty obiema połówkami (klin). Na początku układania jest złożony wzdłuż osi i odstaje od ciała jak płetwa przy szwie, którym został dołożony
    const finOf = (P) => { if (!P.unf || !P.via) return null; const base = P.via.id.replace(/'$/, ''); if (!seams.some((s) => (s.a.P === P && s.a.e.id === base) || (s.b.P === P && s.b.e.id === base)) || !seams.some((s) => (s.a.P === P && s.a.e.id === base + "'") || (s.b.P === P && s.b.e.id === base + "'"))) return null; const q = E(P, P.via), t = T[P.key]; return { a: q[0], b: q[q.length - 1], ax: [plAp(t, P.unf[0]), plAp(t, P.unf[1])] }; };
    const outParts = placed.map((P) => ({ key: 'p' + P.key, fin: finOf(P), ed: P.ed.map((e) => ({ pts: E(P, e), tag: tagOf.get(e) || 'free' })) }));
    const hold = []; if (an.trzym !== 'ramiona') { const topOf = (P, far) => { let b = null; for (const e of P.ed) for (const p of E(P, e)) { const dc = far ? Math.abs(cbU(p[1]) - p[0]) : Math.abs(p[0]); if (dc > 3 && (!b || p[1] < b[1])) b = p; } return b; };
      const bp = cbOk ? cbP : placed.filter((P) => P !== F).sort((x, y) => Math.min(...ring(x).map((p) => plAp(T[x.key], p)[1])) - Math.min(...ring(y).map((p) => plAp(T[y.key], p)[1])))[0], hf = topOf(F, false), hb = bp ? topOf(bp, !!Ucb) : null;
      if (hf && hb) hold.push({ key: 'p' + F.key, at: hf }, { key: 'p' + bp.key, at: hb }); }
    let dl = 0, wid = 0, area = 0; for (const p of outParts) { let ar = 0; const rr = []; for (const e of p.ed) for (const q of e.pts) { dl = Math.max(dl, q[1]); wid = Math.max(wid, q[0]); rr.push(q); } for (let k = 0; k < rr.length; k++) { const q0 = rr[k], q1 = rr[(k + 1) % rr.length]; ar += q0[0] * q1[1] - q1[0] * q0[1]; } area += Math.abs(ar); }
    { const bad = swSane(Ucb ? 2 * cbU(-pit) : 0, dl, m, an); if (bad) return { err: bad }; }
    const usedPi = new Set(placed.map((P) => P.pi)), skip = pcs.filter((_, i2) => !usedPi.has(i2)).map((pc) => String(pc.name || '').replace(/ \(część.*$/, ''));
    const cbLine = cbQ ? (cbQ[0][1] < cbQ[cbQ.length - 1][1] ? [cbQ[0], cbQ[cbQ.length - 1]] : [cbQ[cbQ.length - 1], cbQ[0]]) : null;
    return { plan: { parts: outParts, seams: outSeams, hold, Ucb, cbLine, area, yMax: an.trzym === 'ramiona' ? null : pit + 8 }, dl, hemC: 4 * (Ucb || wid), used: Array.from(usedPi).map((k) => String(pcs[k].name || '')), skip: skip.filter((x, i2, arr) => x && arr.indexOf(x) === i2), strap: hold.length === 2 };
  }
  // punkt na łamanej w ułamku jej długości
  function ptOn(pts, f) { const L = swLen(pts); let acc = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc + d >= f * L - 1e-9) { const t = (f * L - acc) / (d || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; } acc += d; } return pts[pts.length - 1]; }
  window.__pl = { plEdges, plAll, impPlan, plHalve, plUnfold }; // tylko do testów
