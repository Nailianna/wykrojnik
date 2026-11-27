#!/usr/bin/env python3
"""Usługa renderująca Wykrojnika: przyjmuje zadania z przeglądarki, uruchamia Blendera w tle, oddaje stan i wynik.

Bez zależności poza biblioteką standardową. Blender chodzi jako jeden stały proces ze skryptem wykrojnik_render.py
(ten sam skrypt, którego używa aplikacja na komputerze). Zadania czekają w kolejce, mają limit czasu, a pliki są sprzątane.
Renderowanie i układanie tkaniny nie potrzebują klucza API Claude'a.

Ta sama usługa serwuje stronę Wykrojnika (WK_STATIC) i przekazuje pytania do Claude'a pod /api/claude.
Zasady dla /api/claude: klucz przychodzi w nagłówku x-api-key każdego żądania i żyje tylko w zmiennej tej jednej obsługi,
usługa nie ma własnego klucza i nie czyta go ze zmiennych środowiskowych, nic nie zapisuje ani nie loguje,
a jedyne adresy docelowe to dwa punkty API Anthropic wpisane niżej.
"""
import collections, hashlib, json, os, re, shlex, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('WK_PORT') or os.environ.get('PORT') or '8080')
DATA = os.environ.get('WK_DATA', '/tmp/wykrojnik-render')
BLENDER = os.environ.get('WK_BLENDER', sys.executable + ' ' + shlex.quote(os.path.join(HERE, 'wykrojnik_render.py')))
TOKEN = os.environ.get('WK_TOKEN', '')
ORIGINS = [o.strip() for o in os.environ.get('WK_ORIGINS', '').split(',') if o.strip()]
STATIC = os.environ.get('WK_STATIC', '')
T_RENDER = int(os.environ.get('WK_LIMIT_RENDER_S', '120'))
T_CLOTH = int(os.environ.get('WK_LIMIT_CLOTH_S', '300'))
TTL = int(os.environ.get('WK_TTL_H', '168')) * 3600
MAX_BODY = int(os.environ.get('WK_MAX_MB', '48')) * 1024 * 1024
MAX_QUEUE = int(os.environ.get('WK_MAX_QUEUE', '40'))
MAX_PX = int(os.environ.get('WK_MAX_PX', '2000'))
IDLE = int(os.environ.get('WK_IDLE_S', '900'))  # po tylu sekundach bez zadań Blender jest wyłączany, żeby nie zajmował pamięci
PER_CLIENT = int(os.environ.get('WK_MAX_ACTIVE', '6'))  # najwięcej zadań jednej przeglądarki naraz
PER_HOUR = int(os.environ.get('WK_MAX_HOUR', '240'))  # najwięcej zadań jednej przeglądarki na godzinę
ANTHROPIC = 'https://api.anthropic.com'
ANTHROPIC_VERSION = '2023-06-01'
CLAUDE_MAX = 32 * 1024 * 1024
KEY = re.compile(r'^sk-ant-[A-Za-z0-9_-]{16,300}$')
ID = re.compile(r'^[A-Za-z0-9_-]{6,64}$')
SIG = re.compile(r'^[A-Za-z0-9_-]{3,40}$')

lock = threading.Condition()
jobs, queue = {}, []
recent = collections.defaultdict(collections.deque)  # identyfikator przeglądarki -> czasy ostatnich zadań
state = {'proc': None, 'ready': False, 'cur': None, 'version': '', 'error': ''}


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def owner_dir(client, project):
    d = os.path.join(DATA, hashlib.sha256(client.encode()).hexdigest()[:24], hashlib.sha256(project.encode()).hexdigest()[:16])
    os.makedirs(d, exist_ok=True)
    return d


def result_path(job):
    ext = 'png' if job['kind'] == 'render' else 'bin'
    return os.path.join(owner_dir(job['client'], job['project']), job['kind'][0] + '-' + hashlib.sha256(job['key'].encode()).hexdigest()[:32] + '.' + ext)


def scene_path(client, project, sig):
    return os.path.join(owner_dir(client, project), 's-' + sig + '.glb')


# ---------- Blender: jeden proces, zadania po kolei ----------
def start_blender():
    try:
        p = subprocess.Popen(shlex.split(BLENDER), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1)
    except Exception as e:
        state['error'] = 'Blender się nie uruchomił: %s' % e
        return None
    state.update(proc=p, ready=False, error='')
    threading.Thread(target=read_blender, args=(p,), daemon=True).start()
    return p


def read_blender(p):
    for line in p.stdout:
        line = line.strip()
        if line.startswith('Blender ') and not state['version']:
            state['version'] = line[:40]
        if not line.startswith('WK '):
            continue
        part = line.split(' ', 3)
        with lock:
            if part[1] == 'READY':
                state['ready'] = True
            else:
                j = state['cur']
                if j and str(j['n']) == part[2]:
                    j['state'] = 'done' if part[1] == 'DONE' and os.path.exists(j['out']) else 'failed'
                    j['error'] = '' if j['state'] == 'done' else (part[3] if len(part) > 3 else 'Blender nie zapisał wyniku')[:200]
                    j['t1'] = time.time()
                    state['cur'] = None
            lock.notify_all()
    with lock:
        if state['proc'] is p:
            state.update(proc=None, ready=False)
            j = state['cur']
            if j:
                j.update(state='failed', error=j.get('error') or 'Blender zakończył pracę w trakcie zadania', t1=time.time())
                state['cur'] = None
        lock.notify_all()


def kill_blender():
    p = state['proc']
    state.update(proc=None, ready=False)
    if p:
        try:
            p.kill()
        except Exception:
            pass


def worker():
    n = 0
    while True:
        with lock:
            idle0 = time.time()
            while not queue:
                lock.wait(5)
                if not queue and state['proc'] and time.time() - idle0 > IDLE:
                    kill_blender()
                    log('Blender wyłączony po bezczynności')
            job = queue.pop(0)
            if job['state'] != 'queued':
                continue
            job['state'] = 'starting'
        p = state['proc'] or start_blender()
        t0 = time.time()
        with lock:
            while p and not state['ready'] and state['proc'] is p and time.time() - t0 < 90:
                lock.wait(1)
            if not p or not state['ready']:
                kill_blender()
                job.update(state='failed', error=state['error'] or 'Blender nie wystartował w 90 s', t1=time.time())
                continue
            if job.get('cancel'):
                job.update(state='cancelled', t1=time.time())
                continue
            n += 1
            job.update(state='running', n=n, t0=time.time())
            state['cur'] = job
            msg = {'id': n, 'out': job['out']}
            if job['kind'] == 'render':
                msg.update(glb=job['scene'], geo=job['geo'], mats=job['mats'], w=job['w'], h=job['h'], cam=job['cam'])
            else:
                msg['cloth'] = job['input']
        try:
            p.stdin.write(json.dumps(msg) + '\n')
            p.stdin.flush()
        except Exception:
            pass
        limit = T_RENDER if job['kind'] == 'render' else T_CLOTH
        with lock:
            while job['state'] == 'running' and time.time() - job['t0'] < limit and not job.get('cancel'):
                lock.wait(0.5)
            if job['state'] == 'running':  # limit czasu albo anulowanie: Blendera nie da się przerwać w pół zadania, więc startuje od nowa
                state['cur'] = None
                kill_blender()
                job.update(state='cancelled' if job.get('cancel') else 'failed', error='' if job.get('cancel') else 'Przekroczony limit czasu (%d s)' % limit, t1=time.time())
        if job['kind'] == 'cloth':
            try:
                os.remove(job['input'])
            except OSError:
                pass
        log(job['kind'], job['state'], '%.1fs' % (time.time() - job['t0']), job.get('error', ''))


def janitor():
    while True:
        time.sleep(600)
        now = time.time()
        with lock:
            for k in [k for k, j in jobs.items() if j.get('t1') and now - j['t1'] > 3600]:
                del jobs[k]
        for root, dirs, files in os.walk(DATA, topdown=False):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    old = now - os.path.getmtime(fp)
                    if old > TTL or (f.startswith('in-') and old > 3600) or (f.startswith('s-') and old > 86400):
                        os.remove(fp)
                except OSError:
                    pass
            if root != DATA and not os.listdir(root):
                try:
                    os.rmdir(root)
                except OSError:
                    pass


# ---------- HTTP ----------
TYPES = {'.mp4': 'video/mp4', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}


class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def send(self, code, body=b'', ctype='application/json', extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        o = self.headers.get('Origin', '')
        if o and o in ORIGINS:
            self.send_header('Access-Control-Allow-Origin', o)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'content-type, x-wk-client, x-wk-project, x-wk-token')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def same_origin(self):
        o = self.headers.get('Origin', '')
        if not o or o in ORIGINS:
            return True
        host = urllib.parse.urlparse(o).netloc
        return host in (self.headers.get('Host', ''), self.headers.get('X-Forwarded-Host', ''))

    def claude(self):
        """Przekazuje pytanie do API Anthropic kluczem z tego żądania. Niczego nie zapisuje i nie loguje."""
        def err(code, typ, msg):
            self.send(code, {'type': 'error', 'error': {'type': typ, 'message': msg}})
        if not self.same_origin():
            return err(403, 'forbidden', 'Zapytanie z innej strony.')
        key = self.headers.get('x-api-key', '').strip()
        if not KEY.match(key):
            return err(401, 'authentication_error', 'Brak klucza API w zapytaniu.')
        head = {'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION}
        if self.command == 'GET':
            req = urllib.request.Request(ANTHROPIC + '/v1/models?limit=1', headers=head, method='GET')  # bezpłatne sprawdzenie klucza
        else:
            n = int(self.headers.get('Content-Length', '0') or 0)
            if n > CLAUDE_MAX:
                return err(413, 'request_too_large', 'Zapytanie jest za duże.')
            head['content-type'] = 'application/json'
            req = urllib.request.Request(ANTHROPIC + '/v1/messages', data=self.rfile.read(n), headers=head, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                return self.send(r.status, r.read(), r.headers.get('content-type') or 'application/json')
        except urllib.error.HTTPError as e:
            return self.send(e.code, e.read(), e.headers.get('content-type') or 'application/json')
        except Exception:
            return err(502, 'api_error', 'Nie udało się połączyć z API Anthropic.')

    def who(self):
        if not self.same_origin():
            self.send(403, {'error': 'Zapytanie z innej strony.'})
            return None
        c, p = self.headers.get('X-Wk-Client', ''), self.headers.get('X-Wk-Project', '')
        if TOKEN and self.headers.get('X-Wk-Token', '') != TOKEN:
            self.send(401, {'error': 'Brak dostępu do usługi renderującej.'})
            return None
        if not ID.match(c) or not ID.match(p):
            self.send(400, {'error': 'Brak identyfikatora użytkownika albo projektu.'})
            return None
        return c, p

    def body(self):
        n = int(self.headers.get('Content-Length', '0') or 0)
        if n <= 0 or n > MAX_BODY:
            self.send(413 if n > MAX_BODY else 400, {'error': 'Za duże albo puste dane.'})
            return None
        return self.rfile.read(n)

    def do_OPTIONS(self):
        self.send(204)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/claude':
            return self.claude()
        if path == '/api/render/health':
            with lock:
                return self.send(200, {'ok': True, 'blender': state['version'] or ('gotowy' if state['ready'] else 'uruchomi się przy pierwszym zadaniu'), 'queue': len(queue), 'error': state['error']})
        m = re.match(r'^/api/render/jobs/([a-f0-9]{32})(/result)?$', path)
        if m:
            w = self.who()
            if not w:
                return
            with lock:
                j = jobs.get(m.group(1))
                if not j or (j['client'], j['project']) != w:
                    return self.send(404, {'error': 'Nie ma takiego zadania.'})
                if not m.group(2):
                    pos = sum(1 for q in queue if q['state'] == 'queued' and q['t'] < j['t']) if j['state'] == 'queued' else 0
                    return self.send(200, {'id': j['id'], 'kind': j['kind'], 'state': j['state'], 'ahead': pos, 'error': j.get('error', ''), 'cached': bool(j.get('cached'))})
                if j['state'] != 'done':
                    return self.send(409, {'error': 'Wynik nie jest jeszcze gotowy.'})
                out = j['out']
            try:
                data = open(out, 'rb').read()
            except OSError:
                return self.send(410, {'error': 'Wynik został już usunięty.'})
            return self.send(200, data, 'image/png' if j['kind'] == 'render' else 'application/octet-stream')
        if STATIC and not path.startswith('/api/'):
            fp = os.path.normpath(os.path.join(STATIC, path.lstrip('/') or 'index.html'))
            if fp.startswith(os.path.abspath(STATIC)) and os.path.isfile(fp):
                return self.send(200, open(fp, 'rb').read(), TYPES.get(os.path.splitext(fp)[1], 'application/octet-stream'))
        self.send(404, {'error': 'Nie znaleziono.'})

    def do_PUT(self):
        m = re.match(r'^/api/render/scenes/([A-Za-z0-9_-]{3,40})$', self.path.split('?')[0])
        w = self.who() if m else None
        if not m:
            return self.send(404, {'error': 'Nie znaleziono.'})
        if not w:
            return
        data = self.body()
        if data is None:
            return
        if data[:4] != b'glTF':
            return self.send(400, {'error': 'To nie jest plik GLB.'})
        fp = scene_path(w[0], w[1], m.group(1))
        with open(fp + '.tmp', 'wb') as f:
            f.write(data)
        os.replace(fp + '.tmp', fp)
        self.send(200, {'ok': True})

    def do_DELETE(self):
        m = re.match(r'^/api/render/jobs/([a-f0-9]{32})$', self.path.split('?')[0])
        w = self.who() if m else None
        if not m:
            return self.send(404, {'error': 'Nie znaleziono.'})
        if not w:
            return
        with lock:
            j = jobs.get(m.group(1))
            if j and (j['client'], j['project']) == w and j['state'] in ('queued', 'starting', 'running'):
                j['cancel'] = True
                if j['state'] == 'queued':
                    j.update(state='cancelled', t1=time.time())
                lock.notify_all()
        self.send(200, {'ok': True})

    def do_POST(self):
        if self.path.split('?')[0] == '/api/claude':
            return self.claude()
        if self.path.split('?')[0] != '/api/render/jobs':
            return self.send(404, {'error': 'Nie znaleziono.'})
        w = self.who()
        if not w:
            return
        raw = self.body()
        if raw is None:
            return
        try:
            d = json.loads(raw)
            kind, key = d['kind'], str(d['key'])[:400]
            assert kind in ('render', 'cloth') and key
        except Exception:
            return self.send(400, {'error': 'Nieczytelne zadanie.'})
        job = {'id': uuid.uuid4().hex, 'kind': kind, 'key': key, 'client': w[0], 'project': w[1], 'state': 'queued', 't': time.time()}
        job['out'] = result_path(job)
        if os.path.exists(job['out']):  # ten sam projekt, stan i kadr: zapisany wynik, bez Blendera
            os.utime(job['out'])
            job.update(state='done', cached=True, t1=time.time())
            with lock:
                jobs[job['id']] = job
            return self.send(200, {'id': job['id'], 'state': 'done', 'cached': True})
        if kind == 'render':
            try:
                geo = str(d['geo'])
                cam = d['cam']
                wd, ht = int(d['w']), int(d['h'])
                assert SIG.match(geo) and 16 <= wd <= MAX_PX and 16 <= ht <= MAX_PX
                cam = {'pos': [float(x) for x in cam['pos']][:3], 'target': [float(x) for x in cam['target']][:3], 'fov': float(cam['fov'])}
                mats = [{'c': [float(x) for x in m['c']][:3], 'a': float(m['a']), 'r': float(m['r']), 'm': float(m['m'])} for m in (d.get('mats') or [])][:200]
            except Exception:
                return self.send(400, {'error': 'Nieczytelny opis kadru.'})
            sp = scene_path(w[0], w[1], geo)
            if not os.path.exists(sp):
                return self.send(200, {'need': 'scene', 'geo': geo})
            os.utime(sp)
            job.update(scene=sp, geo=geo, cam=cam, w=wd, h=ht, mats=mats)
        else:
            c = d.get('data')
            if not isinstance(c, dict) or not all(k in c for k in ('ns', 'rmap', 'uv', 'tri', 'X', 'body')):
                return self.send(400, {'error': 'Brakuje danych o częściach ubrania.'})
            job['input'] = os.path.join(owner_dir(w[0], w[1]), 'in-' + job['id'] + '.json')
            with open(job['input'], 'w') as f:
                json.dump(c, f)
        with lock:
            if sum(1 for q in queue if q['state'] == 'queued') >= MAX_QUEUE:
                return self.send(503, {'error': 'Kolejka renderów jest pełna. Spróbuj za chwilę.'})
            now, mine = time.time(), recent[w[0]]
            while mine and now - mine[0] > 3600:
                mine.popleft()
            active = sum(1 for q in jobs.values() if q['client'] == w[0] and q['state'] in ('queued', 'starting', 'running') and not (q['project'] == w[1] and q['kind'] == kind))
            if active >= PER_CLIENT or len(mine) >= PER_HOUR:
                return self.send(429, {'error': 'Masz już dużo zadań w kolejce. Poczekaj na ich wynik.' if active >= PER_CLIENT else 'Limit renderów na godzinę jest wyczerpany. Spróbuj później.'})
            mine.append(now)
            for q in list(jobs.values()):  # nowsze zadanie tego samego rodzaju w tym samym projekcie zastępuje starsze
                if q['client'] == w[0] and q['project'] == w[1] and q['kind'] == kind and q['state'] in ('queued', 'starting', 'running'):
                    q['cancel'] = True
                    if q['state'] == 'queued':
                        q.update(state='cancelled', t1=time.time())
            jobs[job['id']] = job
            queue.append(job)
            lock.notify_all()
        self.send(200, {'id': job['id'], 'state': 'queued'})


def main():
    os.makedirs(DATA, exist_ok=True)
    threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=janitor, daemon=True).start()
    log('Usługa renderująca Wykrojnika na porcie', PORT, '| dane:', DATA, '| Blender:', BLENDER)
    ThreadingHTTPServer(('0.0.0.0', PORT), H).serve_forever()


if __name__ == '__main__':
    main()
