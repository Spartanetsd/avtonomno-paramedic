// @ts-check
// Робочі калькулятори. Без DOM. Точні фізичні розрахунки відокремлено від орієнтовних оцінок.

/** Питома теплоємність води, Дж/(кг·К) */
export const C_WATER = 4186;
/** Питома теплота пароутворення води, Дж/кг (≈100 °C) */
export const L_VAPOR = 2.257e6;

/**
 * Перетворює рядок/число на скінченне число (кома як десятковий роздільник).
 * Порожнє, «∞», «1e999» і будь-яке сміття → NaN.
 * @param {unknown} v
 */
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim().replace(/[\s\u00A0\u202F]+/g, '').replace(',', '.');
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Частка від 0 до 1. Людина може ввести й відсотки: 85 → 0,85.
 * @param {unknown} v
 */
export function ratio(v) {
  const n = num(v);
  return n > 1 && n <= 100 ? n / 100 : n;
}

/**
 * Слово «доба» після числа: 1 доба, 2 доби, 5 діб, 2,5 доби.
 * @param {number} n
 * @param {boolean} [acc] знахідний відмінок: «на 1 добу»
 */
export function dayWord(n, acc = false) {
  if (!Number.isInteger(n)) return 'доби';
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 'діб';
  if (b === 1) return acc ? 'добу' : 'доба';
  if (b >= 2 && b <= 4) return 'доби';
  return 'діб';
}

/**
 * Кількість діб з одним знаком після коми й правильним словом.
 * @param {number} n @param {boolean} [acc]
 */
export function daysText(n, acc = false) {
  if (!Number.isFinite(n)) return '∞';
  const r = Math.round(n * 10) / 10;
  return `${fmt(r, 1)} ${dayWord(r, acc)}`;
}

/** Пресети коефіцієнта корисного використання енергії акумулятора */
export const K_PRESETS = [
  { id: 'pb', label: 'Павербанк (перетворення до 5 В)', k: 0.7 },
  { id: 'inv', label: 'Станція через інвертор 230 В', k: 0.85 },
  { id: 'dc', label: 'Станція, виходи USB / 12 В', k: 0.9 },
  { id: 'lfp', label: 'Акумулятор LiFePO4 12 В напряму', k: 0.9 },
  { id: 'car', label: 'Стартерний акумулятор авто (не більше)', k: 0.3 },
];

/**
 * Калькулятор автономності акумулятора.
 * @param {{voltage?:unknown, capacity:unknown, unit:'mAh'|'Ah'|'Wh', loadW:unknown, k:unknown, maxW?:unknown}} p
 */
export function battery(p) {
  const v = num(p.voltage), c = num(p.capacity), load = num(p.loadW), k = ratio(p.k);
  const maxRaw = p.maxW == null || p.maxW === '' ? NaN : num(p.maxW);
  /** @type {string[]} */
  const errors = [];
  if (p.unit !== 'Wh' && !(v > 0 && v <= 1000)) errors.push('Вкажіть напругу від 0 до 1000 В.');
  if (!(c > 0)) errors.push('Вкажіть ємність більшу за 0.');
  if (!(load > 0)) errors.push('Вкажіть потужність навантаження більшу за 0 Вт.');
  if (!(k >= 0.05 && k <= 1)) errors.push('Коефіцієнт використання — від 0,05 до 1 (або від 5 до 100 %).');
  if (!Number.isNaN(maxRaw) && !(maxRaw > 0)) errors.push('Потужність виходу має бути більшою за 0 Вт або порожньою.');
  if (errors.length) return { ok: false, errors };

  const nominalWh = p.unit === 'Wh' ? c : p.unit === 'Ah' ? v * c : (v * c) / 1000;
  const usableWh = nominalWh * k;
  const hours = usableWh / load;
  /** @type {{level:'info'|'caution'|'danger', text:string}[]} */
  const warnings = [];
  if (!Number.isNaN(maxRaw)) {
    if (load > maxRaw) warnings.push({ level: 'danger', text: `Навантаження ${fmt(load)} Вт більше за потужність виходу ${fmt(maxRaw)} Вт: прилад не запуститься або спрацює захист. Потужність виходу і запас енергії — різні речі.` });
    else if (load > 0.8 * maxRaw) warnings.push({ level: 'caution', text: 'Навантаження понад 80 % від потужності виходу: можливий нагрів і спрацювання захисту, особливо для приладів із пусковим струмом.' });
  }
  if (k > 0.95) warnings.push({ level: 'info', text: 'Коефіцієнт понад 0,95 на практиці майже недосяжний: перетворювачі, кабелі й сам акумулятор мають утрати.' });
  if (p.unit === 'mAh' && v > 5) warnings.push({ level: 'info', text: 'Ємність павербанків у мА·год зазвичай указують за напругою елементів 3,6–3,7 В, а не 5 В.' });
  if (p.unit !== 'Wh' && v >= 11 && v <= 13 && k > 0.5) warnings.push({ level: 'info', text: 'Якщо це стартерний акумулятор авто — розраховуйте не більше 30 % ємності, щоб зберегти можливість запуску.' });

  const unitLabel = p.unit === 'mAh' ? 'мА·год' : 'А·год';
  const steps = [
    p.unit === 'Wh'
      ? `Номінальний запас: ${fmt(nominalWh)} Вт·год`
      : `Номінальний запас: ${fmt(v)} В × ${fmt(c)} ${unitLabel}${p.unit === 'mAh' ? ' ÷ 1000' : ''} = ${fmt(nominalWh)} Вт·год`,
    `Доступно з урахуванням втрат: ${fmt(nominalWh)} × ${fmt(k)} = ${fmt(usableWh)} Вт·год`,
    `Час роботи: ${fmt(usableWh)} Вт·год ÷ ${fmt(load)} Вт = ${fmt(hours)} год`,
  ];
  return { ok: true, nominalWh, usableWh, lossWh: nominalWh - usableWh, hours, warnings, steps };
}

/**
 * Тепловтрати посудини в повітря, Вт/К (закон охолодження Ньютона).
 * Оцінка: посудина з кришкою, висота ≈ діаметр, коефіцієнт тепловіддачі ≈10 Вт/(м²·К)
 * (природна конвекція й випромінювання). 1 л ≈ 0,55 Вт/К, 5 л ≈ 1,6 Вт/К.
 */
export const HEAT_LOSS_H = 10;
/** Запас, °C: ціль вважаємо досяжною, лише коли найвища температура вища за неї хоча б на стільки */
export const REACH_MARGIN = 0.5;
/** @param {number} liters */
export function lossCoeff(liters) {
  const r = Math.cbrt(liters / 1000 / (2 * Math.PI));
  return HEAT_LOSS_H * 6 * Math.PI * r * r;
}

/**
 * Калькулятор нагрівання води.
 * Точно: мінімальна енергія Q = c·m·ΔT. Орієнтовно: час із ККД і тепловтратами посудини
 * (вода спершу має температуру повітря). Малої потужності може не вистачити взагалі.
 * @param {{liters:unknown, t0:unknown, t1:unknown, powerW:unknown, eff:unknown, inverter?:boolean, maxW?:unknown}} p
 */
export function waterHeat(p) {
  const l = num(p.liters), t0 = num(p.t0), t1 = num(p.t1), w = num(p.powerW), eff = ratio(p.eff);
  const maxRaw = p.maxW == null || p.maxW === '' ? NaN : num(p.maxW);
  /** @type {string[]} */
  const errors = [];
  if (!(l > 0 && l <= 500)) errors.push('Об’єм води — від 0 до 500 л.');
  if (!(t0 >= 0 && t0 < 100)) errors.push('Початкова температура — від 0 до 99 °C (лід цей розрахунок не враховує).');
  if (!(t1 > 0 && t1 <= 100)) errors.push('Бажана температура — до 100 °C.');
  if (t0 >= 0 && t1 > 0 && t1 <= t0) errors.push('Бажана має бути вищою за початкову.');
  if (!(w > 0 && w <= 20000)) errors.push('Потужність нагрівача — від 0 до 20 000 Вт.');
  if (!(eff >= 0.1 && eff <= 1)) errors.push('ККД — від 0,1 до 1 (або від 10 до 100 %).');
  if (p.maxW != null && p.maxW !== '' && !(maxRaw > 0)) errors.push('Вихід станції — число більше за 0 Вт або порожнє поле.');
  if (errors.length) return { ok: false, errors };

  const dT = t1 - t0;
  const qJ = l * C_WATER * dT; // маса ≈ об’єм для води
  const qWh = qJ / 3600;
  const minSourceWh = qWh / eff;
  const minutesNoLoss = (minSourceWh / w) * 60;
  const pIn = w * eff; // скільки ватів доходить до води
  const k = lossCoeff(l); // Вт/К
  const tau = (l * C_WATER) / k; // с
  const tMax = t0 + pIn / k; // температура, на якій нагрів = втратам
  // Запас 0,5 °C: біля самої межі нагрів тягнувся б нескінченно довго
  const reachable = tMax > t1 + REACH_MARGIN;
  const minPowerW = (k * (dT + REACH_MARGIN)) / eff; // з меншою потужністю бажаної температури не досягти
  const needW = Math.floor(minPowerW) + 1; // найменша ціла потужність, з якою вже нагріє
  // Скільки потрібно, щоб нагріти за 30 хв з урахуванням тепловтрат
  const e30 = Math.exp(1800 / tau);
  const power30W = (k * e30 * dT) / (e30 - 1) / eff;
  const minutes = reachable ? (tau * Math.log((tMax - t0) / (tMax - t1))) / 60 : Infinity;
  const sourceWh = reachable ? (w * minutes) / 60 : Infinity;
  const batteryWh = p.inverter ? sourceWh / 0.85 : sourceWh;
  const lossShare = reachable ? 1 - minutesNoLoss / minutes : 1;

  /** @type {{level:'info'|'caution'|'danger', text:string}[]} */
  const warnings = [];
  if (!reachable) {
    warnings.push({ level: 'danger', text: `З потужністю ${fmt(w)} Вт вода не нагріється вище ≈${fmt(Math.min(tMax, 100), 0)} °C: на цій температурі все тепло нагрівача йде в повітря. Потрібно щонайменше ${fmt(needW)} Вт, а щоб нагріти за 30 хв — близько ${fmt(power30W, 0)} Вт.` });
  } else {
    if (lossShare > 0.15) warnings.push({ level: 'caution', text: `Тепловтрати помітні: через них нагрів триває на ${fmt(lossShare * 100, 0)} % довше. Накрийте посудину кришкою й обгорніть її рушником — так тепло не тікатиме в повітря.` });
    if (minutes > 24 * 60) warnings.push({ level: 'caution', text: 'Понад добу нагріву — практично це не робочий спосіб. Шукайте потужніше джерело тепла або менший об’єм.' });
  }
  if (t1 >= 100) warnings.push({ level: 'info', text: `Кип’ятіння понад сам нагрів витрачає енергію на пароутворення: ≈${fmt(L_VAPOR / 3600)} Вт·год на кожен випаруваний літр. Кришка зменшує ці втрати.` });
  if (!Number.isNaN(maxRaw) && w > maxRaw) warnings.push({ level: 'danger', text: `Нагрівач ${fmt(w)} Вт потужніший за вихід ${fmt(maxRaw)} Вт — не запуститься або спрацює захист.` });
  if (reachable) warnings.push({ level: 'info', text: 'Час орієнтовний: посуд і нагрівач теж забирають тепло, а реальна потужність приладу буває нижчою за паспортну.' });

  const steps = [
    `Точно (фізика): Q = c·m·ΔT = ${fmt(C_WATER)} Дж/(кг·°C) × ${fmt(l)} кг × ${fmt(dT)} °C = ${fmt(qJ / 1000)} кДж = ${fmt(qWh)} Вт·год`,
    `До води доходить: ${fmt(w)} Вт × ККД ${fmt(eff)} = ${fmt(pIn)} Вт`,
    `Тепловтрати посудини (закон охолодження Ньютона, оцінка з кришкою): ≈${fmt(k)} Вт на кожен градус різниці з повітрям`,
    reachable
      ? `Найвища можлива температура: ${fmt(t0)} + ${fmt(pIn)} ÷ ${fmt(k)} ≈ ${fmt(tMax, 0)} °C — бажані ${fmt(t1)} °C досяжні`
      : `Найвища можлива температура: ${fmt(t0)} + ${fmt(pIn)} ÷ ${fmt(k)} ≈ ${fmt(tMax, 0)} °C — нижче бажаних ${fmt(t1)} °C`,
    reachable
      ? `Час із тепловтратами: ≈${fmtHours(minutes / 60)} (без утрат було б ${fmtHours(minutesNoLoss / 60)})`
      : `Мінімальна потужність: ${fmt(k)} × (${fmt(dT)} + ${fmt(REACH_MARGIN)}) ÷ ${fmt(eff)} ≈ ${fmt(minPowerW)} Вт — тобто від ${fmt(needW)} Вт`,
    reachable ? `Енергія від джерела: ${fmt(w)} Вт × час = ${fmt(sourceWh)} Вт·год` : 'Енергію не пораховано: з такою потужністю нагрів не завершиться',
    p.inverter && reachable ? `Через інвертор станції (ККД ≈0,85): ${fmt(sourceWh)} ÷ 0,85 = ${fmt(batteryWh)} Вт·год з акумулятора` : 'Без інвертора: споживання з джерела дорівнює попередньому рядку',
  ];
  return { ok: true, qJ, qWh, minSourceWh, sourceWh, batteryWh, minutes, minutesNoLoss, reachable, tMax, minPowerW, needW, power30W, k, warnings, steps };
}

/** Пресети норм води, л на людину на добу */
export const WATER_PRESETS = [
  { id: 'min', label: 'Мінімум', note: '≈3,8 л: пиття та мінімальна санітарія (Ready.gov)', drink: 2.8, cook: 0, hygiene: 1 },
  { id: 'basic', label: 'Базовий', note: '7,5 л: нижня межа базових потреб Sphere', drink: 2.5, cook: 3, hygiene: 2 },
  { id: 'std', label: 'Стандарт', note: '15 л: мінімальний стандарт Sphere для домогосподарства', drink: 3, cook: 6, hygiene: 6 },
];

/** Орієнтовна потреба тварин, л на кг маси на добу (загальне ветеринарне правило 50–60 мл/кг). */
export const PET_L_PER_KG = 0.06;

/**
 * Калькулятор водних запасів.
 * @param {{adults:unknown, kids:unknown, elderly:unknown, days:unknown, drink:unknown, cook:unknown, hygiene:unknown, petKg?:unknown, hot?:boolean, haveL?:unknown}} p
 */
export function waterNeeds(p) {
  const cnt = (/** @type {unknown} */ x) => (x == null || String(x).trim() === '' ? 0 : num(x));
  const a = cnt(p.adults), kd = cnt(p.kids), e = cnt(p.elderly);
  const days = num(p.days), drink = num(p.drink), cook = num(p.cook), hyg = num(p.hygiene);
  const petKg = p.petKg == null || p.petKg === '' ? 0 : num(p.petKg);
  const have = p.haveL == null || p.haveL === '' ? NaN : num(p.haveL);
  /** @type {string[]} */
  const errors = [];
  const people = a + kd + e;
  if ([a, kd, e].some((x) => !(x >= 0 && x <= 1000) || !Number.isInteger(x))) errors.push('Кількість людей — цілі числа від 0.');
  if (!(days >= 0.5 && days <= 365)) errors.push('Кількість діб — від 0,5 до 365.');
  if (!(drink >= 0 && drink <= 20) || !(cook >= 0 && cook <= 50) || !(hyg >= 0 && hyg <= 100)) errors.push('Перевірте норми на людину: пиття 0–20, їжа 0–50, гігієна 0–100 л.');
  if (!(petKg >= 0 && petKg <= 500)) errors.push('Маса тварин — від 0 до 500 кг.');
  if (people === 0 && !(petKg > 0)) errors.push('Додайте хоча б одну людину або тварину.');
  if (!Number.isNaN(have) && !(have >= 0)) errors.push('Наявний запас — число від 0.');
  if (errors.length) return { ok: false, errors };

  const heat = p.hot ? 2 : 1;
  const drinkEff = drink * heat;
  const perPerson = drinkEff + cook + hyg;
  const peopleDaily = people * perPerson;
  const petsDaily = petKg * PET_L_PER_KG * (p.hot ? 1.5 : 1);
  const daily = peopleDaily + petsDaily;
  const total = daily * days;
  const drinkingOnly = (people * drinkEff + petsDaily) * days;
  const daysCovered = !Number.isNaN(have) && daily > 0 ? have / daily : null;
  const drinkDaysCovered = !Number.isNaN(have) && (people * drinkEff + petsDaily) > 0 ? have / (people * drinkEff + petsDaily) : null;

  const steps = [
    `На людину на добу: пиття ${fmt(drinkEff)}${p.hot ? ` (×2 у спеку)` : ''} + їжа ${fmt(cook)} + гігієна ${fmt(hyg)} = ${fmt(perPerson)} л`,
    `Люди: ${people} × ${fmt(perPerson)} = ${fmt(peopleDaily)} л на добу`,
    petKg > 0 ? `Тварини: ${fmt(petKg)} кг × ${fmt(PET_L_PER_KG * (p.hot ? 1.5 : 1))} л/кг = ${fmt(petsDaily)} л на добу` : 'Тварин не враховано',
    `Разом: ${fmt(daily)} л × ${daysText(days)} = ${fmt(total)} л`,
  ];
  const increases = [
    'спека (потреба в питті може подвоїтися — Ready.gov)',
    'вагітність і годування груддю',
    'хвороба, температура, діарея',
    'фізична робота',
    'солона їжа',
  ];
  return { ok: true, people, perPerson, daily, total, drinkingOnly, petsDaily, daysCovered, drinkDaysCovered, steps, increases };
}

/** Категорії пріоритетів енергії (за промптом) */
export const ENERGY_CATS = [
  { id: 1, label: 'Критично необхідне' },
  { id: 2, label: 'Освітлення' },
  { id: 3, label: 'Зв’язок' },
  { id: 4, label: 'Приготування їжі' },
  { id: 5, label: 'Інше' },
];

/** Типові пристрої для швидкого додавання (орієнтовні значення). */
export const DEVICE_PRESETS = [
  { name: 'Телефон (заряджання)', watts: 10, hours: 1.5, cat: 3 },
  { name: 'Wi‑Fi роутер', watts: 10, hours: 12, cat: 3 },
  { name: 'LED-лампа', watts: 5, hours: 5, cat: 2 },
  { name: 'Налобний ліхтар (заряджання)', watts: 5, hours: 1, cat: 2 },
  { name: 'Ноутбук', watts: 45, hours: 3, cat: 5 },
  { name: 'Чайник (1 л окропу)', watts: 2000, hours: 0.06, cat: 4 },
  { name: 'USB-вентилятор', watts: 4, hours: 8, cat: 5 },
  { name: 'Електроковдра', watts: 60, hours: 4, cat: 1 },
  { name: 'Медичний пристрій', watts: 50, hours: 8, cat: 1, medical: true },
];

/**
 * Розподіл енергії за пріоритетами.
 * @param {{availableWh:unknown, days:unknown, devices:{name:string, watts:unknown, hours:unknown, cat:number, medical?:boolean}[]}} p
 */
export function energyPlan(p) {
  const avail = num(p.availableWh), days = num(p.days);
  /** @type {string[]} */
  const errors = [];
  if (!(avail > 0)) errors.push('Вкажіть доступний запас енергії більший за 0 Вт·год.');
  if (!(days >= 0.5 && days <= 60)) errors.push('Період — від 0,5 до 60 діб.');
  const devs = (p.devices || []).map((d, i) => ({ i, name: String(d.name || 'Пристрій').slice(0, 60), watts: num(d.watts), hours: num(d.hours), cat: Math.min(5, Math.max(1, Math.round(Number(d.cat) || 5))), medical: !!d.medical }));
  if (!devs.length) errors.push('Додайте хоча б один пристрій.');
  if (devs.some((d) => !(d.watts >= 0) || !(d.hours >= 0 && d.hours <= 24))) errors.push('Потужність — від 0 Вт, години — від 0 до 24 на добу.');
  if (errors.length) return { ok: false, errors };

  const budget = avail / days;
  let left = budget;
  const sorted = [...devs].sort((x, y) => x.cat - y.cat || x.i - y.i);
  const rows = sorted.map((d) => {
    const need = d.watts * d.hours;
    const got = Math.min(need, Math.max(0, left));
    left -= got;
    const status = need === 0 ? 'full' : got >= need - 1e-9 ? 'full' : got > 0 ? 'partial' : 'none';
    return { ...d, need, got, hoursCovered: d.watts > 0 ? got / d.watts : d.hours, status };
  });
  const totalNeed = rows.reduce((s, r) => s + r.need, 0);
  const autonomyDays = totalNeed > 0 ? avail / totalNeed : Infinity;
  const steps = [
    `Добовий бюджет: ${fmt(avail)} Вт·год ÷ ${daysText(days)} = ${fmt(budget)} Вт·год`,
    `Добова потреба всіх пристроїв: Σ(Вт × год) = ${fmt(totalNeed)} Вт·год`,
    'Енергія розподіляється за пріоритетом: спершу категорія 1, потім 2 і далі; у межах категорії — за порядком у списку.',
    Number.isFinite(autonomyDays) ? `Якщо вмикати все за планом: ${fmt(avail)} ÷ ${fmt(totalNeed)} = ${daysText(autonomyDays)}` : 'Пристрої не споживають енергії',
  ];
  return { ok: true, budget, totalNeed, autonomyDays, rows, unusedWh: Math.max(0, left), medical: rows.some((r) => r.medical), steps };
}

/**
 * Число українською: до 2 знаків після коми, без зайвих нулів.
 * @param {number} n
 * @param {number} [digits]
 */
export function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  const d = abs >= 100 ? 0 : abs >= 10 ? Math.min(1, digits) : digits;
  const s = n.toFixed(d);
  const [i, f] = s.split('.');
  const intPart = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = f ? f.replace(/0+$/, '') : '';
  return frac ? `${intPart},${frac}` : intPart;
}

/**
 * Години → «X год Y хв».
 * @param {number} h
 */
export function fmtHours(h) {
  if (!Number.isFinite(h)) return '∞';
  if (h < 1 / 60) return 'менше хвилини';
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  if (hh === 0) return `${mm} хв`;
  if (hh >= 48) return daysText(h / 24);
  return mm ? `${hh} год ${mm} хв` : `${hh} год`;
}
