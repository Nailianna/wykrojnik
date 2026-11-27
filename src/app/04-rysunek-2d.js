  // ---------- rysunek 2D ----------
  // wykrój wczytany z PDF: gotowe elementy jednego rozmiaru zamiast konstrukcji z wymiarów
  function impDraft(imp, m) {
    const adjK = JSON.stringify((imp && imp.adj) || {}) + [m.og, m.ot, m.ob, m.wzrost].join(','), planAx = impAxes(imp, m); if (!impAdjC || impAdjC.imp !== imp || impAdjC.k !== adjK) impAdjC = { imp, k: adjK, r: impAdj(imp, planAx) };
    const pcs = impAdjC.r.pieces, an = imp.an || null, sa = an && an.sa, bd = an && an.body;
    // opisy cięcia, zapas i wymiary ciała dla rozmiaru pochodzą z analizy arkusza
    const fit = bd && bd.b ? ' Rozmiar ' + bd.n + ' jest szyty na biust ' + f1(bd.b) + (bd.t ? ', talię ' + f1(bd.t) : '') + (bd.h ? ', biodra ' + f1(bd.h) : '') + ' cm; modelka ma ' + [m.og, m.ot, m.ob].map((v) => f1(v)).join(' / ') + '.' : '';
    const saT = !sa ? 'Linie i zapasy na szwy są takie jak w oryginale, Wykrojnik ich nie przelicza.' : (sa.inc ? 'Zapas na szwy jest wliczony w linie' + (sa.cm !== null ? ': ' + f1(sa.cm) + ' cm' : ', ale arkusz nie podaje, ile wynosi') : 'Linie nie zawierają zapasu na szwy' + (sa.cm !== null ? ', dodaj ' + f1(sa.cm) + ' cm' : '')) + (sa.ex && sa.ex.length ? ' (' + sa.ex.map((w) => w.gdzie + ': ' + f1(w.cm) + ' cm').join(', ') + ')' : '') + '.' + (an.skos ? ' Wykrój jest cięty ze skosu.' : '');
    // zszyte elementy do podglądu 3D: liczone raz na wykrój i modelkę
    const sk = adjK + (imp.size || '') + '|' + pcs.length + '|' + (pcs[0] ? pcs[0].name + pcs[0].w : '') + '|' + [m.og, m.ot, m.ob, m.wzrost].join(',');
    if (!impSewC || impSewC.k !== sk || impSewC.imp !== imp) { let sw; if (planAx) sw = { err: 'plan' }; else try { sw = impSew(Object.assign({}, imp, { pieces: pcs }), m); } catch (e) { sw = { err: 'Nie umiem jeszcze zszyć tego fasonu.' }; }
      if ((sw.err || (TEST && window['__forcePlan'])) && an && an.szwy && an.szwy.length) { // kształt nie pasuje do znanych krojów: szyję według szwów wskazanych przez analizę
        let pl = null; try { pl = impPlan(imp, m, impAdjC.r.fn); } catch (e) { pl = null; }
        if (pl && !pl.err) sw = { plan: pl.plan, used: pl.used, pieces: [], dl: pl.dl, hemC: pl.hemC, sleeve: null, gather: null, skip: pl.skip, strap: pl.strap ? { F: true, B: true, yMax: pl.plan.yMax } : null, byPlan: true };
        else if (pl && pl.err) sw = { err: (sw.err === 'plan' ? '' : sw.err + ' ') + pl.err }; else if (sw.err === 'plan') sw = { err: 'Po tej zmianie nie umiem zszyć wykroju według szwów z analizy.' };
      } impSewC = { k: sk, imp, sw }; }
    const sw = impSewC.sw; let ap = null; if (sw.err) { try { ap = impApprox(imp, m, pcs); } catch (e) { ap = null; } } // elementów nie da się zszyć: podgląd pokaże przybliżoną bryłę zamiast odmowy
    const sew3 = ap ? ' Elementów nie udało się zszyć, więc podgląd 3D pokazuje przybliżoną bryłę: długość od talii ' + ap.dl + ' cm, obwód dołu ' + ap.hemC + ' cm.' : !sw.err ? (sw.byPlan ? ' Podgląd 3D jest zszyty według szwów z analizy' + (sw.strap ? ', na ramiączkach' : '') : ' Podgląd 3D pokazuje przód' + (sw.strap ? (sw.strap.F && sw.strap.B ? ' i tył na ramiączkach' : ' i tył z górną krawędzią przytrzymaną na miejscu') : ', tył') + (sw.kim ? ' razem z rękawami' : sw.sleeve ? ' i rękawy' + (sw.gather ? ' zmarszczone do długości mankietu' : '') : '') + '') + (sw.used && sw.used.length ? '. Zszyte elementy: ' + sw.used.map((x) => x.toLowerCase()).join(', ') : '') + (sw.skip.length ? '; bez elementów: ' + sw.skip.join(', ').toLowerCase() : '') + '.' : '';
    return { pieces: pcs, sewn: sw.err ? null : { pieces: sw.pieces, plan: sw.plan || null }, sewErr: sw.err || '', info: { rows: [], darts: [], cut: pcs.map((q) => [q.name, q.cut ? q.cut.replace(/^wytnij /, '') : 'według oryginału']), warn: 'Wykrój wczytany z pliku, rozmiar ' + (imp.size || 'jedyny') + '. ' + saT + fit + sew3 },
      approx: !!ap, sil: ap ? ap.sil : sw.err ? { top: 'import', lower: 'none', hemC: 0, a: W.full(m), neckGap: 99, lowerArm: 0 } : { top: 'dress', lower: 'straight', imported: true, impDl: sw.dl, frac: 0, hemC: sw.hemC, a: W.full(m), neckGap: 99, lowerArm: 0, sleeve: sw.sleeve, kim: sw.kim || null, strap: sw.strap || null, gather: sw.gather, seams: { side: true } }, title: (imp.name || 'Wykrój z pliku') + (imp.size ? ' · ' + imp.size : ''), notions: an && an.pasm ? an.pasm.map((x) => [x, '']) : [], bases: {}, imported: true };
  }
  // nowy projekt zaczyna od pustego manekina: fason wybiera się dopiero w panelu
  function emptyDraft(m) { return { pieces: [], info: { rows: [], darts: [], cut: [], warn: '' }, sil: { top: 'waist', lower: 'none', empty: true, hemC: 0, a: W.full(m), neckGap: 99, lowerArm: 0 }, title: 'bez fasonu', notions: [], bases: {}, empty: true }; }
  let impSewC = null, impAdjC = null, impAxC = null;
  // czy ubranie jest szyte według planu z analizy (kroju nie da się rozpoznać z kształtu) i które elementy zmieniają wtedy długość; liczone na oryginalnych elementach, raz na wykrój i modelkę
  function impAxes(imp, m) {
    const k = [m.og, m.ot, m.ob, m.wzrost].join(','); if (impAxC && impAxC.pcs === imp.pieces && impAxC.an === imp.an && impAxC.k === k) return impAxC.ax;
    let ax = null; if (imp.an && imp.an.szwy && imp.an.szwy.length) { let g; try { g = TEST && window['__forcePlan'] ? { err: 1 } : impSew(Object.assign({}, imp, { adj: null }), m); } catch (e) { g = { err: 1 }; } if (g.err) { let pl = null; try { pl = impPlan(Object.assign({}, imp, { adj: null }), m); } catch (e) { pl = null; } if (pl && !pl.err && pl.lenAx.length) ax = pl.lenAx; } }
    impAxC = { pcs: imp.pieces, an: imp.an, k, ax }; return ax;
  }
  const impCache = {}; // pełne dane ostatnio wczytanych plików (wszystkie rozmiary), tylko na czas sesji
  async function impLoad(file) {
    if (!file) return; const bz = busyOn('Czytam wykrój z pliku.'); await paintTick();
    try {
      await new Promise((r) => { if (window.PatImport) r(undefined); else { const sc = document.createElement('script'); sc.src = 'importer.js'; sc.onload = r; sc.onerror = r; document.head.appendChild(sc); } });
      if (!window.PatImport) throw new Error('Nie udało się wczytać modułu importu.');
      const data = await window.PatImport.load(file), size = data.sizes[Math.floor(data.sizes.length / 2)] || '', pieces = window.PatImport.pick(data, size);
      if (!pieces.length) throw new Error('Nie znalazłam w tym pliku elementów wykroju.');
      const sn = snap(); sn.style = 'import'; sn.imp = { name: data.name, sizes: data.sizes, size, pieces }; sn.sel = {}; sn.layers = [{ role: 'wierzch' }];
      addProj(data.name, sn); impCache[state.proj] = data; impFill(); if (state.view !== '2d') setView('2d'); goPanel('fason');
      say('Wczytałam ' + pieces.length + ' elementów' + (data.sizes.length ? ' w rozmiarze ' + size + '. Rozmiar zmienisz w panelu Fason.' : '.'));
    } catch (e) { say(e && e.message ? e.message : 'Nie udało się wczytać tego pliku.', true); } finally { busyOff(bz); }
  }
  function impFill() {
    const on = state.style === 'import' && !!state.imp, box = $('impBox'); box.hidden = !on; if (!on) $('dopImp').hidden = true; $('fTab').hidden = on; document.querySelectorAll('[data-ft]').forEach((el) => { if (on) el.hidden = true; }); if (on) $('fOpts').hidden = true; if (!on) return;
    const sel = $('impSize'); sel.textContent = ''; for (const z of state.imp.sizes || []) { const o = document.createElement('option'); o.value = z; o.textContent = z; sel.appendChild(o); } sel.value = state.imp.size || ''; sel.disabled = !(state.imp.sizes || []).length; $('impSizeRow').hidden = sel.disabled;
    { const uw = (state.imp.an && state.imp.an.uw) || [], nb = $('impNotesB'); $('impNotes').hidden = !uw.length; nb.textContent = ''; for (const [k, title] of [['spr', 'Do sprawdzenia'], ['zapas', 'Zapasy na szwy'], ['druk', 'Druk'], ['material', 'Materiał']]) { const it = uw.filter((u) => u.k === k); if (!it.length) continue; const b = document.createElement('b'); b.textContent = title; nb.appendChild(b); it.forEach((u) => { const p = document.createElement('p'); p.textContent = u.t + (u.s ? ' (' + u.s + ')' : ''); nb.appendChild(p); }); } }
    { // długość: suwaki działają, gdy wiem, który element jest przodem, tyłem i rękawem
      const r = impAdj(state.imp, impAxes(state.imp, cur())), adj = state.imp.adj || {}, set = (id, o, v) => { for (const e of [$('i_' + id), $('is_' + id)]) { e.min = o ? o.min : 0; if (document.activeElement !== e) e.value = o ? o.d : 0; } };
      $('dopImp').hidden = false; $('impLbT').textContent = r.body && r.body.plan ? 'Dół dłuższy o' : 'Przód i tył dłuższe o'; $('impLenBox').hidden = !r.body && !r.sleeve; $('i_lb').closest('label').hidden = !r.body; $('impLsRow').hidden = !r.sleeve; set('lb', r.body, adj.b); set('ls', r.sleeve, adj.s);
      $('impLenN').textContent = !r.body && !r.sleeve ? (state.imp.an ? 'W tym wykroju nie umiem wskazać przodu, tyłu ani rękawa, więc długości tu nie zmienisz.' : 'Długość zmienisz po analizie wykroju, bo muszę wiedzieć, który element jest przodem, tyłem i rękawem.')
        : r.body && r.body.plan ? 'Wydłużam i skracam elementy sięgające dołu, w połowie ich długości, więc dół i jego szerokość zostają jak w oryginale. Elementy doszyte luzem popraw ręcznie.' : (r.body && r.body.loose ? 'W tym fasonie nie ma pachy, więc wydłużam i skracam w dolnej połowie elementu. Sprawdź na rysunku, czy zmienił się właściwy koniec.' : 'Wydłużam i skracam pod pachą, więc dół i jego szerokość zostają jak w oryginale.') + (!r.body ? ' Przodu i tyłu nie rozpoznałam, zmienisz tylko rękaw.' : '') + ' Podszewkę i odszycia popraw ręcznie.';
    }
    $('impNote').textContent = sel.disabled ? 'Ten plik zawiera jeden rozmiar.' : impCache[state.proj] ? '' : 'Żeby zmienić rozmiar, wczytaj plik jeszcze raz. Zapisuję tylko wybrany rozmiar.';
  }
  let model = null, vb = null, rafD = 0;
  function drawSoon() { if (rafD) return; rafD = requestAnimationFrame(() => { rafD = 0; draw(); }); }
  function compute() {
    if (!Array.isArray(state.layers) || !state.layers.length || state.layers[0].role !== 'wierzch') state.layers = [{ role: 'wierzch' }];
    const lys = state.layers.map((L) => (L.role === 'wierzch' ? { role: 'wierzch', fabric: state.fabric } : Object.assign({}, L)));
    const d = state.style === 'pusty' ? emptyDraft(cur()) : state.style === 'import' ? impDraft(state.imp, cur()) : W.draft(cur(), Object.assign({}, state.p, { layers: lys, fabName: (id) => (FAB[id] ? FAB[id].name.toLowerCase() : id) }), state.style);
    const pick = d.pieces.filter((pc) => !state.sel[pc.id]), use = pick.length ? pick : d.pieces;
    const lay = state.pack && state.paper !== 'one' ? W.pack(use, 2, state.paper) : W.layout(use, 2), tl = W.tiles(lay, state.paper);
    return { d, lay, tl, use };
  }
  function fitView() {
    const r = $('cv').getBoundingClientRect(), pad = 3, T = model.tl, ins = insets();
    const ew = state.tiles ? Math.max(model.lay.w, T.cols * T.tw) : model.lay.w, eh = state.tiles ? Math.max(model.lay.h, T.rows * T.th) : model.lay.h;
    const w = ew + 2 * pad, h = eh + 2 * pad, avW = Math.max(120, r.width - ins.l - ins.r), avH = Math.max(120, r.height - 24);
    const sc = Math.min(avW / w, avH / h);
    fitScale = sc;
    vb = { x: -pad - (ins.l + (avW - w * sc) / 2) / sc, y: -pad - (12 + (avH - h * sc) / 2) / sc, w: r.width / sc, h: r.height / sc };
  }
  let fitScale = 1, fitDist = 230;
  function insets() {
    const wide = $('stage').getBoundingClientRect().width > 760;
    return { l: state.panel && wide ? 348 : 12, r: state.card && wide && state.style !== 'pusty' ? 300 : 12 };
  }
  function showZoom() {
    let z = 1;
    if (state.view === '3d') z = fitDist / cam.dist; else if (vb) z = $('cv').getBoundingClientRect().width / vb.w / fitScale;
    $('zoom').value = Math.round(Math.log2(z) * 100); $('zoomV').textContent = Math.round(z * 100) + '%';
  }
  function applyVb() { $('cv').setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].join(' ')); showZoom(); }
  function draw(refit) {
    try { model = compute(); } catch (e) { say('Z tych wymiarów nie da się zbudować wykroju. Sprawdź wpisane wartości.'); return; }
    const { d, lay, tl } = model;
    $('emptyN').hidden = !d.empty || !$('home').hidden || !!state.ref; cardUi();
    if (state.view === '3d' && d.imported && !d.sewn && !d.approx) { say(d.sewErr || 'Tego wykroju nie umiem pokazać w 3D.', true); setView('2d'); return; } // po zmianie ustawień wykrój przestał się zszywać: zamiast przypadkowej bryły wraca rysunek
    { const mb = $('miniS').closest('.float') || $('miniS').parentElement; if (mb) mb.style.display = d.empty ? 'none' : ''; }
    $('sub').textContent = (projCur().name || 'Bez nazwy') + ' · ' + d.title + ' · ' + (cur().name || 'Bez imienia');
    if (state.view === '3d') {
      $('miniS').innerHTML = `<svg viewBox="0 0 ${lay.w} ${lay.h}" aria-hidden="true">` + lay.prims.filter((q) => q.t === 'poly' && q.s === 'cut').map((q) => `<path d="M${q.pts.map((a) => a[0].toFixed(1) + ' ' + a[1].toFixed(1)).join('L')}Z"/>`).join('') + '</svg>';
      render3d(refit);
    }
    else {
      if (!vb || refit) fitView();
      let s = '';
      if (state.tiles) for (const t of tl.pages) s += `<rect class="sheet" x="${t.x}" y="${t.y}" width="${tl.tw}" height="${tl.th}"/>`;
      for (const q of lay.prims) {
        if (q.t === 'poly') {
          if (q.s === 'grid' && !state.grid) continue;
          s += `<path class="${q.s}" d="M${q.pts.map((a) => a[0].toFixed(3) + ' ' + a[1].toFixed(3)).join('L')}${q.closed ? 'Z' : ''}"/>`;
        } else if (!q.lab || state.labels) {
          s += `<text ${q.lab ? 'class="lb" ' : ''}x="${q.x}" y="${q.y}" font-size="${q.size === 'L' ? 1.5 : 0.75}" ${q.size === 'L' ? 'font-weight="600"' : ''} text-anchor="${q.anchor || 'start'}"${q.rot ? ` transform="rotate(${q.rot} ${q.x} ${q.y})"` : ''}>${esc(q.text)}</text>`;
        }
      }
      if (state.tiles) for (const t of tl.pages) s += `<path class="tile" d="M${t.x} ${t.y}h${tl.tw}v${tl.th}h${-tl.tw}Z"/><text class="tl" x="${t.x + 0.6}" y="${t.y + 1.7}" font-size="1.2">${t.label}</text>`;
      $('cv').innerHTML = s; applyVb();
    }
    const dl = (id, rows) => {
      const el = $(id); el.textContent = '';
      for (const r of rows) {
        const a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = r[0]; b.textContent = r[1];
        if (r[2] === true) b.className = 'ok'; else if (r[2]) { const sm = document.createElement('small'); sm.textContent = r[2]; b.appendChild(sm); }
        el.append(a, b);
      }
    };
    const i = d.info;
    const chk = i.rows.filter((r) => r[2] != null), rest = i.rows.filter((r) => r[2] == null), bad = chk.filter((r) => Math.abs(r[1] - r[2]) >= 0.15).length;
    dl('info', chk.map((r) => [r[0], f1(r[1]) + ' cm', Math.abs(r[1] - r[2]) < 0.15 ? true : (/Szew/.test(r[0]) ? 'druga strona: ' : 'modelka + luz: ') + f1(r[2])]));
    $('verdict').textContent = bad ? (bad === 1 ? 'Jeden wymiar odbiega od modelki.' : 'Wymiary odbiegające od modelki: ' + bad + '.') : d.empty ? 'Wybierz fason, a pokażę wykrój i sprawdzę wymiary.' : d.imported ? 'Wykrój z pliku. Dopasowania do modelki jeszcze nie sprawdzam.' : 'Wykrój zgadza się z wymiarami modelki.'; $('verdict').classList.toggle('bad', !!bad);
    dl('info2', rest.map((r) => [r[0], f1(r[1]) + ' cm'])); $('moreBox').hidden = !rest.length;
    $('warn').textContent = i.warn;
    $('dartsH').hidden = !i.darts.length; dl('darts', i.darts);
    dl('cutlist', i.cut);
    renderLayers(d); renderPrint(model); renderExtras(d);
    const pg = tl.single ? 'Jedna strona ' + Math.ceil(tl.tw + 2) + ' × ' + Math.ceil(tl.th + 2) + ' cm' : (tl.pages.length + 1) + ' stron ' + tl.fmt.toUpperCase() + ', ' + (tl.landscape ? 'poziomo' : 'pionowo');
    $('pagesN').textContent = pg + (tl.single ? '. Do plotera albo projektora.' : ', razem ze stroną tytułową.');
  }

