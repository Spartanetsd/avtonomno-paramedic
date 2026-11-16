// Типи моделі даних «Автономно». Використовуються для перевірки JS через JSDoc (npm run check).

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type Need = 'heat' | 'food' | 'water' | 'energy' | 'cool' | 'hygiene';
export type Place = 'apartment' | 'house' | 'shelter' | 'car' | 'temp';
export type Limit = 'noOutside' | 'noFlame' | 'lowWater' | 'saveCharge' | 'vulnerable' | 'animals';
export type Duration = 'h12' | 'd3' | 'd7' | 'd7plus';
export type Risk = 'info' | 'caution' | 'danger';
export type Mode = '5' | '30' | 'long';
export type PlaceRule = 'ok' | 'caution' | 'danger' | 'na';

export interface Source {
  org: string;
  title: string;
  url: string;
}

export interface Uses {
  /** Літрів води на одне застосування */
  water?: number;
  /** Орієнтовні Вт·год на одне застосування */
  energyWh?: number;
  /** Відкрите полум’я */
  flame?: boolean;
  /** Горіння палива (ризик чадного газу) */
  combustion?: boolean;
  /** Потрібно виходити надвір; 'unlessCar' — якщо людина не в авто */
  outside?: boolean | 'unlessCar';
}

export interface Physics {
  law: 'joule' | 'faraday' | 'carnot' | 'fourier' | 'newton' | 'einstein';
  text: string;
}

export interface Solution {
  id: string;
  need: Need;
  title: string;
  problem: string;
  seasons: Season[];
  /** 1 — без витрат, 2 — дешево, 3 — практично, 4 — автономна система */
  level: 1 | 2 | 3 | 4;
  /** Орієнтовна верхня межа витрат, грн (0 — без витрат) */
  cost: number;
  prepMin: number;
  resultMin: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Внутрішня оцінка ефективності 1–5 для підбору */
  effect: number;
  result: string;
  materials: string[];
  needs: string[];
  needsAny?: string[][];
  uses: Uses;
  places?: Partial<Record<Place, PlaceRule>>;
  risk: Risk;
  steps: string[];
  limits: string[];
  altId: string;
  altText: string;
  physics: Physics;
  sources: string[];
  now: string[];
  tags: string[];
  vulnerableRisk?: string;
}

export interface Myth {
  id: string;
  need: Need;
  myth: true;
  risk: 'danger';
  title: string;
  why: string;
  physics?: string;
  instead: string[];
  sources: string[];
  tags: string[];
}

export interface ReserveItem {
  id: string;
  key?: string;
  name: string;
  cat: string;
  qty: number;
  unit: string;
  ok: boolean;
}

export interface Profile {
  place: Place | null;
  equip: string[];
  limits: Limit[];
  duration: Duration;
  budget: number;
  setupDone: boolean;
  setupDismissed: boolean;
}

export interface DayState {
  power: boolean | null;
  gas: boolean | null;
  tap: boolean | null;
  waterL: number | null;
  batteryPct: number | null;
  roomC: number | null;
  adults: number;
  kids: number;
  elderly: number;
  pets: number;
  petKg: number;
  updated: string | null;
}

export interface Settings {
  /** 'black' — темна тема з чистим чорним тлом (економить заряд на OLED) */
  theme: 'auto' | 'light' | 'dark' | 'black';
  contrast: boolean;
  motion: boolean;
  season: Season | null;
}

/** Режим «Я в укритті». Час — мілісекунди від 1970 р. */
export interface ShelterLog {
  /** Коли ввімкнули режим; null — режим вимкнено */
  since: number | null;
  /** Коли натиснули «Відбій»; поки не null — показуємо кроки після відбою */
  after: number | null;
  /** Скільки разів вчасно сховалися */
  count: number;
  /** Скільки хвилин загалом провели в укритті */
  minutes: number;
  /** Коли завершили востаннє */
  last: number | null;
}

export interface AppData {
  v: number;
  profile: Profile;
  state: DayState;
  reserve: ReserveItem[];
  favs: string[];
  notes: string;
  calc: Record<string, Record<string, any>>;
  settings: Settings;
  /** Позначені пункти тривожної валізки */
  bag: string[];
  /** Коли валізку перевіряли востаннє (мс) */
  bagAt: number | null;
  /** Позначені пункти підготовки укриття */
  prep: string[];
  shelter: ShelterLog;
  /** Особистий план на тривогу: де укриття й де зустрічається родина без зв’язку */
  plan: { shelter: string; meet: string };
}

export interface Ctx {
  season: Season;
  place: Place;
  equip: Set<string>;
  unavailable: Set<string>;
  limits: Set<string>;
  duration: Duration;
  budget: number;
  adults: number;
  kids: number;
  elderly: number;
  n: number;
  vulnerable: boolean;
  pets: number;
  petKg: number;
  power: boolean;
  gas: boolean;
  tap: boolean;
  waterL: number | null;
  batteryPct: number | null;
  roomC: number | null;
  heatSource: boolean;
  burnerAllowed: boolean;
  /** Режим «Я в укритті»: місце — укриття, надвір не можна, температура вдома не враховується */
  alarm: boolean;
}

export interface Alert {
  id: string;
  level: Risk;
  need: Need | 'general';
  title: string;
  text: string;
  action?: string;
  sources: string[];
}

export interface Rec {
  sol: Solution;
  score: number;
  reasons: string[];
  warnings: string[];
  missing: string[];
  costNow: number;
  owned: string[];
}

export interface Blocked {
  sol: Solution | Myth;
  why: string;
}
