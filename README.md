# Wykrojnik

Aplikacja do konstruowania wykrojów odzieży z wymiarów: spódnice, sukienki, topy, t-shirty i gorsety. Rysuje wykrój, sprawdza go z wymiarami modelki, pokazuje podgląd 3D na sylwetce i drukuje na kartkach A4 w skali 100%.

Wersja 0.94.1. Aplikacja jest w budowie i żaden wykrój nie został jeszcze sprawdzony szyciem. Przed krojeniem właściwej tkaniny uszyj próbę z surówki.

## Uruchomienie

Do rysowania wykrojów aplikacja nie wymaga instalacji ani serwera.

1. Pobierz repozytorium (Code, Download ZIP) i rozpakuj.
2. Otwórz `index.html` w Chrome albo Edge na komputerze.

Analiza wykrojów z PDF i dobieranie wykroju ze zdjęcia przez Claude'a potrzebują strony uruchomionej razem z serwerem (niżej). Z pliku otwartego prosto z dysku analiza nie działa.

## Publikacja strony

Wszystko wdraża się razem, z jednego repozytorium, jako jeden kontener: strona, pytania do Claude'a kluczem użytkownika (`/api/claude`) i render w Blenderze (`/api/render`). Opis krok po kroku: [docs/wdrozenie.md](docs/wdrozenie.md).

Na własnym komputerze: `docker compose up --build`, potem http://localhost:8080.

Testy bez klucza i bez Blendera: `python3 tools/test-serwera.py`.

Aplikacja jest przeznaczona na komputer. Na telefonie nie była projektowana ani testowana.

## Twoje dane

Projekty i modelki zapisują się wyłącznie w pamięci Twojej przeglądarki, na Twoim komputerze. Repozytorium nie zawiera niczyich projektów, wymiarów ani wykrojów: każda osoba zaczyna z pustą listą i dwiema przykładowymi modelkami.

Wykroje wczytane z własnych plików PDF też zostają tylko u Ciebie. Kupionych wykrojów nie dodawaj do repozytorium, bo ich licencje zwykle pozwalają tylko na użytek własny.

## Co jest w środku

| Plik | Rola |
|---|---|
| `index.html`, `app.js` | interfejs, projekty, podgląd 3D; `app.js` powstaje z części w `src/app` |
| `src/app/*.js` | źródła interfejsu podzielone tematycznie (formularz, projekty, rysunek, druk, 3D, inspiracja, pulpit) |
| `importer.js` | czyta linie, warstwy i napisy z wykroju w PDF, przygotowuje obrazy stron dla analizatora |
| `engine.js` | konstrukcja wykrojów z wymiarów, układ na kartkach, PDF |
| `cloth.js` | zszywanie elementów i układanie tkaniny na sylwetce |
| `figure.js` | siatka sylwetki |
| `prints.js` | wzory tkanin |
| `przymiarka.html` | pracownia importu własnych wykrojów z PDF |
| `server/serwer.py` | serwer: strona, pytania do Claude'a kluczem użytkownika, kolejka renderów |
| `server/wykrojnik_render.py` | skrypt Blendera (powstaje z `src/app/14a-blender.js`) |
| `Dockerfile`, `railway.json`, `docker-compose.yml` | wdrożenie jako jeden kontener |
| `tools/test-serwera.py` | testy serwera na podstawionym Blenderze i podstawionym API |
| `src/app/12c-plan-szycia.js` | zszywanie wczytanego wykroju według szwów wskazanych przez analizę |
| `tools/check.js` | kontrola spójności wykrojów (`node tools/check.js`) |
| `tools/types.d.ts` | typy wymiarów i parametrów fasonu, używane tylko do sprawdzania kodu |
| `tools/build.sh` | składa `app.js` z części, sprawdza typy i wykroje (`sh tools/build.sh`) |

Zmiany w interfejsie rób w `src/app`, nie w `app.js`, a potem uruchom `sh tools/build.sh`. Nowy parametr fasonu dopisz też w `tools/types.d.ts`.

## Czego ta wersja nie ma

- Inspiracja (dobór fasonu ze zdjęcia) działa tylko po uruchomieniu aplikacji w Claude; własny klucz jej jeszcze nie obsługuje.
- Instalacja jako aplikacja i zapis projektów do pliku na dysku też wymagają Claude.

## Źródła konstrukcji

Baza „Podręcznik” liczy głębokość pachy, szerokości tyłu i przodu oraz rękaw według wzorów z książki: E. Stark, B. Tymolewska, „Modelowanie form odzieży damskiej”. Baza „Wykrojnik” to własna konstrukcja autorki aplikacji.

Biblioteki i zasoby innych autorów są opisane w pliku `NOTICE.md`.

## Wykroje z PDF

Na pulpicie jest „Nowy z pliku PDF”. Aplikacja czyta z pliku linie, warstwy rozmiarów i napisy, a Claude opisuje ich znaczenie: nazwy elementów, ile wyciąć, nitkę, zapas na szwy i tabelę rozmiarów. Opis formatu jest w `docs/analizator.md`.

W Wykrojniku otwartym w Claude analiza idzie wbudowanym kanałem i nie wymaga klucza. Na stronie opublikowanej z tego repozytorium każda osoba podłącza własny klucz API Anthropic („Podłącz Claude” na ekranie analizy) i sama płaci za swoje analizy. Bez klucza wykrój można wczytać bez analizy, a reszta aplikacji działa od razu.

Jak obchodzimy się z kluczem:

- klucz żyje tylko w pamięci otwartej karty; odświeżenie albo zamknięcie karty go usuwa, „Odłącz klucz” usuwa go od razu,
- nie trafia do `localStorage`, cookies, projektów, kopii zapasowych ani adresów,
- każde zapytanie niesie go w nagłówku do serwera Wykrojnika (`/api/claude` w `server/serwer.py`), który przekazuje zapytanie do API Anthropic i niczego nie zapisuje ani nie loguje,
- w projekcie nie ma klucza właścicielki ani klucza zapasowego; serwer nie czyta klucza ze zmiennych środowiskowych.

Domyślny model to `claude-sonnet-5-5`; inny ustawisz wpisem `wykrojnik.apimodel` w pamięci przeglądarki.

Podgląd 3D wczytanego wykroju powstaje na dwa sposoby. Kroje rozpoznawane z samego kształtu (przód i tył z wszywanym rękawem, rękaw skrojony razem z przodem i tyłem, góra na ramiączkach) zszywa `src/app/12b-szycie-importu.js`. Pozostałe są szyte według szwów wskazanych przez analizę (`src/app/12c-plan-szycia.js`, opis w `docs/analizator.md`). Elementy wiszące luzem i dokrojone odszycia jeszcze nie działają.

Repozytorium nie zawiera żadnych wykrojów w PDF ani kluczy, wgrywasz własne.

## Render w Blenderze

Podgląd 3D sam dostaje gotowy obraz z Blendera: z usługi renderującej na serwerze (zwykła przeglądarka, bez instalowania czegokolwiek) albo z Blendera na komputerze, gdy Wykrojnik jest zainstalowany jako aplikacja. Gdy ubranie jest zszyte z elementów wykroju, Blender układa też tkaninę z płaskich części. Gotowy plik GLB można wgrać jako wizualizację referencyjną. Render nie korzysta z klucza API. Opis, API i wdrożenie: [docs/render.md](docs/render.md).
