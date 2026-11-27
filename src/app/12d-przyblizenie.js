  // ---------- przybliżona bryła wczytanego wykroju ----------
  // Bazą jest sylwetka odczytana przez analizę z ilustracji w instrukcji (dekolt, rękaw, kształt dołu, długość), a wymiary z elementów wykroju ją doprecyzowują.
  // Gdy elementów nie da się zszyć, podgląd 3D nie odmawia: pokazuje bryłę o długości, obwodzie dołu, górze i rękawach zmierzonych z elementów wykroju.
  // Obrys elementu traktuję jak wycinek pierścienia: pole i obwód dają dwie liczby, długość i średnią szerokość (dla prostokąta to jego boki).
  function apxShape(pc) {
    const cut = (pc.prims || []).filter((q) => q.t === 'poly' && q.s === 'cut' && q.pts.length > 3), ring = cut.reduce((b, q) => (q.pts.length > b.length ? q.pts : b), []);
    if (ring.length < 4) return { A: pc.w * pc.h, a: Math.max(pc.w, pc.h), b: Math.min(pc.w, pc.h), ring: [] };
    let A = 0, P = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; A += p[0] * q[1] - q[0] * p[1]; P += Math.hypot(q[0] - p[0], q[1] - p[1]); }
    A = Math.abs(A) / 2; const h = P / 2, disc = Math.max(0, h * h - 4 * A), a = (h + Math.sqrt(disc)) / 2, b = A / Math.max(1, a);
    return { A, a, b, ring };
  }
  const apxDist = (p, pts) => { let best = 1e9; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)); } return best; };
  // ile szerokości elementu trafia do ubrania: liczba sztuk, a element krojony ze złożenia albo odbijany liczy się podwójnie
  const apxCopies = (pc) => { const c = String(pc.cut || ''), n = /(\d+)\s*×/.exec(c); return Math.max(1, Math.min(8, n ? +n[1] : 1)) * (/złożenia|odbijając/.test(c) ? 2 : 1); };
  function impApprox(imp, m, pcs) {
    const an = imp.an || {}, typ = an.typ || '', sy = an.syl || {}; if (typ === 'spodnie') return null;
    const a = W.full(m), Tw = m.ot + 2, major = pcs.filter((q) => Math.hypot(q.w, q.h) > 25); if (!major.length) return null;
    const minor = (q) => q.role === 'C' || /odszyc|facing|podszew|lining|pasek|strap|rami[aą]cz|kiesze|pocket|mankiet|cuff|ko[lł]nierz|collar|lam[oó]wk|binding|szlufk|wi[aą]zani|troczk/i.test(q.name);
    const isSl = (q) => q.role === 'S' || /r[eę]kaw|sleeve/i.test(q.name), isSk = (q) => /sp[oó]dnic|skirt|panel|klin|godet|falban|tren|(^|\s)d[oó][lł](\s|$)/i.test(q.name);
    const body = major.filter((q) => !minor(q) && !isSl(q)), up = (q) => Math.max(q.h, q.w * 0.6 > q.h ? q.w : 0);
    let skirt = body.filter((q) => typ === 'spodnica' || isSk(q)); if (!skirt.length && typ === 'sukienka') skirt = body.filter((q) => q.role !== 'F' && q.role !== 'B' && Math.max(q.w, q.h) > 60);
    const strap = an.trzym === 'ramiaczka' || (!an.trzym && pcs.some((q) => /rami[aą]cz|strap/i.test(q.name))), bez = an.trzym === 'bez', topOff = strap || bez ? a.Dts - a.Gp + 4 : a.Dps;
    const sl = pcs.filter(isSl).sort((x, y) => y.w * y.h - x.w * x.h)[0], rek = strap || bez ? 'brak' : sy.rekaw || (sl ? (Math.max(sl.w, sl.h) > 42 ? 'dlugi' : 'krotki') : 'brak');
    // długość z ilustracji jako ułamek odległości od talii do podłogi: rozstrzyga, który z dwóch wymiarów elementu jest jego długością
    const WF = m.wzrost - a.Dts - 22, want = sy.dlugosc ? WF * ({ biodra: 0.19, mini: 0.4, kolano: 0.56, midi: 0.74, maxi: 0.92, ziemia: 1 })[sy.dlugosc] : 0;
    let dl = 0, hemC = 0, how = '', floorHit = false;
    if (skirt.length) { // dół z osobnych elementów: długość i obwód z ich kształtu
      // najpewniejsza długość: odległość od krawędzi dołu wskazanej przez analizę do najdalszej krawędzi tego samego elementu (czyli do talii)
      const Ld = new Map();
      if (an.dol && an.dol.length) { let E = []; try { E = plAll(pcs); } catch (e) { E = []; } const hemOf = new Map();
        for (const at of an.dol) { let b = null, bd = 12; for (const e of E) { const d = Math.hypot(e.mid[0] - at[0], e.mid[1] - at[1]); if (d < bd) { bd = d; b = e; } } if (b) { if (!hemOf.has(b.pi)) hemOf.set(b.pi, []); if (!hemOf.get(b.pi).includes(b)) hemOf.get(b.pi).push(b); } }
        hemOf.forEach((hem, pi) => { const far = E.filter((e) => e.pi === pi && !hem.includes(e)).map((e) => Math.min(...hem.map((h) => apxDist(e.mid, h.pts)))).sort((x, y) => y - x)[0]; if (far > 20 && far < 150 && skirt.includes(pcs[pi])) Ld.set(pcs[pi], far); }); }
      const known = Array.from(Ld.values()).sort((x, y) => x - y), ref = known.length ? known[Math.floor(known.length / 2)] : want, rows = [];
      for (const q of skirt) { const s = apxShape(q), okA = s.a >= 20 && s.a <= 150, okB = s.b >= 20 && s.b <= 150, L = Ld.get(q) || Math.max(20, Math.min(150, ref && okA && okB ? (Math.abs(s.a - ref) < Math.abs(s.b - ref) ? s.a : s.b) : s.a > 135 || s.b >= 0.6 * s.a ? s.b : s.a)); rows.push({ q, L, A: s.A, arc: (s.A / L) * apxCopies(q), n: apxCopies(q) }); }
      // kopertowy dół: lewy i prawy przód zachodzą na siebie, więc do obwodu liczy się tylko szerszy z nich
      const fr = rows.filter((r) => /prz[oó]d|front/i.test(r.q.name)), wrap = sy.kopertowa || (fr.some((r) => /lew|left/i.test(r.q.name)) && fr.some((r) => /praw|right/i.test(r.q.name)));
      let S = rows.reduce((t, r) => t + r.arc, 0); if (wrap && fr.length >= 2) S -= Math.min(...fr.map((r) => r.arc));
      dl = known.length ? ref : rows.reduce((t, r) => t + r.L * r.A * r.n, 0) / rows.reduce((t, r) => t + r.A * r.n, 0); floorHit = dl > WF; dl = Math.min(dl, WF);
      hemC = Math.max(m.ob + 4, Math.min(Tw + 4 * Math.PI * dl, 2 * S - Tw)); how = 'dol';
    } else { // przód i tył w jednym kawałku: długość z wysokości przodu, obwód dołu z szerokości elementów przy dolnej krawędzi
      const F = body.filter((q) => q.role === 'F').sort((x, y) => up(y) - up(x))[0] || body.slice().sort((x, y) => up(y) - up(x))[0]; if (!F) return null;
      const B = body.filter((q) => q.role === 'B').sort((x, y) => up(y) - up(x))[0];
      const bottom = (q) => { const s = apxShape(q); if (!s.ring.length || q.w * 0.6 > q.h) return Math.min(q.w, q.h); let lo = 1e9, hi = -1e9; const y0 = q.box.y1 - 0.1 * q.h; for (const p of s.ring) if (p[1] > y0) { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); } const wd = hi - lo; return wd * (/złożenia|odbijając/.test(q.cut || '') || wd < 0.36 * m.ob ? 2 : 1); };
      dl = Math.max(0, Math.min(0.62 * m.wzrost, up(F) - topOff - 2)); hemC = typ === 'spodnica' ? 2 * bottom(F) : bottom(F) + (B ? bottom(B) : bottom(F)); how = 'calosc';
      if (typ === 'spodnica') dl = Math.max(20, Math.min(120, up(F) - 3));
    }
    const kind = typ === 'spodnica' ? 'sk' : typ === 'gorset' ? 'go' : typ === 'top' || typ === 'okrycie' || (typ !== 'sukienka' && dl < 30) ? 'to' : 'su';
    if (kind === 'su' || kind === 'sk') dl = Math.max(25, dl);
    // kształt dołu z ilustracji ogranicza to, co wyszło z pomiaru: prosty dół nie faluje, a koło nie może wyjść wąskie
    const lim = { prosty: [0, 0], trapez: [0.08, 0.34], polkole: [0.3, 0.75], kolo: [0.7, 2], rybka: [0, 0.2] }[sy.dol] || [0, 2];
    let frac = (kind === 'su' || kind === 'sk') && hemC > (m.ob + 6) * 1.12 ? Math.max(0.08, Math.min(2, (hemC - Tw) / (2 * Math.PI * dl))) : 0; frac = Math.max(lim[0], Math.min(lim[1], frac)); const flare = frac > 0; if (flare) hemC = Tw + 2 * Math.PI * frac * dl;
    const style = kind === 'sk' ? (flare ? 'sk_kolo' : 'sk_prosta') : kind === 'go' ? 'go_nad' : kind === 'to' ? (strap ? 'to_ramiaczka' : 'to_klasyczny') : flare ? 'su_kolo' : 'su_dopasowana';
    const P = Object.assign({}, DEF_P, { dl: Math.round(dl), tren: 0, crop: 0, dol: '', fac: 'brak', layers: null, extras: [] }, kind === 'su' ? { gora: strap || bez ? 'bez' : 'ramiona', ram: strap ? 'cienkie' : 'brak', rek } : kind === 'to' && !strap ? { rek } : {},
      sy.dekolt && sy.dekolt !== 'prosty' ? { nk: sy.dekolt, bk: sy.dekolt === 'serce' ? 'serce' : sy.dekolt === 'v' ? 'luk' : 'prosta' } : {}, sy.gleboki ? { nd: 7 } : {}, sy.rozciecie && dl > 50 ? { rozp: Math.round(dl * 0.45) } : {}, sy.gora === 'luzna' ? { luzG: 10, luzT: 12 } : {});
    let d; try { d = W.draft(m, P, style); } catch (e) { d = null; } if (!d || !d.sil) return null;
    const sil = Object.assign({}, d.sil, flare ? { frac, hemC, pleat: false } : {}, { approx: true, approxP: P, approxStyle: style });
    return { sil, dl: Math.round(dl), hemC: Math.round(flare ? hemC : sil.hemC || hemC), how, skirt: skirt.map((q) => q.name), syl: !!an.syl, floor: floorHit };
  }
