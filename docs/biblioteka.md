# Biblioteka konstrukcji (od wersji 0.97)

Biblioteka to Twoje własne, stopniowane wykroje zapisane tak, żeby dało się je otwierać, przeliczać na modelkę i składać w nowe projekty. Wchodzisz do niej z pulpitu przez „Nowy z biblioteki”.

## Gdzie leżą dane

Aplikacja nie ma żadnej konstrukcji wbudowanej. Bibliotekę wczytujesz z pliku JSON, a ona zostaje w bazie przeglądarki (IndexedDB `wykrojnik-biblioteka`). W aplikacji zainstalowanej na komputerze kopia trafia też do `Dokumenty/Wykrojnik/biblioteka.json` i stamtąd jest czytana przy starcie.

Kupione wykroje są zwykle licencjonowane tylko do własnego użytku. Dlatego plik biblioteki nie należy do tego repozytorium, nie jest częścią opublikowanej strony i nie trafia do żadnego serwera. Kod aplikacji nie zawiera nazw wykrojów.

## Format pliku

```
{ "format": "wykrojnik-biblioteka", "wersja": 1,
  "konstrukcje": [ {
    "id", "nazwa", "typ": "gora" | "spodnica" | "sukienka",
    "rozmiary": ["34", "36", ...],
    "tabela": { "wzrost": [...], "biust": [...], "talia": [...], "biodra": [...] },
    "cechy", "zapas", "zrodlo": { plik źródłowy, suma kontrolna, arkusz },
    "elementy": [ {
      "id", "nazwa", "rola": "F" | "B" | "S" | "C" | "X", "ile", "tryb": "zlozenie" | "para" | ...,
      "stan": "ok" | "do_weryfikacji", "uwagi",
      "idx": numery rozmiarów, dla których obrys udało się odczytać,
      "nE": liczba punktów na każdej krawędzi (między narożnikami),
      "obrysy": po jednym obrysie na odczytany rozmiar, płaska lista x, y w centymetrach,
      "znaki": kreski z arkusza (nitka prosta, nacinki)
    } ] } ] }
```

Każdy rozmiar elementu ma tę samą liczbę punktów na tej samej krawędzi. Dzięki temu rozmiary można mieszać punkt po punkcie.

## Dopasowanie do modelki

Wymiar modelki zamieniam na ułamkowy numer rozmiaru z tabeli konstrukcji (na przykład „między 36 a 38”) i mieszam dwa sąsiednie obrysy. Luz i proporcje fasonu zostają takie, jak zaplanowała je autorka wykroju.

- Przód i tył góry albo sukienki: biust do linii pachy, talia w talii, biodra na wysokości bioder. Każda strefa bierze rozmiar ze swojego wymiaru, najwyżej dwa rozmiary od biustu.
- Spódnica dopasowana w talii: talia u góry, biodra na wysokości bioder. Spódnica na gumie idzie za biodrami.
- Pozostałe elementy idą za wymiarem głównym.

Po każdej zmianie wymiarów modelki elementy są liczone od nowa, a panel pokazuje, czy szwy nadal do siebie pasują (ramię, bok, bok spódnicy, rękaw w pasze).

## Zaszewki i rozpoznanie krawędzi

Zaszewka to wcięcie w obrysie z dwóch prostych, prawie równych ramion. Do porównania szwów i do 3D zamykam ją: część obrysu za zaszewką przesuwa się tak, żeby wylot się zszedł. Na wykroju 2D zaszewka zostaje.

Środek elementu to prosta krawędź równoległa do nitki prostej, najchętniej wspólna dla wszystkich rozmiarów. Od niej liczę resztę: punkt szyi to najwyższy narożnik, za nim szew ramienia, podkrój pachy, bok i dół. Góra bez szwu ramienia jest traktowana jak góra na ramiączkach. W spódnicy szukam talii, boku i dołu.

## Łączenie, podział i wymiana

Projekt z biblioteki ma górę, dół albo jedno i drugie. Górą może być bluzka, top albo sukienka, dołem spódnica albo dół sukienki poniżej linii odcięcia.

Przy łączeniu porównuję obwód góry w linii odcięcia z górną krawędzią dołu. Różnica do 1,5 cm przechodzi sama. Większa wymaga Twojej decyzji:

- zakładki albo marszczenie dołu na szerokość góry,
- zwężenie góry do gotowej talii spódnicy (gdy spódnica ma pasek i własne zakładki),
- zwężenie szerszej części do węższej, bez marszczenia.

Wybór zmienia elementy 2D i ubranie w 3D. Linię odcięcia możesz przesunąć poniżej talii, a dół wydłużyć albo skrócić. Wymiana góry albo dołu zachowuje drugą część i podjętą decyzję.

## Porównanie nowego wykroju z biblioteką

Wczytany wykrój (z pliku) dostaje w panelu „Podobne konstrukcje w bibliotece”. Każdy element porównuję z elementami biblioteki po przebiegu obrysu, niezależnie od obrotu i odbicia. Dostajesz najbliższą bazę, zgodność w procentach i różnicę wymiarów, czyli o ile trzeba bazę wydłużyć albo poszerzyć. Element bez dobrego odpowiednika jest oznaczony jako nowy.

## Czego jeszcze nie ma

- W 3D zszywam górę z jednego przodu i jednego tyłu (z rękawem wszywanym w pachę albo bez) oraz spódnice z osobnego przodu i tyłu. Sukienki z paneli, raglany, kimona i spódnice z klinów widać na razie tylko w 2D.
- Rękaw bez główki (prostokątny, marszczony) nie jest wszywany w 3D.
- Bardzo szeroki dół (koło, głębokie zakładki) ma w 3D prawdziwą objętość, ale fałdy przy dole układają się zbyt grubo.
- Zakładki i marszczenie nie są rysowane na elemencie jako linie złożeń, panel podaje tylko, ile centymetrów trzeba ułożyć.
- Czytnik rozmiarów narysowanych jeden w drugim (`tools/gniazdo.js`), którym powstaje biblioteka, nie jest jeszcze podpięty pod „Nowy z pliku”.
