  // ---------- biblioteka konstrukcji: własne, stopniowane wykroje jako baza do nowych projektów ----------
  // Dane biblioteki pochodzą z pliku użytkowniczki (kupione wykroje są tylko do użytku własnego), aplikacja niczego nie ma wbudowanego.
  // Element biblioteki ma obrys każdego rozmiaru z tą samą liczbą punktów na krawędź, więc rozmiary można mieszać punkt po punkcie.
  const LIB = { list: [], when: 0 };
  const libPts = (flat) => { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; };
  const libP = (el) => el._p || (el._p = el.obrysy.map(libPts));
  const libGet = (id) => LIB.list.find((k) => k.id === id) || null;
  // krawędzie obrysu: odcinki między narożnikami, każda razem z punktem końcowym
  function libEdges(el, pts) { const out = []; let o = 0; for (const n of el.nE) { const e = []; for (let j = 0; j <= n; j++) e.push(pts[(o + j) % pts.length]); out.push(e); o += n; } return out; }
  // krawędź wspólna dla wszystkich rozmiarów (złożenie, środek): jej punkty nie przesuwają się między najmniejszym a największym rozmiarem
  function libCommon(el) { if (el._wsp) return el._wsp; const P = libP(el), a = libEdges(el, P[0]), b = libEdges(el, P[P.length - 1]); return (el._wsp = a.map((e, i) => P.length > 1 && e.every((p, j) => Math.hypot(p[0] - b[i][j][0], p[1] - b[i][j][1]) < 0.35))); }
  const libStraight = (e) => { const A = e[0], B = e[e.length - 1], l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; let d = 0; for (const p of e) d = Math.max(d, Math.abs((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) / l); return d < 0.25 ? l : 0; };
  // obrys dla ułamkowego numeru rozmiaru; tOf(j) daje każdemu punktowi własny numer (strefy: biust, talia, biodra)
  function libShape(el, t, tOf) {
    const P = libP(el), ix = el.idx, n = ix.length; if (n === 1) return P[0].map((p) => p.slice());
    const seg = (tt) => { let k = 0; while (k < n - 2 && tt > ix[k + 1]) k++; const f = (tt - ix[k]) / (ix[k + 1] - ix[k]); return [k, Math.max(-1.5, Math.min(2.5, f))]; };
    return P[0].map((_, j) => { const [k, f] = seg(tOf ? tOf(j) : t), a = P[k][j], b = P[k + 1][j]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; });
  }
  // strzałka nitki prostej: kreska z grotem narysowana jedną ścieżką (koniec, grot, dwa wąsy); grot wskazuje dół ubrania
  function libDown(el) {
    if (el._down !== undefined) return el._down; let best = null;
    for (const z of el.znaki || []) { const p = z.p; if (z.ds || p.length < 4 || p.length > 7) continue; let d = 0, a = 0, b = 0;
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) { const l = Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]); if (l > d) { d = l; a = i; b = j; } }
      if (d < 5 || z.dl - d < 0.8 || z.dl - d > 8) continue;
      const near = (k) => p.filter((q) => { const l = Math.hypot(q[0] - p[k][0], q[1] - p[k][1]); return l > 0.05 && l < 3; }).length, nA = near(a), nB = near(b); if (nA === nB) continue;
      const tip = nA > nB ? p[a] : p[b], tail = nA > nB ? p[b] : p[a]; if (!best || d > best.l) best = { l: d, d: [(tip[0] - tail[0]) / d, (tip[1] - tail[1]) / d] }; }
    return (el._down = best ? best.d : null);
  }
  // układ elementu: środek (prosta krawędź równoległa do nitki, najchętniej wspólna dla wszystkich rozmiarów) i kierunek w dół
  function libFrame(el) {
    if (el._fr !== undefined) return el._fr; const P = libP(el), big = P[P.length - 1], E = libEdges(el, big), wsp = libCommon(el), down = libDown(el); let c = -1, cl = 0;
    E.forEach((e, i) => { const l = libStraight(e); if (!l || l < 8) return; const A = e[0], B = e[e.length - 1], al = down ? Math.abs(((B[0] - A[0]) * down[0] + (B[1] - A[1]) * down[1]) / l) : 1; if (al < 0.94) return; const sc = l * (wsp[i] ? 3 : 1); if (sc > cl) { cl = sc; c = i; } });
    if (c >= 0) { const A = E[c][0], B = E[c][E[c].length - 1], l = Math.hypot(B[0] - A[0], B[1] - A[1]); let sg = 0; for (const p of big) { const d = ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) / l; if (Math.abs(d) < 0.6) continue; if (!sg) sg = Math.sign(d); else if (Math.sign(d) !== sg) { c = -1; break; } } }
    let dn = down;
    if (c >= 0) { const A = E[c][0], B = E[c][E[c].length - 1], l = Math.hypot(B[0] - A[0], B[1] - A[1]), d0 = [(B[0] - A[0]) / l, (B[1] - A[1]) / l], n = E.length;
      if (down) dn = d0[0] * down[0] + d0[1] * down[1] >= 0 ? d0 : [-d0[0], -d0[1]];
      else { // bez strzałki: przy dekolcie albo talii pierwszy narożnik za końcem środka leży bliżej środka niż przy dole
        const pe = E[(c - 1 + n) % n][0], nx = E[(c + 1) % n], ne = nx[nx.length - 1], dist = (p) => Math.abs((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) / l; dn = dist(pe) <= dist(ne) ? d0 : [-d0[0], -d0[1]]; } }
    if (!dn) return (el._fr = null);
    return (el._fr = { c, down: dn, known: !!down });
  }
  // przejście do układu elementu (x od środka w bok, y w dół od najwyższego punktu) i z powrotem na arkusz
  function libXf(el, pts) {
    const fr = libFrame(el); if (!fr) return null; const dn = fr.down, px = [-dn[1], dn[0]], raw = pts.map((p) => [p[0] * px[0] + p[1] * px[1], p[0] * dn[0] + p[1] * dn[1]]), y0 = Math.min(...raw.map((q) => q[1])), mx = raw.reduce((s, q) => s + q[0], 0) / raw.length; let x0 = mx, sg = 1;
    if (fr.c >= 0) { const e = libEdges(el, raw)[fr.c]; x0 = (e[0][0] + e[e.length - 1][0]) / 2; if (mx - x0 < 0) sg = -1; }
    return { Q: raw.map((q) => [sg * (q[0] - x0), q[1] - y0]), back: (q) => { const X = sg * q[0] + x0, Y = q[1] + y0; return [X * px[0] + Y * dn[0], X * px[1] + Y * dn[1]]; } };
  }
  const libToFrame = (el, pts) => { const x = libXf(el, pts); return x ? x.Q : null; };
  // przerysowanie obrysu w układzie elementu: fn dostaje punkt [x od środka, y od góry] i oddaje nowy
  const libWarp = (el, pts, fn) => { const x = libXf(el, pts); return x ? x.Q.map((q) => x.back(fn(q))) : pts; };
  // obejście półelementu od górnego końca środka, bokiem, do dolnego końca środka
  function libWalk(el, pts) {
    const fr = libFrame(el); if (!fr || fr.c < 0) return null; const F = libToFrame(el, pts), N = F.length, off = [0]; for (const k of el.nE) off.push(off[off.length - 1] + k);
    const s = off[fr.c] % N, e = off[fr.c + 1] % N, topIsStart = F[s][1] < F[e][1], Q = [], cor = [], isCor = new Set(off.slice(0, -1).map((v) => v % N));
    if (topIsStart) { for (let j = s, g = 0; g <= N; g++, j = (j - 1 + N) % N) { if (g && isCor.has(j) && j !== e) cor.push(Q.length); Q.push(F[j]); if (j === e) break; } }
    else { for (let j = e, g = 0; g <= N; g++, j = (j + 1) % N) { if (g && isCor.has(j) && j !== s) cor.push(Q.length); Q.push(F[j]); if (j === s) break; } }
    const x0 = Q[0][0]; return { Q: Q.map((q) => [q[0] - x0, q[1]]), cor };
  }
  // to samo obejście po zamknięciu zaszewek. Zaszewka to wcięcie w obrysie: dwa proste, prawie równe ramiona między trzema kolejnymi narożnikami.
  // Zamknięcie przesuwa część obrysu za zaszewką tak, żeby jej wylot się zszedł; przesunięcie maleje do zera na wysokości wierzchołka.
  // Zaszewka od boku zabiera długość szwu bocznego poniżej, zaszewka od talii albo dołu zabiera szerokość po stronie boku.
  function libWalkC(el, pts) {
    const w = libWalk(el, pts); if (!w) return null; let Q = w.Q.map((q) => q.slice()), cor = w.cor.slice(); const darts = [];
    const dev = (A, B, p) => { const l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; return Math.abs((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) / l; };
    const run = (ib, st) => { let end = ib + st; for (let j = ib + 2 * st; j > 0 && j < Q.length - 1; j += st) { let ok = true; for (let t = ib + st; ok && t !== j; t += st) if (dev(Q[ib], Q[j], Q[t]) > 0.3) ok = false; if (!ok) break; end = j; } return end; };
    for (let guard = 0; guard < 6; guard++) {
      let hit = null;
      const cand = []; for (let t = 3; t < Q.length - 3; t++) { const b = Q[t], a = Q[t - 2], c = Q[t + 2], l1 = Math.hypot(a[0] - b[0], a[1] - b[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]); if (l1 < 0.5 || l2 < 0.5) continue; const cs = ((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / (l1 * l2); if (cs >= 0.55 && (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0) cand.push([cs, t]); } cand.sort((p, q) => q[0] - p[0]);
      for (const cd of cand) { const ib = cd[1], ia = run(ib, -1), ic = run(ib, 1), a = Q[ia], b = Q[ib], c = Q[ic], l1 = Math.hypot(a[0] - b[0], a[1] - b[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]); if (l1 < 2.5 || l2 < 2.5 || Math.abs(l1 - l2) > 0.3 * Math.max(l1, l2)) continue;
        const cs = ((a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])) / (l1 * l2), mouth = Math.hypot(a[0] - c[0], a[1] - c[1]), turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if (cs >= 0.78 && mouth >= 0.5 && mouth < 0.7 * Math.max(l1, l2) && turn < 0) { hit = [ia, ib, ic]; break; } }
      if (!hit) break;
      const ia = hit[0], ib = hit[1], ic = hit[2], a = Q[ia], b = Q[ib], c = Q[ic], mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], L = Math.hypot(mid[0] - b[0], mid[1] - b[1]) || 1, u = [(mid[0] - b[0]) / L, (mid[1] - b[1]) / L], hor = Math.abs(u[0]) > Math.abs(u[1]), after = hor || u[1] < 0;
      const wOf = (p) => Math.max(0, Math.min(1, ((p[0] - b[0]) * u[0] + (p[1] - b[1]) * u[1]) / L)); darts.push({ at: b.slice(), u, L, lo: Math.max(a[1], c[1]), mouth: Math.hypot(a[0] - c[0], a[1] - c[1]), len: Math.hypot(a[0] - b[0], a[1] - b[1]), hor });
      if (after) { const sh = [a[0] - c[0], a[1] - c[1]]; for (let j = ic, s = 0; j < Q.length; j++, s++) { const wg = wOf(Q[j]); if (wg <= 0 && s > 2) break; Q[j] = [Q[j][0] + sh[0] * wg, Q[j][1] + sh[1] * wg]; } }
      else { const sh = [c[0] - a[0], c[1] - a[1]]; for (let j = ia, s = 0; j >= 0; j--, s++) { const wg = wOf(Q[j]); if (wg <= 0 && s > 2) break; Q[j] = [Q[j][0] + sh[0] * wg, Q[j][1] + sh[1] * wg]; } }
      const r = ic - ia; Q = Q.slice(0, ia + 1).concat(Q.slice(ic + 1)); cor = cor.filter((t) => t < ia || t > ic).map((t) => (t > ic ? t - r : t));
    }
    cor = cor.filter((t, i) => !i || Math.hypot(Q[t][0] - Q[cor[i - 1]][0], Q[t][1] - Q[cor[i - 1]][1]) > 0.8); // dwa narożniki w tym samym miejscu liczą się jako jeden
    Q[Q.length - 1][0] = 0; return { Q, cor, darts };
  }
  // przód albo tył z ramieniem i pachą. Punkt szyi to najwyższy narożnik, za nim prosty szew ramienia, podkrój pachy, bok aż do narożnika dołu.
  // Dodatkowe narożniki na boku (odcięcie, rozporek) nie przeszkadzają, bo krawędzie są liczone od góry.
  function libBodice(wc, top, pit, noSleeve) {
    const W = wc.Q, cor = wc.cor, n = W.length; if (cor.length < 2) return null;
    const yB = W[n - 1][1], yT = Math.min(...W.map((p) => p[1])), H = yB - yT; let hc = -1, np = -1;
    for (const t of cor) if (W[t][1] > yB - 0.3 * H && (hc < 0 || W[t][0] > W[hc][0])) hc = t; if (hc < 0) return null;
    for (const t of cor) if (t < hc && W[t][0] >= 2.5 && W[t][0] <= 24 && (np < 0 || W[t][1] < W[np][1] - 0.01)) np = t;
    const ci = np < 0 ? -9 : cor.indexOf(np), T0 = (dy) => (a) => a.map((p) => [Math.max(0, p[0]), p[1] + dy]);
    // szczyt boku: najdalszy od środka narożnik w górnej części, poniżej punktu from
    const sideTop = (from) => { let ua = -1; const lim = W[from][1] + 0.6 * (W[hc][1] - W[from][1]); for (let q = cor.indexOf(from) + 1; q < cor.length && cor[q] < hc; q++) { const t = cor[q]; if (W[t][1] > W[from][1] + 3 && W[t][1] <= lim && (ua < 0 || W[t][0] > W[ua][0] + 0.3)) ua = t; } return ua; };
    const fin = (ed, extra) => { const bt = ed[ed.length - 1]; ed.push({ pts: [[0, bt.pts[bt.pts.length - 1][1]], [0, ed[0].pts[0][1]]], tag: 'center' }); bt.pts[bt.pts.length - 1][0] = 0; ed[0].pts[0][0] = 0; const sd = ed.find((e) => e.tag === 'side').pts; return Object.assign({ ax: null, cb: W[n - 1][1] - W[0][1], ed, side: swLen(sd), sideY: sd[sd.length - 1][1], hem: W[hc][0], bot: Math.max(...ed.map((e) => Math.max(...e.pts.map((p) => p[1])))), sa: 0, lib: true }, extra); };
    const sp = ci < 0 || W[np][1] > yT + 6 ? undefined : cor[ci + 1], sh = sp !== undefined && sp < hc ? W.slice(np, sp + 1) : null, shL = sh ? swLen(sh) : 0;
    if (sh && shL >= 2.5 && shL <= 34 && W[sp][0] - W[np][0] >= 0.6 * shL && W[sp][1] >= W[np][1] - 1 && Math.hypot(W[sp][0] - W[np][0], W[sp][1] - W[np][1]) >= 0.975 * shL) { const ua = sideTop(sp); if (ua < 0 || W[ua][1] < W[sp][1] + 6) return null; const arL = swLen(W.slice(sp, ua + 1)); if (arL < 10 || arL > 48) return null;
      const dy = -top - W[np][1], T = T0(dy); return fin([{ pts: T(W.slice(0, np + 1)), tag: 'neck' }, { pts: T(sh), tag: 'shoulder' }, { pts: T(W.slice(sp, ua + 1)), tag: 'arm' }, { pts: T(W.slice(ua, hc + 1)), tag: 'side' }, { pts: T(W.slice(hc)), tag: 'bottom' }], { sh: shL, arm: arL, dy }); }
    // bez szwu ramienia: góra na ramiączkach. Szczyt boku staje tuż pod pachą sylwetki, ramiączko trzyma najwyższy punkt.
    if (noSleeve) return libStrapTop(W, cor, hc, pit, fin, T0);
    return null;
  }
  function libStrapTop(W, cor, hc, pit, fin, T0) {
    const yT = Math.min(...W.map((p) => p[1])), H = W[W.length - 1][1] - yT, lim = yT + 0.45 * H; let mx = 0; for (let t = 0; t < hc; t++) if (W[t][1] <= lim) mx = Math.max(mx, W[t][0]);
    let ua = -1; for (const t of cor) if (t < hc && W[t][1] <= lim && W[t][0] >= 0.75 * mx && (ua < 0 || W[t][0] > W[ua][0] + 0.3)) ua = t;
    if (ua < 0) { for (let t = 1; t < hc; t++) if (W[t][1] <= lim && (ua < 0 || W[t][0] - W[t][1] > W[ua][0] - W[ua][1])) ua = t; }
    if (ua < 1 || swLen(W.slice(ua, hc + 1)) < 8) return null;
    let pk = -1; for (const t of cor) if (t < ua && W[t][0] >= 2.5 && W[t][0] <= W[ua][0] - 4 && W[t][1] < W[ua][1] - 3 && (pk < 0 || W[t][1] < W[pk][1])) pk = t;
    const dy = -(pit - 1.5) - W[ua][1], T = T0(dy), ed = pk > 0 ? [{ pts: T(W.slice(0, pk + 1)), tag: 'neck' }, { pts: T(W.slice(pk, ua + 1)), tag: 'arm' }] : [{ pts: T(W.slice(0, ua + 1)), tag: 'neck' }];
    ed.push({ pts: T(W.slice(ua, hc + 1)), tag: 'side' }, { pts: T(W.slice(hc)), tag: 'bottom' }); return fin(ed, { sh: 0, arm: 0, dy, strap: { pk: pk > 0 ? T([W[pk]])[0] : null, cands: [] } });
  }
  // panel spódnicy: talia (od środka do boku), bok, dół. Szczyt boku to najdalszy od środka narożnik w górnej części, róg dołu to najdalszy narożnik przy dole.
  function libSkirt(wc) {
    if (!wc) return null; const Q = wc.Q, yT = Math.min(...Q.map((q) => q[1])), yB = Math.max(...Q.map((q) => q[1])), H = yB - yT; if (H < 15 || !wc.cor.length) return null;
    let hc = -1, sc = -1; for (const t of wc.cor) if (Q[t][1] > yT + 0.4 * H && (hc < 0 || Q[t][0] > Q[hc][0])) hc = t; if (hc < 0) return null;
    for (const t of wc.cor) if (t < hc && Q[t][1] < yT + 0.35 * H && (sc < 0 || Q[t][0] > Q[sc][0])) sc = t; if (sc < 0) return null;
    return { waist: Q.slice(0, sc + 1), side: Q.slice(sc, hc + 1), hem: Q.slice(hc), H, yT: Q[sc][1], darts: wc.darts };
  }
  // ---------- dopasowanie do wymiarów ----------
  // ułamkowy numer rozmiaru dla wymiaru ciała: między kolumnami tabeli rozmiarów, najwyżej jeden rozmiar poza tabelą
  const libT = (arr, v) => { const n = arr.length; if (!arr || n < 2 || !(v > 0)) return 0; if (v <= arr[0]) return Math.max(-1, (v - arr[0]) / (arr[1] - arr[0])); for (let i = 1; i < n; i++) if (v <= arr[i]) return i - 1 + (v - arr[i - 1]) / (arr[i] - arr[i - 1]); return Math.min(n, n - 1 + (v - arr[n - 1]) / (arr[n - 1] - arr[n - 2])); };
  const libSizes = (k, m) => ({ b: libT(k.tabela.biust, m.og), t: libT(k.tabela.talia, m.ot), h: libT(k.tabela.biodra, m.ob) });
  function libSizeName(k, t) { const n = k.rozmiary.length, i = Math.max(0, Math.min(n - 1, Math.round(t))), d = t - i, nm = k.rozmiary[i]; if (Math.abs(d) < 0.15) return nm; if (d > 0) return i === n - 1 ? nm + ', poszerzony ponad tabelę' : 'między ' + nm + ' a ' + k.rozmiary[i + 1]; return i === 0 ? nm + ', zwężony poniżej tabeli' : 'między ' + k.rozmiary[i - 1] + ' a ' + nm; }
  const libElastic = (k) => /gum/i.test(k.cechy || '');
  const libClampT = (t, ref) => Math.max(ref - 2, Math.min(ref + 2, t));
  // Każda strefa elementu dostaje rozmiar ze swojego wymiaru. Spódnica dopasowana w talii: talia u góry, biodra na wysokości bioder.
  // Przód i tył góry albo sukienki: biust do linii pachy, talia w talii, biodra na wysokości bioder. Pozostałe elementy idą za wymiarem głównym.
  function libFitEl(k, el, m, T, a) {
    const main = el.rola === 'F' || el.rola === 'B', P = libP(el), base = k.typ === 'spodnica' ? (libElastic(k) ? T.h : /pasek/.test(el.id) ? T.t : Math.max(T.t, T.h)) : T.b;
    const xf = main && P.length > 1 ? libXf(el, P[Math.max(0, Math.min(P.length - 1, Math.round(base)))]) : null; if (!xf) return libShape(el, base);
    if (k.typ === 'spodnica') { if (libElastic(k)) return libShape(el, base); const hip = Math.max(14, m.wb || 20); return libShape(el, 0, (j) => { const f = Math.max(0, Math.min(1, (xf.Q[j][1] - 1) / (hip - 1))); return T.t + (T.h - T.t) * f; }); }
    const yb = a.Gp + 3, yw = a.Dts, yh = a.Dts + (m.wb || 20), tt = libClampT(T.t, T.b), th = libClampT(T.h, T.b);
    return libShape(el, 0, (j) => { const y = xf.Q[j][1]; return y <= yb ? T.b : y <= yw ? T.b + (tt - T.b) * ((y - yb) / (yw - yb)) : y <= yh ? tt + (th - tt) * ((y - yw) / (yh - yw)) : th; });
  }
  const libArea = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const libLen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  const libCut = (el) => 'wytnij ' + (el.ile || 1) + '×' + (el.tryb === 'zlozenie' ? ' ze złożenia' : el.tryb === 'para' ? ' w lustrzanej parze' : el.tryb === 'zlozenie+para' ? ', część ze złożenia, część w parze' : '');
  // element aplikacji z obrysu: linia szycia jako linia cięcia (biblioteka nie zawiera zapasów), znaki z arkusza jako linie pomocnicze
  function libPiece(i, name, pts, o) {
    const b = [1e9, 1e9, -1e9, -1e9]; for (const p of pts) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }
    const ring = pts.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]); ring.push(ring[0].slice());
    const prims = /** @type {any[]} */ ([{ t: 'poly', s: 'cut', pts: ring }]); for (const z of o.znaki || []) if (!z.ds && z.p.length <= 7 && z.p.every((p) => p[0] > b[0] - 0.3 && p[0] < b[2] + 0.3 && p[1] > b[1] - 0.3 && p[1] < b[3] + 0.3)) prims.push({ t: 'poly', s: 'aux', pts: z.p });
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; prims.push({ t: 'text', x: cx, y: cy, text: name, size: 'M', anchor: 'middle' }); if (o.cut) prims.push({ t: 'text', x: cx, y: cy + 1.6, text: o.cut, size: 'S', anchor: 'middle' });
    return Object.assign({ id: 'lib-' + (i + 1), name, cut: o.cut || '', hemIn: [], prims, box: { x0: b[0], y0: b[1], x1: b[2], y1: b[3] }, noteAt: null, w: b[2] - b[0], h: b[3] - b[1], marks: [{ pn: 1, x: cx, y: b[1], seen: true, box: b.slice() }] }, o.role ? { role: o.role } : {}, o.lib ? { lib: o.lib } : {});
  }
  // elementy ułożone obok siebie na jednym arkuszu roboczym; znaki z arkusza zostają tylko przy elementach, których kształt się nie zmienił
  function libLayout(items) { let x = 2, y = 2, rowH = 0; const out = []; for (const it of items) { const b = [1e9, 1e9, -1e9, -1e9]; for (const p of it.pts) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); } const w = b[2] - b[0], h = b[3] - b[1]; if (x > 2 && x + w > 260) { x = 2; y += rowH + 4; rowH = 0; } const dx = x - b[0], dy = y - b[1]; out.push(Object.assign({}, it, { pts: it.pts.map((p) => [p[0] + dx, p[1] + dy]), znaki: (it.znaki || []).map((z) => ({ ds: z.ds, p: z.p.map((p) => [p[0] + dx, p[1] + dy]) })) })); x += w + 4; rowH = Math.max(rowH, h); } return out; }
  // przycięcie wielokąta do półpłaszczyzny (p - o)·n <= 0
  function libClip(pts, o, n) { const out = [], d = (p) => (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1]; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], da = d(a), db = d(b); if (da <= 0) out.push(a); if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; }
  const libTmp = (name, role, pts) => { const ring = pts.map((p) => p.slice()); ring.push(ring[0].slice()); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return { name, role, prims: [{ t: 'poly', s: 'cut', pts: ring }], w: x1 - x0, h: y1 - y0 }; };
  const libEd = (piece, tag) => { const e = piece.ed.find((q) => q.tag === tag); return e ? e.pts : null; };
  // ---------- projekt z biblioteki: elementy 2D, zszycie do 3D i sprawozdanie ----------
  // spec: { all: { k, dl } } albo { top: { k, dy }, bot: { k, dl }, mode: 'marszcz' | 'szer' | 'talia' }
  function libBuild(spec, m) {
    const a = W.full(m), pit = a.Dts - a.Gp - 1, rep = { fit: [], join: null, seams: [], miss: [], darts: [] }, items = [], an = { typ: 'inne', trzym: '' };
    let kT = spec.all ? libGet(spec.all.k) : spec.top ? libGet(spec.top.k) : null, kB = spec.bot ? libGet(spec.bot.k) : null;
    if ((spec.all && !kT) || (spec.top && !kT) || (spec.bot && !kB)) return { err: 'Tej konstrukcji nie ma już w bibliotece. Wczytaj bibliotekę jeszcze raz.' };
    if (kT && kT.typ === 'spodnica' && !kB) { kB = kT; kT = null; }
    const fitOf = (k) => { const T = libSizes(k, m), key = k.typ === 'spodnica' ? (libElastic(k) ? 'h' : 't') : 'b'; rep.fit.push({ k: k.nazwa, size: libSizeName(k, T[key]), by: key, T, zones: k.typ !== 'spodnica' && (Math.abs(T.t - T.b) > 0.4 || Math.abs(T.h - T.b) > 0.4) }); return T; };
    const els = (k) => { const T = fitOf(k); return k.elementy.map((el) => ({ el, k, pts: libFitEl(k, el, m, T, a), wc: null, bod: null })); };
    const top = kT ? els(kT) : null, bot = kB ? els(kB) : null, joined = !!(top && bot), dl = (spec.bot && spec.bot.dl) || (spec.all && spec.all.dl) || 0;
    const by = (list, r) => list.find((it) => it.el.rola === r) || null;
    // --- góra: przód i tył po zamknięciu zaszewek, rozpoznanie ramienia, pachy i boku
    let rT = null; const tF = top && by(top, 'F'), tB = top && by(top, 'B'), tS = top && by(top, 'S');
    if (top) {
      for (const it of [tF, tB]) { if (!it) continue; it.wc = libWalkC(it.el, it.pts); if (!it.wc) continue; it.bod = libBodice(it.wc, a.Dts, pit, !tS);
        if (!it.bod) { try { const r = /** @type {any} */ (swBodice(libTmp(it.el.nazwa, it.el.rola, it.wc.Q), a.Dts, pit)); if (!r.err && r.kim) it.bod = r; } catch (e) { /* zostaje bez rozpoznania */ } }
        for (const d of it.wc.darts) rep.darts.push({ el: it.el.nazwa, mouth: d.mouth, len: d.len, hor: d.hor }); }
      if (!tF || !tB) rT = { err: 'Ta konstrukcja nie ma jednego przodu i jednego tyłu (jest szyta z paneli), a takiej góry nie umiem jeszcze zszyć w 3D.' };
      else if (!tF.wc || !tB.wc) rT = { err: 'Przód albo tył nie ma prostej linii środka, więc nie umiem ich ułożyć na sylwetce.' };
      else if (!tF.bod || !tB.bod) rT = { err: tS ? 'Rękaw tej konstrukcji jest wszyty inaczej niż w klasyczną pachę (na przykład raglan), a tego jeszcze nie umiem zszyć w 3D.' : 'Nie umiem wskazać ramienia i pachy na przodzie albo tyle.' };
      else { const tmp = [libTmp(tF.el.nazwa, 'F', tF.wc.Q), libTmp(tB.el.nazwa, 'B', tB.wc.Q)];
        if (tS) { const w = /zlozenie/.test(tS.el.tryb || '') ? libWalk(tS.el, tS.pts) : null; tmp.push(libTmp(tS.el.nazwa, 'S', w ? w.Q.concat(w.Q.slice(1, -1).reverse().map((q) => [-q[0], q[1]])) : tS.pts)); }
        const cuff = by(top, 'C'); if (cuff) tmp.push(libTmp(cuff.el.nazwa, 'C', cuff.pts));
        const dS = tF.bod.side - tB.bod.side, hiLo = tF.bod.lib && tB.bod.lib && Math.abs(dS) > 2 && Math.abs(dS - (tF.bod.sideY - tB.bod.sideY)) < 1.5; if (hiLo) rep.miss.push((dS > 0 ? 'Przód' : 'Tył') + ' jest przy boku dłuższy o ' + f1(Math.round(Math.abs(dS) * 2) / 2) + ' cm. Traktuję to jako rozporek albo dłuższy dół, a nie błąd.');
        try { rT = impSew0({ pieces: tmp, an: {} }, m, { F: tF.bod, B: tB.bod, loose: hiLo }); } catch (e) { rT = { err: 'Nie umiem jeszcze zszyć góry tego fasonu.' }; } }
    }
    // --- dół: panele przodu i tyłu spódnicy
    let sk = null; const bF = bot && by(bot, 'F'), bB = bot && by(bot, 'B');
    const cutY = joined ? (spec.top && spec.top.dy) || 0 : 0, botDress = !!(kB && kB.typ !== 'spodnica'), bS = bot && by(bot, 'S');
    const lower = (it) => { const side = libEd(it.bod, 'side'), hem = libEd(it.bod, 'bottom'), keep = []; if (!side || side[side.length - 1][1] < cutY + 8) return null; let xw = side[0][0];
      for (let i = 0; i < side.length; i++) { const p = side[i]; if (p[1] < cutY) { xw = p[0]; continue; } if (!keep.length) { const q = side[i - 1] || p, t = (cutY - q[1]) / ((p[1] - q[1]) || 1); xw = i ? q[0] + (p[0] - q[0]) * t : p[0]; keep.push([xw, Math.max(cutY, i ? cutY : p[1])]); } keep.push(p.slice()); }
      return keep.length > 2 ? { waist: [[0, keep[0][1]], keep[0].slice()], side: keep, hem: hem.map((p) => p.slice()), H: side[side.length - 1][1] - keep[0][1], yT: keep[0][1], darts: [] } : null; };
    if (bot && bF && bB) { for (const it of [bF, bB]) { it.wc = libWalkC(it.el, it.pts); if (botDress && it.wc) it.bod = libBodice(it.wc, a.Dts, pit, !bS); }
      const SF = botDress ? (bF.bod && bB.bod ? lower(bF) : null) : libSkirt(bF.wc), SB = botDress ? (bF.bod && bB.bod ? lower(bB) : null) : libSkirt(bB.wc); if (SF && SB) sk = { F: SF, B: SB }; }
    if (sk) { // obwód górnej krawędzi i gotowa talia: długość paska, gdy pasek jest dopasowany (bez gumy)
      const T = libSizes(kB, m), band = botDress ? null : kB.elementy.find((e) => e.id === 'pasek'); sk.raw = 2 * (libLen(sk.F.waist) + libLen(sk.B.waist)); let bw = 0;
      if (band && !libElastic(kB)) { const bp = libShape(band, T.t), xs = bp.map((p) => p[0]), ys = bp.map((p) => p[1]); bw = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * (/zlozenie/.test(band.tryb || '') ? 2 : 1); }
      sk.fin = bw > 0.6 * m.ot && bw < sk.raw + 1 ? bw : sk.raw; if (!botDress) for (const it of [bF, bB]) for (const d of it.wc.darts) rep.darts.push({ el: it.el.nazwa, mouth: d.mouth, len: d.len, hor: d.hor });
    }
    // zmiana długości spódnicy: część poniżej połowy długości jest rozciągana, szerokość dołu zostaje
    const lenY = (y, S) => { const ym = S.yT + 0.5 * S.H, low = S.H * 0.5; if (!dl || y <= ym) return y; return ym + (y - ym) * Math.max(0.2, (low + dl) / low); };
    let sew = null, J = null; const warpTop = {}, warpBot = {};
    if (joined && rT && !rT.err && sk) {
      const side0 = {}, P = {}; let topW = 0;
      for (const [id, R] of [['przod', 'F'], ['tyl', 'B']]) { const pc = rT.pieces.find((q) => q.id === id), side = pc && libEd(pc, 'side'); if (!side) return { err: 'Góra nie ma szwu bocznego, do którego umiem doszyć spódnicę.' };
        const yEnd = side[side.length - 1][1], yc = Math.max(side[0][1] + 2, Math.min(cutY, yEnd)), keep = []; let xw = side[side.length - 1][0];
        for (let i = 0; i < side.length; i++) { const p = side[i]; if (p[1] <= yc || !i) { keep.push(p); xw = p[0]; } else { const q = side[i - 1], t = (yc - q[1]) / ((p[1] - q[1]) || 1); xw = q[0] + (p[0] - q[0]) * t; keep.push([xw, yc]); break; } }
        side0[R] = keep; P[R] = { pc, yc, xw }; topW += 2 * xw; }
      const raw = sk.raw, fin = sk.fin, auto = Math.abs(raw - topW) <= 1.5 || Math.abs(fin - topW) <= 1.5, canTalia = fin < raw - 1.5 && fin < topW - 1.5;
      let mode = spec.mode === 'szer' || (spec.mode === 'talia' && canTalia) ? spec.mode : 'marszcz'; if (auto) mode = 'marszcz';
      const Ct = auto ? topW : mode === 'talia' ? fin : Math.min(topW, raw), kTop = Ct / topW, merged = [];
      J = { topW, botRaw: raw, botFin: fin, seam: Ct, auto, how: auto ? (Math.abs(raw - topW) <= 1.5 ? 'raw' : 'fin') : '', mode, canTalia, waistY: P.F.yc, diff: raw - topW };
      for (const [id, R] of [['przod', 'F'], ['tyl', 'B']]) { const { pc, yc, xw } = P[R], S = sk[R], xSeam = xw * kTop, xs = S.side[0][0], ys0 = S.side[0][1], s0 = xSeam / xs, Hside = S.side[S.side.length - 1][1] - ys0;
        // spódnica: przy zmianie szerokości zwężona na całej długości (duża nadwyżka) albo do linii bioder; przy marszczeniu i zakładkach szerokość wraca tuż pod szwem
        const uni = mode === 'szer' && raw > topW && s0 < 0.8, Hs = mode === 'szer' && raw > topW ? Math.max(8, m.wb || 20) : (s0 < 0.8 ? Hside : Math.min(12, 0.3 * Hside)), /* duża nadwyżka (zakładki, marszczenie) rozchodzi się na całej długości, mała tuż pod szwem */ sx = (y) => (uni ? s0 : s0 + (1 - s0) * Math.max(0, Math.min(1, (y - ys0) / Hs)));
        const mapS = (q) => [Math.max(0, q[0] * sx(q[1])), yc + (lenY(q[1], S) - ys0)];
        if (mode === 'szer' && raw > topW) warpBot[R] = (q) => [q[0] * sx(q[1]), q[1]];
        // góra: zwężona od linii biustu (gdy zmienia się jej szerokość) albo zmarszczona tuż nad szwem
        let sideT = side0[R]; if (kTop < 0.999) { const redraw = mode !== 'marszcz', y1 = redraw ? Math.min(yc - 4, -pit + 3) : yc - 5, f = (y) => 1 - (1 - kTop) * Math.max(0, Math.min(1, (y - y1) / (yc - y1))); sideT = sideT.map((p) => [p[0] * f(p[1]), p[1]]); if (redraw) warpTop[R] = { f, y1 }; }
        const sSide = S.side.map(mapS), sHem = S.hem.map(mapS); sHem[sHem.length - 1][0] = 0; sSide[0] = sideT[sideT.length - 1].slice();
        const ed = pc.ed.filter((q) => q.tag !== 'side' && q.tag !== 'bottom' && q.tag !== 'center').map((q) => ({ pts: q.pts, tag: q.tag }));
        ed.push({ pts: sideT.concat(sSide.slice(1)), tag: 'side' }, { pts: sHem, tag: 'bottom' }); ed.push({ pts: [[0, sHem[sHem.length - 1][1]], [0, ed[0].pts[0][1]]], tag: 'center' });
        merged.push({ id, ed, prims: [] }); }
      const other = rT.pieces.filter((q) => q.id !== 'przod' && q.id !== 'tyl'), bt = (p) => Math.max(...libEd(p, 'bottom').map((q) => q[1])), hx = (p) => libEd(p, 'bottom')[0][0];
      sew = Object.assign({}, rT, { pieces: merged.concat(other), dl: Math.max(bt(merged[0]), bt(merged[1])), hemC: 2 * (hx(merged[0]) + hx(merged[1])) }); rep.join = J; an.typ = 'sukienka';
    } else if (joined) sew = { err: rT && rT.err ? rT.err : 'Tej spódnicy nie umiem jeszcze doszyć w 3D: potrzebuję osobnego przodu i tyłu z prostą linią środka.' };
    else if (top) { sew = rT; an.typ = kT.typ === 'sukienka' ? 'sukienka' : 'top'; }
    else if (sk) { // sama spódnica: górna krawędź na talii, trzymana w talii jak góra bez ramiączek
      const pieces = [], s0 = Math.min(1, sk.fin / sk.raw);
      for (const [id, R] of [['przod', 'F'], ['tyl', 'B']]) { const S = sk[R], ys0 = S.side[0][1], Hs = s0 < 0.8 ? S.side[S.side.length - 1][1] - ys0 : Math.min(12, 0.3 * (S.side[S.side.length - 1][1] - ys0)), mp = (q) => [Math.max(0, q[0] * (s0 + (1 - s0) * Math.max(0, Math.min(1, (q[1] - ys0) / Hs)))), lenY(q[1], S) - ys0];
        const wst = S.waist.map(mp), sd = S.side.map(mp), hm = S.hem.map(mp); wst[0][0] = 0; hm[hm.length - 1][0] = 0;
        pieces.push({ id, ed: [{ pts: wst, tag: 'neck' }, { pts: sd, tag: 'side' }, { pts: hm, tag: 'bottom' }, { pts: [[0, hm[hm.length - 1][1]], [0, wst[0][1]]], tag: 'center' }], prims: [] }); }
      const bt = (p) => Math.max(...libEd(p, 'bottom').map((q) => q[1])), hx = (p) => libEd(p, 'bottom')[0][0];
      sew = { pieces, dl: Math.max(bt(pieces[0]), bt(pieces[1])), hemC: 2 * (hx(pieces[0]) + hx(pieces[1])), sleeve: null, strap: { F: null, B: null, yMax: 1, waist: true }, gather: null, used: [], skip: [], slErr: '', sa: 0 }; an.typ = 'spodnica';
    } else sew = { err: 'Tej spódnicy nie umiem jeszcze ułożyć w 3D: potrzebuję osobnego przodu i tyłu z prostą linią środka (spódnice z klinów i z jednego elementu pokazuję na razie tylko w 2D).' };
    // --- kontrola szwów: krawędzie, które mają się zejść po zamknięciu zaszewek
    if (rT && !rT.err) { const F = rT.pieces.find((q) => q.id === 'przod'), B = rT.pieces.find((q) => q.id === 'tyl'); for (const [tag, nm] of [['shoulder', 'szew ramienia'], ['side', 'szew boczny góry']]) { const x = F && libEd(F, tag), y = B && libEd(B, tag); if (x && y) rep.seams.push({ nm, a: libLen(x), b: libLen(y) }); }
      if (tS) { const slp = rT.pieces.find((q) => q.id === 'stanik-rekaw'); if (rT.sleeve && slp) rep.seams.push({ nm: 'rękaw', a: libLen(libEd(F, 'arm')) + libLen(libEd(B, 'arm')), b: slp.ed.filter((e) => /^cap/.test(e.tag)).reduce((t, e) => t + libLen(e.pts), 0), sl: true }); else rep.miss.push('Rękaw jest na wykroju 2D, ale w 3D go jeszcze nie wszywam' + (rT.slErr ? ' (' + rT.slErr + ')' : '') + '.'); } }
    if (sk) rep.seams.push({ nm: 'szew boczny spódnicy', a: libLen(sk.F.side), b: libLen(sk.B.side) });
    // --- elementy 2D: te same części po dopasowaniu, odcięciu i zmianach z połączenia
    // na arkuszu roboczym każdy element stoi nitką prostą w pionie, górą do góry
    const up = (el) => { const fr = libFrame(el); if (!fr) return (p) => p; const dn = fr.down, px = [-dn[1], dn[0]]; return (p) => [p[0] * px[0] + p[1] * px[1], p[0] * dn[0] + p[1] * dn[1]]; };
    const add = (it, pts0, nmX, keepMarks, role) => { const R = up(it.el), pts = pts0.map(R); items.push({ pts, znaki: keepMarks ? (it.el.znaki || []).map((z) => ({ ds: z.ds, p: z.p.map(R) })) : [], name: (it.el.nazwa + (nmX || '')).toUpperCase(), cut: libCut(it.el), role: role || '', lib: { k: it.k.id, e: it.el.id } }); };
    // zaszewka od boku: po jej zamknięciu bok poniżej podjeżdża do góry, więc na rozłożonym elemencie linia odcięcia opada ku bokowi o szerokość zaszewki
    const cutAt = (it, yCloth, keepTop, fn) => { const x = libXf(it.el, it.pts), dyE = it.bod.dy, y0 = yCloth - dyE, hd = it.wc.darts.find((d) => d.hor), wOf = (q) => (hd ? Math.max(0, Math.min(1, ((q[0] - hd.at[0]) * hd.u[0] + (q[1] - hd.at[1]) * hd.u[1]) / hd.L)) : 0);
      let Q = x.Q.map((q) => { const l = hd && q[1] > hd.lo - 0.01 ? hd.mouth * wOf(q) : 0; return [q[0], q[1] - l, l]; }); Q = libClip(Q, [0, y0], [0, keepTop ? 1 : -1]).map((q) => (q.length > 2 ? [q[0], q[1] + q[2]] : [q[0], q[1] + (hd ? hd.mouth * Math.max(0, Math.min(1, (q[0] - hd.at[0]) * hd.u[0] / hd.L)) : 0)]));
      if (fn) Q = Q.map(fn); return Q.length > 3 ? Q.map(x.back) : null; };
    if (top) for (const it of top) { const R = it.el.rola; let pts = it.pts, note = '', same = true;
      if (J && (R === 'F' || R === 'B') && it.bod && it.bod.lib) { const wt = warpTop[R], dyE = it.bod.dy, Q = cutAt(it, J.waistY, true, wt ? (q) => [q[0] * wt.f(q[1] + dyE), q[1]] : null); if (Q) { pts = Q; note = ' (odcięty w talii)'; same = false; } }
      add(it, pts, note, same, R !== 'X' ? R : ''); }
    if (bot && botDress) { if (sk) for (const it of [bF, bB]) { const R = it.el.rola, S = sk[R], dyE = it.bod.dy, wf = warpBot[R], Q = cutAt(it, S.yT, false, (q) => { const p = wf ? wf([q[0], q[1] + dyE]) : [q[0], q[1] + dyE]; return [p[0], lenY(p[1], S) - dyE]; }); if (Q) add(it, Q, ' (dół od linii odcięcia)', false, ''); }
      rep.miss.push('Z konstrukcji „' + kB.nazwa + '” biorę tylko dół przodu i tyłu poniżej linii odcięcia.'); }
    else if (bot) for (const it of bot) { const R = it.el.rola; if (joined && it.el.id === 'pasek') { rep.miss.push('Pasek spódnicy pomijam, bo spódnica jest wszyta w dół góry.'); continue; }
      let pts = it.pts, same = true; const S = sk && (R === 'F' || R === 'B') ? sk[R] : null;
      if (S && (dl || warpBot[R])) { const wf = warpBot[R]; pts = libWarp(it.el, it.pts, (q) => { const p = wf ? wf(q) : q; return [p[0], lenY(p[1], S)]; }); same = false; }
      add(it, pts, '', same, ''); }
    const laid = libLayout(items), pieces = laid.map((it, i) => libPiece(i, it.name, it.pts, it)), src = [kT, kB].filter(Boolean);
    Object.assign(an, { el: [], skip: [], sa: { inc: false, cm: 1, ex: [] }, skos: false, pasm: [], marka: '', uw: src.map((k) => ({ k: 'zapas', t: k.nazwa + ': ' + k.zapas + '.', s: 'biblioteka' })), syl: null, szwy: [], srodek: { p: [], t: [] }, rozloz: [], dol: [], rozm: [], body: null });
    return { pieces, an, sew, rep };
  }
  // ---------- projekt z biblioteki w aplikacji ----------
  const libRt = new WeakMap(); // wynik ostatniego przeliczenia dla danego projektu: zszycie do 3D i sprawozdanie
  // elementy projektu są przeliczane z biblioteki przy każdej zmianie wymiarów modelki albo ustawień połączenia
  function libSync(imp, m) {
    if (!imp || !imp.lib || !LIB.list.length) return null;
    const key = JSON.stringify(imp.lib) + '|' + [m.og, m.ot, m.ob, m.wb, m.wzrost, m.Dts || '', m.Gp || ''].join(',') + '|' + LIB.when, old = libRt.get(imp); if (old && old.key === key) return old;
    let r; try { r = libBuild(imp.lib, m); } catch (e) { r = { err: 'Nie udało się przeliczyć konstrukcji z biblioteki.' }; }
    const rt = { key, sew: r.err ? { err: r.err } : r.sew, rep: r.rep || null, err: r.err || '' };
    if (!r.err) { imp.pieces = r.pieces; imp.an = r.an; }
    libRt.set(imp, rt); setTimeout(libFill, 0); return rt;
  }
  const libName = (spec) => { const t = spec.all ? libGet(spec.all.k) : spec.top ? libGet(spec.top.k) : null, b = spec.bot ? libGet(spec.bot.k) : null; return [t && t.nazwa, b && b.nazwa].filter(Boolean).join(' + ') || 'Z biblioteki'; };
  function libOpen(spec) {
    const r = libBuild(spec, cur()); if (r.err) { say(r.err, true); return; }
    const name = libName(spec).slice(0, 60), sn = snap(); sn.style = 'import'; sn.imp = { name, sizes: [], size: '', pieces: r.pieces, an: r.an, lib: spec }; sn.sel = {}; sn.layers = [{ role: 'wierzch' }];
    addProj(name, sn); impFill(); $('libBox').hidden = true; homeShow(false); if (state.view !== '2d') setView('2d'); goPanel('fason');
    say('Otworzyłam konstrukcję z biblioteki i przeliczyłam ją na wymiary modelki „' + (cur().name || 'bez imienia') + '”.');
  }
  // zmiana ustawień projektu (inna góra, inny dół, linia odcięcia, długość, sposób połączenia)
  function libSet(patch) {
    if (!state.imp || !state.imp.lib) return; const spec = JSON.parse(JSON.stringify(state.imp.lib)); patch(spec);
    const r = libBuild(spec, cur()); if (r.err) { say(r.err, true); libFill(); return; }
    state.imp.lib = spec; state.imp.name = libName(spec).slice(0, 60); const pr = projCur(); if (pr) pr.name = state.imp.name; persist(true); draw(true); libFill();
  }
  const libKind = (k) => (k.typ === 'spodnica' ? 'dol' : k.typ === 'gora' ? 'gora' : 'cale');
  const libCm = (v) => f1(Math.round(v * 2) / 2);
  // panel Fason: z czego składa się projekt, jak został dopasowany i co wymagało decyzji
  function libFill() {
    const box = $('libPanel'); if (!box) return; const on = state.style === 'import' && state.imp && state.imp.lib; box.hidden = !on; if (!on) return;
    $('libNo').hidden = LIB.list.length > 0; $('libCtl').hidden = !LIB.list.length; if (!LIB.list.length) return;
    const spec = state.imp.lib, rt = libRt.get(state.imp), rep = rt && rt.rep, both = !!(spec.top && spec.bot), kT = spec.all ? libGet(spec.all.k) : spec.top ? libGet(spec.top.k) : null;
    const fillSel = (id, kinds, val, none) => { const s = $(id); s.textContent = ''; if (none) { const o = mkEl('option'); o.value = ''; o.textContent = none; s.appendChild(o); } for (const k of LIB.list) if (kinds.includes(libKind(k))) { const o = mkEl('option'); o.value = k.id; o.textContent = (id === 'libBot' && libKind(k) === 'cale' ? 'dół z: ' : '') + k.nazwa; s.appendChild(o); } s.value = val || ''; };
    const soloSkirt = spec.all && kT && kT.typ === 'spodnica';
    fillSel('libTop', ['gora', 'cale'], soloSkirt ? '' : (spec.all ? spec.all.k : spec.top ? spec.top.k : ''), 'bez góry'); fillSel('libBot', ['dol', 'cale'], soloSkirt ? spec.all.k : spec.bot ? spec.bot.k : '', 'bez dołu');
    $('libDyRow').hidden = !both; $('libDy').value = both ? String(spec.top.dy || 0).replace('.', ',') : '0'; const dl = spec.bot ? spec.bot.dl : spec.all ? spec.all.dl : 0; $('libDlRow').hidden = !(spec.bot || soloSkirt); $('libDl').value = String(dl || 0).replace('.', ',');
    const J = rep && rep.join, need = !!(J && !J.auto); $('libJoin').hidden = !need; let opts = [];
    if (J) { const more = J.diff > 0, orig = J.botRaw - J.botFin > 1.5; opts = more ? [['marszcz', 'Ułóż zakładki albo marszczenie spódnicy na szerokość góry (' + libCm(J.topW) + ' cm)']].concat(J.canTalia ? [['talia', 'Zwęź górę do talii spódnicy (' + libCm(J.botFin) + ' cm), zakładki zostają jak w oryginale']] : [], [['szer', 'Zwęź spódnicę do szerokości góry, bez zakładek i marszczenia']]) : [['marszcz', 'Zmarszcz dół góry do spódnicy (' + libCm(J.botRaw) + ' cm)'], ['szer', 'Zwęź górę w talii do szerokości spódnicy']];
      if (need) { $('libJoinT').textContent = 'Góra ma w linii odcięcia ' + libCm(J.topW) + ' cm. Górna krawędź spódnicy ma ' + libCm(J.botRaw) + ' cm' + (orig ? ', a po ułożeniu zakładek z oryginału ' + libCm(J.botFin) + ' cm' : '') + '. Wybierz, jak je dopasować.';
        const s = $('libMode'); s.textContent = ''; for (const [v, tx] of opts) { const o = mkEl('option'); o.value = v; o.textContent = tx; s.appendChild(o); } s.value = J.mode; } }
    const ul = $('libRep'); ul.textContent = ''; const li = (t, cls) => { const e = mkEl('li'); e.textContent = t; if (cls) e.className = cls; ul.appendChild(e); };
    if (rt && rt.err) li(rt.err, 'warn');
    if (rep) {
      for (const f of rep.fit) li(f.k + ': rozmiar ' + f.size + ', dobrany według ' + (f.by === 'b' ? 'biustu' : f.by === 't' ? 'talii' : 'bioder') + '.');
      for (const s of rep.seams) { const d = Math.abs(s.a - s.b); if (s.sl) { li('Rękaw: podkrój pachy ma ' + libCm(s.a) + ' cm, główka rękawa ' + libCm(s.b) + ' cm' + (d <= 3 ? ', pasuje.' : ', różnica ' + libCm(d) + ' cm do sprawdzenia.'), d <= 3 ? '' : 'warn'); continue; } li(s.nm.charAt(0).toUpperCase() + s.nm.slice(1) + ': przód ' + libCm(s.a) + ' cm, tył ' + libCm(s.b) + ' cm' + (d <= Math.max(1, 0.03 * s.a) ? ', pasuje.' : ', różnica ' + libCm(d) + ' cm do sprawdzenia.'), d <= Math.max(1, 0.03 * s.a) ? '' : 'warn'); }
      if (J) li(J.auto ? 'Linia odcięcia dopasowana automatycznie: góra ' + libCm(J.topW) + ' cm, spódnica ' + libCm(J.how === 'fin' ? J.botFin : J.botRaw) + ' cm' + (J.how === 'fin' ? ' po ułożeniu zakładek z oryginału.' : '.') : 'Linia odcięcia według Twojej decyzji: ' + ((opts.find((o) => o[0] === J.mode) || ['', ''])[1].replace(/^./, (c) => c.toLowerCase())) + '. Szew ma ' + libCm(J.seam) + ' cm.');
      for (const d of rep.darts) li(d.el + ': zaszewka ' + (d.hor ? 'od boku' : 'pionowa') + ', ' + libCm(d.mouth) + ' cm szerokości i ' + libCm(d.len) + ' cm długości. Do porównania szwów i do 3D jest zamknięta.');
      for (const x of rep.miss) li(x);
    }
    if (rt && rt.sew && rt.sew.err) li('Podgląd 3D: ' + rt.sew.err, 'warn');
  }
  // lista konstrukcji do wyboru
  function libList() {
    const box = $('libList'); box.textContent = ''; $('libEmpty').hidden = LIB.list.length > 0; $('libPair').hidden = !LIB.list.length;
    for (const [kind, title] of [['gora', 'Góry'], ['dol', 'Spódnice'], ['cale', 'Sukienki']]) { const ks = LIB.list.filter((k) => libKind(k) === kind); if (!ks.length) continue; const h = mkEl('h3'); h.textContent = title; box.appendChild(h);
      for (const k of ks) { const row = mkEl('div'); row.className = 'anDoc'; const nm = mkEl('span'); nm.className = 'anDn'; nm.textContent = k.nazwa; const inf = mkEl('span'); inf.className = 'anDi'; const bad = k.elementy.filter((e) => e.stan !== 'ok').length;
        inf.textContent = k.rozmiary[0] + ' do ' + k.rozmiary[k.rozmiary.length - 1] + ', elementów: ' + k.elementy.length + (bad ? ', do sprawdzenia: ' + bad : ''); const sp = mkEl('span'), b = mkEl('button'); b.textContent = 'Otwórz'; b.addEventListener('click', () => libOpen({ all: { k: k.id } })); row.append(nm, inf, sp, b); box.appendChild(row); } }
    const fill = (id, kinds) => { const s = $(id); s.textContent = ''; for (const k of LIB.list) if (kinds.includes(libKind(k))) { const o = mkEl('option'); o.value = k.id; o.textContent = k.nazwa; s.appendChild(o); } }; fill('libPT', ['gora', 'cale']); fill('libPB', ['dol', 'cale']);
  }
  // ---------- przechowywanie: baza przeglądarki, a w aplikacji także plik w Dokumentach ----------
  const libDb = () => new Promise((ok, no) => { const q = indexedDB.open('wykrojnik-biblioteka', 1); q.onupgradeneeded = () => q.result.createObjectStore('pliki'); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
  function libAdopt(obj, keep) {
    if (!obj || obj.format !== 'wykrojnik-biblioteka' || !Array.isArray(obj.konstrukcje)) return false;
    LIB.list = obj.konstrukcje.filter((k) => k && k.id && Array.isArray(k.elementy) && k.tabela); LIB.when = Date.now();
    if (keep) libDb().then((db) => { db.transaction('pliki', 'readwrite').objectStore('pliki').put(JSON.stringify(obj), 'lib'); }).catch(() => {});
    if (!$('libBox').hidden) libList(); if (state.style === 'import' && state.imp && state.imp.lib && uiReady) draw(true); return true;
  }
  function libBoot() { libDb().then((db) => { const q = db.transaction('pliki').objectStore('pliki').get('lib'); q.onsuccess = () => { if (q.result && !LIB.list.length) { try { libAdopt(JSON.parse(q.result), false); } catch (e) { /* uszkodzony zapis: biblioteka zostaje pusta */ } } }; }).catch(() => {}); }
  // w aplikacji na komputerze biblioteka leży obok projektów; nowszy plik zastępuje zapis w bazie
  const LIB_FILE = '~/Documents/Wykrojnik/biblioteka.json';
  async function libDisk() { if (!desktop || !desktop.fs) return; try { if (!(await desktop.fs.exists(LIB_FILE))) return; const raw = await desktop.fs.readFile(LIB_FILE, 'utf8'), sig = raw.length + ':' + raw.slice(0, 160); let seen = ''; try { seen = localStorage.getItem('wykrojnik.lib.sig') || ''; } catch (e) { seen = ''; } if (LIB.list.length && sig === seen) return;
    if (libAdopt(JSON.parse(raw), true)) { try { localStorage.setItem('wykrojnik.lib.sig', sig); } catch (e) { /* bez pamięci przeglądarki plik zostanie wczytany przy następnym starcie */ } say('Wczytałam bibliotekę konstrukcji z folderu Dokumenty/Wykrojnik.'); } } catch (e) { /* bez zgody na pliki biblioteka zostaje taka, jaka była */ } }
  const libToDisk = (text) => { if (!desktop || !desktop.fs) return; desktop.fs.writeFile(LIB_FILE, text).then(() => { try { localStorage.setItem('wykrojnik.lib.sig', text.length + ':' + text.slice(0, 160)); } catch (e) { /* nic */ } }).catch(() => {}); };
  // ---------- porównanie wczytanego wykroju z biblioteką ----------
  // podpis kształtu: odległość od środka ciężkości w 96 punktach równo rozłożonych po obwodzie, w jednostkach pierwiastka z pola; nie zależy od obrotu, odbicia ani skali
  function libSig(pts) {
    const ring = pts.slice(); if (Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) > 0.01) ring.push(ring[0]); const L = libLen(ring), A = Math.abs(libArea(ring.slice(0, -1))) || 1, n = 96, s = [], sc = Math.sqrt(A); let cx = 0, cy = 0, acc = 0, j = 1; const P = [];
    for (let k = 0; k < n; k++) { const t = (L * k) / n; while (j < ring.length - 1 && acc + Math.hypot(ring[j][0] - ring[j - 1][0], ring[j][1] - ring[j - 1][1]) < t) { acc += Math.hypot(ring[j][0] - ring[j - 1][0], ring[j][1] - ring[j - 1][1]); j++; } const a = ring[j - 1], b = ring[j], dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = Math.max(0, Math.min(1, (t - acc) / dl)); P.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
    for (const p of P) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n; for (const p of P) s.push(Math.hypot(p[0] - cx, p[1] - cy) / sc);
    return { s, area: A, per: L };
  }
  function libSigDist(a, b) { const n = a.length; let best = 1e9; for (const rev of [false, true]) for (let sh = 0; sh < n; sh++) { let d = 0; for (let i = 0; i < n && d < best; i++) { const j = rev ? (sh - i + 2 * n) % n : (sh + i) % n, e = a[i] - b[j]; d += e * e; } if (d < best) best = d; } return Math.sqrt(best / n); }
  // dla każdego elementu wczytanego wykroju: najbliższe elementy biblioteki w rozmiarze o najbliższym polu
  function libMatch(pieces) {
    if (!LIB.list.length) return []; const out = [];
    for (const pc of pieces) { const R = swRing(pc); if (!R || R.pts.length < 4) continue; const sg = libSig(R.pts); if (sg.area < 60) continue; const hits = [], dims = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } return [Math.max(x1 - x0, y1 - y0), Math.min(x1 - x0, y1 - y0)]; }, dn = dims(R.pts);
      for (const k of LIB.list) for (const el of k.elementy) { const P = libP(el); let bi = 0, bd = 1e9; P.forEach((p, i) => { const d = Math.abs(Math.abs(libArea(p)) - sg.area); if (d < bd) { bd = d; bi = i; } });
        const sl = el._sig || (el._sig = []), s2 = sl[bi] || (sl[bi] = libSig(P[bi])), ar = sg.area / s2.area; if (ar < 0.6 || ar > 1.6) continue; const d = libSigDist(sg.s, s2.s), dl = dims(P[bi]); hits.push({ k, el, d, size: k.rozmiary[el.idx[bi]] || '', ar, per: sg.per / s2.per, dL: dn[0] - dl[0], dW: dn[1] - dl[1] }); }
      const sc = (h) => h.d + 0.0006 * (Math.abs(h.dL) + Math.abs(h.dW)); hits.sort((x, y) => sc(x) - sc(y)); /* przy podobnym obrysie wygrywa baza o bliższych wymiarach */ out.push({ name: pc.name, best: hits.slice(0, 2).map((h) => ({ k: h.k.nazwa, kid: h.k.id, el: h.el.nazwa, size: h.size, zg: Math.max(0, Math.round(100 * (1 - h.d / 0.15))), pole: Math.round((h.ar - 1) * 100), obw: Math.round((h.per - 1) * 100), dL: Math.round(h.dL * 2) / 2, dW: Math.round(h.dW * 2) / 2 })) }); }
    return out;
  }
  function libMatchFill() {
    const box = $('libMatch'); if (!box) return; const on = state.style === 'import' && state.imp && !state.imp.lib && LIB.list.length > 0; box.hidden = !on; if (!on) return;
    const res = libMatch(state.imp.pieces || []), b = $('libMatchB'); b.textContent = ''; let any = false;
    for (const r of res) { const p = mkEl('p'), h = r.best[0]; if (!h) { p.textContent = r.name + ': nowy element, w bibliotece nie ma nic zbliżonego.'; b.appendChild(p); continue; } any = true;
      const mod = [Math.abs(h.dL) >= 1 ? (h.dL > 0 ? 'wydłuż ją o ' : 'skróć ją o ') + f1(Math.abs(h.dL)) + ' cm' : '', Math.abs(h.dW) >= 1 ? (h.dW > 0 ? 'poszerz o ' : 'zwęź o ') + f1(Math.abs(h.dW)) + ' cm' : ''].filter(Boolean).join(' i ');
      p.textContent = r.name + ': ' + (h.zg >= 80 ? 'baza to ' + h.k + ', ' + h.el.toLowerCase() + ' w rozmiarze ' + h.size + '. Przebieg obrysu zgadza się w ' + h.zg + '%' + (mod ? '. Żeby odtworzyć ten element z bazy, ' + mod : ', wymiary są takie same') + '.' : h.zg >= 65 ? 'podobny do ' + h.k + ', ' + h.el.toLowerCase() + ' (obrys zgodny w ' + h.zg + '%). Wymaga sprawdzenia' + (mod ? ', a z bazy trzeba by: ' + mod : '') + '.' : 'nowy element, w bibliotece nie ma dobrego odpowiednika.') + (r.best[1] && r.best[1].zg >= 80 && r.best[1].kid !== h.kid ? ' Druga zbliżona baza: ' + r.best[1].k + ', ' + r.best[1].el.toLowerCase() + ' (' + r.best[1].zg + '%).' : ''); b.appendChild(p); }
    if (!any) { const p = mkEl('p'); p.textContent = 'Żaden element nie ma w bibliotece dobrego odpowiednika.'; b.appendChild(p); }
  }
  // ---------- zdarzenia ----------
  $('hLib').addEventListener('click', () => { libList(); $('libBox').hidden = false; });
  $('libX').addEventListener('click', () => { $('libBox').hidden = true; });
  $('libAdd').addEventListener('click', () => $('libFile').click());
  $('libFile').addEventListener('change', async () => { const f = $('libFile').files[0]; $('libFile').value = ''; if (!f) return; let ok = false; try { const text = await f.text(); ok = libAdopt(JSON.parse(text), true); if (ok) libToDisk(text); } catch (e) { ok = false; } say(ok ? 'Wczytałam bibliotekę: konstrukcji ' + LIB.list.length + '.' : 'To nie jest plik biblioteki Wykrojnika.', !ok); libList(); });
  $('libPGo').addEventListener('click', () => { const t = $('libPT').value, b = $('libPB').value; if (t && b) libOpen({ top: { k: t, dy: 0 }, bot: { k: b, dl: 0 }, mode: 'zakladki' }); });
  const libPick = () => libSet((s) => { const t = $('libTop').value, b = $('libBot').value, dy = (s.top && s.top.dy) || 0, dl = (s.bot && s.bot.dl) || (s.all && s.all.dl) || 0, keep = s.all ? s.all.k : s.top.k; delete s.all; delete s.top; delete s.bot;
    if (t && b) { s.top = { k: t, dy }; s.bot = { k: b, dl }; } else if (t || b) s.all = { k: t || b, dl }; else s.all = { k: keep, dl }; });
  $('libTop').addEventListener('change', libPick); $('libBot').addEventListener('change', libPick);
  const libNum = (id, lo, hi) => { const v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v * 2) / 2)) : 0; };
  $('libDy').addEventListener('change', () => libSet((s) => { if (s.top) s.top.dy = libNum('libDy', -12, 25); }));
  $('libDl').addEventListener('change', () => libSet((s) => { const v = libNum('libDl', -40, 60); if (s.bot) s.bot.dl = v; else if (s.all) s.all.dl = v; }));
  $('libMode').addEventListener('change', () => libSet((s) => { s.mode = $('libMode').value; }));
  libBoot();
  if (TEST) window['__lib'] = { LIB, libAdopt, libBuild, libOpen, libSet, libMatch, libRt, libShape, libFrame, libWalk, libWalkC, libBodice, libSkirt, libGet, libP };
