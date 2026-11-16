// @ts-check
// Локальне сховище: localStorage з резервом у пам’яті, версіонування й міграції,
// перевірка даних, експорт та імпорт JSON. Дані не залишають пристрій.

import { RESERVE_CATALOG, RESERVE_CATS, EQUIP, LIMITS, PLACES, DURATIONS, SEASON_ORDER } from './data.js';

/** @typedef {import('./types').AppData} AppData */
/** @typedef {import('./types').ReserveItem} ReserveItem */

export const STORE_KEY = 'avtonomno.data';
export const SCHEMA = 2;

/** @returns {AppData} */
export function defaults() {
  return {
    v: SCHEMA,
    profile: { place: null, equip: [], limits: [], duration: 'd3', budget: 0, setupDone: false, setupDismissed: false },
    state: { power: null, gas: null, tap: null, waterL: null, batteryPct: null, roomC: null, adults: 1, kids: 0, elderly: 0, pets: 0, petKg: 0, updated: null },
    reserve: [],
    favs: [],
    notes: '',
    calc: {},
    settings: { theme: 'auto', contrast: false, motion: false, season: null },
    bag: [],
    bagAt: null,
    prep: [],
    shelter: { since: null, after: null, count: 0, minutes: 0, last: null },
    plan: { shelter: '', meet: '' },
  };
}

const CAT_KEYS = new Set(RESERVE_CATS.map((c) => c.key));
const CATALOG_KEYS = new Set(RESERVE_CATALOG.map((c) => c.key));
const EQUIP_KEYS = new Set([...EQUIP.map((e) => e.key), ...CATALOG_KEYS]);

/** @param {unknown} v @param {number} max */
function str(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
}
/** @param {unknown} v @param {number} min @param {number} max @param {number|null} dflt */
function numIn(v, min, max, dflt) {
  if (v === null || v === undefined || v === '') return dflt;
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
/**
 * Список коротких рядків-ключів без повторів. Невідомі ключі зберігаються:
 * так дані з новішої версії не губляться, а підрахунок їх просто не враховує.
 * @param {unknown} v @param {number} max
 */
function keyList(v, max) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((k) => typeof k === 'string' && /^[\w-]{1,40}$/.test(k)))].slice(0, max);
}
/** Позначка часу в мс (2000–2200 рр.) або null. @param {unknown} v */
function ms(v) {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n > 946684800000 && n < 7258118400000 ? Math.round(n) : null;
}
/** @param {unknown} v */
function triBool(v) {
  return v === true ? true : v === false ? false : null;
}

/**
 * Перевіряє й нормалізує один предмет резерву.
 * @param {any} it
 * @returns {ReserveItem | null}
 */
export function cleanItem(it) {
  if (!it || typeof it !== 'object') return null;
  const name = str(it.name, 80);
  if (!name) return null;
  const key = typeof it.key === 'string' && CATALOG_KEYS.has(it.key) ? it.key : undefined;
  const cat = typeof it.cat === 'string' && CAT_KEYS.has(it.cat) ? it.cat : 'other';
  const id = str(it.id, 40) || newId();
  return {
    id,
    ...(key ? { key } : {}),
    name,
    cat,
    qty: numIn(it.qty, 0, 100000, 1),
    unit: str(it.unit, 12) || 'шт',
    ok: it.ok !== false,
  };
}

/**
 * Перевіряє весь об’єкт даних; невідоме відкидає, бракуюче — заповнює типовим.
 * @param {any} raw
 * @returns {AppData}
 */
export function cleanData(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const p = raw.profile || {};
  d.profile.place = typeof p.place === 'string' && p.place in PLACES ? p.place : null;
  d.profile.equip = Array.isArray(p.equip) ? [...new Set(p.equip.filter((k) => typeof k === 'string' && EQUIP_KEYS.has(k)))] : [];
  d.profile.limits = Array.isArray(p.limits) ? [...new Set(p.limits.filter((k) => typeof k === 'string' && k in LIMITS))] : [];
  d.profile.duration = typeof p.duration === 'string' && p.duration in DURATIONS ? p.duration : 'd3';
  d.profile.budget = numIn(p.budget, 0, 1000000, 0) ?? 0;
  d.profile.setupDone = p.setupDone === true;
  d.profile.setupDismissed = p.setupDismissed === true;

  const s = raw.state || {};
  d.state.power = triBool(s.power);
  d.state.gas = triBool(s.gas);
  d.state.tap = triBool(s.tap);
  d.state.waterL = numIn(s.waterL, 0, 100000, null);
  d.state.batteryPct = numIn(s.batteryPct, 0, 100, null);
  d.state.roomC = numIn(s.roomC, -40, 60, null);
  d.state.adults = Math.round(numIn(s.adults, 0, 50, 1) ?? 1);
  d.state.kids = Math.round(numIn(s.kids, 0, 50, 0) ?? 0);
  d.state.elderly = Math.round(numIn(s.elderly, 0, 50, 0) ?? 0);
  d.state.pets = Math.round(numIn(s.pets, 0, 50, 0) ?? 0);
  d.state.petKg = numIn(s.petKg, 0, 500, 0) ?? 0;
  d.state.updated = typeof s.updated === 'string' ? s.updated.slice(0, 40) : null;

  d.reserve = Array.isArray(raw.reserve) ? raw.reserve.map(cleanItem).filter(Boolean).slice(0, 500) : [];
  d.favs = Array.isArray(raw.favs) ? [...new Set(raw.favs.filter((x) => typeof x === 'string').map((x) => x.slice(0, 40)))].slice(0, 200) : [];
  d.notes = str(raw.notes, 4000);
  d.calc = raw.calc && typeof raw.calc === 'object' ? JSON.parse(JSON.stringify(raw.calc)) : {};

  const st = raw.settings || {};
  d.settings.theme = st.theme === 'light' || st.theme === 'dark' || st.theme === 'black' ? st.theme : 'auto';
  d.settings.contrast = st.contrast === true;
  d.settings.motion = st.motion === true;
  d.settings.season = typeof st.season === 'string' && SEASON_ORDER.includes(st.season) ? st.season : null;

  d.bag = keyList(raw.bag, 200);
  d.bagAt = ms(raw.bagAt);
  d.prep = keyList(raw.prep, 200);
  const sh = raw.shelter || {};
  d.shelter.since = ms(sh.since);
  d.shelter.after = d.shelter.since != null ? ms(sh.after) : null;
  d.shelter.count = Math.round(numIn(sh.count, 0, 1000000, 0) ?? 0);
  d.shelter.minutes = Math.round(numIn(sh.minutes, 0, 100000000, 0) ?? 0);
  d.shelter.last = ms(sh.last);
  const pl = raw.plan || {};
  d.plan.shelter = typeof pl.shelter === 'string' ? pl.shelter.slice(0, 120) : '';
  d.plan.meet = typeof pl.meet === 'string' ? pl.meet.slice(0, 120) : '';
  return d;
}

/**
 * Міграції між версіями схеми. Нова версія не повинна ламати попередні дані.
 * @param {any} raw
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const v = Number(raw.v) || 1;
  // v1 → v2: додано тривожну валізку, підготовку укриття й режим «Я в укритті».
  // Нові поля заповнює cleanData типовими значеннями, старі дані не змінюються.
  // Майбутні зміни додаються тут кроками: if (v < 3) { ... }
  return { ...raw, v: Math.max(v, SCHEMA) };
}

/* ───────────── Робота зі сховищем ───────────── */

/** @type {AppData} */
let data = defaults();
let persistent = false;
/** @type {Set<() => void>} */
const subs = new Set();
/** @type {ReturnType<typeof setTimeout> | null} */
let timer = null;
let lastError = '';
/** Є незбережені зміни — лише тоді пишемо в сховище */
let dirty = false;

/** Завантажує дані. Повертає true, якщо сховище доступне. */
export function load() {
  try {
    const ls = globalThis.localStorage;
    const raw = ls.getItem(STORE_KEY);
    data = cleanData(migrate(raw ? JSON.parse(raw) : null));
    dirty = false;
    const probe = '__avtonomno_probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    persistent = true;
  } catch (e) {
    data = data || defaults();
    persistent = false;
  }
  return persistent;
}

export function isPersistent() {
  return persistent;
}
export function getError() {
  return lastError;
}

/** @returns {AppData} */
export function get() {
  return data;
}

/**
 * Змінює дані й планує збереження.
 * @param {(d: AppData) => void} fn
 */
export function update(fn) {
  fn(data);
  dirty = true;
  schedule();
  subs.forEach((f) => f());
}

/** @param {AppData} next */
export function replaceAll(next) {
  data = cleanData(next);
  dirty = true;
  saveNow();
  subs.forEach((f) => f());
}

/** @param {() => void} fn */
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(saveNow, 250);
}

export function saveNow() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!dirty) return true;
  try {
    globalThis.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    persistent = true;
    dirty = false;
    lastError = '';
    return true;
  } catch (e) {
    persistent = false;
    lastError = e && /** @type {any} */ (e).name === 'QuotaExceededError' ? 'Пам’ять браузера заповнена — дані збережено лише до закриття сторінки.' : 'Браузер не дозволяє зберігати дані — вони діятимуть лише до закриття сторінки.';
    return false;
  }
}

/* ───────────── Експорт / імпорт ───────────── */

/** @param {AppData} d */
export function exportData(d) {
  return {
    app: 'avtonomno',
    format: SCHEMA,
    exported: new Date().toISOString(),
    reserve: d.reserve,
    profile: d.profile,
    state: d.state,
    favs: d.favs,
    notes: d.notes,
    bag: d.bag,
    bagAt: d.bagAt,
    prep: d.prep,
    plan: d.plan,
    shelter: { count: d.shelter.count, minutes: d.shelter.minutes, last: d.shelter.last },
  };
}

/**
 * Розбирає JSON імпорту. Приймає повну копію або лише масив резерву.
 * @param {string} text
 * @param {AppData} current
 * @returns {{ok:true, data:AppData, counts:{reserve:number, favs:number}} | {ok:false, error:string}}
 */
export function importData(text, current) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Файл не є коректним JSON.' };
  }
  if (Array.isArray(raw)) raw = { app: 'avtonomno', reserve: raw };
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Неочікуваний формат файлу.' };
  if (raw.app && raw.app !== 'avtonomno') return { ok: false, error: 'Це файл іншого застосунку.' };
  if (!Array.isArray(raw.reserve)) return { ok: false, error: 'У файлі немає списку запасів (reserve).' };
  const items = raw.reserve.map(cleanItem).filter(Boolean);
  if (raw.reserve.length && !items.length) return { ok: false, error: 'Жоден запис запасів не пройшов перевірку.' };
  const next = cleanData({
    ...current,
    reserve: items,
    profile: raw.profile ? { ...current.profile, ...raw.profile } : current.profile,
    state: raw.state ? { ...current.state, ...raw.state } : current.state,
    favs: Array.isArray(raw.favs) ? raw.favs : current.favs,
    notes: typeof raw.notes === 'string' ? raw.notes : current.notes,
    bag: Array.isArray(raw.bag) ? raw.bag : current.bag,
    bagAt: raw.bagAt != null ? raw.bagAt : current.bagAt,
    prep: Array.isArray(raw.prep) ? raw.prep : current.prep,
    plan: raw.plan && typeof raw.plan === 'object' ? { ...current.plan, ...raw.plan } : current.plan,
    // Лічильник укриттів — з файлу, а поточний режим «Я в укритті» лишається як є
    shelter: raw.shelter && typeof raw.shelter === 'object'
      ? { ...current.shelter, count: raw.shelter.count ?? current.shelter.count, minutes: raw.shelter.minutes ?? current.shelter.minutes, last: raw.shelter.last ?? current.shelter.last }
      : current.shelter,
  });
  return { ok: true, data: next, counts: { reserve: next.reserve.length, favs: next.favs.length } };
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
