  // ---------- aplikacja desktopowa ----------
  function drawIcon() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.scale(8, 8);
    const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#ffa48c'); gr.addColorStop(0.55, '#ffa48c'); gr.addColorStop(1, '#ffa48c');
    g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, 64, 64, 15); g.fill();
    g.strokeStyle = '#12302a'; g.lineCap = g.lineJoin = 'round'; g.lineWidth = 5.5; g.beginPath(); g.moveTo(14, 22); g.lineTo(22.5, 44); g.lineTo(32, 26); g.lineTo(41.5, 44); g.lineTo(50, 22); g.stroke();
    g.globalAlpha = 0.85; g.lineWidth = 2.6; g.setLineDash([4.5, 5]); g.beginPath(); g.moveTo(14, 52); g.lineTo(50, 52); g.stroke();
    g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(50, 14, 3.2, 0, 7); g.fill();
    return c.toDataURL('image/png');
  }
  function showStore() { $('store').textContent = fileOk ? 'Projekty i modelki zapisują się same w Dokumenty/Wykrojnik.' : desktop && desktop.fs ? 'Projekty i modelki zapisują się teraz w pamięci aplikacji. Po zgodzie na pliki trafią do Dokumenty/Wykrojnik.' : 'Projekty i modelki zapisują się same w tej przeglądarce. Po zainstalowaniu aplikacji trafią do Dokumenty/Wykrojnik.'; }
  // zapis w Dokumentach: po zgodzie na pliki. Nowsza z dwóch kopii (plik albo pamięć aplikacji) wygrywa, żeby zgoda włączona po czasie nie cofnęła pracy.
  async function fileOn(late) {
    fileOk = true; $('permRow').hidden = true;
    const raw = await desktop.fs.readFile(FILE, 'utf8').catch(() => null), last = (st) => Math.max(0, ...((st && st.projects) || []).map((q) => (q && q.updated) || 0));
    let fromFile = !!raw; if (raw && late) { try { fromFile = last(JSON.parse(raw)) > last(state); } catch (e) { fromFile = false; } }
    if (fromFile && adopt(raw)) { ensureProjects(); loadPrintImg(); histReset(); fillForm(); layoutUi(); setView(state.view); if (!$('home').hidden) homeFill(); } else if (late) persist(true);
    showStore(); BL.mode = BL.mode === 'server' ? 'server' : ''; blInit();
  }
  async function boot() {
    const back = uiResume(); loadPrintImg(); histReset();
    fillForm(); layoutUi(); setView(state.view === '3d' ? '3d' : '2d'); showStore(); uiReady = true; homeShow(!back);
    if (!window.claude || !window.claude.use) { blInit(); return; }
    claude.use('downloads').then((d) => (downloads = d)).catch(() => {});
    claude.use('db').then((d) => { if (d) { dbRef = d; wishPull(); } }).catch(() => {});
    claude.use('sample').then((s) => { sampleFn = s; if (s && inBlob) { $('inGo').disabled = false; $('inStat').textContent = ''; } }).catch(() => {});
    try { desktop = (TEST && window['__wkDesktop']) || (await claude.use('desktop')); } catch (e) { desktop = null; }
    blNote();
    if (!desktop || !desktop.fs) blInit();
    if (!desktop) { instState = 'none'; instFill(); return; }
    if (desktop.fs) {
      instState = 'installed'; instFill();
      desktop.app.dock.setIcon(drawIcon()).catch(() => {});
      try {
        let ps = await desktop.permissions.state('full-access');
        for (let i = 0; i < 3 && ps === 'unavailable'; i++) { await new Promise((r) => setTimeout(r, 2000)); ps = await desktop.permissions.state('full-access'); } // tuż po starcie aplikacja może jeszcze nie znać stanu zgody
        if (ps === 'granted') await fileOn(false);
        else { $('permRow').hidden = false; showStore(); blInit(); if (ps === 'prompt') say('Po aktualizacji Wykrojnik potrzebuje ponownej zgody na pliki. Włączysz ją w panelu Projekty.'); }
      } catch (e) {}
    } else if (desktop.install) {
      try {
        const stI = await desktop.install.state(); instState = stI;
        if (stI === 'available') { const go = () => desktop.install.request().catch(() => say('Instalacja się nie rozpoczęła. Spróbuj jeszcze raz z aplikacji Claude na komputerze.')); $('hInst').addEventListener('click', go); }
        instFill();
      } catch (e) {}
    }
  }
  $('permBtn').addEventListener('click', async () => {
    try { const r = await desktop.permissions.request(['full-access']); if (r && r['full-access'] === 'granted') await fileOn(true); else say('Bez tej zgody projekty zostają w pamięci aplikacji, a Blender z tego komputera jest niedostępny.'); }
    catch (e) { say('Nie udało się zapytać o zgodę. Spróbuj jeszcze raz za chwilę.'); }
  });
  boot();
})();
