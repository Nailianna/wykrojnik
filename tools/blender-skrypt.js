// Wyciąga skrypt Blendera z aplikacji (src/app/14a-blender.js) do server/wykrojnik_render.py, żeby serwer i aplikacja używały tego samego.
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '../src/app/14a-blender.js'), 'utf8'), a = s.indexOf('const BL_PY = ['), b = s.indexOf("].join('\\n');", a);
const lines = eval(s.slice(a + 'const BL_PY = '.length, b + 1));
fs.writeFileSync(path.join(__dirname, '../server/wykrojnik_render.py'), lines.join('\n'));
