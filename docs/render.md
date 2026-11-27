# Render i układanie tkaniny w Blenderze

Wykrojnik pokazuje gotowy obraz z Blendera w tym samym miejscu, w którym jest podgląd 3D. Użytkowniczka niczego nie klika: sekundę po zatrzymaniu widoku przeglądarka zleca render aktualnego kadru, a kolejny gest od razu przywraca zwykły podgląd.

## Jak to jest zbudowane

- `src/app/14a-blender.js`: eksport sceny z podglądu do GLB (z materiałami każdej części), kamera, kolejkowanie po stronie przeglądarki, dwa sposoby połączenia.
- `src/app/14b-model-3d.js`: gotowy model GLB jako wizualizacja referencyjna.
- `server/serwer.py`: usługa renderująca (sama biblioteka standardowa Pythona). Kolejka, stan zadania, limit czasu, zapis wyników, sprzątanie.
- `server/wykrojnik_render.py`: skrypt Blendera. Powstaje z `14a-blender.js` poleceniem `node tools/blender-skrypt.js`, więc aplikacja i serwer używają tego samego.

Przeglądarka najpierw pyta `api/render/health`. Jeśli usługa odpowiada, używa jej. Jeśli nie, a Wykrojnik jest zainstalowany jako aplikacja na komputerze z Blenderem, używa lokalnego Blendera. W pozostałych przypadkach zostaje zwykły podgląd. Etykieta nad podglądem mówi, co widać (bryła z wymiarów, ubranie zszyte z elementów, ułożone w Blenderze albo gotowy model), a po kliknięciu pokazuje stan połączenia i powód niedostępności.

Zmiana samego koloru albo połysku nie przesyła sceny od nowa: zadanie niesie listę materiałów, a Blender podmienia je na wczytanej geometrii.

## API

Każde żądanie niesie nagłówki `x-wk-client` (losowy identyfikator przeglądarki) i `x-wk-project`. Zadania i wyniki są widoczne tylko dla tej pary. To rozdziela użytkowników, ale nie jest logowaniem. Jedna przeglądarka może mieć naraz 6 zadań i 240 na godzinę, a zapytania z obcych stron są odrzucane.

| Żądanie | Co robi |
|---|---|
| `GET /api/render/health` | czy usługa żyje |
| `PUT /api/render/scenes/{sig}` | przesyła scenę GLB |
| `POST /api/render/jobs` | `{kind:"render", key, geo, mats, w, h, cam}` albo `{kind:"cloth", key, data}`; odpowiedź `{id, state}`, `{need:"scene"}` albo od razu `{state:"done", cached:true}` |
| `GET /api/render/jobs/{id}` | stan: `queued`, `starting`, `running`, `done`, `failed`, `cancelled`, liczba zadań przed nami |
| `GET /api/render/jobs/{id}/result` | obraz PNG albo położenia węzłów tkaniny |
| `DELETE /api/render/jobs/{id}` | anuluje zadanie |

Render zwraca obraz z konkretnej kamery. Układanie tkaniny zwraca geometrię, którą podgląd od razu pokazuje i pozwala obracać. Nowsze zadanie tego samego rodzaju w tym samym projekcie zastępuje starsze. Klucz API Claude'a nie jest tu potrzebny ani przyjmowany.

## Silnik renderu

Na serwerze bez karty graficznej usługa używa Cycles (`WK_ENGINE=CYCLES`, 48 próbek z odszumianiem). Zmierzone na 2 rdzeniach: kadr 1036×804 około 8 s, kadr 2000×1552 około 29 s, ułożenie tkaniny 17–36 s. EEVEE bez karty graficznej był w tych samych kadrach kilka do kilkunastu razy wolniejszy. Blender na komputerze z kartą graficzną (aplikacja na Macu) zostaje przy EEVEE.

Po kwadransie bez zadań usługa wyłącza Blendera, żeby nie zajmował pamięci. Następny render startuje wtedy kilkanaście sekund dłużej.

## Uruchomienie i wdrożenie

Jeden kontener serwuje stronę, `/api/claude` i `/api/render`. Na własnym komputerze: `docker compose up --build`, potem http://localhost:8080. Wdrożenie krok po kroku: [wdrozenie.md](wdrozenie.md). Ustawienia (wszystkie opcjonalne): `server/przyklad.env`.

Bez Dockera: `pip install bpy==5.3.0`, potem `WK_STATIC=. WK_ENGINE=CYCLES python3 server/serwer.py`.

## Testy

- `python3 tools/test-serwera.py`: kolejka, zapis, anulowanie, limit czasu, rozdzielenie użytkowników, na podstawionym Blenderze.
- Ten sam plik sprawdza `/api/claude` na podstawionym API: klucz tylko z żądania, dwie osoby naraz, brak klucza w logach i plikach, klucz ze zmiennych środowiskowych nigdy nieużyty.

Furtki do testów w aplikacji (podstawiona analiza, podstawiona aplikacja desktopowa, dostęp do stanu podglądu) działają tylko wtedy, gdy przed wczytaniem strony ustawiono `window.__wkTest = true`. Zwykła strona niczego takiego nie wystawia.
