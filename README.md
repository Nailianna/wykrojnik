# Wykrojnik

Aplikacja do konstruowania wykrojów odzieży z wymiarów: spódnice, sukienki, topy, t-shirty i gorsety. Rysuje wykrój, sprawdza go z wymiarami modelki, pokazuje podgląd 3D na sylwetce i drukuje na kartkach A4 w skali 100%.

Wersja 0.71.0. Aplikacja jest w budowie i żaden wykrój nie został jeszcze sprawdzony szyciem. Przed krojeniem właściwej tkaniny uszyj próbę z surówki.

## Uruchomienie

Aplikacja nie wymaga instalacji ani serwera.

1. Pobierz repozytorium (Code, Download ZIP) i rozpakuj.
2. Otwórz `index.html` w Chrome albo Edge na komputerze.

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
| `tools/check.js` | kontrola spójności wykrojów (`node tools/check.js`) |
| `tools/types.d.ts` | typy wymiarów i parametrów fasonu, używane tylko do sprawdzania kodu |
| `tools/build.sh` | składa `app.js` z części, sprawdza typy i wykroje (`sh tools/build.sh`) |

Zmiany w interfejsie rób w `src/app`, nie w `app.js`, a potem uruchom `sh tools/build.sh`. Nowy parametr fasonu dopisz też w `tools/types.d.ts`.

## Czego ta wersja nie ma

- Inspiracja (dobór fasonu ze zdjęcia) działa tylko po uruchomieniu aplikacji w Claude.
- Instalacja jako aplikacja i zapis projektów do pliku na dysku też wymagają Claude.

## Źródła konstrukcji

Baza „Podręcznik” liczy głębokość pachy, szerokości tyłu i przodu oraz rękaw według wzorów z książki: E. Stark, B. Tymolewska, „Modelowanie form odzieży damskiej”. Baza „Wykrojnik” to własna konstrukcja autorki aplikacji.

Biblioteki i zasoby innych autorów są opisane w pliku `NOTICE.md`.

## Wykroje z PDF

Na pulpicie jest „Nowy z pliku PDF”. Aplikacja czyta z pliku linie, warstwy rozmiarów i napisy, a Claude opisuje ich znaczenie: nazwy elementów, ile wyciąć, nitkę, zapas na szwy i tabelę rozmiarów. Opis formatu jest w `docs/analizator.md`.

W Wykrojniku otwartym w Claude analiza idzie wbudowanym kanałem i nie wymaga klucza. W kopii z tego repozytorium wklejasz własny klucz API Claude w ekranie analizy. Klucz jest zapisywany tylko w pamięci przeglądarki (`localStorage`, wpis `wykrojnik.apikey`), nie trafia do projektów ani kopii zapasowych, a zapytania są rozliczane z konta, do którego należy. Domyślny model to `claude-sonnet-5-5`; inny ustawisz wpisem `wykrojnik.apimodel`. Bez klucza wykrój można wczytać bez analizy.

Repozytorium nie zawiera żadnych wykrojów w PDF ani kluczy, wgrywasz własne.
