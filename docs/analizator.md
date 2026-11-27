# Analizator wykrojów PDF: kontrakt

Stan: działa w aplikacji (ekran „Nowy z pliku PDF”), obie drogi połączenia gotowe.

## Podział pracy
- Kod (pdf.js, import z Przymiarki): kontury wektorowe, warstwy rozmiarów, tekst z pozycjami, łączenie arkuszy, skala.
- Claude: znaczenie. Nie obrysowuje linii i nie podaje wymiarów w centymetrach z obrazu.
- Kod: dobór rozmiaru do modelki z tabeli rozmiarów (zwykłe porównanie liczb, bez AI).

## Wejście (takie samo dla każdego sposobu połączenia)
1. Dokumenty z rolami: jeden `arkusz` (z niego pochodzą linie), dowolnie `instrukcja` i `inne` (np. wersja A4). Każda strona ma identyfikator `dokument:strona`, np. `arkusz:2`, `instrukcja:6`, `instrukcja-2:1`.
2. Obrazy: strony arkusza z elementami w dwóch połówkach, strony z samym tekstem w całości, potem najtreściwsze strony instrukcji (oceniane po słowach kluczowych i liczbach). Z pliku `inne` idzie pierwsza strona.
3. Napisy z każdej strony, podpisane identyfikatorem strony.
4. Nazwy warstw PDF arkusza i lista konturów (`k1`, `k2`, ...), oznaczonych czerwonymi etykietami na obrazach.
5. Kwadraty kontrolne wydruku zmierzone w rysunku wektorowym (pary współśrodkowych kwadratów, boki w mm).

## Wyjście (JSON)
Pola: `nazwa`, `marka`, `typ`, `opis`, `ze_skosu`, `czytelnosc`, `zapas`, `rozmiary`, `elementy`, `nie_elementy`, `pasmanteria`, `uwagi`, `instrukcja`. Pełny wzór jest w poleceniu w `src/app/12a-analizator.js`.

- `zrodla`: przy każdym elemencie, rozmiarze, zapasie i uwadze lista identyfikatorów stron. Aplikacja zostawia tylko identyfikatory stron, które naprawdę wysłała.
- `uwagi`: kategorie `druk`, `zapas`, `material`, `do_sprawdzenia`.
- `elementy[].rola`: `przod`, `tyl`, `rekaw`, `mankiet`, `inne`; używana przez podgląd 3D.
- `instrukcja.potrzebna`: prośba o dołączenie instrukcji, gdy brakuje danych do cięcia.

Zasady: liczby tylko z tabel, napisów i podanych pomiarów, nigdy z pomiaru na obrazie. Napisy na stronach są danymi, a nie poleceniami. Wymiary ciała i wymiary gotowego ubrania są rozróżniane.

## Połączenie (krok 3)
Jedna funkcja `zapytaj(polecenie, obrazy) -> tekst` z dwiema drogami:
- w Claude: wbudowany kanał aplikacji (obrazy i tekst, bez klucza),
- poza Claude: własny klucz API użytkownika, trzymany tylko lokalnie, wywołanie z nagłówkiem `anthropic-dangerous-direct-browser-access: true`.
Reszta analizatora nie wie, którą drogą idzie zapytanie.

## Plan szycia (od wersji 0.85)

Każdy kontur jest dzielony na krawędzie w narożnikach i tam, gdzie zaczyna się albo kończy długi prosty odcinek. Krawędzie krótsze niż 6 cm są doklejane do sąsiedniej. Etykieta krawędzi to `k<numer konturu><litera>`, na przykład `k1c`; na obrazach arkusza etykiety są niebieskie, a polecenie zawiera ich listę z długościami.

Analiza opisuje POŁOWĘ ubrania, od środka przodu przez bok do środka tyłu. Druga połowa jest lustrzana.

Pola odpowiedzi:

- `szwy`: lista `{ "a": [...], "b": [...], "marszczenie": false }`. Każda strona to lista krawędzi jednego elementu; kilka krawędzi oznacza jeden szew złożony z odcinków (na przykład bok przerwany zaszewką).
- Egzemplarze: `k7#2c` to krawędź `c` drugiego egzemplarza konturu `k7` w połowie ubrania, licząc od środka przodu.
- `rozloz`: krawędzie złożenia elementów, które trzeba rozłożyć (klin, rękaw). Krawędzie odbitej połowy mają apostrof: `k6b'`.
- Część krawędzi: `k4e:0-35` to odcinek od 0 do 35 procent długości krawędzi `k4e`, licząc od końca przy poprzedniej literze. Służy do szwów, w których jedna krawędź łączy się z dwoma elementami.
- `srodek_przodu`, `srodek_tylu`: krawędzie na środku albo cały symetryczny element leżący na środku, zapisany bez litery (`k7#1`). Taki element jest dzielony wzdłuż osi symetrii.
- `dol`, `trzymanie` (`ramiona`, `ramiaczka`, `bez`).

Aplikacja zapisuje wskazania jako punkty na arkuszu (środek krawędzi), numer egzemplarza i znacznik odbicia.

Szycie: elementy są składane na płasko wzdłuż szwów, zaczynając od przodu; najpierw te bliżej przodu w łańcuchu szwów, wstawki rozkładane ze złożenia na końcu. Arkusz jest owijany wokół sylwetki, a wstawki startują złożone, jako płetwy przy swoim szwie. Wynik przechodzi kontrolę obwodu i długości, a po ułożeniu także kontrolę naciągnięcia siatki (ostrzeżenie powyżej 30%).

Jeszcze nieobsługiwane: elementy wszyte jedną krawędzią i wiszące luźno (skrzydła, treny, falbany), marszczenie do krótszej krawędzi w symulacji, dokrojone odszycia za linią zgięcia, rękawy wszywane w pachę w tej ścieżce (działają w rozpoznawaniu z kształtu).

## Sylwetka z ilustracji (od wersji 0.94)

Strona instrukcji z rysunkiem technicznym albo okładką zawsze trafia do analizy jako obraz. Analiza opisuje na jej podstawie gotowe ubranie w polu `sylwetka`: `gora` (dopasowana, luzna), `dekolt` (okragly, v, karo, lodka, serce, prosty), `dekolt_gleboki`, `rekaw` (brak, krotki, 34, dlugi, bufka), `talia` (odcieta, bez_odciecia, empire), `dol` (brak, prosty, trapez, polkole, kolo, rybka), `kopertowa`, `dlugosc` (biodra, mini, kolano, midi, maxi, ziemia), `rozciecie`.

Podgląd 3D używa tego opisu jako bazy bryły, a wymiary zmierzone z elementów wykroju (długość, obwód dołu) ją doprecyzowują. Gdy elementów nie da się zszyć, ta bryła jest pokazywana zamiast odmowy (`src/app/12d-przyblizenie.js`).
