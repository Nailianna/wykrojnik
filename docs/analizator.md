# Analizator wykrojów PDF: kontrakt

Stan: działa w aplikacji (ekran „Nowy z pliku PDF”), obie drogi połączenia gotowe.

## Podział pracy
- Kod (pdf.js, import z Przymiarki): kontury wektorowe, warstwy rozmiarów, tekst z pozycjami, łączenie arkuszy, skala.
- Claude: znaczenie. Nie obrysowuje linii i nie podaje wymiarów w centymetrach z obrazu.
- Kod: dobór rozmiaru do modelki z tabeli rozmiarów (zwykłe porównanie liczb, bez AI).

## Wejście (takie samo dla każdego sposobu połączenia)
1. `strony[]`: obraz każdej strony arkusza, dłuższy bok około 1600 px (dla A0 to około 36 dpi).
2. `tekst[]`: napisy z PDF-a z pozycją (strona, x, y w skali 0-1000). Napisy pisane po łuku wychodzą pocięte, dlatego obraz jest konieczny.
3. `warstwy[]`: nazwy warstw PDF (zwykle rozmiary plus warstwa wspólna).
4. `kontury[]`: kandydaci na elementy z kodu: id, strona, ramka 0-1000, warstwa, czy zamknięty.
5. `instrukcja` (opcjonalnie): tekst osobnego PDF-a z instrukcją szycia.
6. Powiększenia: wycinki 3x dla napisów, których analizator nie odczytał (drugie pytanie, tylko gdy trzeba).

## Wyjście (JSON)
```json
{
  "wykroj": { "nazwa": "", "marka": "", "typ": "sukienka|top|spodnica|gorset|inne", "opis": "", "najblizszy_fason": "su_empire|...|null", "ze_skosu": false },
  "zapas": { "wliczony": true, "cm": 0.7, "wyjatki": [{ "gdzie": "szwy boczne", "cm": 1.3 }], "zrodlo": "arkusz|instrukcja|brak" },
  "rozmiary": [{ "nazwa": "M", "biust": 88, "talia": 68, "biodra": 94, "wzrost": null, "warstwa": "Size M" }],
  "warstwy_wspolne": ["FOR ALL SIZES"],
  "elementy": [{
    "nr": 1, "nazwa": "FRONT BODY", "nazwa_pl": "Przód",
    "tkanina": "glowna|podszewka|inna", "material": "jedwab",
    "ile": 1, "ze_zlozenia": false, "para_lustrzana": false, "pol_elementu_do_odbicia": true,
    "nitka": "prosta|skos|poprzeczna|brak",
    "strony": [1, 2], "ramka": [0, 0, 1000, 1000], "kontury": ["k3", "k9"],
    "krawedzie": [{ "nazwa": "ramię", "strona": 1, "przy": [712, 330] }],
    "znaki": ["zaszewka przód", "linie zakładek 1-5", "zamek kryty 40-50 cm"],
    "uwagi": ""
  }],
  "pasmanteria": ["zamek kryty 40-50 cm"],
  "tkaniny": { "zalecane": [], "zuzycie": [{ "rozmiary": "XS-S", "cm": 265, "szerokosc": 155 }] },
  "niepewne": ["czego analizator nie był pewien i dlaczego"]
}
```
Zasady: liczby tylko z tabel i napisów, nigdy z pomiaru na obrazie. Czego nie widać, to `null` i wpis w `niepewne`. Pozycje w skali 0-1000 strony.

## Połączenie (krok 3)
Jedna funkcja `zapytaj(polecenie, obrazy) -> tekst` z dwiema drogami:
- w Claude: wbudowany kanał aplikacji (obrazy i tekst, bez klucza),
- poza Claude: własny klucz API użytkownika, trzymany tylko lokalnie, wywołanie z nagłówkiem `anthropic-dangerous-direct-browser-access: true`.
Reszta analizatora nie wie, którą drogą idzie zapytanie.
