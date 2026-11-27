// Pośrednik do usługi renderującej (Cloudflare Pages Functions). Przeglądarka rozmawia tylko z własną stroną,
// a adres i hasło usługi zostają po stronie serwera: RENDER_URL (np. https://render.example.com) i opcjonalnie RENDER_TOKEN.
// Klucz API Claude'a nigdy tędy nie przechodzi: przepuszczane są wyłącznie nagłówki wymienione niżej.
export async function onRequest({ request, env, params }) {
  const json = (code, error) => new Response(JSON.stringify({ error }), { status: code, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (!env.RENDER_URL) return json(503, 'Usługa renderująca nie jest jeszcze podłączona do tej strony.');
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, 'Niedozwolone źródło żądania.');
  const path = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).join('/');
  if (!/^(health|jobs|jobs\/[a-f0-9]{32}(\/result)?|scenes\/[A-Za-z0-9_-]{3,40})$/.test(path)) return json(404, 'Nie znaleziono.');
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) return json(405, 'Niedozwolona metoda.');
  const headers = new Headers();
  for (const h of ['content-type', 'x-wk-client', 'x-wk-project']) { const v = request.headers.get(h); if (v) headers.set(h, v); }
  if (env.RENDER_TOKEN) headers.set('x-wk-token', env.RENDER_TOKEN);
  let up;
  try { up = await fetch(env.RENDER_URL.replace(/\/$/, '') + '/api/render/' + path, { method: request.method, headers, body: request.method === 'POST' || request.method === 'PUT' ? await request.arrayBuffer() : undefined }); }
  catch (e) { return json(502, 'Usługa renderująca nie odpowiada.'); }
  return new Response(up.body, { status: up.status, headers: { 'content-type': up.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' } });
}
