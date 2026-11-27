  function render3d(refit) {
    if (!init3d()) { say('Podgląd 3D nie działa w tym widoku (brak WebGL).', true); return; }
    const m = cur(), sil = model.d.sil, a = W.full(m), body = bodyFn(m, a), TAU = Math.PI * 2;
    // wczytany wykrój nie ma parametrów fasonu: podgląd dostaje obojętne wartości i długość odczytaną z elementów
    const p = sil.imported ? Object.assign({}, state.p, { gora: 'ramiona', dl: sil.impDl, kn: 0, gf: 0, ff: 1, flare: 0, tren: 0, rozp: 0, pasek: 0, pasT: 0, zakK: 0, crop: 0, bok: 0, ram: 'brak', ramW: 0, rek: sil.sleeve ? 'dlugi' : 'brak', mank: false, kol: 'brak', kolW: 0, kop: false, falN: false, falR: false, marsz: false, sciag: false, nk: 'okragly', nkb: 'okragly', nd: 0, nw: 0, nb: 0, bk: 'prosta', luzG: 4, luzT: 4, luzB: 4, fac: 'brak', extras: [] }) : state.p;
    if (g3.group) { g3.scene.remove(g3.group); g3.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    const FG = figData(), fs = FG ? m.wzrost / FG.H : 0, headLen = FG ? (FG.H - FG.lv.neck) * fs : m.wzrost * 0.165;
    const grp = new T3.Group(), floor = -(m.wzrost - a.Dts - headLen);
    // manekin
    const bm = new T3.MeshStandardMaterial({ color: state.figure ? 0xd2c8b6 : 0xcdc3ae, roughness: state.figure ? 0.85 : 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
    const NB = 64;
    const useFig = state.figure && !!FG;
    if (!useFig) grp.add(surface(72, NB, (u, v) => {
      const y = body.top + (body.bottom - body.top) * v, s = body(y);
      const k = v < 0.001 || v > 0.999 ? 0.02 : v < 0.03 ? 0.75 : v > 0.97 ? 0.8 : 1;
      const x = s.a * Math.cos(u * TAU) * k, sn = Math.sin(u * TAU);
      let z = s.z + s.b * sn * k + (state.bust ? body.bump(x, y, sn, false) : body.bump(x, y, sn, true) * 0.6);
      z -= body.butt(x, y, sn, s.a);
      return [x, y, z];
    }, bm));
    // proporcje orientacyjne: talia 62% wzrostu, kolano 28,5%, kostka 4%
    const H = m.wzrost, legH = -m.wb - floor, kneeY = floor + legH * (FG ? FG.lv.knee / FG.lv.hip : 0.58), ankleY = floor + legH * (FG ? FG.lv.ankle / FG.lv.hip : 0.09), hemY = -p.dl;
    let figArm = null; // przy sylwetce: czy punkt ubrania leży już w ramieniu (wtedy jest wycinany, żeby ręka nie szarpała krawędzi pachy)
    let figArmAt = null; // przy sylwetce: oś i promień ręki w odległości t od barku, po niej układa się rękaw
    let figFit = null, figDrape = null, figShX = 0, figTop = null, figCol = null, figArmP = null, figClear = null; // przy włączonej sylwetce ubranie jest wypychane na zewnątrz ciała, żeby siatka nie przebijała przez tkaninę
    if (useFig) {
      const lv = FG.lv, hipA = body(-m.wb).a, yb1 = a.Dps - a.Wg;
      let nkF = a.Dts, yMap = pw([[0, floor], [lv.hip, -m.wb], [lv.waist, 0], [lv.bust, yb1], [lv.neck, nkF], [FG.H, nkF + headLen]]);
      const rH = (m.ob * 0.97) / (lv.gH * fs), rW = (m.ot * 0.97) / (lv.gW * fs), rB = (m.og * 0.97) / (lv.gB * fs), rL = Math.max(0.85, Math.min(1.25, Math.sqrt(rH)));
      const ratio = pw([[0, rL], [lv.knee, rL], [lv.hip, rH], [lv.waist, rW], [lv.bust, rB], [lv.bust + 0.7, (rB + 1) / 2 * 0.98], [lv.neck - 0.4, 0.94], [lv.neck + 0.35, 1], [FG.H, 1]]);
      const tab = (arr, y) => { const t = Math.max(0, Math.min(FG.n - 1.001, (y / FG.H) * (FG.n - 1))), i = Math.floor(t); return arr[i] + (arr[i + 1] - arr[i]) * (t - i); };
      const zModel = (Y) => { const yy = Math.max(-m.wb, Math.min(a.Dts, Y)), s = body(yy); return s.z + 0.5 * body.bump(a.Rg / 2, yy, 1, false) - 0.5 * body.butt(hipA * 0.42, yy, -1, hipA); };
      const n = FG.P.length / 3, pos = new Float32Array(n * 3), crotch = 7.4, armF = new Uint8Array(n);
      const cupD = Math.max(-2.2, Math.min(5, (body.bh - 4.7) * 0.9)); // siatka bazowa ma mniej więcej miseczkę B
      const mkPos = () => { for (let i = 0; i < n; i++) {
        const x = FG.P[i * 3], y = FG.P[i * 3 + 1], z = FG.P[i * 3 + 2], ax = Math.abs(x), arm = ax > (y >= 12 ? 1.75 : 1.5 + (12 - y) * 0.55);
        const r = ratio(y), yc = Math.max(lv.hip, Math.min(lv.neck, y)), Y = yMap(y); armF[i] = arm ? 1 : 0;
        const close = y < crotch ? (1 - y / crotch) * 0.85 : 0; // nogi bliżej siebie niż w siatce bazowej, żeby mieściły się w wąskich spódnicach
        pos[i * 3] = arm ? Math.sign(x) * (ax + (r - 1) * tab(FG.half, y)) * fs : (x * r - Math.sign(x) * Math.min(close, ax * 0.9)) * fs;
        pos[i * 3 + 1] = Y;
        pos[i * 3 + 2] = (z - tab(FG.zc, yc)) * (arm ? 1 : r) * fs + zModel(yMap(yc));
        if (!arm && cupD) { const dz = (z - tab(FG.zc, yc)) * fs, dyb = Y - yb1; if (dz > 0 && Math.abs(dyb) < 14) pos[i * 3 + 2] += cupD * Math.exp(-Math.pow(dyb / (dyb > 0 ? 6 : 5), 2) - Math.pow((Math.abs(pos[i * 3]) - a.Rg / 2) / Math.max(4.2, a.Rg * 0.36), 2)) * sstep(dz / 4); }
      } };
      mkPos();
      { // dopasowanie wysokości barków sylwetki do wymiarów: droga po ciele od talii przez ramię przy szyi z powrotem do talii ma mieć długość tyłu plus długość przodu z wykroju
        const nbn = Math.ceil(a.Dts + 9), zl = new Float32Array(nbn).fill(1e9), zh = new Float32Array(nbn).fill(-1e9); let top = 0;
        for (let t = 0; t < FG.T.length; t += 3) {
          const i0 = FG.T[t], i1 = FG.T[t + 1], i2 = FG.T[t + 2]; if (armF[i0] || armF[i1] || armF[i2]) continue; const p0 = i0 * 3, p1 = i1 * 3, p2 = i2 * 3;
          if (Math.min(Math.abs(pos[p0]), Math.abs(pos[p1]), Math.abs(pos[p2])) > 9.5 || Math.max(Math.abs(pos[p0]), Math.abs(pos[p1]), Math.abs(pos[p2])) < 6.5 || Math.max(pos[p0 + 1], pos[p1 + 1], pos[p2 + 1]) < -1) continue;
          for (let u = 0; u <= 8; u++) for (let v = 0; u + v <= 8; v++) { const b1 = u / 8, b2 = v / 8, b0 = 1 - b1 - b2, X = Math.abs(pos[p0] * b0 + pos[p1] * b1 + pos[p2] * b2), Y = pos[p0 + 1] * b0 + pos[p1 + 1] * b1 + pos[p2 + 1] * b2; if (X < 7 || X > 9 || Y < -0.5 || Y >= nbn - 1) continue; const b = Math.round(Y), z = pos[p0 + 2] * b0 + pos[p1 + 2] * b1 + pos[p2 + 2] * b2; if (z < zl[b]) zl[b] = z; if (z > zh[b]) zh[b] = z; if (Y > top) top = Y; }
        }
        const nT = Math.round(top); let okc = nT > yb1 + 6 && zl[0] < 1e8;
        for (let b = 1; b <= nT && okc; b++) if (zl[b] > 1e8) { zl[b] = zl[b - 1]; zh[b] = zh[b - 1]; }
        if (okc) {
          const loop = (sc) => { let L = 0; for (let b = 1; b <= nT; b++) { const dy = b > yb1 ? sc : 1; L += Math.hypot(dy, zl[b] - zl[b - 1]) + Math.hypot(dy, zh[b] - zh[b - 1]); } return L + Math.max(0, zh[nT] - zl[nT]); };
          const target = a.Dts + a.Dps - 1.5; let lo = 0.82, hi = 1.1; for (let it = 0; it < 24; it++) { const mid = (lo + hi) / 2; if (loop(mid) > target) hi = mid; else lo = mid; }
          const sc = (lo + hi) / 2; if (Math.abs(sc - 1) > 0.008) { nkF = yb1 + (a.Dts - yb1) * sc; yMap = pw([[0, floor], [lv.hip, -m.wb], [lv.waist, 0], [lv.bust, yb1], [lv.neck, nkF], [FG.H, nkF + headLen]]); mkPos(); }
        }
      }
      const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setIndex(new T3.BufferAttribute(FG.T, 1)); geo.computeVertexNormals();
      grp.add(new T3.Mesh(geo, bm));
      { // mapa promieni tułowia i nóg (bez rąk) wokół osi manekina: co 1 cm wysokości i co 3,75 stopnia
        const y0m = Math.floor(floor), ny = Math.ceil(a.Dts + 6 - y0m) + 1, NPH = 96, Rm = new Float32Array(ny * NPH), cz = new Float32Array(ny);
        for (let i = 0; i < ny; i++) cz[i] = body(Math.max(-m.wb, Math.min(a.Dts, y0m + i))).z;
        const yPit = a.Dts - a.Gp - 1, xTip = a.Sb / 2 + 0.8, slv = !!sil.sleeve && p.gora !== 'bez', yArmLim = slv ? Math.min(a.Dts - 11, yPit + 2) : a.Dts - 11, xTipS = xTip + (slv ? 1.5 : 0); // z rękawem stanik obejmuje też nasadę ręki
        const put = (x, Y, z, isA) => { const iy = Math.round(Y - y0m); if (iy < 0 || iy >= ny || (isA ? Math.abs(x) > xTipS : Y > yPit && Math.abs(x) > xTip)) return; const dz = z - cz[iy]; let ph = Math.atan2(dz, x); if (ph < 0) ph += TAU; const k = iy * NPH + Math.min(NPH - 1, Math.floor((ph / TAU) * NPH)), r = Math.hypot(x, dz); if (r > Rm[k]) Rm[k] = r; };
        for (let t = 0; t < FG.T.length; t += 3) {
          const i0 = FG.T[t] * 3, i1 = FG.T[t + 1] * 3, i2 = FG.T[t + 2] * 3;
          const isArm = armF[i0 / 3] || armF[i1 / 3] || armF[i2 / 3]; // z ręki do mapy wchodzi tylko czapka barku, na której leży ramię ubrania
          if (isArm && Math.max(pos[i0 + 1], pos[i1 + 1], pos[i2 + 1]) < yArmLim) continue;
          for (let u = 0; u <= 4; u++) for (let v = 0; u + v <= 4; v++) { const b1 = u / 4, b2 = v / 4, b0 = 1 - b1 - b2; if (isArm && pos[i0 + 1] * b0 + pos[i1 + 1] * b1 + pos[i2 + 1] * b2 < yArmLim) continue; put(pos[i0] * b0 + pos[i1] * b1 + pos[i2] * b2, pos[i0 + 1] * b0 + pos[i1 + 1] * b1 + pos[i2 + 1] * b2, pos[i0 + 2] * b0 + pos[i1 + 2] * b1 + pos[i2 + 2] * b2, isArm); }
        }
        const Rd = new Float32Array(ny * NPH);
        for (let iy = 0; iy < ny; iy++) for (let ip = 0; ip < NPH; ip++) { let mx = 0; for (let dy = -1; dy <= 1; dy++) { const jy = iy + dy; if (jy < 0 || jy >= ny) continue; for (let dp = -1; dp <= 1; dp++) mx = Math.max(mx, Rm[jy * NPH + ((ip + dp + NPH) % NPH)]); } Rd[iy * NPH + ip] = mx; }
        // wygładzenie, żeby wypchnięta tkanina nie miała schodków
        for (let pass = 0; pass < 2; pass++) { const src = Rd.slice(); for (let iy = 1; iy < ny - 1; iy++) for (let ip = 0; ip < NPH; ip++) { const c = src[iy * NPH + ip]; if (!c) continue; let sum = 0, cnt = 0; for (let dy = -1; dy <= 1; dy++) for (let dp = -2; dp <= 2; dp++) { const v = src[(iy + dy) * NPH + ((ip + dp + NPH) % NPH)]; if (v) { sum += v; cnt++; } } Rd[iy * NPH + ip] = Math.max(c - 0.3, sum / cnt); } }
        // powłoka dla ubrań dopasowanych: otoczka wypukła każdego przekroju (tkanina nie wchodzi między piersi ani w zagłębienie pleców),
        // a między biodrami i pachą dodatkowo łagodne przejścia w pionie, bo materiał pod biustem się napina, zamiast wklejać się w ciało
        const Hd = new Float32Array(ny * NPH), crs = (o, p1, p2) => (p1[0] - o[0]) * (p2[1] - o[1]) - (p1[1] - o[1]) * (p2[0] - o[0]);
        for (let iy = 0; iy < ny; iy++) {
          const P = []; for (let ip = 0; ip < NPH; ip++) { const r = Rd[iy * NPH + ip]; Hd[iy * NPH + ip] = r; if (r > 0) { const ph = ((ip + 0.5) / NPH) * TAU; P.push([r * Math.cos(ph), r * Math.sin(ph)]); } }
          if (P.length < 8) continue;
          P.sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]); const lo = [], up = [];
          for (const pt of P) { while (lo.length >= 2 && crs(lo[lo.length - 2], lo[lo.length - 1], pt) <= 0) lo.pop(); lo.push(pt); }
          for (let i = P.length - 1; i >= 0; i--) { const pt = P[i]; while (up.length >= 2 && crs(up[up.length - 2], up[up.length - 1], pt) <= 0) up.pop(); up.push(pt); }
          const Hl = lo.slice(0, -1).concat(up.slice(0, -1));
          for (let ip = 0; ip < NPH; ip++) {
            const ph = ((ip + 0.5) / NPH) * TAU, dx = Math.cos(ph), dz = Math.sin(ph); let best = Rd[iy * NPH + ip];
            for (let j = 0; j < Hl.length; j++) { const A = Hl[j], B = Hl[(j + 1) % Hl.length], ex = B[0] - A[0], ez = B[1] - A[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const sR = (A[0] * ez - A[1] * ex) / den, tE = (A[0] * dz - A[1] * dx) / den; if (sR > 0 && tE >= -1e-6 && tE <= 1 + 1e-6 && sR > best) best = sR; }
            Hd[iy * NPH + ip] = best;
          }
        }
        { const iA = Math.max(0, Math.round(-m.wb - y0m)), iB = Math.min(ny - 1, Math.round(yPit - y0m)), sl = 0.75;
          for (let iy = iB - 1; iy >= iA; iy--) for (let ip = 0; ip < NPH; ip++) Hd[iy * NPH + ip] = Math.max(Hd[iy * NPH + ip], Hd[(iy + 1) * NPH + ip] - sl);
          for (let iy = iA + 1; iy <= iB; iy++) for (let ip = 0; ip < NPH; ip++) Hd[iy * NPH + ip] = Math.max(Hd[iy * NPH + ip], Hd[(iy - 1) * NPH + ip] - sl * 2); }
        figFit = (q, e, w) => { // dosuwa punkt ubrania do powłoki sylwetki powiększonej o luz e
          const fy = q[1] - y0m, iy = Math.floor(fy); if (iy < 0 || iy >= ny - 1) return q;
          const ty = fy - iy, czz = cz[iy] + (cz[iy + 1] - cz[iy]) * ty, dz = q[2] - czz, r = Math.hypot(q[0], dz); if (r < 1e-6) return q; let ph = Math.atan2(dz, q[0]); if (ph < 0) ph += TAU;
          const fp = (ph / TAU) * NPH - 0.5, ip = Math.floor(fp), tp = fp - ip, i0 = (ip + NPH) % NPH, i1 = (ip + 1) % NPH;
          const h = (Hd[iy * NPH + i0] * (1 - tp) + Hd[iy * NPH + i1] * tp) * (1 - ty) + (Hd[(iy + 1) * NPH + i0] * (1 - tp) + Hd[(iy + 1) * NPH + i1] * tp) * ty; if (!(h > 0)) return q;
          // nad pachą punkt, pod którym na tej wysokości nie ma już ciała, po bokach zostaje na miejscu: opadnie na bark w następnym kroku
          if (q[1] > yPit - 4) w *= 1 - sstep((q[1] - (yPit - 4)) / 6) * sstep((Math.abs(q[0]) / r - 0.5) / 0.3);
          const k = (r + (h + e - r) * w) / r; q[0] *= k; q[2] = czz + dz * k; return q;
        };
        { // mapa wysokości barków i ramion widzianych z góry: tkanina, pod którą na danej wysokości nie ma już ciała, opada na bark, a poza nim zwisa
          const hx0 = -Math.ceil(a.Sb / 2 + 16), hnx = -2 * hx0 + 1, yLo = yPit - 6, zNk = body(a.Dts).z, rNk = a.os / TAU + 1.6; let zlo = 1e9, zhi = -1e9;
          for (let i = 0; i < n; i++) if (pos[i * 3 + 1] >= yLo && Math.abs(pos[i * 3]) < -hx0) { zlo = Math.min(zlo, pos[i * 3 + 2]); zhi = Math.max(zhi, pos[i * 3 + 2]); }
          const hz0 = Math.floor(zlo) - 8, hnz = Math.ceil(zhi) + 8 - hz0 + 1, Hs = new Float32Array(hnx * hnz).fill(-1e9);
          for (let t = 0; t < FG.T.length; t += 3) {
            const i0 = FG.T[t] * 3, i1 = FG.T[t + 1] * 3, i2 = FG.T[t + 2] * 3; if (Math.max(pos[i0 + 1], pos[i1 + 1], pos[i2 + 1]) < yLo || Math.min(pos[i0 + 1], pos[i1 + 1], pos[i2 + 1]) > a.Dts + 6) continue; // bez głowy: nad barkiem przy szyi liczy się skóra barku, nie wystający nad nim podbródek
            for (let u = 0; u <= 6; u++) for (let v = 0; u + v <= 6; v++) { const b1 = u / 6, b2 = v / 6, b0 = 1 - b1 - b2, ix = Math.round(pos[i0] * b0 + pos[i1] * b1 + pos[i2] * b2 - hx0), iz = Math.round(pos[i0 + 2] * b0 + pos[i1 + 2] * b1 + pos[i2 + 2] * b2 - hz0); if (ix < 0 || iz < 0 || ix >= hnx || iz >= hnz) continue; const Y = pos[i0 + 1] * b0 + pos[i1 + 1] * b1 + pos[i2 + 1] * b2; if (Y > Hs[iz * hnx + ix] && Y <= a.Dts + 6 && !(Y > a.Dts + 1 && Math.hypot(ix + hx0, iz + hz0 - zNk) < rNk)) Hs[iz * hnx + ix] = Y; } // szyja i głowa nie należą do tej mapy: od szyi tkanina jest odpychana na boki, nie w górę
          }
          // mapa samej skóry (bez dociągania poza obrys ciała) do kolizji: drobne dziury między próbkami są zalepiane
          const Hr = Hs.slice(); for (let pass = 0; pass < 2; pass++) { const src = Hr.slice(); for (let iz = 1; iz < hnz - 1; iz++) for (let ix = 1; ix < hnx - 1; ix++) { if (src[iz * hnx + ix] > -1e8) continue; let sum = 0, c = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const v = src[(iz + dz) * hnx + ix + dx]; if (v > -1e8) { sum += v; c++; } } if (c >= 4) Hr[iz * hnx + ix] = sum / c; } }
          const sl = 1.3, rx = (iz, ix, dz, dx, d) => { const jz = iz + dz, jx = ix + dx; if (jz < 0 || jx < 0 || jz >= hnz || jx >= hnx) return; const v = Hs[jz * hnx + jx] - sl * d; if (v > Hs[iz * hnx + ix]) Hs[iz * hnx + ix] = v; };
          for (let pass = 0; pass < 2; pass++) {
            for (let iz = 0; iz < hnz; iz++) for (let ix = 0; ix < hnx; ix++) { rx(iz, ix, 0, -1, 1); rx(iz, ix, -1, 0, 1); rx(iz, ix, -1, -1, 1.414); rx(iz, ix, -1, 1, 1.414); }
            for (let iz = hnz - 1; iz >= 0; iz--) for (let ix = hnx - 1; ix >= 0; ix--) { rx(iz, ix, 0, 1, 1); rx(iz, ix, 1, 0, 1); rx(iz, ix, 1, 1, 1.414); rx(iz, ix, 1, -1, 1.414); }
          }
          for (let pass = 0; pass < 2; pass++) { const src = Hs.slice(); for (let iz = 1; iz < hnz - 1; iz++) for (let ix = 1; ix < hnx - 1; ix++) { let sum = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) sum += src[(iz + dz) * hnx + ix + dx]; Hs[iz * hnx + ix] = Math.max(src[iz * hnx + ix] - 0.4, sum / 9); } }
          figTop = (x, z) => { const fx = x - hx0, fz = z - hz0, ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix >= hnx - 1 || iz >= hnz - 1) return -1e9; const tx2 = fx - ix, tz = fz - iz; const h00 = Hr[iz * hnx + ix], h01 = Hr[iz * hnx + ix + 1], h10 = Hr[(iz + 1) * hnx + ix], h11 = Hr[(iz + 1) * hnx + ix + 1]; if (h00 < -1e8 || h01 < -1e8 || h10 < -1e8 || h11 < -1e8) return -1e9; return (h00 * (1 - tx2) + h01 * tx2) * (1 - tz) + (h10 * (1 - tx2) + h11 * tx2) * tz; };
          figDrape = (q, e) => {
            if (q[1] <= yPit - 2) return q; const fx = q[0] - hx0, fz = q[2] - hz0, ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix >= hnx - 1 || iz >= hnz - 1) return q;
            const tx2 = fx - ix, tz = fz - iz, top = (Hs[iz * hnx + ix] * (1 - tx2) + Hs[iz * hnx + ix + 1] * tx2) * (1 - tz) + (Hs[(iz + 1) * hnx + ix] * (1 - tx2) + Hs[(iz + 1) * hnx + ix + 1] * tx2) * tz + e;
            if (q[1] > top) q[1] += (top - q[1]) * sstep((q[1] - (yPit - 2)) / 4); return q;
          };
        }
        // przekrój ramienia na każdej wysokości jako okrąg (środek i promień): ubranie nie może leżeć w środku ręki
        const ax = new Float32Array(ny), az = new Float32Array(ny), ar = new Float32Array(ny), an = new Float32Array(ny);
        for (let i = 0; i < n; i++) { if (!armF[i] || pos[i * 3 + 1] < yPit - 14) continue; const iy = Math.round(pos[i * 3 + 1] - y0m); if (iy >= 0 && iy < ny) { ax[iy] += Math.abs(pos[i * 3]); az[iy] += pos[i * 3 + 2]; an[iy]++; } }
          for (let iy = 0; iy < ny; iy++) if (an[iy]) { ax[iy] /= an[iy]; az[iy] /= an[iy]; }
          for (let i = 0; i < n; i++) { if (!armF[i] || pos[i * 3 + 1] < yPit - 14) continue; const iy = Math.round(pos[i * 3 + 1] - y0m); if (iy >= 0 && iy < ny) ar[iy] += Math.hypot(Math.abs(pos[i * 3]) - ax[iy], pos[i * 3 + 2] - az[iy]) / an[iy]; }
        { // oś ręki: dwa proste odcinki (ramię i przedramię) dopasowane do środków przekrojów, promień wygładzony
          const yS = nkF - 3, all = []; for (let iy = ny - 1; iy >= 0; iy--) if (an[iy] >= 8 && y0m + iy < yS - 3 && y0m + iy > yS - 60) all.push([y0m + iy, ax[iy], az[iy], ar[iy]]);
          const seg = (rows) => { const nR = rows.length, my = rows.reduce((s2, r) => s2 + r[0], 0) / nR, f = (k) => { const mv = rows.reduce((s2, r) => s2 + r[k], 0) / nR; let num = 0, den = 0; for (const r of rows) { num += (r[0] - my) * (r[k] - mv); den += (r[0] - my) * (r[0] - my); } const sl = num / (den || 1); return (y) => mv + sl * (y - my); }; return [f(1), f(2), f(3)]; };
          const up = all.filter((r) => r[0] > yS - 27), lowR = all.filter((r) => r[0] <= yS - 27);
          if (up.length > 6) {
            const A1 = seg(up), A2 = lowR.length > 6 ? seg(lowR) : A1, yE = yS - 27, x0 = Math.min(A1[0](yS), a.Sb / 2 - 1), z0 = A1[1](yS);
            const d1 = [A1[0](yE) - A1[0](yS), -27, A1[1](yE) - A1[1](yS)], l1 = Math.hypot(d1[0], d1[1], d1[2]), d2 = [A2[0](yE - 20) - A2[0](yE), -20, A2[1](yE - 20) - A2[1](yE)], l2 = Math.hypot(d2[0], d2[1], d2[2]);
            figShX = A1[0](yS);
            figArmAt = (sx, t) => {
              const s1 = Math.min(t, l1) / l1, s3 = Math.max(0, t - l1) / l2, c = [x0 + d1[0] * s1 + d2[0] * s3, yS + d1[1] * s1 + d2[1] * s3, z0 + d1[2] * s1 + d2[2] * s3], dd = t < l1 ? d1 : d2, an2 = Math.atan2(dd[0], -dd[1]);
              return { c: [sx * c[0], c[1], c[2]], r: Math.max(2.5, (t < l1 ? A1 : A2)[2](c[1])), ca: Math.cos(an2), sa: Math.sin(an2) };
            };
            { // dokładniejsza oś ręki: łamana przez wygładzone środki przekrojów, żeby rękaw szedł po ręce także za łokciem
              const bx = new Float32Array(ny), bz = new Float32Array(ny), bn = new Float32Array(ny), rz = new Float32Array(ny), rx2 = new Float32Array(ny);
              for (let i = 0; i < n; i++) { if (!armF[i]) continue; const iy = Math.round(pos[i * 3 + 1] - y0m); if (iy >= 0 && iy < ny) { bx[iy] += Math.abs(pos[i * 3]); bz[iy] += pos[i * 3 + 2]; bn[iy]++; } }
              for (let iy = 0; iy < ny; iy++) if (bn[iy]) { bx[iy] /= bn[iy]; bz[iy] /= bn[iy]; }
              for (let i = 0; i < n; i++) { if (!armF[i]) continue; const iy = Math.round(pos[i * 3 + 1] - y0m); if (iy >= 0 && iy < ny) { rz[iy] = Math.max(rz[iy], Math.abs(pos[i * 3 + 2] - bz[iy])); rx2[iy] = Math.max(rx2[iy], Math.abs(Math.abs(pos[i * 3]) - bx[iy])); } }
              for (let iy = 0; iy < ny; iy++) rz[iy] = Math.min(rz[iy], rx2[iy]);
              const rows = []; for (let iy = ny - 1; iy >= 0; iy--) { const Y = y0m + iy; if (bn[iy] >= 8 && Y < yPit - 2 && Y > yS - 64) rows.push(iy); }
              if (rows.length > 20) {
                const smo = (arr, k) => rows.map((iy, j) => { let sum = 0, c = 0; for (let d = -k; d <= k; d++) { const r = rows[j + d]; if (r !== undefined) { sum += arr[r]; c++; } } return sum / c; });
                const X = smo(bx, 6), Z = smo(bz, 6), R = smo(rz, 5), P = [[x0, yS, z0, Math.min(8.5, R[0])]]; rows.forEach((iy, j) => { if (j % 3 === 0 || j === rows.length - 1) P.push([X[j], y0m + iy, Z[j], Math.min(8.5, R[j])]); }); // co trzeci przekrój: oś ręki bez drobnych zygzaków, które zawyżały jej długość
                { const A0 = P[0], A1 = P[1], Rm = Math.min(9.5, A1[3] * 1.2); A0[3] = A1[3] * 0.85; for (const f of [0.66, 0.33]) P.splice(1, 0, [A0[0] + (A1[0] - A0[0]) * f, A0[1] + (A1[1] - A0[1]) * f, A0[2] + (A1[2] - A0[2]) * f, f > 0.5 ? Rm : (Rm + A0[3]) / 2]); } // nasada ręki jest grubsza niż ramię niżej
                figArmP = { P, tPit: 0 };
                const S = [0]; for (let j = 1; j < P.length; j++) S.push(S[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1], P[j][2] - P[j - 1][2]));
                figArmP.tPit = Math.max(2, S[3] - 3);
                figArmAt = (sx, t) => {
                  let j = 1; while (j < P.length - 1 && S[j] < t) j++;
                  const k = (t - S[j - 1]) / (S[j] - S[j - 1] || 1), A = P[j - 1], B = P[j], c = [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];
                  const T0 = P[Math.max(0, j - 2)], T1 = P[Math.min(P.length - 1, j + 1)], an2 = Math.atan2(T1[0] - T0[0], -(T1[1] - T0[1]));
                  return { c: [sx * c[0], c[1], c[2]], r: Math.max(2.2, A[3] + (B[3] - A[3]) * Math.max(0, Math.min(1, k))), ca: Math.cos(an2), sa: Math.sin(an2) };
                };
              }
            }
          }
        }
        const armOut = (q) => { // nad pachą tkanina układa się na ramieniu, pod pachą zostaje między ręką a tułowiem
          const iy = Math.round(q[1] - y0m); if (iy < 0 || iy >= ny || an[iy] < 4) return;
          const sx = q[0] < 0 ? -1 : 1, dx = Math.abs(q[0]) - ax[iy], dz2 = q[2] - az[iy], d = Math.hypot(dx, dz2), R = ar[iy] + 0.45; if (d >= R) return;
          if (q[1] > yPit - 1) { const k = R / (d || 1e-6); q[0] = sx * (ax[iy] + dx * k); q[2] = az[iy] + dz2 * k; }
          else if (!(sil.sleeve && p.gora !== 'bez')) { const nx = ax[iy] - Math.sqrt(Math.max(0, R * R - dz2 * dz2)); if (Math.abs(q[0]) > nx) q[0] = sx * Math.max(0, nx); }
        };
        figCol = (q, e, arms) => {
          let hit = false; const fy = q[1] - y0m, iy = Math.floor(fy);
          if (iy >= 0 && iy < ny - 1) {
            const ty = fy - iy, czz = cz[iy] + (cz[iy + 1] - cz[iy]) * ty, dz = q[2] - czz; let ph = Math.atan2(dz, q[0]); if (ph < 0) ph += TAU;
            const fp = (ph / TAU) * NPH - 0.5, ip = Math.floor(fp), tp = fp - ip, i0 = (ip + NPH) % NPH, i1 = (ip + 1) % NPH;
            const base = (Rd[iy * NPH + i0] * (1 - tp) + Rd[iy * NPH + i1] * tp) * (1 - ty) + (Rd[(iy + 1) * NPH + i0] * (1 - tp) + Rd[(iy + 1) * NPH + i1] * tp) * ty, need = base + e, r = Math.hypot(q[0], dz);
            let up = false;
            if (q[1] > Math.max(yPit - 1, a.Dts - 11) && figTop) { const top = figTop(q[0], q[2]) + e * 1.5 + 0.35, dv = top - q[1]; if (dv > 0 && (dv < 3.5 || (base > 0.5 && r < need && dv < need - r))) { q[1] = top; up = true; hit = true; } } // punkt tuż pod skórą barku albo ramienia idzie w górę
            if (!up && base > 0.5 && r < need) {
              { if (r < 1e-6) { q[2] = czz + need; } else { const k = need / r; q[0] *= k; q[2] = czz + dz * k; } }
              hit = true;
            }
          }
          if (arms && figArmP) {
            const P = figArmP.P, sx = q[0] < 0 ? -1 : 1, x = Math.abs(q[0]); let bd = 1e9, bx = 0, by = 0, bz = 0, bR = 0;
            if (q[1] < P[0][1] + 7 && q[1] > P[P.length - 1][1] - 6 && x > P[0][0] - 9) {
              for (let j = 1; j < P.length; j++) { const A = P[j - 1], B = P[j]; if (A[1] < q[1] - 9 || B[1] > q[1] + 9) continue; const ex = B[0] - A[0], ey = B[1] - A[1], ez = B[2] - A[2], l2 = ex * ex + ey * ey + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - A[0]) * ex + (q[1] - A[1]) * ey + (q[2] - A[2]) * ez) / l2)) : 0, cx = A[0] + ex * t, cy = A[1] + ey * t, cz2 = A[2] + ez * t, dd = Math.hypot(x - cx, q[1] - cy, q[2] - cz2); if (dd < bd) { bd = dd; bx = cx; by = cy; bz = cz2; bR = A[3] + (B[3] - A[3]) * t; } }
              const R = bR + e; if (bd < R && bd > 1e-6) { const k = R / bd; q[0] = sx * (bx + (x - bx) * k); q[1] = by + (q[1] - by) * k; q[2] = bz + (q[2] - bz) * k; hit = true; }
            }
          }
          return hit;
        };
        if (state.sim && window.Cloth && sil.top === 'dress') { // pole odległości od ciała: liczone raz dla danej sylwetki
          let ck = n; for (let i = 0; i < pos.length; i += 23) ck = (ck * 31 + Math.round(pos[i] * 50)) % 2147483647;
          if (!g3.sdf || g3.sdf.key !== ck) {
            const yL = floor - 1, yH = a.Dts + 9; let xa = 1e9, xb = -1e9, za = 1e9, zb = -1e9, vol = 0;
            for (let i = 0; i < n; i++) { const Y = pos[i * 3 + 1]; if (Y < yL - 2 || Y > yH + 2) continue; xa = Math.min(xa, pos[i * 3]); xb = Math.max(xb, pos[i * 3]); za = Math.min(za, pos[i * 3 + 2]); zb = Math.max(zb, pos[i * 3 + 2]); }
            for (let t = 0; t < FG.T.length; t += 3) { const p0 = FG.T[t] * 3, p1 = FG.T[t + 1] * 3, p2 = FG.T[t + 2] * 3; vol += pos[p0] * (pos[p1 + 1] * pos[p2 + 2] - pos[p1 + 2] * pos[p2 + 1]) - pos[p0 + 1] * (pos[p1] * pos[p2 + 2] - pos[p1 + 2] * pos[p2]) + pos[p0 + 2] * (pos[p1] * pos[p2 + 1] - pos[p1 + 1] * pos[p2]); }
            let ix = FG.T; if (vol < 0) { ix = new Uint32Array(FG.T.length); for (let t = 0; t < ix.length; t += 3) { ix[t] = FG.T[t]; ix[t + 1] = FG.T[t + 2]; ix[t + 2] = FG.T[t + 1]; } }
            g3.sdf = { key: ck, S: window.Cloth.sdf(pos, ix, [xa - 5, yL, za - 5], [xb + 5, yH, zb + 5], 1) };
          }
          const SD = g3.sdf.S; figCol = (q, e) => SD.push(q, e);
        }
        figClear = (q) => {
          const fy = q[1] - y0m, iy = Math.floor(fy); if (iy < 0 || iy >= ny - 1) return q;
          const ty = fy - iy, czz = cz[iy] + (cz[iy + 1] - cz[iy]) * ty, dz = q[2] - czz; let ph = Math.atan2(dz, q[0]); if (ph < 0) ph += TAU;
          const fp = (ph / TAU) * NPH - 0.5, ip = Math.floor(fp), tp = fp - ip, i0 = (ip + NPH) % NPH, i1 = (ip + 1) % NPH;
          const need = (Rd[iy * NPH + i0] * (1 - tp) + Rd[iy * NPH + i1] * tp) * (1 - ty) + (Rd[(iy + 1) * NPH + i0] * (1 - tp) + Rd[(iy + 1) * NPH + i1] * tp) * ty + 0.5, r = Math.hypot(q[0], dz);
          if (need > 0.5 && r < need && r > 1e-6) { const k = need / r; q[0] *= k; q[2] = czz + dz * k; }
          armOut(q);
          return q;
        };
      }
      for (const sx of [-1, 1]) for (const [yy, jx, rr] of [[kneeY, 1.35, 6.4], [ankleY + 1, 1.62, 3.9]]) { const pts = []; for (let i = 0; i <= 40; i++) pts.push(new T3.Vector3(sx * (jx * rL - (1 - (yy === kneeY ? lv.knee : lv.ankle) / crotch) * 0.85) * fs + rr * rL * (m.wzrost / 170) * Math.cos((i / 40) * TAU), yy, zModel(-m.wb) + (yy === kneeY ? 2 : 0) + rr * rL * (m.wzrost / 170) * Math.sin((i / 40) * TAU))); grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x7fc4e8 }))); }
      const fl = new T3.Mesh(new T3.CylinderGeometry(42, 42, 0.6, 48), new T3.MeshStandardMaterial({ color: 0x8b8fa0, roughness: 0.9, transparent: true, opacity: 0.35 })); fl.position.y = floor - 0.3; grp.add(fl);
    } else {
      const sm = new T3.MeshStandardMaterial({ color: 0x3a3f4d, roughness: 0.6, metalness: 0.4 });
      const pole = new T3.Mesh(new T3.CylinderGeometry(1.4, 1.4, body.bottom - floor, 16), sm); pole.position.y = (body.bottom + floor) / 2; grp.add(pole);
      const base = new T3.Mesh(new T3.CylinderGeometry(22, 24, 2, 40), sm); base.position.y = floor + 1; grp.add(base);
    }
    { // gdzie wypada dół względem kolan i kostek
      const el = $('hemGap'), dK = hemY - kneeY, dA = hemY - ankleY, dF = hemY - floor; el.textContent = ''; el.className = 'fitn';
      const num = (v) => Object.assign(document.createElement('b'), { textContent: f1(Math.abs(v)) + ' cm' });
      if (sil.lower === 'none') { if (sil.crop > 0) el.append('Dół kończy się ', num(sil.crop), ' nad talią'); else el.append('Dół kończy się w talii'); }
      else if (sil.top === 'corset') el.append('Talia w gorsecie ', num(sil.c.waist), ', redukcja ', num(sil.c.gr));
      else if (dF < -1) { el.className = 'fitn low'; el.append('Dół leży na podłodze, za długa o ', num(dF)); }
      else if (dF < 1.5) el.append('Dół sięga do ziemi');
      else if (Math.abs(dK) < 1) el.append('Dół wypada na wysokości kolan');
      else if (dK > 0) el.append('Dół wypada ', num(dK), ' nad kolanem');
      else if (dA < 2) el.append('Dół sięga do kostek');
      else if (-dK <= dA) el.append('Dół wypada ', num(dK), ' pod kolanem');
      else el.append('Dół wypada ', num(dA), ' nad kostką');
      if (sil.top !== 'corset' && sil.lower !== 'none') el.append(' · wzrost ' + Math.round(H) + ' cm');
    }
    const nBody = grp.children.length; // przy pustym projekcie wszystko dodane dalej jest zdejmowane: zostaje sam manekin
    // ubranie
    const yBot = sil.lower === 'none' ? (sil.crop > 0 ? sil.crop : -0.3) : -p.dl; // top kończy się w talii albo nad nią
    const er = (y) => {
      const yb = a.Dps - a.Wg, eg = sil.top === 'dress' ? p.luzG / m.og : p.luzT / m.ot, et = p.luzT / m.ot, eb = (sil.lower === 'circle' ? 4 : p.luzB) / m.ob;
      if (y >= yb) { const yp = a.Dts - a.Gp; return y <= yp ? eg : eg * (1 - 0.9 * sstep((y - yp) / Math.max(1, a.Dts - 3 - yp))); } // luz z biustu nie dochodzi do ramion: tam ubranie leży na ciele
      if (y >= 0) return et + (eg - et) * sstep(y / yb); if (y >= -m.wb) return et + (eb - et) * sstep(-y / m.wb); return eb;
    };
    // tkanina: sztywność i ciężar sterują tym, jak materiał odstaje albo opada w fałdy (model uproszczony, nie symulacja)
    const F = FAB[state.fabric] || FAB.bawelna, lift = F.st * (1 - 0.5 * F.wt), drape = 1 - lift, off = 0.4 + 0.8 * F.st;
    const fit = (y) => { const s = body(y), k = 1 + Math.max(-0.02, er(y)); return { a: s.a * k + off, b: s.b * k + off, z: s.z }; };
    const hipS = fit(-m.wb), L = Math.max(1, p.dl - m.wb), waistS = fit(0), Tw = m.ot + p.luzT, hipP = ellP(hipS.a, hipS.b);
    const hipK = sil.lower === 'trapez' ? sil.hipC / (m.ob + p.luzB) : 1, hemK = sil.lower === 'trapez' ? sil.hemC / (m.ob + p.luzB) : 1;
    const circ = sil.lower === 'circle', nBase = circ ? (sil.frac === 2 ? 14 : sil.frac === 1 ? 10 : 7) : 6;
    const nF = Math.round(nBase * (0.8 + 0.7 * drape)), nG = Math.round(nF * 0.5) + 1, cap = 0.14 + 0.2 * drape;
    const tb = (sil.frac === 2 ? 0.46 : sil.frac === 1 ? 0.36 : 0.22) * (0.45 + 0.95 * lift);
    const waveOf = (target, s) => { const r = target / ellP(s.a, s.b); return Math.min(cap, Math.sqrt(Math.max(0, 2 * (r * r - 1))) / nF); };
    const eOf = (y) => Math.max(0.5, 0.3 + 0.5 * off + (Math.max(0, er(y)) * ellP(body(y).a, body(y).b)) / TAU); // luz w centymetrach promienia
    const sectRaw = (y, phi) => {
      let s, wave = 0, yo = y, fb = 0, ya = null, eX = 0;
      if (sil.lower === 'empire' && y < sil.yE) {
        ya = sil.yE; const sE = fit(sil.yE), t = (sil.yE - y) / (sil.yE + p.dl), kf = 1 + (sil.hemC / sil.seamC - 1) * t, k = 1 + (kf - 1) * (0.45 + 0.55 * lift), bs = fit(Math.max(y, -m.wb - 4));
        s = { a: Math.max(sE.a * k, y > -m.wb - 4 ? bs.a + 0.3 : 0), b: Math.max(sE.b * k, y > -m.wb - 4 ? bs.b + 0.3 : 0), z: bs.z };
        wave = waveOf(ellP(sE.a, sE.b) * kf, s) * sstep(t * 4);
      } else if (sil.lower === 'mermaid' && y < -sil.kn) {
        const dk = (sil.kn - m.wb) / Math.max(1, sil.kn - m.wb), sK = { a: Math.max(4, hipS.a + Math.min(p.flare, 2) * dk * 0.9), b: Math.max(4, hipS.b + Math.min(p.flare, 2) * dk * 0.4) };
        const d = -sil.kn - y, gr = sil.grow || TAU, tm = 0.4 * Math.pow(gr / TAU, 0.7) * (0.45 + 0.95 * lift);
        s = { a: sK.a + d * tm, b: sK.b + d * tm * 0.92, z: hipS.z };
        wave = waveOf(ellP(sK.a, sK.b) + gr * d, s) * sstep(d / 8);
      } else if (circ && y < 0) {
        ya = 0; const d = -y, bs = fit(Math.max(y, -m.wb)), ca = waistS.a + d * tb, cb = waistS.b + d * tb * 0.92;
        s = { a: Math.max(ca, d <= m.wb + 2 ? bs.a : hipS.a), b: Math.max(cb, d <= m.wb + 2 ? bs.b : hipS.b), z: bs.z };
        wave = waveOf(Tw + TAU * sil.frac * d, s) * sstep(d / (m.wb * 0.8));
        yo = y - 3 * drape * F.wt * (d / p.dl) * (1 - Math.cos(4 * phi)) / 2; // skos wyciąga się pod własnym ciężarem
      } else if (y >= -m.wb) { s = fit(y); fb = 1; if (hipK !== 1 && y < 0) { const k = 1 + (hipK - 1) * (-y / m.wb); eX = (k - 1) * (s.a + s.b) / 2; s = { a: s.a * k, b: s.b * k, z: s.z }; } }
      else {
        ya = -m.wb;
        const Le = sil.lower === 'mermaid' ? Math.max(1, sil.kn - m.wb) : L, d = (-m.wb - y) / Le, hold = 0.35 + 0.65 * lift;
        if (sil.lower === 'trapez') {
          const kf = hipK + (hemK - hipK) * d, k = hipK + (hemK - hipK) * d * hold;
          s = { a: hipS.a * k, b: hipS.b * Math.pow(k, 1.1), z: hipS.z * (1 - d) };
          wave = waveOf(hipP * kf, s) * sstep(d * 3);
        } else {
          const fl = (sil.lower === 'mermaid' ? Math.min(p.flare, 2) : p.flare * (sil.flareK || 1)) * d;
          s = { a: Math.max(4, hipS.a + fl * 0.9 * (fl > 0 ? hold : 1)), b: Math.max(4, hipS.b + fl * 0.4 * (fl > 0 ? hold : 1)), z: hipS.z };
          if (fl > 0) wave = waveOf(hipP + 4 * fl, s) * sstep(d * 3);
        }
      }
      // fałdy tylko na zewnątrz od bryły podstawowej, żeby tkanina nie wchodziła w ciało
      const k = 1 + wave * (0.9 * (1 + Math.cos(nF * phi + 0.6)) + 0.25 * drape * (1 + Math.cos(nG * phi + 2.1)));
      const gx = s.a * Math.cos(phi) * k, gs = Math.sin(phi);
      const q = [gx, yo, s.z + s.b * gs * k + body.bump(gx, y, gs, true) * (state.bust ? 1 : 0.6) - body.butt(gx, Math.max(y, -m.wb - 6), gs, hipS.a) * 1.05];
      if (figFit) { // przy sylwetce część dopasowana leży na ciele z luzem z wykroju, a część swobodna zaczyna się płynnie od tego miejsca
        if (fb) figFit(q, eOf(y) + eX, 1);
        else if (ya !== null) { const fd = 1 - sstep((ya - y) / 10); if (fd > 0) { const sA = fit(ya), ax0 = sA.a * Math.cos(phi), qa = [ax0, ya, sA.z + sA.b * gs + body.bump(ax0, ya, gs, true) * (state.bust ? 1 : 0.6) - body.butt(ax0, Math.max(ya, -m.wb - 6), gs, hipS.a) * 1.05], z0 = qa[2]; figFit(qa, eOf(ya), 1); q[0] += (qa[0] - ax0) * fd; q[2] += (qa[2] - z0) * fd; } }
      }
      if (figClear) { figClear(q); if (figDrape) figDrape(q, eOf(y)); }
      return q;
    };
    const topOk = useFig && !!figCol && !!g3.sdf && state.sim && !!window.Cloth && sil.top === 'dress' && (model.d.sewn || model.d).pieces.some((q) => q.id === 'przod' && q.ed) && (model.d.sewn || model.d).pieces.some((q) => q.id === 'tyl' && q.ed);
    const topFull = topOk && (sil.imported || ((sil.lower === 'straight' || sil.lower === 'trapez') && !sil.tren && p.dl >= m.wb + 1)); // sukienka i top z jednego kawałka: całość układa się jako zszyta tkanina
    // symulacja: poniżej linii przypięcia (talia, biodra, odcięcie) położenie tkaniny bierze się z symulacji, nie z reguł
    let simRef = null; $('simS').textContent = '';
    {
      const stiffTop = sil.top === 'corset' || sil.lower === 'none' || state.style === 'su_rybka_kliny';
      let spec = null;
      if (!state.sim || stiffTop || sil.tren || topFull) spec = null;
      else if (sil.lower === 'circle') spec = { yPin: 0, L: p.dl, C: sil.pleat ? (d) => Tw + (sil.hemC - Tw) * Math.min(1, d / 3) : (d) => Tw + TAU * sil.frac * d };
      else if (sil.lower === 'mermaid') spec = { yPin: -sil.kn, L: p.dl - sil.kn, C: (d) => sil.kneeC + (sil.grow || TAU) * d };
      else if (sil.lower === 'empire') { const Le = sil.yE + p.dl; spec = { yPin: sil.yE, L: Le, C: sil.frac ? (d) => sil.seamC + TAU * sil.frac * d : (d) => sil.seamC + ((sil.hemC - sil.seamC) * d) / Le }; }
      else if (sil.hemC && p.dl - m.wb > 6) { const c0 = sil.hipC || m.ob + p.luzB, Ls = p.dl - m.wb; spec = { yPin: -m.wb, L: Ls, C: (d) => c0 + ((sil.hemC - c0) * d) / Ls }; }
      if (!spec) g3.sim = null;
      else {
        const key = JSON.stringify([state.style, p, m, state.fabric, state.figure]);
        if (!g3.sim || g3.sim.key !== key) {
          const manClear = (q) => { // manekin: elipsa tułowia na danej wysokości, poniżej tułowia nic nie ma
            // pod dolną krawędzią manekina zostaje niewidoczna, lekko zwężona bryła, żeby tkanina nie zawijała się pod korpus
            const under = q[1] < body.bottom, s = body(Math.max(body.bottom, Math.min(q[1], a.Dts))), dz = q[2] - s.z, r = Math.hypot(q[0], dz) || 1e-6, cs = q[0] / r, sn = dz / r;
            const R = ((s.a * s.b) / Math.hypot(s.b * cs, s.a * sn)) * (under ? Math.max(0.6, 0.94 - (body.bottom - q[1]) * 0.006) : 1) + 0.35 + (sn < 0 && !under ? body.butt(q[0], q[1], sn, hipS.a) : 0); if (r < R) { q[0] = cs * R; q[2] = s.z + sn * R; } return q;
          };
          const sim = makeSim(spec, key, sectRaw, figClear || manClear, floor, F); g3.sim = sim;
          clearTimeout(g3.simT); g3.simT = setTimeout(() => simRun(sim), 220);
        }
        if (g3.sim.ready) simRef = g3.sim;
        if (!g3.sim.done) $('simS').textContent = 'Układam tkaninę…';
      }
    }
    let topLook = null; // powierzchnia zszytej góry do rysowania dodatków (kołnierz, falbanka, linie)
    const sect = (y, phi) => (simRef && y < simRef.yPin - 1e-4 ? simRef.sample(phi, simRef.yPin - y) : topLook ? topLook(y, phi) : sectRaw(y, phi));
    // góra zszyta z elementów wykroju: przód, tył i rękawy jako tkanina ułożona na sylwetce (na razie tylko góry z ramionami, na sylwetce)
    let topSim = null;
    {
      const D = model.d.sewn || model.d, ok = topOk;
      if (!ok) g3.top = null;
      else {
        const toHip = sil.lower !== 'circle' && sil.lower !== 'none' && sil.lower !== 'empire', longEnough = p.dl >= m.wb + 1;
        const cutY = toHip && longEnough && !topFull ? m.wb : null, pinned = topFull ? false : toHip ? longEnough : !(sil.crop > 0), yPinW = cutY != null ? -cutY : 0, hasSl = !!sil.sleeve && !!figArmP;
        const pk = Object.assign({}, p, { extras: 0, saSzew: 0, saDol: 0, saTalia: 0, fac: 0, facW: 0, kol: 0, kolW: 0, falN: 0, falR: 0, sciag: 0 }); if (!topFull && cutY == null && pinned) Object.assign(pk, { dl: 0, flare: 0, kn: 0, gf: 0, ff: 0, zakK: 0, tren: 0, rozp: 0, pasT: 0, luzB: 0 }); else if (cutY != null) Object.assign(pk, { dl: 0, flare: 0, kn: 0, gf: 0, ff: 0, tren: 0, rozp: 0 });
        const key = 'top' + JSON.stringify([state.style, pk, m, state.fabric, sil.imported ? [state.proj, state.imp && state.imp.size, sil.hemC, sil.impDl, sil.gather] : 0]);
        if (!g3.top || g3.top.key !== key) {
          const hh = topFull ? Math.max(1.7, Math.min(3, Math.sqrt(((m.ob + 8) * (a.Dts + p.dl) + (hasSl ? 70 * sil.sleeve.L : 0)) / 3300))) : 1.6; // gęstość siatki dobrana do wielkości ubrania
          let g = null; try { g = window.Cloth.build(D, { h: hh, sleeve: hasSl, cutY, gather: sil.gather || null }); } catch (e) { g = null; }
          if (!g) g3.top = { key, fail: true };
          else {
            const stl = p.gora === 'bez', yTopW = a.Dts - 0.3, FI = g.info.F, BI = g.info.B, SB = g.info.S ? g.info.S.box : null, SL = sil.sleeve, rr = SB ? (SB[2] - SB[0]) / TAU : 0;
            const phiOf = (mt, sFr) => (mt.pk === 'F' ? Math.PI / 2 - mt.sx * sFr * Math.PI / 2 : 1.5 * Math.PI + mt.sx * sFr * Math.PI / 2);
            const init = (mt) => {
              if (mt.pk === 'S') {
                const tP = figArmP.tPit, t = mt.v >= SL.H ? tP + (mt.v - SL.H) : tP * Math.max(0, mt.v / SL.H), A = figArmAt(mt.sx, t), th = mt.u / rr, r0 = Math.max(rr * 0.9, A.r + 1.2), cu = Math.cos(th), su = Math.sin(th);
                return [A.c[0] + r0 * cu * mt.sx * A.ca, A.c[1] + r0 * cu * A.sa, A.c[2] + r0 * su];
              }
              const I = mt.pk === 'F' ? FI : BI, yw = mt.v < 0 && !stl ? (-mt.v * yTopW) / -I.top : -mt.v, Wd = I.sideX ? I.sideX(Math.max(mt.v, I.sideTop)) : 20, q = sectRaw(Math.min(yw, yTopW), phiOf(mt, Math.min(1, Math.abs(mt.u) / Math.max(4, Wd))));
              return [q[0], q[1], q[2]];
            };
            const pinPos = (mt, sFr) => { const q = sectRaw(yPinW, phiOf(mt, sFr)); return [q[0], yPinW, q[2]]; };
            const eB = 0.5 + 0.25 * F.st, collide = (q, kind) => figCol(q, kind ? eB + 0.1 : eB, true);
            // tkanina: sztywność steruje oporem przy zginaniu (skala logarytmiczna jak w seamer-studio), dżersej jest rozciągliwy
            const bendC = Math.exp(Math.log(6e-5) + (Math.log(2e-7) - Math.log(6e-5)) * F.st), knit = state.fabric === 'dzersej';
            const S = window.Cloth.sim(g, { selfContact: !window.__noSelf, init, pinPos, pinned, collide, hold: stl, holdSlack: 0.4, steps: 150, subSteps: 14, stretchCompliance: knit ? 4e-7 : 2e-8, compressCompliance: 4e-7, bendCompliance: bendC, friction: 0.4, damping: 0.03 });
            // lico na zewnątrz: orientacja trójkątów każdego elementu względem środka bryły, którą okrywa
            const X = S.X, cen = (pred) => { let cx = 0, cy = 0, cz2 = 0, c = 0; for (let i = 0; i < g.ns; i++) if (pred(g.meta[i])) { cx += X[i * 3]; cy += X[i * 3 + 1]; cz2 += X[i * 3 + 2]; c++; } return [cx / c, cy / c, cz2 / c]; };
            const cb = cen((mt) => mt.pk !== 'S');
            for (const gr of g.grp) {
              const c0 = gr.pk === 'S' ? cen((mt) => mt.pk === 'S' && mt.sx === gr.sx) : cb; let sum = 0;
              for (let t = gr.t0; t < gr.t1; t++) { const i0 = g.rmap[g.tri[t * 3]] * 3, i1 = g.rmap[g.tri[t * 3 + 1]] * 3, i2 = g.rmap[g.tri[t * 3 + 2]] * 3, ux = X[i1] - X[i0], uy = X[i1 + 1] - X[i0 + 1], uz = X[i1 + 2] - X[i0 + 2], vx = X[i2] - X[i0], vy = X[i2 + 1] - X[i0 + 1], vz = X[i2 + 2] - X[i0 + 2];
                const nx = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz = ux * vy - uy * vx, mx = (X[i0] + X[i1] + X[i2]) / 3 - c0[0], my = gr.pk === 'S' ? (X[i0 + 1] + X[i1 + 1] + X[i2 + 1]) / 3 - c0[1] : 0, mz = (X[i0 + 2] + X[i1 + 2] + X[i2 + 2]) / 3 - c0[2]; sum += nx * mx + ny2 * my + nz * mz; }
              if (sum < 0) for (let t = gr.t0; t < gr.t1; t++) { const k = g.tri[t * 3 + 1]; g.tri[t * 3 + 1] = g.tri[t * 3 + 2]; g.tri[t * 3 + 2] = k; }
            }
            g3.top = { key, g, S, yPinW, pinned, hasSl, ready: false, done: false, prev: g3.top && !g3.top.fail ? (g3.top.ready ? g3.top : g3.top.prev) : null };
            clearTimeout(g3.topT); const tp = g3.top; g3.topT = setTimeout(() => topRun(tp), 260);
          }
        }
        if (g3.top && !g3.top.fail && !g3.top.done && !g3.top.run && g3.top.S.steps > 0) { const tp = g3.top; clearTimeout(g3.topT); g3.topT = setTimeout(() => topRun(tp), 60); }
        if (g3.top && !g3.top.fail) { if (g3.top.ready) { topSim = g3.top; g3.top.prev = null; } else if (g3.top.prev && g3.top.prev.pinned === pinned && g3.top.prev.yPinW === yPinW) topSim = g3.top.prev;
          if (topSim) { // mapa promieni ułożonej tkaniny: z niej biorą położenie dodatki rysowane na górze
            const g = topSim.g, X = topSim.S.X, yA = Math.floor(topSim.pinned ? topSim.yPinW : -p.dl) - 1, nyG = Math.ceil(a.Dts + 4 - yA) + 1, NG = 120, Gm = new Float32Array(nyG * NG), czG = new Float32Array(nyG);
            for (let i = 0; i < nyG; i++) czG[i] = body(Math.max(-m.wb, Math.min(a.Dts, yA + i))).z;
            for (const gr of g.grp) { if (gr.pk === 'S') continue; for (let t = gr.t0; t < gr.t1; t++) { const i0 = g.rmap[g.tri[t * 3]] * 3, i1 = g.rmap[g.tri[t * 3 + 1]] * 3, i2 = g.rmap[g.tri[t * 3 + 2]] * 3;
              for (let u = 0; u <= 4; u++) for (let v = 0; u + v <= 4; v++) { const b1 = u / 4, b2 = v / 4, b0 = 1 - b1 - b2, x = X[i0] * b0 + X[i1] * b1 + X[i2] * b2, y = X[i0 + 1] * b0 + X[i1 + 1] * b1 + X[i2 + 1] * b2, z = X[i0 + 2] * b0 + X[i1 + 2] * b1 + X[i2 + 2] * b2, iy = Math.round(y - yA); if (iy < 0 || iy >= nyG) continue; const dz = z - czG[iy]; let ph = Math.atan2(dz, x); if (ph < 0) ph += TAU; const k = iy * NG + Math.min(NG - 1, Math.floor((ph / TAU) * NG)), r = Math.hypot(x, dz); if (r > Gm[k]) Gm[k] = r; } } }
            topLook = (y, phi) => {
              const q = sectRaw(y, phi), fy = y - yA, iy = Math.round(fy); if (iy < 0 || iy >= nyG) return q; const dz = q[2] - czG[iy], r = Math.hypot(q[0], dz); if (r < 1e-6) return q; let ph = Math.atan2(dz, q[0]); if (ph < 0) ph += TAU;
              const fp = (ph / TAU) * NG - 0.5, ip = Math.floor(fp), tp = fp - ip, g0 = Gm[iy * NG + ((ip + NG) % NG)], g1 = Gm[iy * NG + ((ip + 1) % NG)]; if (!(g0 > 0) || !(g1 > 0)) return q;
              const k = (g0 * (1 - tp) + g1 * tp + 0.12) / r; q[0] *= k; q[2] = czG[iy] + dz * k; return q;
            };
          } if (!g3.top.done) $('simS').textContent = 'Układam tkaninę…'; }
      }
    }
    let tx;
    const wx = fabTex(FAB[state.fabric] ? state.fabric : 'bawelna'), ps = state.print !== 'gladka' ? printTex(wx) : null;
    if (ps) tx = { tile: ps.tile * state.pscale / 100, rough: wx.rough, metal: wx.metal, bump: wx.bump, opacity: wx.opacity, map: ps.map, bumpMap: ps.bumpT, alpha: ps.alpha };
    else tx = Object.assign({ bumpMap: wx.bump ? wx.map : null }, wx);
    const gm = new T3.MeshStandardMaterial({ color: ps ? 0xffffff : new T3.Color(state.color), roughness: tx.rough, metalness: tx.metal, side: T3.DoubleSide, map: tx.map, bumpMap: tx.bumpMap, bumpScale: tx.bump });
    if (tx.alpha) { gm.alphaMap = tx.alpha; gm.transparent = true; gm.depthWrite = false; }
    else if (tx.opacity && tx.opacity < 1) { gm.transparent = true; gm.opacity = tx.opacity; }
    // tkaniny prześwitujące: najpierw lewa strona, potem prawa, żeby warstwy nie migotały
    const addG = (mesh) => {
      if (!gm.transparent) { grp.add(mesh); return; }
      const bk = gm.clone(); bk.side = T3.BackSide; bk.depthWrite = false; const fr = gm.clone(); fr.side = T3.FrontSide; fr.depthWrite = false;
      mesh.material = bk; mesh.renderOrder = 1; const top = new T3.Mesh(mesh.geometry, fr); top.renderOrder = 2; grp.add(mesh, top);
    };
    const Pm = circ ? (sil.top === 'dress' ? m.og + p.luzG : Tw) : (m.ob + p.luzB), uN = Math.max(1, Math.round(Pm / tx.tile)), r0 = circ ? Tw / (TAU * sil.frac) : 0;
    const uvOf = (u, phi, y, top) => (circ && y < 0 ? [((r0 - y) * Math.cos(phi * sil.frac)) / tx.tile, ((r0 - y) * Math.sin(phi * sil.frac)) / tx.tile] : [u * uN, (top - y) / tx.tile]);
    const uOf = (phi) => { let d = Math.abs(((phi - Math.PI / 2) % TAU + TAU) % TAU); if (d > Math.PI) d = TAU - d; return d / Math.PI; }; // 0 = środek przodu, 1 = środek tyłu
    if (sil.top === 'corset') {
      // gorset: pas od górnej do dolnej krawędzi, z odstępem sznurowania na środku tyłu (ściśnięcia talii podgląd nie pokazuje)
      const C = sil.c;
      addG(surface(192, 36, (u, v) => { const phi = u * TAU, uu = uOf(phi), T = C.T(uu), y = T + (-C.B(uu) - T) * v, q = sect(y, phi); q.push(uu > 1 - C.gap ? 1 : 0, u * uN, (T - y) / tx.tile); return q; }, gm));
    } else if (sil.top !== 'dress') {
      const y0 = p.pasek > 0 ? 0.3 : 0;
      addG(surface(144, 90, (u, v) => { const y = y0 + (-p.dl - y0) * v, q = sect(y, u * TAU); const t = uvOf(u, u * TAU, y, y0); q.push(0, t[0], t[1]); return q; }, gm));
    } else {
      // góra: pełna powłoka od punktu szyjnego, z wyciętym dekoltem i pachami (krawędzie dociągane do linii wycięcia)
      const yNP = a.Dts - 0.2 - p.nw * 0.38, Xn = (a.os / 5 + p.nw * 0.9) * 0.95;
      const nkF = sil.wrap ? 'v' : p.nk; // przód kopertowy daje w podglądzie dekolt V do miejsca skrzyżowania
      const yCf = sil.wrap ? Math.min(yNP - 1, -sil.wrap.yCross) : Math.min(yNP - 1, a.Dts - a.os / 5 - p.nd - 1), yCb = Math.min(yNP - 1, a.Dt - 0.3 - p.nb);
      const prof = (shape, t, r) => shape === 'v' ? t : shape === 'karo' ? (t < 0.8 ? 0 : (t - 0.8) / 0.2) : shape === 'lodka' ? t * t
        : shape === 'serce' ? (t < 0.8 ? r * (t + 0.4 * Math.sin((Math.PI * t) / 0.8)) : 0.8 * r + (1 - 0.8 * r) * Math.pow((t - 0.8) / 0.2, 1.5)) : Math.pow(t, 2.6);
      // przy sylwetce pacha jest wycięta odrobinę szerzej, żeby ramię nie przecinało krawędzi tkaniny
      const yArm = a.Dts - a.Gp - sil.lowerArm - (useFig ? 1.2 : 0), yTip = a.Dts - 4.8 + (useFig ? 2.2 : 0) + (sil.bok > 0 ? Math.max(0, 1 - sil.bok / 9) * 3.4 : 0), yc = (yArm + yTip) / 2, hy = (yTip - yArm) / 2, bokS = sil.bok > 0 ? Math.max(0, 1 - sil.bok / 9) : 0, wz = 5.4 + sil.lowerArm * 0.3 + (useFig ? 2 : 0) + bokS * 1.8;
      const yArmN = yArm, yTipN = a.Dts - 4.8 + (useFig ? 2.2 : 0), ycN = (yArmN + yTipN) / 2, hyN = (yTipN - yArmN) / 2, wzN = 5.4 + sil.lowerArm * 0.3 + (useFig ? 2 : 0), xsN = (useFig && figShX ? Math.min(a.Sb / 2 - 0.3, figShX + 2.5) : a.Sb / 2 - 0.3) - (sil.bok || 0);
      const bez = p.gora === 'bez', yU = a.Dts - a.Gp - sil.lowerArm, ybL = a.Dps - a.Wg, bhh = Math.max(2, Math.min(12, p.bh || 6));
      // bez ramiączek: górna krawędź biegnie nad biustem z przodu, pod pachą z boku i odrobinę niżej z tyłu
      const topS = (phi, yy) => {
        const sn = Math.sin(phi), ac = Math.abs(Math.cos(phi)); if (sn <= 0) return yU - 1.5 * (1 - ac);
        if (sil.strap || p.bk === 'luk') { // z ramiączkami: poziomo między ramiączkami (albo łukiem w dół), za nimi w dół pod pachę
          const aa = fit(yy).a, x = aa * ac, xq = a.Rg / 2, top = ybL + bhh; if (x <= xq) return Math.max(top - (p.bk === 'luk' ? 2.5 * (1 - (x / xq) * (x / xq)) : 0), Math.min(yU, ybL + 1.5));
          const uu = Math.min(1, (x - xq) / Math.max(1, aa - xq)); return Math.max(top + (yU - top) * uu * uu * (3 - 2 * uu), Math.min(yU, ybL + 1.5));
        }
        const w = 1 - Math.pow(ac, 2.2); let t = yU + (ybL + bhh - yU) * w;
        if (p.bk === 'serce') t += w - 4.5 * Math.pow(Math.max(0, 1 - (fit(yy).a * ac) / (a.Rg / 2)), 1.3);
        return Math.max(t, Math.min(yU, ybL + 1.5));
      };
      const yTop0 = topSim ? topSim.yPinW : bez ? Math.max(yU, ybL + bhh) + 1.5 : yNP, yMid = topSim ? topSim.yPinW + (yBot - topSim.yPinW) * 0.42 : bez ? ybL - 3 : Math.min(yArm, yCf, yCb) - 1.5;
      if (!sil.imported && (!topSim || (topSim.pinned && topSim.yPinW - yBot > 0.6))) addG(surface(200, 140, (u, v) => {
        let phi = u * TAU, cut = 0;
        const yBt = sil.tren ? yBot - sil.tren * Math.pow(Math.max(0, -Math.sin(phi)), 1.3) : yBot; // tren wydłuża dół z tyłu
        let y = v < 0.42 ? yTop0 + (yMid - yTop0) * (v / 0.42) : yMid + (yBt - yMid) * ((v - 0.42) / 0.58);
        const sn = Math.sin(phi), cs = Math.cos(phi);
        if (bez) { const lim = topS(phi, Math.min(y, ybL + bhh)); if (y > lim) { y = lim; cut = 1; } }
        else if (y > Math.min(yArm, yCf, yCb) - 0.5) {
          // dekolt
          const yC = sn > 0 ? yCf : yCb, shp = sn > 0 ? nkF : p.nkb, f = (yy) => { const x = Math.abs(fit(yy).a * cs); return x >= Xn ? yNP : yC + (yNP - yC) * prof(shp, x / Xn, Math.min(0.3, (0.5 * Xn) / Math.max(1, yNP - yC))); };
          let lim = f(y);
          if (y > lim) { let lo = yC - 1, hi = y; for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (mid > f(mid)) hi = mid; else lo = mid; } y = lo; cut = 1; }
          // pacha
          if (!sil.sleeve && y > yArmN) { // z rękawem pacha jest zaszyta, więc powłoka zostaje pełna
            // krawędź pachy widziana z przodu: na dole owal wycięty w boku, u góry dochodzi do końca ramienia (węższego przy odsłoniętych ramionach)
            const s0 = fit(y), tA = (y - ycN) / hyN, tau = (y - yArmN) / (2 * hyN), ov = tA >= 1 ? s0.a : s0.a * Math.sqrt(Math.max(0, 1 - Math.pow(wzN / s0.b, 2) * (1 - tA * tA)));
            const Xa = y < ycN ? ov : Math.min(xsN, Math.max(ov, xsN - 14 * Math.pow(Math.max(0, 1 - tau), 1.2)));
            if (Xa < s0.a - 1e-3 && Math.abs(s0.a * cs) > Xa) { const ph = Math.acos(Math.max(0, Xa) / s0.a); phi = sn >= 0 ? (cs >= 0 ? ph : Math.PI - ph) : (cs >= 0 ? TAU - ph : Math.PI + ph); cut = 1; }
          }
        }
        let over = 0; if (sil.tren && y < floor + 0.5) { over = floor + 0.5 - y; y = floor + 0.5; } // nadmiar trenu kładzie się na podłodze za sylwetką
        let pt = sect(y, phi);
        if (!bez && !sil.sleeve && y > ycN && Math.abs(pt[0]) > xsN) { // koniec ramienia liczony na gotowej bryle: tkanina nie wychodzi poza szerokość ramienia z wykroju
          let lo = sn >= 0 ? Math.PI / 2 : 1.5 * Math.PI, hi = phi; for (let it = 0; it < 11; it++) { const mid = (lo + hi) / 2; if (Math.abs(sect(y, mid)[0]) > xsN) hi = mid; else lo = mid; }
          phi = lo; pt = sect(y, phi); cut = 1;
        }
        if (over) { pt[0] += Math.cos(phi) * over * 0.9; pt[2] += Math.sin(phi) * over * 0.9; }
        const t = uvOf(u, phi, y, yNP); pt.push(cut, t[0], t[1]); return pt;
      }, gm));
      // wysokość linii dekoltu dla danego kąta (ta sama reguła co wycięcie w powłoce)
      const neckY = (phi) => {
        const sn = Math.sin(phi), cs = Math.cos(phi), yC = sn > 0 ? yCf : yCb, shp = sn > 0 ? nkF : p.nkb;
        const f = (yy) => { const x = Math.abs(fit(yy).a * cs); return x >= Xn ? yNP : yC + (yNP - yC) * prof(shp, x / Xn, Math.min(0.3, (0.5 * Xn) / Math.max(1, yNP - yC))); };
        let lo = yC - 1, hi = yNP; for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (mid > f(mid)) hi = mid; else lo = mid; } return lo;
      };
      if (topSim) { // zszyta góra: siatka z elementów wykroju w położeniu z symulacji
        const g = topSim.g, X = topSim.S.X, pos = new Float32Array(g.nr * 3), uv = new Float32Array(g.nr * 2), nrm = new Float32Array(g.ns * 3), nr = new Float32Array(g.nr * 3);
        for (let r = 0; r < g.nr; r++) { const k = g.rmap[r] * 3; pos[r * 3] = X[k]; pos[r * 3 + 1] = X[k + 1]; pos[r * 3 + 2] = X[k + 2]; uv[r * 2] = g.ruv[r * 2] / tx.tile; uv[r * 2 + 1] = -g.ruv[r * 2 + 1] / tx.tile; }
        for (let t = 0; t < g.tri.length; t += 3) { const s0 = g.rmap[g.tri[t]] * 3, s1 = g.rmap[g.tri[t + 1]] * 3, s2 = g.rmap[g.tri[t + 2]] * 3, ux = X[s1] - X[s0], uy = X[s1 + 1] - X[s0 + 1], uz = X[s1 + 2] - X[s0 + 2], vx = X[s2] - X[s0], vy = X[s2 + 1] - X[s0 + 1], vz = X[s2 + 2] - X[s0 + 2], nx = uy * vz - uz * vy, ny2 = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [s0, s1, s2]) { nrm[k] += nx; nrm[k + 1] += ny2; nrm[k + 2] += nz; } }
        for (let i = 0; i < g.ns; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l; }
        for (let r = 0; r < g.nr; r++) { const k = g.rmap[r] * 3; nr[r * 3] = nrm[k]; nr[r * 3 + 1] = nrm[k + 1]; nr[r * 3 + 2] = nrm[k + 2]; }
        const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T3.BufferAttribute(uv, 2)); geo.setAttribute('normal', new T3.BufferAttribute(nr, 3)); geo.setIndex(new T3.BufferAttribute(Uint32Array.from(g.tri), 1));
        addG(new T3.Mesh(geo, gm));
        if (state.seams) for (const ch of g.seams) { const pts = ch.map((i) => new T3.Vector3(X[i * 3] + nrm[i * 3] * 0.12, X[i * 3 + 1] + nrm[i * 3 + 1] * 0.12, X[i * 3 + 2] + nrm[i * 3 + 2] * 0.12)); grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 }))); }
      }
      if (sil.sleeve && !bez && !sil.imported && !(topSim && topSim.hasSl)) { // rękaw: rura wzdłuż ręki sylwetki, a na manekinie pod stałym kątem od barku
        const SL = sil.sleeve, rB = SL.bic / TAU, rH = SL.hem / TAU, ang = 0.42, cA = Math.cos(ang), sA = Math.sin(ang), z0s = fit(yc).z + 0.4;
        for (const sx of [1, -1]) addG(surface(28, 26, (u, v) => {
          const t = v * (SL.L - 2) - (figArmAt ? 6 * (1 - v) * (1 - v) * Math.pow(Math.max(0, -sx * Math.cos(u * TAU)), 2) : 0), A = figArmAt ? figArmAt(sx, t) : { c: [sx * (a.Sb / 2 - 2.5 + sA * t), a.Dts - 3.2 - cA * t, z0s], r: 0 };
          const rFull = Math.max(rB + (rH - rB) * v, A.r + 1), r = (figArmAt && !SL.puff ? A.r + 0.9 + (rFull - A.r - 0.9) * sstep(Math.max(0, t) / 8) : rFull) * (SL.puff ? 1 + 0.5 * Math.sin(Math.PI * Math.min(1, v * 1.04)) : 1), th = u * TAU, c2 = A.ca == null ? cA : A.ca, s2 = A.sa == null ? sA : A.sa;
          return [A.c[0] + r * Math.cos(th) * c2, A.c[1] + sx * r * Math.cos(th) * s2, A.c[2] + r * Math.sin(th), 0, u * 4, (v * SL.L) / tx.tile];
        }, gm));
      }
      if (sil.sleeve && sil.sleeve.ruf && !bez) { // falbanka przy dole rękawa: rozszerzający się, pofalowany pierścień
        const SL = sil.sleeve, rH = SL.hem / TAU, cA = Math.cos(0.42), sA = Math.sin(0.42), z0s = fit(yc).z + 0.4;
        for (const sx of [1, -1]) addG(surface(40, 5, (u, v) => {
          const t = SL.L - 2 + v * SL.ruf, A = figArmAt ? figArmAt(sx, t) : { c: [sx * (a.Sb / 2 - 2.5 + sA * t), a.Dts - 3.2 - cA * t, z0s], r: 0 }, th = u * TAU;
          const r = Math.max(rH, A.r + 1) * (1 + v * (0.45 + 0.14 * Math.sin(th * 9))), c2 = A.ca == null ? cA : A.ca, s2 = A.sa == null ? sA : A.sa;
          return [A.c[0] + r * Math.cos(th) * c2, A.c[1] + sx * r * Math.cos(th) * s2, A.c[2] + r * Math.sin(th), 0, u * 4, v];
        }, gm));
      }
      if (topSim && topSim.g.neck.length > 8 && (sil.collar || sil.ruffN)) { // kołnierz i falbanka idą po prawdziwej krawędzi dekoltu zszytej góry
        const g = topSim.g, X = topSim.S.X, NL = g.neck.map((i) => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]]), nN = NL.length, zN = body(a.Dts).z; let yLo = 1e9, yHi = -1e9; for (const q of NL) { yLo = Math.min(yLo, q[1]); yHi = Math.max(yHi, q[1]); }
        const at = (u) => { const f = ((u % 1) + 1) % 1 * nN, i = Math.floor(f) % nN, t = f - Math.floor(f), A = NL[i], B = NL[(i + 1) % nN]; return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
        const out = (q) => { const dx = q[0], dz = q[2] - zN, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
        if (sil.collar) {
          const gk = gm.clone(); if (!ps) gk.color = new T3.Color(state.color).lerp(new T3.Color(0xffffff), 0.25); const wC = sil.collar.w, st = sil.collar.type === 'stojka', szal = sil.collar.type === 'szal';
          const cpt = (u, v) => { const q = at(u), o = out(q); if (st) return [q[0] - o[0] * v * wC * 0.22, q[1] + v * wC * 0.97, q[2] - o[1] * v * wC * 0.22];
            const tpr = szal ? Math.max(0, Math.min(1, 0.15 + (1.3 * (q[1] - yLo)) / Math.max(1, yHi - yLo))) : 1, d = v * wC * tpr; return [q[0] + o[0] * (0.35 + d * 0.8), q[1] - d * 0.55 + 0.12, q[2] + o[1] * (0.35 + d * 0.8)]; };
          const cm = surface(Math.min(160, nN * 3), 6, (u, v) => { const q = cpt(u, v); q.push(0, u * uN, (v * wC) / tx.tile); return q; }, gk); cm.renderOrder = 2; grp.add(cm);
          const ep = []; for (let i = 0; i <= 160; i++) { const q = cpt(i / 160, 1); ep.push(new T3.Vector3(q[0], q[1], q[2])); } grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(ep), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })));
        }
        if (sil.ruffN) { const wR = sil.ruffN; const rm = surface(Math.min(220, nN * 5), 6, (u, v) => { const q = at(u), o = out(q), lift = 0.4 + v * wR * (0.55 + 0.22 * Math.sin(u * nN * 2.4)); return [q[0] + o[0] * lift, q[1] - v * wR * 0.6 + 0.15, q[2] + o[1] * lift, 0, u * uN, v]; }, gm.clone()); rm.renderOrder = 2; grp.add(rm); }
      }
      if (sil.ruffN && !bez && !topSim) { // falbanka przy dekolcie: pofalowany pas leżący wzdłuż krawędzi
        const zN2 = body(a.Dts).z, wR = sil.ruffN;
        const rm = surface(220, 6, (u, v) => { const phi = u * TAU, y0 = neckY(phi), q = sect(y0 - v * wR * 0.75, phi), l = Math.hypot(q[0], q[2] - zN2) || 1, lift = 0.45 + v * (1.3 + 0.9 * Math.sin(phi * 38)); return [q[0] * (1 + lift / l), q[1] + 0.15, zN2 + (q[2] - zN2) * (1 + lift / l), Math.abs(phi - 1.5 * Math.PI) < 0.04 ? 1 : 0, u * uN, v]; }, gm.clone());
        rm.renderOrder = 2; grp.add(rm);
      }
      if (sil.sciag) { // ściągacz pod biustem: ciemna linia dookoła na wysokości tunelu
        const pts = []; for (let i = 0; i <= 120; i++) { const q = sect(sil.sciag, (i / 120) * TAU), l = Math.hypot(q[0], q[2]) || 1; pts.push(new T3.Vector3(q[0] * (1 + 0.25 / l), q[1], q[2] * (1 + 0.25 / l))); }
        grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })));
      }
      if (sil.collar && !bez && !topSim) { // kołnierz: stójka stoi przy szyi, bebe leży płasko na dekolcie
        const gk = gm.clone(); if (!ps) gk.color = new T3.Color(state.color).lerp(new T3.Color(0xffffff), 0.25);
        const nrr = (a.os / (2 * Math.PI)) * 1.08, zN = body(a.Dts).z, wC = sil.collar.w, st = sil.collar.type === 'stojka';
        const cpt = (phi, v) => {
          const y0 = neckY(phi);
          if (st) { const q = sect(y0, phi), k = 0.55 * v; return [q[0] + (nrr * Math.cos(phi) - q[0]) * k, y0 + v * wC, q[2] + (zN + nrr * Math.sin(phi) - q[2]) * k]; }
          const tpr = sil.collar.type === 'szal' ? Math.max(0, Math.min(1, 0.15 + (1.3 * (y0 - yCf)) / Math.max(1, yNP - yCf))) : 1; // szalowy zwęża się ku dołowi
          const q = sect(y0 - v * wC * tpr * (1 - 0.35 * Math.abs(Math.cos(phi))), phi), l = Math.hypot(q[0], q[2] - zN) || 1;
          return [q[0] * (1 + 0.4 / l), q[1] + 0.1, zN + (q[2] - zN) * (1 + 0.4 / l)];
        };
        const cm = surface(160, 8, (u, v) => { const phi = u * TAU, q = cpt(phi, v); q.push((!st && Math.abs(phi - Math.PI / 2) < 0.035) || Math.abs(phi - 1.5 * Math.PI) < 0.04 ? 1 : 0, u * uN, (v * wC) / tx.tile); return q; }, gk);
        cm.renderOrder = 2; grp.add(cm);
        const ep = []; for (let i = 0; i <= 160; i++) { const q = cpt((i / 160) * TAU, 1); ep.push(new T3.Vector3(q[0] * 1.004, q[1], q[2] * 1.004)); }
        grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(ep), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })));
      }
      if (sil.wrap) { // linia zakładu: od skrzyżowania na środku przodu do talii po boku
        const yX = Math.min(yNP - 1, -sil.wrap.yCross), pts = [];
        for (let i = 0; i <= 16; i++) { const t = i / 16, y = yX * (1 - t) + 0.3, x = -sil.wrap.ext * t, q = sect(y, Math.acos(Math.max(-0.98, Math.min(0.98, x / fit(y).a)))), l = Math.hypot(q[0], q[2]) || 1; pts.push(new T3.Vector3(q[0] * (1 + 0.3 / l), q[1], q[2] * (1 + 0.3 / l))); }
        grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })));
      }
      if (sil.zp && state.seams && !bez && !topSim) { // zaszewka piersiowa: linia od szczytu biustu do miejsca, z którego wychodzi
        const yb2 = a.Dps - a.Wg, phA = (y, x) => Math.acos(Math.max(-0.98, Math.min(0.98, x / fit(y).a)));
        const tg = sil.zp === 'pacha' ? [yArm + (yTip - yArm) * 0.3, 0.42] : sil.zp === 'ramie' ? [yNP - 1.2, phA(yNP - 1.2, (Xn + a.Sb / 2) / 2)] : sil.zp === 'dekolt' ? [neckY(phA(yb2 + 6, Xn * 0.6)) - 0.2, phA(yb2 + 6, Xn * 0.6)] : [yArm - 5, 0.04];
        const p0 = phA(yb2, a.Rg / 2);
        for (const sx of [1, -1]) { const pts = []; for (let i = 3; i <= 20; i++) { const t = i / 20, y = yb2 + (tg[0] - yb2) * t, ph = p0 + (tg[1] - p0) * t, q = sect(y, sx > 0 ? ph : Math.PI - ph), l = Math.hypot(q[0], q[2]) || 1; pts.push(new T3.Vector3(q[0] * (1 + 0.25 / l), q[1], q[2] * (1 + 0.25 / l))); } grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), new T3.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }))); }
      }
    }
    if (sil.strap) { // ramiączka: wąskie paski od górnej krawędzi nad biustem przez ramię do tyłu albo do szyi
      const yU2 = a.Dts - a.Gp - sil.lowerArm, yFc = a.Dps - a.Wg + Math.max(2, Math.min(12, p.bh || 6)), yB = yU2 - 1.2;
      let yF = yFc - 0.4; if (!(sil.strap || p.bk === 'luk') || p.bk === 'serce') for (let it = 0; it < 3; it++) { const wE = 1 - Math.pow(Math.min(1, (a.Rg / 2) / fit(yF).a), 2.2); yF = Math.max(yU2 + (yFc - yU2) * wE + (p.bk === 'serce' ? wE : 0), Math.min(yU2, yFc - 4.5)) - 0.4; } // początek ramiączka leży na górnej krawędzi
      const ySh = a.Dts - 1.6, x0 = a.Rg / 2, xn = (a.os / (2 * Math.PI)) * 1.02, hal = sil.strap.type === 'szyja';
      const ang = (x, y, front, sx) => { const t = Math.acos(Math.max(-0.98, Math.min(0.98, x / fit(y).a))), f = sx > 0 ? t : Math.PI - t; return front ? f : TAU - f; };
      for (const sx of [1, -1]) addG(surface(2, 48, (u, v) => {
        let y, phi, x = x0;
        if (hal) { y = yF + (a.Dts + 0.3 - yF) * v; x = x0 + (xn - x0) * sstep(v); phi = ang(x, y, true, sx); }
        else if (v < 0.5) { y = yF + (ySh - yF) * (v / 0.5); phi = ang(x, y, true, sx); }
        else { y = ySh + (yB - ySh) * ((v - 0.5) / 0.5); phi = ang(x, y, false, sx); }
        const q = sect(y, phi), q2 = sect(y, phi + 0.03), ex = q2[0] - q[0], ez = q2[2] - q[2], el2 = Math.hypot(ex, ez) || 1, o = (u - 0.5) * Math.max(0.6, sil.strap.w), l = Math.hypot(q[0], q[2]) || 1;
        return [(q[0] + (ex / el2) * o) * (1 + 0.25 / l), q[1], (q[2] + (ez / el2) * o) * (1 + 0.25 / l), 0, u, v * 8];
      }, gm.clone()));
    }
    if (sil.band) { // pasek w talii na sukience: gładki pierścień odrobinę nad powierzchnią
      const hb = sil.band, bm2 = gm.clone(); if (!ps) bm2.color = new T3.Color(state.color).multiplyScalar(0.82);
      const ring = surface(96, 3, (u, v) => { const phi = u * TAU, y = hb / 2 - hb * v, q = sect(Math.max(y, 0.01), phi), l = Math.hypot(q[0], q[2]) || 1; return [q[0] * (1 + 0.45 / l), y, q[2] * (1 + 0.45 / l), 0, u * uN, v]; }, bm2); ring.renderOrder = 2; grp.add(ring);
    }
    if (sil.top === 'waist' && p.pasek > 0) {
      addG(surface(96, 2, (u, v) => { const phi = u * TAU, y = p.pasek * (1 - v), s = fit(Math.min(y, 0)); return [(s.a + 0.25) * Math.cos(phi), y, s.z + (s.b + 0.25) * Math.sin(phi), 0, u * uN, y / tx.tile]; }, gm.clone()));
    }
    // szwy: cienkie paski na powierzchni ubrania, w miejscach wynikających z wykroju
    if (state.seams && sil.seams && !(topSim && !topSim.pinned)) {
      const S = sil.seams, sm2 = new T3.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, side: T3.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const dress = sil.top === 'dress', topSide = dress ? a.Dts - a.Gp - sil.lowerArm - 0.3 : 0, topCb = dress ? (p.gora === 'bez' ? a.Dts - a.Gp - sil.lowerArm - 1.7 : a.Dt - 0.6 - p.nb) : 0, yb0 = body.yb;
      const push = (q) => { const l = Math.hypot(q[0], q[2]) || 1; return [q[0] * (1 + 0.14 / l), q[1], q[2] * (1 + 0.14 / l)]; };
      const vrib = (phiOf, y1) => { const r = surface(1, 70, (u, v) => { const y = y1 + (yBot - y1) * v, rr = Math.max(4, fit(Math.max(y, -m.wb)).a); return push(sect(y, phiOf(y) + (u - 0.5) * (0.34 / rr))); }, sm2); r.renderOrder = 3; grp.add(r); };
      const ring = (y) => { const r = surface(160, 2, (u, v) => push(sect(y + (v - 0.5) * 0.3, u * TAU)), sm2); r.renderOrder = 3; grp.add(r); };
      if (S.corset) for (const uu of S.corset) for (const sx of [1, -1]) { const ph = Math.PI / 2 - sx * uu * Math.PI, T = sil.c.T(uu), B = sil.c.B(uu); const r = surface(1, 30, (u, v) => push(sect(T + (-B - T) * v, ph + (u - 0.5) * 0.035)), sm2); r.renderOrder = 3; grp.add(r); }
      if (S.side) { vrib(() => 0, topSide); vrib(() => Math.PI, topSide); }
      if (S.cb) vrib(() => 1.5 * Math.PI, topCb);
      if (S.cf) vrib(() => 0.5 * Math.PI, 0);
      for (const y of S.rings || []) ring(y);
      if (S.pr) {
        const y1 = yb0 + 8, ang = (x, y, back, sx) => { const s = fit(Math.max(y, -m.wb)), xx = y > yb0 ? x + ((y - yb0) / 8) * (s.a * 0.8 - x) : x, t = Math.acos(Math.max(-0.97, Math.min(0.97, xx / s.a))); const f = sx > 0 ? t : Math.PI - t; return back ? TAU - f : f; };
        for (const sx of [1, -1]) { vrib((y) => ang(S.pr[0], y, false, sx), y1); vrib((y) => ang(S.pr[1], y, true, sx), y1); }
      }
    }
    // zarys biustu: linia biustu, punkty szczytu i warstwice na manekinie
    $('gap').textContent = ''; $('gap').className = 'fitn';
    if (state.bust && (!useFig || sil.top === 'dress')) {
      const dress = sil.top === 'dress', ink = new T3.MeshBasicMaterial({ color: 0x17171c, side: T3.DoubleSide });
      const bodyPt = (y, phi, o) => { const s = body(y), x = (s.a + o) * Math.cos(phi), sn = Math.sin(phi); return [x, y, s.z + (s.b + o) * sn + body.bump(x, y, sn, false)]; };
      const outer = (y, phi) => { if (!dress) return bodyPt(y, phi, 0.15); const q = sect(y, phi), l = Math.hypot(q[0], q[2] - 0.5) || 1; return [q[0] * (1 + 0.2 / l), y, q[2] + (q[2] - 0.5) * (0.2 / l)]; };
      grp.add(surface(160, 2, (u, v) => outer(body.yb + (v - 0.5) * 0.28, u * TAU), ink));
      for (const sx of [-1, 1]) {
        const phi = Math.atan2(1, 0) - sx * Math.asin(Math.min(0.95, (a.Rg / 2) / (dress ? fit(body.yb).a : body(body.yb).a))), q = outer(body.yb, phi);
        const dot = new T3.Mesh(new T3.SphereGeometry(0.55, 14, 10), ink); dot.position.set(q[0], q[1], q[2] + 0.2); grp.add(dot);
      }
      const lm = new T3.LineBasicMaterial({ color: 0x8a8272 });
      for (let yy = body.yb - 6; yy <= body.yb + 10 && !useFig; yy += 2) {
        if (Math.abs(yy - body.yb) < 0.5 && !dress) continue;
        const pts = []; for (let i = 0; i <= 80; i++) { const ph = (i / 80) * Math.PI, q = bodyPt(yy, ph, 0.08); pts.push(new T3.Vector3(q[0], q[1], q[2])); }
        grp.add(new T3.Line(new T3.BufferGeometry().setFromPoints(pts), lm));
      }
      if (dress && !sil.imported) {
        const gpv = sil.neckGap, el = $('gap'), bz = p.gora === 'bez'; el.className = 'fitn' + (gpv < (bz ? 2 : 3) ? ' low' : '');
        el.append(bz ? 'Góra kończy się na środku ' : gpv >= 0 ? 'Dekolt kończy się ' : 'Dekolt schodzi ', Object.assign(document.createElement('b'), { textContent: f1(Math.abs(gpv)) + ' cm' }), gpv >= 0 ? ' nad linią biustu' : ' poniżej linii biustu');
      }
    }
    if (sil.empty) { while (grp.children.length > nBody) { const o = grp.children[grp.children.length - 1]; grp.remove(o); if (o.geometry) o.geometry.dispose(); } $('hemGap').textContent = ''; $('gap').textContent = ''; $('simS').textContent = ''; }
    g3.scene.add(grp); g3.group = grp;
    { // kadr: cała postać albo ubranie w obszarze między etykietami u góry a paskiem suwaków; przelicza się przy każdej zmianie rozmiaru
      const r = g3.canvas.getBoundingClientRect(), hgt = Math.max(200, r.height), asp = Math.max(0.3, r.width / hgt);
      const top = useFig ? a.Dts + headLen + 2 : a.Dts + 6, bot = useFig ? floor - 2 : Math.max(floor, -p.dl - 14);
      let hw = useFig ? 4.97 * fs + 4 : 26; for (let i = 0; i < 16; i++) hw = Math.max(hw, Math.abs(sect(-p.dl, (i / 16) * TAU)[0]) + 3);
      const padT = Math.min(0.2, 100 / hgt), padB = Math.min(0.4, 24 / hgt), avail = 1 - padT - padB;
      const V = Math.max(((top - bot) * 1.06) / avail, (2 * hw * 1.1) / asp), fd = V / (2 * Math.tan((16 * Math.PI) / 180));
      const key = [state.style, p.dl, p.kn, state.figure, H, Math.round(hw), Math.round(hgt), Math.round(r.width)].join('|');
      if (refit || g3.frameKey !== key) {
        const z = refit || !g3.frameKey ? 1 : Math.max(0.2, Math.min(8, fitDist / cam.dist));
        g3.frameKey = key; fitDist = fd; cam.dist = fd / z; g3.mid = (top + bot) / 2 + (padT + avail / 2 - 0.5) * V;
      }
    }
    paint3d(); showZoom();
  }

