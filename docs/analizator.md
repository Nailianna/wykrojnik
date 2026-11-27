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
