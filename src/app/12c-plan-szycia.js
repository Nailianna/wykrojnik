  // ---------- plan szycia wczytanego wykroju: szwy wskazane przez analizę zamiast zgadywania kroju z kształtu ----------
  // Każdy element dzieli się w narożnikach na krawędzie (a, b, c…). Analiza mówi, które krawędzie zszywa się ze sobą i która leży na środku przodu.
  // Elementy są potem składane na płasko wzdłuż szwów w jeden arkusz od środka przodu do środka tyłu, a ten arkusz owija się wokół sylwetki.
  const PL_MIN = 6; // krótszych krawędzi nie nazywam: to nacięcia, zakładki i ścięte rogi
  function plEdges(pc) {
    const R = swRing(pc); if (!R) return null;
    const pts = R.pts, C = swCorners(pts).idx.slice().sort((a, b) => a - b); let raw;
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
  function impPlan(imp, m) {
    const an = imp && imp.an, pcs = (imp && imp.pieces) || []; if (!an || !an.szwy || !an.szwy.length || !an.srodek || !an.srodek.p) return null;
    const a = W.full(m), all = plAll(pcs), cf = plNear(all, an.srodek.p), cb = plNear(all, an.srodek.t); if (!cf) return { err: 'Nie znalazłam krawędzi środka przodu wskazanej przez analizę.' };
    const seams = []; for (const s of an.szwy) { const ea = plNear(all, [s[0], s[1]]), eb = plNear(all, [s[2], s[3]]); if (ea && eb && ea !== eb && ea.pi !== eb.pi && !seams.some((q) => q.a === ea || q.b === ea || q.a === eb || q.b === eb)) seams.push({ a: ea, b: eb }); }
    if (!seams.length) return { err: 'Analiza nie wskazała szwów, które umiem odnaleźć na elementach.' };
    const ring = (pi) => { const o = []; for (const e of all) if (e.pi === pi) for (const p of e.pts) o.push(p); return o; };
    // układ elementu ze środkiem przodu: środek pionowo na U = 0, element po stronie U > 0, dół tam, gdzie leżą krawędzie dołu albo gdzie element jest szerszy
    const T = {}; {
      const A = cf.pts[0], B = cf.pts[cf.pts.length - 1], R0 = ring(cf.pi); let t = plFit(A, B, [0, 0], [0, Math.hypot(B[0] - A[0], B[1] - A[1])], false);
      if (plCen(R0.map((p) => plAp(t, p)))[0] < 0) t = plFit(A, B, [0, 0], [0, Math.hypot(B[0] - A[0], B[1] - A[1])], true);
      const Q = R0.map((p) => plAp(t, p)), L = Math.hypot(B[0] - A[0], B[1] - A[1]); let up = false;
      const hem = (an.dol || []).map((d) => plNear(all, d)).filter((e) => e && e.pi === cf.pi);
      if (hem.length) up = plAp(t, hem[0].mid)[1] < L / 2; else { let w0 = 0, w1 = 0; for (const p of Q) { if (p[1] < L * 0.25) w0 = Math.max(w0, p[0]); if (p[1] > L * 0.75) w1 = Math.max(w1, p[0]); } up = w0 > w1 * 1.15; }
      if (up) t = [t[0], t[1], -t[2], -t[3], t[4], L - t[5]]; // dół wypadł u góry: odwracam pion
      if (plCen(R0.map((p) => plAp(t, p)))[0] < 0) t = [-t[0], -t[1], t[2], t[3], -t[4], t[5]];
      T[cf.pi] = t;
    }
    // składanie na płasko: od elementu już położonego przez najdłuższy wspólny szew do następnego
    const det = (t) => t[0] * t[3] - t[1] * t[2], used = new Set(), order = seams.slice().sort((x, y) => y.a.len - x.a.len);
    for (let guard = 0; guard < 40; guard++) {
      const s = order.find((q) => !used.has(q) && (T[q.a.pi] !== undefined) !== (T[q.b.pi] !== undefined)); if (!s) break; used.add(s);
      const eP = T[s.a.pi] !== undefined ? s.a : s.b, eQ = eP === s.a ? s.b : s.a, tp = T[eP.pi], p0 = plAp(tp, eP.pts[0]), p1 = plAp(tp, eP.pts[eP.pts.length - 1]), cP = plCen(ring(eP.pi).map((p) => plAp(tp, p))), RQ = ring(eQ.pi);
      const sideOf = (c) => Math.sign((p1[0] - p0[0]) * (c[1] - p0[1]) - (p1[1] - p0[1]) * (c[0] - p0[0])), sp = sideOf(cP); let best = null;
      for (const rev of [false, true]) for (const flip of [false, true]) {
        const q0 = eQ.pts[rev ? eQ.pts.length - 1 : 0], q1 = eQ.pts[rev ? 0 : eQ.pts.length - 1], t = plFit(q0, q1, p0, p1, flip); if (sideOf(plCen(RQ.map((p) => plAp(t, p)))) === sp) continue;
        let err = 0; const N = 12; for (let k = 0; k <= N; k++) { const pa = plAp(tp, ptOn(eP.pts, k / N)), pb = plAp(t, ptOn(eQ.pts, rev ? 1 - k / N : k / N)); err += Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); }
        err = err / (N + 1) + (Math.sign(det(t)) === Math.sign(det(tp)) ? 0 : 0.15); // przy remisie element zostaje po tej samej stronie papieru co sąsiad
        if (!best || err < best.err) best = { t, err };
      }
      if (best) T[eQ.pi] = best.t;
    }
    const keys = Object.keys(T).map(Number); if (keys.length < 2) return { err: 'Szwy wskazane przez analizę nie łączą przodu z żadnym innym elementem.' };
    // wysokość: przy ramionach punkt szyjny na wysokości szyi, bez ramion szczyt najdłuższego szwu przodu na wysokości pachy
    const E = (e) => e.pts.map((p) => plAp(T[e.pi], p)), mine = seams.filter((s) => (s.a.pi === cf.pi || s.b.pi === cf.pi) && T[s.a.pi] !== undefined && T[s.b.pi] !== undefined).map((s) => (s.a.pi === cf.pi ? s.a : s.b));
    if (!mine.length) return { err: 'Przód nie ma żadnego szwu z innym elementem.' };
    const pit = a.Dts - a.Gp - 1, cfQ = ring(cf.pi).map((p) => plAp(T[cf.pi], p)), v0 = Math.min(...cfQ.map((p) => p[1])), v1 = Math.max(...cfQ.map((p) => p[1])); let dV;
    const sh = an.trzym === 'ramiona' ? mine.filter((e) => e.len < 32 && plCen(E(e))[1] < v0 + 0.25 * (v1 - v0)).sort((x, y) => plCen(E(x))[1] - plCen(E(y))[1])[0] : null;
    if (sh) { const q = E(sh), np = q[0][0] < q[q.length - 1][0] ? q[0] : q[q.length - 1]; dV = -a.Dts - np[1]; }
    else { const sd = mine.slice().sort((x, y) => y.len - x.len)[0], q = E(sd), top = q[0][1] < q[q.length - 1][1] ? q[0] : q[q.length - 1]; dV = -(pit - 1.5) - top[1]; }
    for (const k of keys) T[k] = [T[k][0], T[k][1], T[k][2], T[k][3], T[k][4], T[k][5] + dV];
    const Ucb = cb && T[cb.pi] !== undefined ? Math.max(8, plCen(E(cb))[0]) : 0;
    // elementy i szwy w postaci dla silnika tkaniny
    const tagOf = new Map(), outSeams = []; if (cf) tagOf.set(cf, 'center'); if (cb && T[cb.pi] !== undefined) tagOf.set(cb, 'center');
    const key = (u, v) => Math.abs(u[1] - v[1]) + Math.abs(Math.min(Math.abs(u[0]), Ucb ? Math.abs(Ucb - u[0]) : 1e9) - Math.min(Math.abs(v[0]), Ucb ? Math.abs(Ucb - v[0]) : 1e9));
    seams.forEach((s, i) => { if (T[s.a.pi] === undefined || T[s.b.pi] === undefined || tagOf.has(s.a) || tagOf.has(s.b)) return; const qa = E(s.a), qb = E(s.b), a0 = qa[0], a1 = qa[qa.length - 1], b0 = qb[0], b1 = qb[qb.length - 1], rev = key(a0, b0) + key(a1, b1) > key(a0, b1) + key(a1, b0);
      tagOf.set(s.a, 's' + i + 'a'); tagOf.set(s.b, 's' + i + 'b'); outSeams.push({ a: { key: 'p' + s.a.pi, tag: 's' + i + 'a' }, b: { key: 'p' + s.b.pi, tag: 's' + i + 'b' }, rev }); });
    const parts = keys.map((pi) => ({ key: 'p' + pi, ed: all.filter((e) => e.pi === pi).map((e) => ({ pts: E(e), tag: tagOf.get(e) || 'free' })) }));
    // ramiączka: tkanina wisi na najwyższym punkcie przodu i najwyższym punkcie elementu ze środkiem tyłu
    const cbQ = Ucb ? E(cb) : null, cbU = (v) => { if (!cbQ) return 1e9; const p0 = cbQ[0], p1 = cbQ[cbQ.length - 1]; return p0[0] + (p1[0] - p0[0]) * Math.max(0, Math.min(1, (v - p0[1]) / (p1[1] - p0[1] || 1))); };
    const hold = []; if (an.trzym !== 'ramiona') { const topOf = (pi, far) => { let b = null; for (const e of all) if (e.pi === pi) for (const p of E(e)) { const dc = far ? Math.abs(cbU(p[1]) - p[0]) : Math.abs(p[0]); if (dc > 3 && (!b || p[1] < b[1])) b = p; } return b; };
      const hf = topOf(cf.pi, false), bp = cb && T[cb.pi] !== undefined ? cb.pi : keys.filter((k) => k !== cf.pi).sort((x, y) => Math.min(...ring(x).map((p) => plAp(T[x], p)[1])) - Math.min(...ring(y).map((p) => plAp(T[y], p)[1])))[0], hb = bp !== undefined ? topOf(bp, !!Ucb) : null;
      if (hf && hb) hold.push({ key: 'p' + cf.pi, at: hf }, { key: 'p' + bp, at: hb }); }
    let dl = 0, wid = 0; for (const p of parts) for (const e of p.ed) for (const q of e.pts) { dl = Math.max(dl, q[1]); wid = Math.max(wid, q[0]); }
    const skip = pcs.filter((_, i) => T[i] === undefined).map((pc) => String(pc.name || '').replace(/ \(część.*$/, ''));
    const cbLine = Ucb ? (() => { const q = E(cb), p0 = q[0], p1 = q[q.length - 1]; return p0[1] < p1[1] ? [p0, p1] : [p1, p0]; })() : null; // środek tyłu po złożeniu na płasko bywa skośny (rozkloszowanie), więc szerokość połowy ubrania liczę osobno na każdej wysokości
    return { plan: { parts, seams: outSeams, hold, Ucb, cbLine, yMax: an.trzym === 'ramiona' ? null : pit + 8 }, dl, hemC: 4 * (Ucb || wid), skip: skip.filter((x, i, arr) => x && arr.indexOf(x) === i), strap: hold.length === 2 };
  }
  // punkt na łamanej w ułamku jej długości
  function ptOn(pts, f) { const L = swLen(pts); let acc = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc + d >= f * L - 1e-9) { const t = (f * L - acc) / (d || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; } acc += d; } return pts[pts.length - 1]; }
  window.__pl = { plEdges, plAll, impPlan }; // tylko do testów
