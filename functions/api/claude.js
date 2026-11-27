// Funkcja serwerowa Wykrojnika (Cloudflare Pages Functions): przekazuje zapytania przeglądarki do API Anthropic.
// Zasady:
// - klucz API przychodzi w nagłówku x-api-key każdego żądania i żyje tylko w zmiennej lokalnej tej jednej obsługi,
// - nie ma klucza właścicielki ani żadnego klucza zapasowego: funkcja nie czyta zmiennych środowiskowych,
// - nic nie jest zapisywane ani logowane (ani klucz, ani treść zapytań),
// - jedyne adresy docelowe to dwa punkty API Anthropic wpisane poniżej.
const API = 'https://api.anthropic.com';
const WERSJA = '2023-06-01';
const LIMIT = 32 * 1024 * 1024; // największe przyjmowane zapytanie w bajtach

const odp = (status, type, message) =>
  new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const kluczZ = (request) => {
  const k = (request.headers.get('x-api-key') || '').trim();
  return /^sk-ant-[A-Za-z0-9_-]{16,300}$/.test(k) ? k : '';
};

// zapytania tylko ze strony, z którą funkcja jest wdrożona
const zTejStrony = (request) => {
  const o = request.headers.get('origin');
  return !o || o === new URL(request.url).origin;
};

export async function onRequest({ request }) {
  if (!zTejStrony(request)) return odp(403, 'forbidden', 'Zapytanie z innej strony.');
  const klucz = kluczZ(request);
  if (!klucz) return odp(401, 'authentication_error', 'Brak klucza API w zapytaniu.');
  const naglowki = { 'x-api-key': klucz, 'anthropic-version': WERSJA };
  let wynik;
  try {
    if (request.method === 'GET') {
      // bezpłatne sprawdzenie klucza: lista modeli
      wynik = await fetch(API + '/v1/models?limit=1', { method: 'GET', headers: naglowki });
    } else if (request.method === 'POST') {
      if (+(request.headers.get('content-length') || 0) > LIMIT) return odp(413, 'request_too_large', 'Zapytanie jest za duże.');
      const tresc = await request.arrayBuffer();
      if (tresc.byteLength > LIMIT) return odp(413, 'request_too_large', 'Zapytanie jest za duże.');
      wynik = await fetch(API + '/v1/messages', { method: 'POST', headers: { ...naglowki, 'content-type': 'application/json' }, body: tresc });
    } else {
      return odp(405, 'method_not_allowed', 'Dozwolone są GET i POST.');
    }
  } catch (e) {
    return odp(502, 'api_error', 'Nie udało się połączyć z API Anthropic.');
  }
  return new Response(wynik.body, {
    status: wynik.status,
    headers: { 'content-type': wynik.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
  });
}
