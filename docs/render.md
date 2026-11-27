# Render i układanie tkaniny w Blenderze

Wykrojnik pokazuje gotowy obraz z Blendera w tym samym miejscu, w którym jest podgląd 3D. Użytkowniczka niczego nie klika: sekundę po zatrzymaniu widoku przeglądarka zleca render aktualnego kadru, a kolejny gest od razu przywraca zwykły podgląd.

## Jak to jest zbudowane

- `src/app/14a-blender.js`: eksport sceny z podglądu do GLB (z materiałami każdej części), kamera, kolejkowanie po stronie przeglądarki, dwa sposoby połączenia.
- `src/app/14b-model-3d.js`: gotowy model GLB jako wizualizacja referencyjna.
- `server/serwer.py`: usługa renderująca (sama biblioteka standardowa Pythona). Kolejka, stan zadania, limit czasu, zapis wyników, sprzątanie.
- `server/wykrojnik_render.py`: skrypt Blendera. Powstaje z `14a-blender.js` poleceniem `node tools/blender-skrypt.js`, więc aplikacja i serwer używają tego samego.
- `functions/api/render/[[path]].js`: pośrednik na Cloudflare Pages. Strona woła `/api/render/...`, a adres i hasło usługi zostają w ustawieniach strony.

Przeglądarka najpierw pyta `api/render/health`. Jeśli usługa odpowiada, używa jej. Jeśli nie, a Wykrojnik jest zainstalowany jako aplikacja na komputerze z Blenderem, używa lokalnego Blendera. W pozostałych przypadkach zostaje zwykły podgląd i powód w ustawieniach.

## API

Każde żądanie niesie nagłówki `x-wk-client` (losowy identyfikator przeglądarki) i `x-wk-project`. Zadania i wyniki są widoczne tylko dla tej pary. To rozdziela użytkowników, ale nie jest logowaniem.

| Żądanie | Co robi |
|---|---|
| `GET /api/render/health` | czy usługa żyje |
| `PUT /api/render/scenes/{sig}` | przesyła scenę GLB |
| `POST /api/render/jobs` | `{kind:"render", key, geo, w, h, cam}` albo `{kind:"cloth", key, data}`; odpowiedź `{id, state}`, `{need:"scene"}` albo od razu `{state:"done", cached:true}` |
| `GET /api/render/jobs/{id}` | stan: `queued`, `starting`, `running`, `done`, `failed`, `cancelled`, liczba zadań przed nami |
| `GET /api/render/jobs/{id}/result` | obraz PNG albo położenia węzłów tkaniny |
| `DELETE /api/render/jobs/{id}` | anuluje zadanie |

Render zwraca obraz z konkretnej kamery. Układanie tkaniny zwraca geometrię, którą podgląd od razu pokazuje i pozwala obracać. Nowsze zadanie tego samego rodzaju w tym samym projekcie zastępuje starsze. Klucz API Claude'a nie jest tu potrzebny ani przyjmowany.

## Uruchomienie na własnym komputerze

```
docker compose up --build
```

Potem otwórz http://localhost:8080. Kontener serwuje stronę i usługę razem. Analiza PDF przez Claude'a w tym trybie nie działa, bo wymaga funkcji `functions/api/claude.js` z Cloudflare.

Bez Dockera: `pip install bpy`, potem `WK_STATIC=. python3 server/serwer.py`.

## Wdrożenie

1. Postaw kontener z `server/Dockerfile` na serwerze z publicznym adresem HTTPS. Ustawienia są opisane w `server/przyklad.env`. Ustaw własne `WK_TOKEN`.
2. W Cloudflare Pages dodaj zmienne `RENDER_URL` (adres usługi) i `RENDER_TOKEN` (to samo hasło).
3. Wypchnij repozytorium. Strona zacznie używać usługi sama.

Cloudflare Pages nie uruchomi Blendera, potrzebny jest osobny serwer. Bez karty graficznej ustaw `WK_ENGINE=CYCLES` albo licz się z wolnym renderem.

## Testy

- `python3 tools/test-serwera.py`: kolejka, zapis, anulowanie, limit czasu, rozdzielenie użytkowników, na podstawionym Blenderze.
- `node tools/test-funkcji.mjs`: funkcja pośrednicząca do Claude'a.
