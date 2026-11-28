  // ---------- PDF ----------
  let msgT = 0;
  function say(t, keep) { $('msg').textContent = t; clearTimeout(msgT); if (!keep) msgT = setTimeout(() => ($('msg').textContent = ''), 7000); }
  function buildPdf() {
    const { d, lay, tl } = compute(), m = cur(), p = state.p, fl = flags(); lyFix(d);
    const part = d.pieces.filter((pc) => state.sel && state.sel[pc.id]).length > 0, inFile = d.pieces.filter((pc) => !(state.sel && state.sel[pc.id])).map((pc) => pc.name.toLowerCase());
    const rows = [['Modelka', 'biust ' + f1(m.og) + ', talia ' + f1(m.ot) + ', biodra ' + f1(m.ob) + ', wysokość bioder ' + f1(m.wb) + ' cm']];
    if (d.cover) for (const r of d.cover) rows.push(r); else {
    rows.push(['Długość od talii', f1(p.dl) + ' cm']);
    rows.push(['Luz', (fl.dress ? 'biust ' + f1(p.luzG) + ', ' : '') + 'talia ' + f1(p.luzT) + (fl.hip ? ', biodra ' + f1(p.luzB) : '') + ' cm']);
    rows.push(['Zapasy na szwy', 'szwy ' + f1(p.saSzew) + ', talia i wykończenia ' + f1(p.saTalia) + ', dół ' + f1(p.saDol) + ' cm']);
    }
    if (part) rows.unshift(['Dodruk', 'ten plik zawiera tylko: ' + inFile.join(', ') + '. Pozostałe elementy są w pełnym wydruku projektu.']);
    rows.push([part ? 'Cały projekt, do wycięcia' : 'Do wycięcia', d.info.cut.map((c) => c[0].toLowerCase() + ' ' + c[1]).join('; ')]);
    rows.push(['Tkanina (bela ' + state.fabW + ' cm)', fabricRows(d).map((r) => r[0].toLowerCase() + ': ' + r[1] + ', ' + r[2]).join('; ')]);
    rows.push(['Dodatki', (d.notions || []).map((r) => r[0].toLowerCase() + ' ' + r[1]).join('; ')]);
    for (const r of d.info.rows) rows.push([r[0], f1(r[1]) + ' cm']);
    const howto = [
      '1. Drukuj w skali 100% („rozmiar rzeczywisty”), bez dopasowywania do strony.',
      '2. Na pierwszym arkuszu wykroju (strona 2 tego pliku) zmierz odcinek kontrolny. Ma mieć dokładnie 10 cm.',
      '3. Przytnij kartki wzdłuż ramek i sklej je według schematu poniżej. Romby na krawędziach muszą się zejść.',
      'Linia ciągła to linia cięcia (z zapasem), przerywana to linia szycia.',
    ];
    const extra = d.layers ? [{ title: 'Warstwy i kolejność szycia', blocks: d.layers.cut.map((c) => ({ h: c.name + ' · ' + c.fabric + (c.scope ? ' · ' + c.scope : ''), lines: c.items.map((t) => '• ' + t).concat(c.notes) })).concat([{ h: 'Kolejność szycia', lines: d.layers.steps.map((t, i) => (i + 1) + '. ' + t) }]) }] : [];
    const buf = W.makePdf(window.jspdf.jsPDF, window.WYKROJ_FONT, lay, tl, { extra, labels: state.labels, title: d.title, sub: (projCur().name ? projCur().name + ' · ' : '') + (m.name || 'Bez imienia') + ' · ' + new Date().toLocaleDateString('pl-PL') + ' · Wykrojnik', rows, howto });
    const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return { buf, name: slug(d.title) + '-' + (slug(m.name || '') || 'modelka') + (part ? '-dodruk' : '') + '.pdf' };
  }
  // zapis pliku: w aplikacji do Dokumenty/Wykrojnik, w przeglądarce zwykłe pobieranie
  async function saveFile(name, bytes, mime, open, okDisk, okDl) {
    if (desktop && desktop.fs) {
      try {
        await desktop.fs.mkdir('~/Documents/Wykrojnik', { recursive: true });
        const path = '~/Documents/Wykrojnik/' + name;
        await desktop.fs.writeFile(path, bytes);
        if (!fileOk) { fileOk = true; persist(true); showStore(); }
        if (open) await desktop.shell.openPath(path).catch(() => {});
        say(okDisk); return true;
      } catch (e) { /* brak zgody na pliki: zwykłe pobieranie */ }
    }
    if (downloads) {
      try { await downloads.save({ filename: name, data: new Blob([bytes], { type: mime }) }); say(okDl); return true; }
      catch (e) { if (!e || e.code !== 'declined') say('Nie udało się zapisać pliku. Zainstaluj Wykrojnik jako aplikację albo otwórz go w Claude.'); }
      return;
    }
    try { const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([bytes], { type: mime })); el.download = name; el.click(); return true; }
    catch (e) { say('W tym widoku nie mogę zapisać pliku. Zainstaluj Wykrojnik jako aplikację.'); }
  }
  $('pdf').addEventListener('click', async () => {
    if (state.style === 'pusty') { say('Ten projekt nie ma jeszcze fasonu, więc nie ma czego drukować. Wybierz fason w panelu Fason.', true); return; }
    let out; const bz = busyOn('Składam PDF z wykrojem.'); await paintTick();
    try { out = buildPdf(); } catch (e) { say('Nie udało się zbudować PDF: ' + e.message); return; } finally { busyOff(bz); }
    saveFile(out.name, new Uint8Array(out.buf), 'application/pdf', true, 'Zapisałam wykrój w Dokumenty/Wykrojnik/' + out.name + '. Drukuj w skali 100%.', 'Wykrój pobrany. Drukuj w skali 100%.')
      .then((ok) => { const pr = projCur(); if (ok && pr) { persist(true); pr.exported = Date.now(); pr.expV = 2; pr.expKey = snapKey(pr.snap); persist(true); } });
  });
  $('bkOut').addEventListener('click', () => {
    persist(true); const name = 'wykrojnik-kopia-' + new Date().toISOString().slice(0, 10) + '.json';
    saveFile(name, new TextEncoder().encode(JSON.stringify(state)), 'application/json', false, 'Kopia zapisana w Dokumenty/Wykrojnik/' + name + '.', 'Kopia pobrana.');
  });
  // kopia zapasowa zastępuje wszystko, więc najpierw pokazuję zakres i pytam, a stan sprzed wczytania da się przywrócić
  let bkNew = '', bkPrev = '';
  const bkApply = (raw, msg) => { let ok = false; try { ok = adopt(raw); } catch (e) { ok = false; } if (!ok) { say('To nie jest plik kopii Wykrojnika.'); return false; } ensureProjects(); loadSnap(projCur().snap); histReset(); fillForm(); layoutUi(); persist(true); draw(true); say(msg, true); return true; };
  $('bkIn').addEventListener('change', async () => {
    const f = $('bkIn').files[0]; $('bkIn').value = ''; if (!f) return; let s = null, raw = '';
    try { raw = await f.text(); s = JSON.parse(raw); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.profiles) || !s.profiles.length || !s.p) { say('To nie jest plik kopii Wykrojnika.'); return; }
    const np = (s.projects || []).length, lost = state.projects.filter((q) => !(s.projects || []).some((x) => x.id === q.id)).map((q) => q.name);
    bkNew = raw; $('bkAskT').textContent = 'Kopia „' + f.name + '” ma projektów: ' + np + ', modelek: ' + s.profiles.length + '. Zastąpi wszystko, co jest teraz w Wykrojniku (projektów: ' + state.projects.length + ', modelek: ' + state.profiles.length + ').' + (lost.length ? ' Tych projektów nie ma w kopii i znikną: ' + lost.join(', ') + '.' : ''); $('bkAsk').hidden = false; $('bkUndo').hidden = true;
  });
  $('bkNo').addEventListener('click', () => { bkNew = ''; $('bkAsk').hidden = true; });
  $('bkYes').addEventListener('click', () => { $('bkAsk').hidden = true; if (!bkNew) return; persist(true); const before = JSON.stringify(state); if (bkApply(bkNew, 'Wczytałam projekty i modelki z kopii. Poprzedni stan możesz przywrócić w panelu Projekty, dopóki nie zamkniesz Wykrojnika.')) { bkPrev = before; $('bkUndo').hidden = false; } bkNew = ''; });
  $('bkUndo').addEventListener('click', () => { if (bkPrev && bkApply(bkPrev, 'Przywróciłam projekty i modelki sprzed wczytania kopii.')) { bkPrev = ''; $('bkUndo').hidden = true; } });
  $('saveWarnB').addEventListener('click', () => $('bkOut').click());

