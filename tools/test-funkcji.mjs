// Test funkcji serwerowej na podstawionym API Anthropic (bez prawdziwego klucza): node tools/test-funkcji.mjs
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/claude.js';

const KA = 'sk-ant-' + 'a'.repeat(40), KB = 'sk-ant-' + 'b'.repeat(40), ZLY = 'sk-ant-' + 'z'.repeat(40);
process.env.ANTHROPIC_API_KEY = 'sk-ant-' + 'w'.repeat(40); // klucz „właścicielki” w środowisku: funkcja nie może go użyć
const wyslane = [];
globalThis.fetch = async (url, init) => {
  const klucz = init.headers['x-api-key'];
  wyslane.push({ url: String(url), klucz, metoda: init.method });
  await new Promise((r) => setTimeout(r, klucz === KA ? 60 : 10)); // odpowiedź dla A wraca później niż dla B
  if (klucz === ZLY) return new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ kto: klucz === KA ? 'A' : 'B', content: [{ type: 'text', text: '{}' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const zap = (metoda, klucz, extra = {}) => onRequest({ request: new Request('https://wykrojnik.example/api/claude', { method: metoda, headers: { ...(klucz ? { 'x-api-key': klucz } : {}), ...(metoda === 'POST' ? { 'content-type': 'application/json' } : {}), ...extra }, body: metoda === 'POST' ? JSON.stringify({ model: 'm', messages: [] }) : undefined }) });

// 1. brak klucza: odmowa bez wywołania API i bez sięgania po klucz ze środowiska
let r = await zap('POST', '');
assert.equal(r.status, 401); assert.equal(wyslane.length, 0);
// 2. błędny klucz: odpowiedź API przekazana bez zmian
r = await zap('GET', ZLY); assert.equal(r.status, 401); assert.equal((await r.json()).error.type, 'authentication_error');
// 3. dwie osoby jednocześnie: każda dostaje odpowiedź na własny klucz
wyslane.length = 0;
const [ra, rb] = await Promise.all([zap('POST', KA), zap('POST', KB)]);
assert.equal((await ra.json()).kto, 'A'); assert.equal((await rb.json()).kto, 'B');
assert.deepEqual(wyslane.map((w) => w.klucz).sort(), [KA, KB].sort());
// 4. tylko dwa adresy docelowe, nigdy klucz ze środowiska
r = await zap('GET', KA);
assert.ok(wyslane.every((w) => w.url === 'https://api.anthropic.com/v1/messages' || w.url === 'https://api.anthropic.com/v1/models?limit=1'));
assert.ok(wyslane.every((w) => w.klucz !== process.env.ANTHROPIC_API_KEY));
// 5. zapytanie z innej strony i inna metoda
r = await zap('POST', KA, { origin: 'https://inna.example' }); assert.equal(r.status, 403);
r = await onRequest({ request: new Request('https://wykrojnik.example/api/claude', { method: 'DELETE', headers: { 'x-api-key': KA } }) }); assert.equal(r.status, 405);
// 6. klucz nie wraca w odpowiedzi ani w nagłówkach
r = await zap('POST', KB); const cialo = await r.text(); assert.ok(!cialo.includes(KB)); assert.ok(![...r.headers.values()].some((v) => v.includes(KB)));
console.log('funkcja serwerowa: 6 testów, wszystko w porządku');
