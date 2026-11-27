#!/usr/bin/env python3
"""Testy usługi renderującej z podstawionym Blenderem (bez prawdziwego renderu): kolejka, zapis wyników, anulowanie, limit czasu, rozdzielenie użytkowników."""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__)); TMP = tempfile.mkdtemp(); PORT = 8097
FAKE = os.path.join(TMP, 'fake.py')
open(FAKE, 'w').write('''import sys, json, time
print("WK READY", flush=True)
for line in sys.stdin:
    j = json.loads(line); src = j.get("cloth") or j.get("glb"); d = open(src, "rb").read()
    time.sleep(30 if b"WOLNE" in d else 0.4)
    if b"BLAD" in d: print("WK FAIL %s zepsute dane" % j["id"], flush=True); continue
    open(j["out"], "wb").write(b"WYNIK " + d[:40]); print("WK DONE %s" % j["id"], flush=True)
''')
env = dict(os.environ, WK_PORT=str(PORT), WK_DATA=os.path.join(TMP, 'dane'), WK_BLENDER=sys.executable + ' ' + FAKE, WK_LIMIT_RENDER_S='3', WK_LIMIT_CLOTH_S='3', WK_TOKEN='haslo-testowe')
srv = subprocess.Popen([sys.executable, os.path.join(HERE, '../server/serwer.py')], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
def call(method, path, body=None, client='klient-aaaa', project='projekt-1', token='haslo-testowe', raw=False):
    h = {'x-wk-client': client, 'x-wk-project': project, 'x-wk-token': token}
    if body is not None and not isinstance(body, bytes): body = json.dumps(body).encode(); h['content-type'] = 'application/json'
    try:
        r = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:%d/api/render%s' % (PORT, path), data=body, method=method, headers=h), timeout=20); d = r.read(); return r.status, d if raw else json.loads(d)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def wait(jid, **kw):
    for _ in range(100):
        s, j = call('GET', '/jobs/' + jid, **kw)
        if j.get('state') in ('done', 'failed', 'cancelled'): return j
        time.sleep(0.1)
    return j
n = [0]
def ok(cond, name):
    n[0] += 1
    if not cond: print('BŁĄD:', name); srv.kill(); sys.exit(1)
try:
    for _ in range(50):
        try:
            if call('GET', '/health')[0] == 200: break
        except Exception: time.sleep(0.1)
    cam = {'pos': [0, 0, 200], 'target': [0, 0, 0], 'fov': 32}; rj = lambda key, geo='scena-1': {'kind': 'render', 'key': key, 'geo': geo, 'w': 400, 'h': 300, 'cam': cam}
    ok(call('POST', '/jobs', rj('k1'), token='zle')[0] == 401, 'złe hasło jest odrzucane')
    ok(call('POST', '/jobs', rj('k1'), client='x')[0] == 400, 'brak identyfikatora jest odrzucany')
    s, j = call('POST', '/jobs', rj('k1')); ok(j.get('need') == 'scene', 'serwer prosi o scenę, której nie ma')
    ok(call('PUT', '/scenes/scena-1', b'to nie glb')[0] == 400, 'plik, który nie jest GLB, jest odrzucany')
    ok(call('PUT', '/scenes/scena-1', b'glTF dane sceny')[0] == 200, 'scena przyjęta')
    s, j = call('POST', '/jobs', rj('k1')); ok(j.get('state') == 'queued', 'zadanie w kolejce'); a = j['id']
    ok(wait(a)['state'] == 'done', 'render gotowy'); s, d = call('GET', '/jobs/%s/result' % a, raw=True); ok(d.startswith(b'WYNIK glTF'), 'wynik do pobrania')
    ok(call('GET', '/jobs/' + a, client='klient-bbbb')[0] == 404, 'inny użytkownik nie widzi zadania')
    ok(call('GET', '/jobs/' + a, project='projekt-2')[0] == 404, 'inny projekt nie widzi zadania')
    s, j = call('POST', '/jobs', rj('k1')); ok(j.get('cached') is True, 'ten sam kadr wraca z zapisu bez Blendera')
    ok(call('POST', '/jobs', rj('k1'), client='klient-bbbb')[1].get('need') == 'scene', 'zapis jednego użytkownika nie trafia do drugiego')
    s, j1 = call('POST', '/jobs', rj('k2')); s, j2 = call('POST', '/jobs', rj('k3')); ok(wait(j1['id'])['state'] == 'cancelled' and wait(j2['id'])['state'] == 'done', 'nowsze zadanie zastępuje starsze w tym samym projekcie')
    call('PUT', '/scenes/wolna', b'glTF WOLNE'); s, j = call('POST', '/jobs', rj('k4', 'wolna')); r = wait(j['id']); ok(r['state'] == 'failed' and 'limit' in r['error'], 'limit czasu kończy zadanie')
    s, j = call('POST', '/jobs', rj('k5')); ok(wait(j['id'])['state'] == 'done', 'po limicie czasu Blender wstaje i kolejne zadanie przechodzi')
    call('PUT', '/scenes/wolna2', b'glTF WOLNE'); s, j = call('POST', '/jobs', rj('k6', 'wolna2')); time.sleep(0.8); call('DELETE', '/jobs/' + j['id']); ok(wait(j['id'])['state'] == 'cancelled', 'anulowanie zadania w toku')
    cl = lambda x: {'kind': 'cloth', 'key': 'c' + x, 'data': {'ns': 1, 'rmap': [0], 'uv': [0, 0], 'tri': [], 'X': [0, 0, 0], 'body': {'pos': [], 'idx': []}, 'x': x}}
    s, j = call('POST', '/jobs', cl('1')); ok(wait(j['id'])['state'] == 'done', 'układanie tkaniny przechodzi przez kolejkę')
    s, j = call('POST', '/jobs', cl('BLAD')); r = wait(j['id']); ok(r['state'] == 'failed' and 'zepsute' in r['error'], 'błąd Blendera wraca jako powód')
    ok(call('POST', '/jobs', {'kind': 'cloth', 'key': 'c9', 'data': {}})[0] == 400, 'niepełne dane tkaniny są odrzucane')
    ok(not [f for r_, d_, fs in os.walk(env['WK_DATA']) for f in fs if f.startswith('in-')], 'pliki robocze zadań są sprzątane')
    print('usługa renderująca: %d testów, wszystko w porządku' % n[0])
finally:
    srv.kill()
