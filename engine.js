// @ts-check
// Локальний рушій рекомендацій на правилах. Жодного хмарного ШІ чи зовнішніх API.
// Порядок: задача → ресурси → відсів небезпечного й неможливого → сезон, місце, люди →
// порівняння (витрати, складність, ефект) → топ-3 з поясненням «чому».

import { SOLUTIONS, MYTHS, BY_ID } from './solutions.js';
import { KEY_LABELS, COMMON_KEYS, CONDITION_KEYS, PLACES, SEASONS, NEED_ORDER, seasonByDate, costBand } from './data.js';
import { stateAlerts, DRINK_PER_DAY } from './safety.js';

/** @typedef {import('./types').Ctx} Ctx */
/** @typedef {import('./types').Solution} Solution */
/** @typedef {import('./types').Myth} Myth */
/** @typedef {import('./types').Mode} Mode */
/** @typedef {import('./types').Need} Need */
/** @typedef {import('./types').Rec} Rec */
/** @typedef {import('./types').Blocked} Blocked */

const COMMON = new Set(COMMON_KEYS);
const COND = new Set(CONDITION_KEYS);

/**
 * Будує контекст із профілю, стану й резерву.
 * alarm — режим «Я в укритті»: надвір не можна, а температура вдома вже не про вас.
 * @param {{profile: import('./types').Profile, state: import('./types').DayState, reserve: import('./types').ReserveItem[], season?: import('./types').Season | null, now?: Date, alarm?: boolean}} d
 * @returns {Ctx}
 */
export function buildContext(d) {
  const profile = d.profile || /** @type {any} */ ({});
  const state = d.state || /** @type {any} */ ({});
  const equip = new Set(profile.equip || []);
  const unavailable = new Set();
  let reserveWater = 0;
  let hasReserveWater = false;
  for (const it of d.reserve || []) {
    if (!it || !it.key) continue;
    if (it.ok && it.qty > 0) {
      equip.add(it.key);
      if (it.key === 'drinkWater') { reserveWater += it.qty; hasReserveWater = true; }
    } else {
      unavailable.add(it.key);
    }
  }
  for (const k of unavailable) if (!(d.reserve || []).some((it) => it.key === k && it.ok && it.qty > 0)) equip.delete(k);

  const limits = new Set(profile.limits || []);
  const alarm = d.alarm === true;
  if (alarm) limits.add('noOutside');
  const place = alarm ? 'shelter' : profile.place || 'apartment';
  const adults = clampInt(state.adults, 0, 50, 1);
  const kids = clampInt(state.kids, 0, 50, 0);
  const elderly = clampInt(state.elderly, 0, 50, 0);
  const n = Math.max(0, adults + kids + elderly);
  const power = state.power === true;
  const gas = state.gas === true;
  const tap = state.tap === true;
  const burnerAllowed = !limits.has('noFlame') && place !== 'shelter' && place !== 'car';
  const stoveOk = equip.has('stove') && place === 'house' && !limits.has('noFlame');
  const heatSource = power || gas || equip.has('station') || (equip.has('burner') && burnerAllowed) || stoveOk;
  const waterL = numOrNull(state.waterL) ?? (hasReserveWater ? reserveWater : null);

  return {
    season: d.season || seasonByDate(d.now || new Date()),
    place,
    equip,
    unavailable,
    limits,
    duration: profile.duration || 'd3',
    budget: Number.isFinite(profile.budget) ? profile.budget : 0,
    adults, kids, elderly, n,
    vulnerable: limits.has('vulnerable') || kids > 0 || elderly > 0,
    pets: clampInt(state.pets, 0, 50, 0),
    petKg: Math.max(0, Number(state.petKg) || 0),
    power, gas, tap,
    waterL,
    batteryPct: numOrNull(state.batteryPct),
    roomC: alarm ? null : numOrNull(state.roomC),
    heatSource,
    burnerAllowed,
    alarm,
  };
}

/**
 * Чи доступний ресурс/умова.
 * @param {Ctx} ctx
 * @param {string} k
 */
export function has(ctx, k) {
  switch (k) {
    case 'grid': return ctx.power;
    case 'gas': return ctx.gas;
    case 'tap': return ctx.tap;
    case 'heatSource': return ctx.heatSource;
    default:
      if (COMMON.has(k)) return !ctx.unavailable.has(k);
      return ctx.equip.has(k);
  }
}

/** @param {string} k */
export function keyLabel(k) {
  return KEY_LABELS[k] || k;
}

/**
 * Відсів небезпечного. Повертає ok=false з причиною.
 * @param {Solution | Myth} sol
 * @param {Ctx} ctx
 * @returns {{ok:boolean, why?:string, level:'info'|'caution'|'danger'}}
 */
export function safetyGate(sol, ctx) {
  if ('myth' in sol || sol.risk === 'danger') return { ok: false, why: 'Небезпечно — не рекомендується за жодних умов', level: 'danger' };
  const rule = sol.places && sol.places[ctx.place];
  if (rule === 'danger') return { ok: false, why: `Небезпечно в місці «${PLACES[ctx.place]}»`, level: 'danger' };
  if (sol.uses.combustion && ctx.place === 'shelter' && rule !== 'ok') return { ok: false, why: 'Горіння в укритті чи підвалі — ризик отруєння чадним газом', level: 'danger' };
  if (sol.uses.flame && ctx.limits.has('noFlame')) return { ok: false, why: 'Полум’я заборонене вашими обмеженнями', level: 'danger' };
  const out = sol.uses.outside === true || (sol.uses.outside === 'unlessCar' && ctx.place !== 'car');
  if (out && ctx.limits.has('noOutside')) return { ok: false, why: 'Потрібно виходити надвір, а зараз це небезпечно', level: 'caution' };
  return { ok: true, level: rule === 'caution' ? 'caution' : sol.risk };
}

/**
 * Що потрібно й чого бракує.
 * @param {Solution} sol
 * @param {Ctx} ctx
 */
export function feasibility(sol, ctx) {
  /** @type {string[]} */ const missing = [];
  /** @type {string[]} */ const conditionMissing = [];
  /** @type {string[]} */ const owned = [];
  for (const k of sol.needs) {
    if (has(ctx, k)) { if (!COND.has(k) && !COMMON.has(k)) owned.push(k); }
    else if (COND.has(k)) conditionMissing.push(k);
    else missing.push(k);
  }
  for (const g of sol.needsAny || []) {
    const hit = g.find((k) => has(ctx, k));
    if (hit) { if (!COND.has(hit) && !COMMON.has(hit)) owned.push(hit); continue; }
    const buyable = g.filter((k) => !COND.has(k));
    if (buyable.length) missing.push(buyable.join('|'));
    else conditionMissing.push(g.join('|'));
  }
  const hasReq = sol.needs.length + (sol.needsAny ? sol.needsAny.length : 0) > 0;
  const satisfied = missing.length === 0 && conditionMissing.length === 0;
  const costNow = sol.cost === 0 ? 0 : satisfied && hasReq ? 0 : sol.cost;
  return { ok: satisfied, missing, conditionMissing, owned, costNow };
}

/** @param {string} group */
export function groupLabel(group) {
  return group.split('|').map(keyLabel).join(' або ');
}

const PREP_ONLY_LONG = (/** @type {Solution} */ s) => s.id.startsWith('prep-');

/**
 * Оцінка рішення в контексті.
 * @param {Solution} sol
 * @param {Ctx} ctx
 * @param {Mode} mode
 * @param {ReturnType<typeof feasibility>} f
 */
export function scoreSolution(sol, ctx, mode, f) {
  let s = sol.effect * 8;
  /** @type {string[]} */ const reasons = [];
  /** @type {string[]} */ const warnings = [];
  const t = ctx.roomC;

  // Ситуативні пріоритети — йдуть першими в поясненні
  if (sol.need === 'heat' && t != null) {
    if (t <= 12 && sol.id === 'heat-room') { s += 16; reasons.push('У кімнаті холодно — це головне зараз'); }
    if (t <= 12 && (sol.id === 'heat-canopy' || sol.id === 'heat-layers')) s += 6;
    if (t < 9 && sol.id === 'heat-relocate') { s += 28; reasons.push('Дуже холодно — час планувати перехід'); }
  }
  if (sol.id === 'heat-relocate' && (t == null || t > 12) && !ctx.vulnerable) s -= 20;
  if (sol.need === 'food' && !ctx.heatSource) {
    if (sol.id === 'food-nocook') { s += 14; reasons.push('Не потребує нагрівання'); }
    if (sol.id === 'food-soak') s += 6;
  }
  if (sol.need === 'water' && ctx.waterL != null && ctx.n > 0 && ctx.waterL < ctx.n * DRINK_PER_DAY * 3) {
    if (['water-calc', 'water-hidden', 'water-save'].includes(sol.id)) { s += 10; reasons.push('Води мало — це насамперед'); }
  }
  if (sol.need === 'water' && !ctx.tap && sol.id === 'water-hidden') s += 4;
  if (sol.need === 'energy' && !ctx.power) {
    if (sol.id === 'energy-phone') s += 6;
    if (sol.id === 'energy-budget') s += 4;
  }
  if (sol.need === 'energy' && ctx.power && (sol.id === 'energy-budget' || sol.id === 'prep-power')) { s += 8; reasons.push('Світло є — саме час усе зарядити'); }
  if (ctx.place === 'car' && sol.id === 'energy-car') { s += 12; reasons.push('Ви в автомобілі'); }
  if (ctx.place === 'shelter' && sol.tags.includes('укриття')) { s += ctx.alarm ? 24 : 14; reasons.push('Саме для укриття'); }
  if (sol.need === 'cool' && t != null && t >= 30 && (sol.id === 'cool-alert' || sol.id === 'cool-body')) s += 10;

  // Сезон
  if (sol.seasons.includes(ctx.season)) {
    s += 6;
    if (sol.seasons.length < 4) reasons.push(`Підходить для сезону: ${SEASONS[ctx.season].label.toLowerCase()}`);
  } else {
    s -= 12;
  }

  // Режим часу
  if (mode === '5') s += sol.prepMin <= 5 ? 14 : sol.prepMin <= 10 ? 4 : -20;
  else if (mode === '30') { s += sol.prepMin <= 30 ? 8 : -6; if (sol.level <= 2) s += 3; }
  else {
    if (sol.level >= 2) s += 8;
    if (sol.level === 4 && (ctx.duration === 'd7' || ctx.duration === 'd7plus')) s += 6;
    if (sol.level === 4 && ctx.duration === 'h12') s -= 14;
    if (sol.level >= 3 && ctx.duration === 'd7plus') s += 4;
  }

  // Ресурси й витрати
  if (f.owned.length) { s += 10; reasons.push(`Використовує те, що є: ${uniq(f.owned).map(keyLabel).join(', ')}`); }
  if (f.costNow === 0) { s += 6; if (!f.owned.length) reasons.push('Без витрат'); }
  else s -= Math.min(14, Math.log10(f.costNow) * 3);
  if (!f.ok && f.missing.length) warnings.push(`Потрібно придбати: ${f.missing.map(groupLabel).join('; ')} (${costBand(sol.cost)})${ctx.limits.has('noOutside') ? ', коли це буде безпечно' : ''}`);

  // Складність
  s -= (sol.difficulty - 1) * 3;

  // Час
  if (sol.prepMin <= 5) reasons.push('Можна зробити за 5 хвилин');
  else if (sol.prepMin <= 30) reasons.push(`Підготовка до ${sol.prepMin} хв`);

  // Обмеження
  const w = sol.uses.water || 0;
  if (ctx.limits.has('lowWater')) {
    if (w > 0) s -= Math.min(20, w * 4);
    else if (sol.need !== 'water') reasons.push('Не потребує води');
  }
  const e = sol.uses.energyWh || 0;
  if (ctx.limits.has('saveCharge')) {
    if (e > 0) s -= 10;
    else if (sol.need === 'energy' || sol.need === 'heat' || sol.need === 'food') reasons.push('Не витрачає заряд');
  }
  if (ctx.limits.has('noFlame') && !sol.uses.flame && (sol.need === 'heat' || sol.need === 'food')) reasons.push('Без полум’я');

  // Ризики
  const gate = safetyGate(sol, ctx);
  if (gate.level === 'caution' || sol.risk === 'caution') {
    s -= 18;
    warnings.push('Обережність: лише з дотриманням усіх правил безпеки');
  }
  if (ctx.vulnerable && sol.vulnerableRisk) { s -= 6; warnings.push(sol.vulnerableRisk); }
  const needsHeat = (sol.needsAny || []).some((g) => g.includes('heatSource'));
  if (needsHeat && !ctx.power && !ctx.gas && !ctx.equip.has('station') && ctx.equip.has('burner') && ctx.burnerAllowed) {
    s -= 6;
    warnings.push('Ваше джерело тепла — пальник: лише коротко, з провітрюванням і детектором CO');
  }

  return { s, reasons: uniq(reasons).slice(0, 3), warnings: uniq(warnings) };
}

/** Тексти, коли безпечного рішення не знайдено. Без вигаданих обхідних шляхів. */
export const NONE_TEXT = {
  heat: 'Безпечного способу зігрітися наявними засобами зараз не знайдено. Зберіть людей в одній кімнаті, вдягніть усе тепле й переходьте в опалюване місце, щойно це безпечно. Не обігрівайтеся плитою, мангалом чи генератором.',
  food: 'Безпечного способу приготувати гаряче зараз немає. Їжте продукти без приготування; гаряче — коли з’являться світло чи газ, або в пункті незламності.',
  water: 'Безпечного способу отримати воду наявними засобами не знайдено. Не пийте воду невідомого походження без знезараження. Шукайте бутильовану воду чи пункт видачі, коли вихід безпечний.',
  energy: 'Відповідного рішення зараз немає. Бережіть заряд телефона; зарядитися можна в пункті незламності, коли вихід безпечний.',
  cool: 'Відповідного рішення зараз немає. Перебувайте в найпрохолоднішому місці, пийте воду, стежте за ознаками перегрівання.',
  hygiene: 'Відповідного рішення зараз немає. Мінімум — чисті руки перед їжею й після туалету.',
};

/** Температура для підказок: «+24 °C». @param {number} t */
const tTxt = (t) => `${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(Math.round(t))}\u00A0°C`;

/** Коли потреба не відповідає ситуації: зігріватися в теплі чи охолоджуватися в прохолоді. */
const IRRELEVANT_TEXT = {
  heat: (/** @type {number} */ t) => `У кімнаті ${tTxt(t)} — зігріватися зараз не потрібно. Якщо вам холодно в теплі, це може бути ознакою хвороби: зверніться до лікаря, а в разі погіршення — 103.`,
  cool: (/** @type {number} */ t) => `У кімнаті ${tTxt(t)} — охолоджуватися зараз не потрібно. Пийте воду за спрагою. Якщо почуваєтеся перегрітими в прохолоді, зверніться до лікаря.`,
};

/**
 * Головна функція підбору.
 * @param {Need} need
 * @param {Ctx} ctx
 * @param {Mode} [mode]
 * @param {number} [limit]
 */
export function recommend(need, ctx, mode = '5', limit = 3) {
  /** @type {Rec[]} */ const items = [];
  /** @type {Blocked[]} */ const blocked = [];
  /** @type {{sol: Solution, missing: string[]}[]} */ const wouldHelp = [];
  /** @type {(Solution|Myth)[]} */
  const pool = [...SOLUTIONS, ...MYTHS].filter((x) => x.need === need);
  // Потреба суперечить температурі в кімнаті: у швидких режимах нічого не нав’язуємо
  const t = ctx.roomC;
  const irrelevant = mode !== 'long' && t != null && ((need === 'heat' && t >= 24) || (need === 'cool' && t < 20));
  for (const sol of pool) {
    if ('myth' in sol) { blocked.push({ sol, why: 'Небезпечно — не робіть цього' }); continue; }
    const rule = sol.places && sol.places[ctx.place];
    if (rule === 'na') continue;
    const gate = safetyGate(sol, ctx);
    if (!gate.ok) { blocked.push({ sol, why: gate.why || 'Небезпечно' }); continue; }
    if (irrelevant) continue;
    // Сезон впливає на порядок (див. scoreSolution), а не відкидає рішення:
    // людина сама обрала потребу — значить, вона актуальна зараз
    if (mode !== 'long' && PREP_ONLY_LONG(sol)) continue;
    const f = feasibility(sol, ctx);
    if (f.conditionMissing.length) {
      blocked.push({ sol, why: `Зараз немає: ${f.conditionMissing.map(groupLabel).join('; ')}` });
      continue;
    }
    if (mode !== 'long') {
      if (!f.ok) { wouldHelp.push({ sol, missing: f.missing }); continue; }
      if (f.costNow > 0) continue;
      if (mode === '5' && sol.prepMin > 10) continue;
      if (mode === '30' && sol.prepMin > 45) continue;
    }
    if (f.costNow > ctx.budget) {
      blocked.push({ sol, why: `Поза вашим бюджетом (${costBand(sol.cost)})` });
      continue;
    }
    const sc = scoreSolution(sol, ctx, mode, f);
    items.push({ sol, score: sc.s, reasons: sc.reasons, warnings: sc.warnings, missing: f.missing, costNow: f.costNow, owned: f.owned });
  }
  items.sort((a, b) => b.score - a.score || a.sol.prepMin - b.sol.prepMin || a.sol.id.localeCompare(b.sol.id));
  wouldHelp.sort((a, b) => b.sol.effect - a.sol.effect);
  // Унікальні групи ресурсів, що допомогли б: без повторів ключів
  const seen = new Set();
  /** @type {string[]} */ const helpGroups = [];
  for (const g of wouldHelp.flatMap((w) => w.missing)) {
    const keys = g.split('|');
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    helpGroups.push(g);
  }
  return {
    items: items.slice(0, limit),
    more: items.slice(limit),
    blocked,
    none: items.length === 0,
    irrelevant,
    noneText: irrelevant && t != null && (need === 'heat' || need === 'cool') ? IRRELEVANT_TEXT[need](t) : NONE_TEXT[need],
    wouldHelp: helpGroups.slice(0, 3).map(groupLabel),
  };
}

/**
 * «Зробіть зараз» у режимі «Я в укритті» для побутових потреб.
 * Тепло й повітря підбираються звичайним способом — для них є окремі картки укриття.
 * @type {Partial<Record<Need, {text:string, id:string|null}[]>>}
 */
const ALARM_NOW = {
  food: [
    { text: 'Їжте те, що не треба готувати: хлібці, горіхи, батончики, консерви', id: 'food-nocook' },
    { text: 'Дітям — їжа й вода у звичний час: розпорядок заспокоює', id: null },
    { text: 'Продукти з різким запахом в укриття не беріть', id: null },
  ],
  water: [
    { text: 'Пийте невеликими ковтками; запас із валізки — насамперед на пиття', id: 'water-calc' },
    { text: 'Воду невідомого походження не пийте без знезараження', id: 'water-chlorine' },
  ],
  energy: [
    { text: 'Один телефон — на зв’язку, решта — в режимі енергозбереження', id: 'energy-phone' },
    { text: 'Світло — лише від ліхтаря чи лампи, без свічок', id: 'energy-light' },
    { text: 'Новини — з офіційних каналів і радіо', id: 'energy-comms' },
  ],
  hygiene: [
    { text: 'Руки — антисептиком або вологими серветками', id: 'hyg-hands' },
    { text: 'Туалет — у відгородженій зоні: відро з пакетом і кришкою', id: 'hyg-toilet' },
    { text: 'Сміття — у щільно зав’язаний пакет', id: 'hyg-waste' },
  ],
};

/**
 * Три першочергові дії «Зробіть зараз».
 * @param {Need} need
 * @param {Ctx} ctx
 * @returns {{text:string, id:string|null}[]}
 */
export function quickActions(need, ctx) {
  // В укритті побутові поради «як удома» (холодильник, краник) недоречні — свої короткі дії
  if (ctx.alarm && ALARM_NOW[need]) return ALARM_NOW[need].slice(0, 3);
  /** @type {{text:string, id:string|null}[]} */
  const acts = [];
  const push = (/** @type {string} */ text, /** @type {string|null} */ id) => {
    if (acts.length < 3 && !acts.some((a) => a.text === text)) acts.push({ text, id });
  };
  const t = ctx.roomC;
  if (need === 'heat' && t != null && t < 9) push('Плануйте перехід у тепле місце, щойно це безпечно', 'heat-relocate');
  if (need === 'cool' && t != null && t >= 35) push('Перевірте ознаки перегрівання; за ознак теплового удару — 103', 'cool-alert');
  if (need === 'water' && ctx.waterL != null && ctx.n > 0 && ctx.waterL < ctx.n * DRINK_PER_DAY) push('Залиште всю питну воду на пиття', 'water-calc');
  // Перший крок кожного рішення — це дія «просто зараз», навіть якщо все рішення займає довше.
  const r = recommend(need, ctx, '30', 6);
  for (const it of r.items) push(it.sol.now[0], it.sol.id);
  for (const it of r.items) for (const a of it.sol.now.slice(1)) push(a, it.sol.id);
  return acts.slice(0, 3);
}

/** Важливі речі для резерву: що є, чого бракує. */
const ESSENTIALS = [
  { key: 'water', label: 'Питна вода щонайменше на 3 доби', why: '≈3 л на людину на добу лише на пиття (Sphere)', test: (/** @type {Ctx} */ c) => c.waterL != null && c.waterL >= Math.max(1, c.n) * DRINK_PER_DAY * 3 },
  { key: 'light', label: 'Ліхтар або акумуляторна лампа', why: 'Безпечне світло замість свічок', test: (/** @type {Ctx} */ c) => c.equip.has('lamp') || c.equip.has('headlamp') },
  { key: 'power', label: 'Павербанк або зарядна станція', why: 'Зв’язок і світло під час відключень', test: (/** @type {Ctx} */ c) => c.equip.has('powerbank') || c.equip.has('station') },
  { key: 'radio', label: 'Радіо на батарейках', why: 'Новини без інтернету', test: (/** @type {Ctx} */ c) => c.equip.has('radio') },
  { key: 'thermos', label: 'Термос', why: 'Окріп і їжа без постійного нагрівання', test: (/** @type {Ctx} */ c) => c.equip.has('thermos') },
  { key: 'disinf', label: 'Засіб для знезараження води', why: 'Безпечна вода, коли кип’ятити нічим', test: (/** @type {Ctx} */ c) => c.equip.has('bleach') || c.equip.has('waterTabs') },
  { key: 'sanit', label: 'Відро з кришкою й міцні пакети', why: 'Туалет без води', test: (/** @type {Ctx} */ c) => has(c, 'bucket') && has(c, 'bags') },
  { key: 'co', label: 'Детектор чадного газу', why: 'Вдома є газ, піч чи пальник', test: (/** @type {Ctx} */ c) => c.equip.has('coAlarm'), when: (/** @type {Ctx} */ c) => c.gas || c.equip.has('burner') || c.equip.has('stove') },
  { key: 'firstAid', label: 'Аптечка', why: 'Перша допомога вдома', test: (/** @type {Ctx} */ c) => c.equip.has('firstAid') },
];

/**
 * Що можна зробити зараз і чого бракує (для «Мій резерв»).
 * @param {Ctx} ctx
 */
export function reserveInsight(ctx) {
  const feasibleNow = SOLUTIONS.filter((s) => {
    const rule = s.places && s.places[ctx.place];
    if (rule === 'na') return false;
    if (!safetyGate(s, ctx).ok) return false;
    const f = feasibility(s, ctx);
    return f.ok && f.costNow <= ctx.budget;
  });
  const essentials = ESSENTIALS.filter((e) => !e.when || e.when(ctx)).map((e) => ({ key: e.key, label: e.label, why: e.why, ok: e.test(ctx) }));
  const enabledByEquip = feasibleNow.filter((s) => feasibility(s, ctx).owned.length > 0);
  return { feasibleNow, enabledByEquip, essentials, missing: essentials.filter((e) => !e.ok) };
}

/**
 * План за «Мій стан сьогодні»: попередження + пріоритетні потреби.
 * @param {Ctx} ctx
 */
export function planFromState(ctx) {
  const alerts = stateAlerts(ctx);
  /** @type {Record<Need, number>} */
  const w = { heat: 0, food: 0, water: 0, energy: 0, cool: 0, hygiene: 0 };
  const t = ctx.roomC;
  if (t != null) {
    if (t < 18) w.heat += (18 - t) * 2;
    if (t >= 26) w.cool += (t - 25) * 2;
  } else {
    if (ctx.season === 'winter') w.heat += 6;
    if (ctx.season === 'autumn') w.heat += 3;
    if (ctx.season === 'summer') w.cool += 6;
  }
  if (!ctx.power) w.energy += 6;
  if (ctx.batteryPct != null) w.energy += Math.max(0, (60 - ctx.batteryPct) / 6);
  if (!ctx.tap) { w.water += 5; w.hygiene += 4; }
  if (ctx.waterL != null && ctx.n > 0) {
    const days = ctx.waterL / (ctx.n * DRINK_PER_DAY);
    w.water += days < 1 ? 20 : days < 3 ? 10 : 0;
  }
  if (!ctx.power && !ctx.gas) w.food += 5;
  for (const a of alerts) if (a.need in w) w[a.need] += a.level === 'danger' ? 30 : a.level === 'caution' ? 12 : 3;
  const order = NEED_ORDER
    .filter((n) => !(n === 'cool' && ctx.season === 'winter' && (t == null || t < 26)))
    .filter((n) => !(n === 'heat' && ctx.season === 'summer' && (t == null || t >= 18)))
    .sort((a, b) => w[b] - w[a] || NEED_ORDER.indexOf(a) - NEED_ORDER.indexOf(b));
  const used = new Set();
  const needs = order.slice(0, 4).map((need) => {
    const r = recommend(need, ctx, '30', 1);
    // Одна й та сама дія (напр. «краник» для води й гігієни) — лише один раз у плані
    const actions = quickActions(need, ctx).filter((a) => !used.has(a.text)).slice(0, 2);
    actions.forEach((a) => used.add(a.text));
    return { need, weight: w[need], rec: r.items[0] || null, noneText: r.noneText, actions };
  });
  return { alerts, needs };
}

/* ───────────── Пошук і фільтри бібліотеки ───────────── */

/** @param {string} s */
export function norm(s) {
  return String(s || '').toLowerCase().replace(/[’'ʼ`´]/g, '').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/**
 * Синоніми й розмовні слова: [частина слова в запиті, що ще шукати].
 * «Повербанк» знайде павербанк, «підвал» — укриття, «свічка» — безпечні ліхтарі.
 */
const SYN = [
  ['повербанк', 'павербанк'], ['павербанк', 'повербанк'],
  ['підвал', 'укритт'], ['укритт', 'підвал'], ['бомбосховищ', 'укритт'], ['сховищ', 'укритт'],
  ['буржуйк', 'піч'], ['свічк', 'ліхтар'], ['свічк', 'лампа'],
  ['генератор', 'станці'], ['холодн', 'тепл'], ['мерзн', 'тепл'], ['замерз', 'тепл'],
  ['спек', 'охолод'], ['жар', 'охолод'], ['душн', 'задух'], ['туалет', 'відро'],
  ['світл', 'ліхтар'], ['ліхтар', 'світл'], ['інтернет', 'звяз'], ['мобільн', 'телефон'],
];

/** Слово запиту та його синоніми. @param {string} w */
export function wordAlts(w) {
  const out = [w];
  for (const [k, v] of SYN) if (w.includes(k) && !out.includes(v)) out.push(v);
  return out;
}

/**
 * @param {{q?:string, need?:string|null, season?:string|null, level?:number|null, onlyNow?:boolean, myths?:boolean}} f
 * @param {Ctx} ctx
 */
export function searchLibrary(f, ctx) {
  const q = norm(f.q || '');
  const words = q ? q.split(' ').filter(Boolean).map(wordAlts) : [];
  /** @type {(Solution|Myth)[]} */
  const pool = f.myths === false ? [...SOLUTIONS] : [...SOLUTIONS, ...MYTHS];
  const res = pool.filter((s) => {
    if (f.need && s.need !== f.need) return false;
    if ('myth' in s) {
      if (f.season || f.level || f.onlyNow) return false;
    } else {
      if (f.season && !s.seasons.includes(/** @type {any} */ (f.season))) return false;
      if (f.level && s.level !== f.level) return false;
      if (f.onlyNow) {
        if (s.places && s.places[ctx.place] === 'na') return false;
        if (!safetyGate(s, ctx).ok) return false;
        const fe = feasibility(s, ctx);
        if (!fe.ok || fe.costNow > ctx.budget) return false;
      }
    }
    if (!words.length) return true;
    const hay = norm([s.title, 'myth' in s ? s.why : s.problem, ...(s.tags || []), ...('myth' in s ? [] : s.materials)].join(' '));
    return words.every((alts) => alts.some((w) => hay.includes(w)));
  });
  return res;
}

/** @param {string} id */
export function getSolution(id) {
  return BY_ID.get(id) || null;
}

/* ───────────── Допоміжні ───────────── */

/** @template T @param {T[]} a @returns {T[]} */
function uniq(a) {
  return [...new Set(a)];
}
/** @param {unknown} v */
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/** @param {unknown} v @param {number} min @param {number} max @param {number} dflt */
function clampInt(v, min, max, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}
