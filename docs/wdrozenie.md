# Wdrożenie Wykrojnika jako publicznej strony

Cały Wykrojnik działa w jednym kontenerze: strona, pytania do Claude'a kluczem użytkownika i render w Blenderze. Nie ma tu żadnego klucza API do ustawienia. Każdy użytkownik wpisuje własny klucz w przeglądarce.

Poniżej droga przez Railway, bo nie wymaga terminala: łączy się z GitHubem, sam buduje kontener z pliku `Dockerfile` i sam publikuje każdą zmianę wypchniętą do `main`. Każda inna usługa, która uruchamia kontener z repozytorium, zadziała tak samo.

## Koszt do akceptacji

Plan Hobby w Railway: 5 USD miesięcznie, w tym 5 USD zużycia. Zużycie liczy się co sekundę z pamięci i procesora. Gdy nikt nie renderuje, usługa wyłącza Blendera i zajmuje kilkadziesiąt megabajtów, więc przy okazjonalnym użyciu rachunek powinien zostać przy 5 USD. Darmowy okres próbny ma za mało pamięci na Blendera.

## Kroki

1. Wejdź na railway.com i załóż konto przez „Login with GitHub”.
2. Wybierz plan Hobby i podaj kartę.
3. New Project, potem „Deploy from GitHub repo”. Przy pierwszym razie Railway poprosi o dostęp do repozytoriów: wskaż `wykrojnik`.
4. Wybierz repozytorium `wykrojnik` i „Deploy Now”. Railway znajdzie `Dockerfile` i zacznie budować. Pierwsze budowanie trwa kilka do kilkunastu minut, bo pobiera Blendera.
5. Gdy status zmieni się na aktywny, otwórz usługę, zakładka Settings, sekcja Networking, „Generate Domain”. Dostaniesz adres w rodzaju `wykrojnik-production.up.railway.app`.
6. Otwórz ten adres. To jest publiczny Wykrojnik.

Zmiennych środowiskowych nie trzeba ustawiać. Lista opcjonalnych jest w `server/przyklad.env`.

## Pierwszy test

1. Na pulpicie wybierz „Nowy projekt”, potem fason, potem podgląd 3D. Nad podglądem pojawi się etykieta. Po sekundzie bez ruchu zobaczysz „Dopracowywanie podglądu…”, a potem „Obraz jest dopracowany.” Pierwszy render po przerwie trwa kilkanaście sekund dłużej, bo Blender się uruchamia.
2. Kliknij etykietę. Powinno być „Render wysokiej jakości jest podłączony.”
3. „Nowy z pliku PDF”, „Podłącz Claude”, wklej własny klucz. Analiza ruszy dopiero po kliknięciu „Analizuj wykrój”.

## Gdy coś nie działa

- Budowanie się nie powiodło: w Railway otwórz nieudane wdrożenie, zakładka Build Logs, i skopiuj ostatnie 30 linii.
- Strona działa, ale etykieta mówi, że render jest niedostępny: zakładka Deploy Logs, ostatnie 30 linii.

## Ograniczenie wydatków

W ustawieniach zużycia konta Railway ustaw twardy limit miesięczny, na przykład 10 USD. Usługa sama ogranicza jedną przeglądarkę do 6 zadań naraz i 240 na godzinę.
