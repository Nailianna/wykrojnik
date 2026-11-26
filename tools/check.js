// kontrola spójności: obwody i długości szwów dla wszystkich fasonów i kilku sylwetek
const W = require('../engine.js');
const ms = [{name:'S',og:80,ot:60,ob:86,wb:19,wzrost:160},{name:'M',og:85,ot:65,ob:88,wb:20,wzrost:176},{name:'38',og:88,ot:68,ob:92,wb:21,wzrost:168},{name:'L',og:96,ot:78,ob:104,wb:21,wzrost:172,opx:84},{name:'XL',og:112,ot:96,ob:120,wb:23,wzrost:165,opx:98},{name:'gruszka',og:84,ot:66,ob:104,wb:22,wzrost:170}];
const base = {dl:58,kn:55,gf:9,fac:'laczone',facW:5,flare:0,luzG:4,luzB:2,luzT:1,nd:0,nw:0,nb:0,nk:'okragly',nkb:'okragly',saSzew:1.5,saDol:4,saTalia:1,pasek:3};
let bad = 0, n = 0;
for (const m of ms) for (const st of W.STYLES) for (const v of [{}, {nd:10,nw:4,nb:12,nk:'v',nkb:'v'}, {luzG:0,luzT:-2,luzB:-2}, {dl:110,flare:(st.flare||0)+6}, {fac:'osobne',nd:12,nw:5,nk:'serce'}, {fac:'osobne',nk:'karo',nd:6,nw:2,nb:14,nkb:'v'}, {fac:'laczone',nk:'lodka',nd:-3,nw:6}, {gora:'bez',luzG:0,ram:'cienkie'}, {rek:'krotki'}, {baza:'stark'}, {baza:'stark',rek:'dlugi',luzG:10}, {baza:'stark',gora:'bez',luzG:0}, {baza:'stark',rek:'34',zp:'pacha'}, {dl:-8}, {dl:0}, {dl:8,luzT:-2}, {dl:14,gora:'bez',ram:'cienkie',bk:'luk'}, {gora:'bez',bk:'luk',bh:9}, {dl:-6,gora:'bez',ram:'cienkie',bk:'prosta'}, {extras:[{name:'Szarfa',base:'talia',k:1,plus:120,w:6,n:1},{name:'Falbana dołu',base:'dol',k:1.8,plus:0,w:12,n:1},{name:'x',base:'rekaw',k:1,plus:0,w:3,n:2}]}, {rek:'bufka',falR:true,falN:true,marsz:true,sciag:true}, {tren:40,sciag:true,gora:'bez',falN:true,luzG:0}, {kop:true,pasT:5}, {kop:true,kol:'szal',rek:'34',mank:true,pasT:6}, {rek:'34',mank:true,nd:5}, {rek:'dlugi',luzG:6}, {gora:'bez',luzG:0,ram:'szyja',ramW:2}, {gora:'bez',bk:'serce',bh:9,luzG:-2,luzT:-2}]) {
  const p = Object.assign({}, base, {flare: st.flare||0, dl: st.dl||58}, v); n++;
  let d; try { d = W.draft(m, p, st.id); } catch (e) { bad++; console.log('BŁĄD', m.name, st.id, JSON.stringify(v), e.message); continue; }
  const lay = W.layout(d.pieces, 2);
  if (lay.prims.some(q => q.t==='poly' && q.pts.some(a => !isFinite(a[0]) || !isFinite(a[1])))) { bad++; console.log('NaN', m.name, st.id, JSON.stringify(v)); }
  for (const r of d.info.rows) if (r[2] != null && Math.abs(r[1]-r[2]) > 0.15 && !(st.id==='sk_trapez' && r[0].startsWith('Biodra'))) { bad++; console.log('RÓŻNICA', m.name, st.id, JSON.stringify(v), r[0], r[1].toFixed(2), r[2].toFixed ? r[2].toFixed(2) : r[2]); }
}
console.log('sprawdzono', n, 'kombinacji, problemów:', bad);
