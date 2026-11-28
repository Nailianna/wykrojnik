  // ---------- paleta poleceń (⌘K) ----------
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  let cmdSel = 0, cmdItems = [];
  function cmdAll() {
    const L = [], add = (t, g, run) => L.push({ t, g, run });
    for (const k of ['proj', 'modelka', 'fason', 'wymiary', 'tkanina', 'druk']) add(PT[k], 'Panel', () => goPanel(k));
    add('Pulpit', 'Widok', () => homeShow(true));
    add('Zapisz PDF', 'Akcja', () => $('pdf').click()); add('Cofnij', 'Akcja', () => histGo(-1)); add('Ponów', 'Akcja', () => histGo(1));
    add('Nowy projekt', 'Akcja', () => homeShow(true)); add('Warstwy', 'Panel', () => goPanel('druk')); add('Zapasy na szwy', 'Panel', () => { goPanel('druk'); $('szwyBox').scrollIntoView({ block: 'start' }); }); add('Duplikuj projekt', 'Akcja', () => { goPanel('proj'); $('prDup').click(); });
    add('Pokaż wykrój', 'Widok', () => setView('2d')); add('Pokaż podgląd 3D', 'Widok', () => setView('3d'));
    add(state.theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw', 'Widok', () => $('theme').click());
    add(state.figure ? 'Schowaj sylwetkę' : 'Pokaż sylwetkę', 'Widok', () => { if (state.view !== '3d') setView('3d'); $('tFig').click(); });
    add(state.card ? 'Schowaj kontrolę wymiarów' : 'Pokaż kontrolę wymiarów', 'Widok', () => (state.card ? $('cardX') : $('cardBtn')).click());
    if (flags().dress) add(state.p.gora === 'bez' ? 'Góra z ramionami' : 'Góra bez ramiączek', 'Fason', () => $('gora').querySelector(state.p.gora === 'bez' ? '[data-g=ramiona]' : '[data-g=bez]').click());
    if (flags().straps) for (const [k, t] of [['stojka', 'Kołnierz: stójka'], ['bebe', 'Kołnierz: bebe'], ['brak', 'Bez kołnierza']]) if ((state.p.kol || 'brak') !== k) add(t, 'Fason', () => { goPanel('wymiary'); $('kol').querySelector('[data-k=' + k + ']').click(); $('kol').scrollIntoView({ block: 'center' }); });
    for (const st of W.STYLES) add(GRP[st.group] + st.name.toLowerCase(), 'Fason', () => pickStyle(st));
    for (const pr of state.projects) if (pr.id !== state.proj) add(pr.name || 'Bez nazwy', 'Projekt', () => openProj(pr.id));
    for (const mo of state.profiles) if (mo.id !== state.active) add(mo.name || 'Bez imienia', 'Modelka', () => { state.active = mo.id; fillForm(); persist(); draw(true); });
    return L;
  }
  function cmdFill() {
    const q = norm($('cmdIn').value.trim()), box = $('cmdList'); box.textContent = '';
    cmdItems = cmdAll().filter((c) => !q || q.split(/\s+/).every((w) => norm(c.t + ' ' + c.g).includes(w))).slice(0, 40); cmdSel = Math.min(cmdSel, Math.max(0, cmdItems.length - 1));
    if (!cmdItems.length) { const p0 = document.createElement('p'); p0.textContent = 'Nie mam takiego polecenia.'; box.append(p0); return; }
    cmdItems.forEach((c, i) => { const b = document.createElement('button'), s2 = document.createElement('small'); b.textContent = c.t; s2.textContent = c.g; b.append(s2); b.setAttribute('role', 'option'); b.setAttribute('aria-selected', i === cmdSel); b.addEventListener('click', () => cmdRun(i)); box.append(b); });
    const cur2 = box.children[cmdSel]; if (cur2 && cur2.scrollIntoView) cur2.scrollIntoView({ block: 'nearest' });
  }
  function cmdOpen() { $('cmd').hidden = false; $('cmdIn').value = ''; cmdSel = 0; cmdFill(); $('cmdIn').focus(); }
  function cmdClose() { $('cmd').hidden = true; }
  function cmdRun(i) { const c = cmdItems[i]; cmdClose(); if (c) c.run(); }
  $('cmdBtn').addEventListener('click', cmdOpen);
  $('cmd').addEventListener('pointerdown', (e) => { if (e.target === $('cmd')) cmdClose(); });
  $('cmdIn').addEventListener('input', () => { cmdSel = 0; cmdFill(); });
  $('cmdIn').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(cmdItems.length - 1, cmdSel + 1); cmdFill(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); cmdFill(); }
    else if (e.key === 'Enter') { e.preventDefault(); cmdRun(cmdSel); }
    else if (e.key === 'Escape') { e.preventDefault(); cmdClose(); }
  });
  document.addEventListener('keydown', (e) => { if (CMD_ON && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('cmd').hidden) cmdOpen(); else cmdClose(); } });

