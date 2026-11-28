  // ---------- projekty ----------
  function fillProj() {
    const box = $('prList'); box.textContent = '';
    const shown = state.projects.filter((x) => !x.tmp); $('prNone').hidden = shown.length > 0; $('prEdit').hidden = !shown.length || !!projCur().tmp;
    shown.slice().reverse().forEach((pr) => {
      const b = document.createElement('button'), a = document.createElement('b'), sm = document.createElement('small'); b.className = 'pj';
      const st = W.STYLES.find((x) => x.id === pr.snap.style), mo = state.profiles.find((x) => x.id === pr.snap.active);
      a.textContent = pr.name || 'Bez nazwy'; sm.textContent = (st ? GRP[st.group] + st.name.toLowerCase().replace(/ \(.*\)/, '') : '') + (mo ? ' · ' + (mo.name || 'Bez imienia') : '');
      b.append(a, sm); b.setAttribute('aria-pressed', pr.id === state.proj);
      b.addEventListener('click', () => { if (pr.id !== state.proj) openProj(pr.id); });
      box.appendChild(b);
    });
    if (document.activeElement !== $('prName')) $('prName').value = projCur().name;
  }
  function loadSnap(sn) {
    const o = JSON.parse(JSON.stringify(sn)); o.p = Object.assign({}, DEF_P, o.p); if (!o.ref) o.ref = null;
    Object.assign(state, o);
    if (state.style !== 'pusty' && !(state.style === 'import' && state.imp && state.imp.pieces) && !W.STYLES.some((x) => x.id === state.style)) state.style = 'sk_prosta';
    if (!state.profiles.some((x) => x.id === state.active)) state.active = state.profiles[0].id;
    if (!state.sel || typeof state.sel !== 'object') state.sel = {};
    loadPrintImg();
  }
  function openProj(id) {
    persist(true); state.proj = id; loadSnap(projCur().snap); histReset();
    fillForm(); persist(true); draw(true);
  }
  function addProj(name, sn) {
    persist(true); state.projects = state.projects.filter((x) => !x.tmp); const id = 'j' + Date.now(); state.projects.push({ id, name, updated: Date.now(), snap: sn }); state.proj = id; loadSnap(sn); histReset();
    fillForm(); persist(true); draw(true); $('prName').focus(); $('prName').select();
  }
  // import wykrojów: pracownia Przymiarka otwierana w oknie aplikacji, z wymiarami bieżącej modelki
  function przOpen() {
    const box = $('przBox'), fr = $('przF'); box.hidden = false;
    const fill = () => { try { const d = fr.contentDocument, m = cur(); const st = d.getElementById('pdfStudio'); if (st) { st.open = true; st.scrollIntoView(); } for (const [k, v] of /** @type {any[][]} */ ([['height', m.wzrost], ['bust', m.og], ['waist', m.ot], ['hips', m.ob]])) { const e = d.getElementById('dst_' + k); if (e && isFinite(v)) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } } } catch (e) { /* inna domena albo strona jeszcze się ładuje */ } };
    if (!fr.getAttribute('src')) { const bz = busyOn('Otwieram Przymiarkę.'); fr.addEventListener('load', () => { busyOff(bz); setTimeout(fill, 300); }, { once: true }); fr.setAttribute('src', 'przymiarka.html'); } else fill();
  }
  $('przX').addEventListener('click', () => { $('przBox').hidden = true; });
  $('impSize').addEventListener('change', () => { const data = impCache[state.proj]; if (!data) { impFill(); say('Wczytaj plik jeszcze raz, żeby zmienić rozmiar.'); return; } { const an = state.imp.an, z = $('impSize').value, rz = an && (an.rozm || []).find((x) => x.w === z); state.imp = Object.assign({}, state.imp, { size: z, pieces: anApply(window.PatImport.pick(data, z), an) }, an ? { an: Object.assign({}, an, { body: rz ? { n: rz.n, b: rz.b, t: rz.t, h: rz.h } : null }) } : {}); } state.sel = {}; persist(); draw(true); });
  function newProj() { const sn = snap(); sn.style = 'pusty'; sn.imp = null; sn.ref = null; sn.p = JSON.parse(JSON.stringify(DEF_P)); sn.layers = [{ role: 'wierzch' }]; sn.sel = {}; addProj('Nowy projekt', sn); }
  for (const [id, k] of [['lb', 'b'], ['ls', 's']]) for (const e of [$('i_' + id), $('is_' + id)]) e.addEventListener('input', () => {
    const v = parseFloat(String(e.value).replace(',', '.')); if (!isFinite(v) || !state.imp) return;
    state.imp = Object.assign({}, state.imp, { adj: Object.assign({}, state.imp.adj, { [k]: Math.max(+e.min, Math.min(+e.max, v)) }) });
    const o = e === $('i_' + id) ? $('is_' + id) : $('i_' + id); o.value = String(state.imp.adj[k]); persist(); drawSoon();
  });
  $('prDup').addEventListener('click', () => addProj((projCur().name || 'Projekt') + ' (kopia)', snap()));
  $('prName').addEventListener('input', () => { projCur().name = $('prName').value; persist(true); fillProj(); draw(); });
  $('undo').addEventListener('click', () => histGo(-1)); $('redo').addEventListener('click', () => histGo(1));
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    const t = e.target; if (t && t.tagName === 'INPUT' && (t.type === 'text' || t.type === '') ) return;
    e.preventDefault(); if (t && t.blur && t.tagName === 'INPUT') t.blur(); histGo(e.shiftKey ? 1 : -1);
  });
  // podpowiedzi, jak zdjąć wymiar: pokazują się przy polu, w którym stoi kursor
  const HINT = {
    braB: 'Rozmiar ustawia obwód pod biustem i obwód biustu na typowe wartości. Zmierzone wymiary wpisz w polach obok, są dokładniejsze.', braC: 'Rozmiar ustawia obwód pod biustem i obwód biustu na typowe wartości. Zmierzone wymiary wpisz w polach obok, są dokładniejsze.', m_og: 'Biust mierz poziomo przez najwyższe punkty, w biustonoszu, który będzie pod ubraniem.', m_opx: 'Pod biustem mierz ciasno i poziomo, tuż pod piersiami.',
    m_ot: 'Talię mierz w najwęższym miejscu tułowia. Zawiąż tam tasiemkę, od niej mierzysz wszystkie długości.', m_ob: 'Biodra mierz poziomo w najszerszym miejscu pośladków.',
    m_wb: 'Wysokość bioder mierz po boku, od tasiemki w talii do poziomu, na którym mierzyłaś biodra.', m_wzrost: 'Wzrost bez butów.',
    a_os: 'Szyję mierz u podstawy, tam gdzie leży łańcuszek.', a_Dt: 'Od wystającego kręgu na karku prosto w dół do tasiemki w talii.', a_Dts: 'Od ramienia przy samej szyi, przez łopatkę, pionowo do tasiemki w talii.',
    a_Dps: 'Od ramienia przy samej szyi, przez szczyt biustu, pionowo do tasiemki w talii.', a_Wg: 'Od ramienia przy samej szyi do szczytu biustu.', a_Rg: 'Odległość między szczytami biustu.',
    a_Gp: 'Od kręgu na karku pionowo w dół do poziomu pach. Najłatwiej włożyć pod pachy linijkę i mierzyć do niej.', a_Sb: 'Przez plecy, od końca jednego ramienia do końca drugiego.',
    a_St: 'Na plecach między pachami, mniej więcej w połowie wysokości pachy.', a_Sp: 'Z przodu między pachami, nad biustem.',
  };
  document.querySelector('[data-sec="modelka"]').addEventListener('focusin', (e) => { $('hint').textContent = HINT[e.target.id] || ''; });
  function rekDef(r) { const armL = 0.345 * (cur().wzrost || 168); return Math.round((r === 'krotki' ? 22 : r === '34' ? armL * 0.75 : armL) * 2) / 2; }
  function dlMin() { const s = state.style; return s.indexOf('to_') === 0 && s !== 'to_stanik' ? -10 : s === 'su_rybka' || s === 'su_rybka_kliny' ? 50 : 25; }
  function bindNum(el, obj, k) {
    el.addEventListener('input', () => {
      const v = parseFloat(el.value.replace(',', '.'));
      if (!isFinite(v) || !el.checkValidity()) return;
      obj()[k] = v; persist(); fillAdv(); syncSl(k); draw(); clearTimeout(galT); galT = setTimeout(fillGallery, 500);
    });
    el.addEventListener('change', () => { const v = parseFloat(el.value.replace(',', '.')); if (!isFinite(v) || !el.checkValidity()) el.value = obj()[k]; });
  }
  MF.forEach((k) => bindNum($('m_' + k), cur, k));
  $('p_bok').addEventListener('input', () => { if (state.p.bok > 0 && state.p.rek && state.p.rek !== 'brak') { state.p.rek = 'brak'; state.p.falR = false; fillForm(); persist(); draw(true); } });
  $('m_opx').addEventListener('input', () => { const i = $('m_opx'), v = parseFloat(i.value); if (i.value === '') delete cur().opx; else if (isFinite(v) && i.checkValidity()) cur().opx = v; else return; persist(); draw(); });
  PF.forEach((k) => bindNum($('p_' + k), () => state.p, k));
  $('m_name').addEventListener('input', () => { cur().name = $('m_name').value; $('prof').selectedOptions[0].textContent = cur().name || 'Bez imienia'; persist(); draw(); });
  $('prof').addEventListener('change', () => { state.active = $('prof').value; fillForm(); persist(); draw(true); });
  const TINTS = ['#f7e3ee', '#e6ebfb', '#e9f4e1', '#fbefd9', '#efe6fa'];
  let galT = 0;
  function fillGallery() {
    const boxes = { 'Spódnice': $('galSk'), 'Sukienki': $('galSu'), 'Gorsety': $('galGo'), 'Topy': $('galGo') };
    for (const k in boxes) boxes[k].textContent = '';
    W.STYLES.forEach((st, i) => {
      if (st.id === 'su_kolo' || st.id === 'su_2kola' || st.id === 'su_zakl') return; // jedna kafelka „Odcinana w talii”, rodzaj koła wybiera się niżej
      const odc = st.id === 'su_polkole', b = document.createElement('button'); b.setAttribute('aria-pressed', odc ? ODC.includes(state.style) : st.id === state.style);
      let svg = '';
      try {
        const d = W.draft(cur(), Object.assign({}, state.p, { flare: st.flare || 0, dl: st.dl ? 95 : 58, kn: 55, gf: 9, fac: 'brak', kol: 'brak', layers: null, extras: [] }, st.preset ? Object.assign({ dl: st.dl || 58 }, st.preset) : { bok: 0 }), st.id), lay = W.layout(d.pieces, 3);
        svg = `<svg viewBox="0 0 ${lay.w} ${lay.h}" aria-hidden="true">` + lay.prims.filter((q) => q.t === 'poly' && q.s === 'cut').map((q) => `<path d="M${q.pts.map((a) => a[0].toFixed(1) + ' ' + a[1].toFixed(1)).join('L')}Z"/>`).join('') + '</svg>';
      } catch (e) {}
      const th = document.createElement('span'); th.className = 'th'; th.style.setProperty('--tint', TINTS[i % TINTS.length]); th.innerHTML = svg;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = odc ? 'Odcinana w talii' : st.group === 'Gorsety' ? 'Gorset ' + st.name.toLowerCase() : st.id === 'to_stanik' ? 'Top do talii' : st.group === 'Topy' ? 'Top: ' + st.name.toLowerCase() : st.name;
      b.append(th, nm);
      b.addEventListener('click', () => { if (!(odc && ODC.includes(state.style))) pickStyle(st); });
      boxes[st.group].appendChild(b);
    });
  }
  function pickStyle(st) { if (state.ref) { say('Ten projekt pokazuje gotowy model 3D. Fason wybierzesz w nowym projekcie.'); return; } if (state.style === 'import' && state.imp && state.imp.lib) state.imp = null; if (st.id !== state.style) state.sel = {}; state.fTab = tabOf(st.id); if (st.preset) { Object.assign(state.p, st.preset); if (st.preset.rek) state.p.rekL = ['krotki', '34', 'dlugi'].includes(st.preset.rek) ? rekDef(st.preset.rek) : 0; if (st.id.indexOf('to_tshirt') === 0) state.fabric = 'dzersej'; } else state.p.bok = 0; if (st.id.indexOf('to_tshirt') !== 0 && state.style.indexOf('to_tshirt') === 0 && state.fabric === 'dzersej') state.fabric = 'bawelna'; const was = W.STYLES.find((s) => s.id === state.style); state.style = st.id; state.p.flare = st.flare || 0; state.p.dol = ''; if (st.dl) state.p.dl = st.dl; else if (was && was.dl && state.p.dl === was.dl) state.p.dl = 58; fillForm(); persist(); draw(true); }
  $('addP').addEventListener('click', () => {
    const c = cur(), id = 'p' + Date.now();
    state.profiles.push({ id, name: 'Nowa modelka', og: c.og, ot: c.ot, ob: c.ob, wb: c.wb, wzrost: c.wzrost, adv: {} }); say('Dodałam własną modelkę z wymiarami „' + (c.name || 'bez imienia') + '”. Wpisz jej imię i popraw wymiary.');
    state.active = id; fillForm(); persist(); draw(); $('m_name').focus(); $('m_name').select();
  });
  $('delP').addEventListener('click', () => {
    const b = $('delP');
    // modelka, z której korzystają inne projekty, zostaje: po jej usunięciu dostałyby cudze miary
    const gone = cur(), used = state.projects.filter((q) => q.id !== state.proj && q.snap && q.snap.active === gone.id).map((q) => q.name);
    if (used.length) { say('Z modelki „' + (gone.name || 'bez imienia') + '” korzystają też projekty: ' + used.join(', ') + '. Najpierw wybierz w nich inną modelkę albo je usuń.', true); return; }
    if (b.textContent === 'Usuń') { b.textContent = 'Na pewno?'; setTimeout(() => (b.textContent = 'Usuń'), 3000); return; }
    if (gone.std) return; state.profiles = state.profiles.filter((x) => x.id !== gone.id); state.active = (state.profiles.find((x) => !x.std) || state.profiles.find((x) => x.id === 'std38')).id;
    fillForm(); persist(); draw(true); say('Usunęłam modelkę „' + (gone.name || 'bez imienia') + '”. Ten projekt liczę teraz na wymiary modelki „' + (cur().name || 'bez imienia') + '”.', true);
  });
  function toggle(id, k) { $(id).addEventListener('click', () => { state[k] = !state[k]; $(id).setAttribute('aria-pressed', state[k]); persist(); draw(true); }); $(id).setAttribute('aria-pressed', state[k]); }
  toggle('tGrid', 'grid'); toggle('tTiles', 'tiles'); toggle('tLab', 'labels'); toggle('tBust', 'bust'); toggle('tSeams', 'seams'); toggle('tSim', 'sim'); const figLab = () => { $('tFig').textContent = state.figure ? 'Pokaż manekin' : 'Pokaż sylwetkę'; $('tFig').setAttribute('aria-pressed', 'false'); }; $('tFig').addEventListener('click', () => { state.figure = !state.figure; figLab(); persist(); draw(true); }); figLab();
  $('fabQ').addEventListener('change', () => { state.fabric = $('fabQ').value; persist(); fillFabricPanel(); draw(true); }); $('colQ').addEventListener('input', () => { $('colA').value = $('colQ').value; $('colA').dispatchEvent(new Event('input', { bubbles: true })); });
  function setView(v) {
    if (v === '3d' && state.style === 'import') {
      const d = model && model.d; // wczytany wykrój ma podgląd tylko jako zszyta tkanina na sylwetce
      if (!d || (!d.sewn && !d.approx)) { say((d && d.sewErr) || 'Tego wykroju nie umiem jeszcze pokazać w 3D.', true); v = '2d'; }
      else if (!state.figure) { state.figure = true; say('Włączyłam sylwetkę, bo wczytany wykrój układa się tylko na niej.'); }
    }
    state.view = v;
    $('v2d').setAttribute('aria-pressed', v === '2d'); $('v3d').setAttribute('aria-pressed', v === '3d');
    $('cv').toggleAttribute('hidden', v !== '2d'); $('gl').toggleAttribute('hidden', v !== '3d');
    document.querySelectorAll('[data-v]').forEach((el) => (el.hidden = el.dataset.v !== v));
    layoutUi(); persist(); draw(true); blTouch();
  }
  $('v2d').addEventListener('click', () => setView('2d'));
  $('mini').addEventListener('click', () => setView('2d'));
  $('v3d').addEventListener('click', () => setView('3d'));
  const P = window.WykrojPrints; let customImg = null, swT = 0;
  function fillFabricPanel() {
    { const q = $('fabQ'); if (!q.options.length) for (const k in FAB) { const o = document.createElement('option'); o.value = k; o.textContent = FAB[k].name; q.appendChild(o); } q.value = state.fabric; $('colQ').value = state.color; $('tFig').textContent = state.figure ? 'Pokaż manekin' : 'Pokaż sylwetkę'; }
    $('fabC').textContent = '';
    for (const k in FAB) { const b = document.createElement('button'); b.textContent = FAB[k].name; b.setAttribute('aria-pressed', k === state.fabric); b.addEventListener('click', () => { state.fabric = k; persist(); fillFabricPanel(); draw(); }); $('fabC').appendChild(b); }
    $('colA').value = state.color; $('colB').value = state.color2; $('pscale').value = state.pscale; $('o_pscale').textContent = state.pscale + '%';
    const plain = state.print === 'gladka'; $('colBrow').hidden = plain || state.print === 'wlasny'; $('pscaleRow').hidden = plain;
    const box = $('prints'); box.textContent = '';
    const add = (id, name, cvs) => { const b = document.createElement('button'); b.setAttribute('aria-pressed', id === state.print); b.append(cvs, name); b.addEventListener('click', () => { state.print = id; persist(); fillFabricPanel(); draw(); }); box.appendChild(b); };
    const sw = (src) => { const c = document.createElement('canvas'); c.width = c.height = 96; c.getContext('2d').drawImage(src, 0, 0, src.width * 0.55, src.height * 0.55, 0, 0, 96, 96); return c; };
    add('gladka', 'Gładka', sw(P.render('gladka', state.color, state.color2, 64)));
    for (const pr of P.LIST) add(pr.id, pr.name, sw(P.render(pr.id, state.color, state.color2, 256)));
    if (customImg) add('wlasny', 'Własny', sw(customImg));
  }
  function loadPrintImg() {
    customImg = null; const src = state.printImg; if (!src || !/^data:image\/jpeg;base64,/.test(src)) return;
    const img = new Image(); img.onload = () => { if (state.printImg !== src) return; const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(img, 0, 0, 512, 512); c._id = Date.now(); customImg = c; fillFabricPanel(); if (state.print === 'wlasny') draw(); };
    img.src = src;
  }
  const swatchesSoon = () => { clearTimeout(swT); swT = setTimeout(fillFabricPanel, 250); };
  $('colA').addEventListener('input', () => { state.color = $('colA').value; persist(); draw(); swatchesSoon(); });
  $('colB').addEventListener('input', () => { state.color2 = $('colB').value; persist(); draw(); swatchesSoon(); });
  $('pscale').addEventListener('input', () => { state.pscale = +$('pscale').value; $('o_pscale').textContent = state.pscale + '%'; persist(); draw(); });
  $('upImg').addEventListener('change', () => {
    const f = $('upImg').files[0]; if (!f) return;
    const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const s = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 512, 512); c._id = Date.now(); customImg = c; state.print = 'wlasny'; try { const k = document.createElement('canvas'); k.width = k.height = 256; k.getContext('2d').drawImage(c, 0, 0, 256, 256); state.printImg = k.toDataURL('image/jpeg', 0.8); } catch (e) {} persist(); fillFabricPanel(); draw(); URL.revokeObjectURL(img.src); };
    img.onerror = () => say('Nie udało się wczytać tego pliku jako obrazu.'); img.src = URL.createObjectURL(f);
  });

