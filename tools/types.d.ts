// Wykrojnik: wspólne typy. Plik służy tylko do sprawdzania kodu (tools/build.sh), przeglądarka go nie ładuje.

/** Wymiary modelki w cm. */
interface WMeas {
  id?: string; name?: string;
  og?: number; ot?: number; ob?: number; wb?: number; wzrost?: number; opx?: number;
  /** wymiary dodatkowe wpisane ręcznie, nadpisują wyliczone */
  adv?: { [k: string]: any };
}

/** Dodatek opisowy: prostokąt liczony z wymiaru wykroju. */
interface WExtra { name: string; base: string; k: number; plus: number; w: number; n: number; note?: string; }

/** Parametry fasonu. Nowy parametr trzeba dopisać tutaj, inaczej sprawdzanie zgłosi błąd. */
interface WParams {
  // długości
  dl?: number; kn?: number; tren?: number; rozp?: number; rekL?: number;
  /** ile cm nad talią kończy się krótki top; ustawia silnik */
  crop?: number;
  // spódnica
  /** dół z koła w empire i princesce: '' (własny), 'polkole', 'kolo', 'kolo2' */
  dol?: string;
  gf?: number; flare?: number; ff?: number; pasek?: number; pasT?: number; zakK?: number; bok?: number;
  // góra
  gora?: string; bk?: string; bh?: number; gr?: number; gh?: number; gd?: number; gg?: number; gp?: number;
  ram?: string; ramW?: number; rek?: string; mank?: boolean; kol?: string; kolW?: number; kop?: boolean;
  falN?: boolean; falR?: boolean; marsz?: boolean; sciag?: boolean;
  // dekolt
  nk?: string; nkb?: string; nd?: number; nw?: number; nb?: number;
  // luzy i zapasy
  luzG?: number; luzB?: number; luzT?: number; saSzew?: number; saTalia?: number; saDol?: number;
  // wykończenie i zapięcie
  fac?: string; facW?: number; zp?: string;
  // konstrukcja
  baza?: string; fit?: string; knit?: boolean; knitStraight?: boolean;
  // dodatki i warstwy
  extras?: WExtra[]; layers?: any[]; fabName?: string;
}

/** Element rysunku wykroju. */
type WPrim = { t: string; [k: string]: any };

interface Window {
  Wykroj: any; WykrojPrints: any; WYKROJ_FIG: any; WYKROJ_FONT: any; Cloth: any; PatImport: any; THREE: any; jspdf: any;
  claude: any; __noSelf?: boolean;
  /** podstawiona odpowiedź analizatora, tylko do testów */
  __anFake?: (prompt: string, images: Blob[]) => any;
  __sw?: any;
}
declare const claude: any;

// przeglądarka przyjmuje tu liczby i wartości logiczne, a elementy wybierane selektorem są zwykłymi elementami HTML
interface Element { dataset: DOMStringMap; hidden: boolean; checked: boolean; setAttribute(name: string, value: string | number | boolean): void; }
interface EventTarget { tagName?: string; type?: string; id?: string; blur?: () => void; }
interface HTMLCanvasElement { _id?: any; }
