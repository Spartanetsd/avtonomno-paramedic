// Тести 2.0: режим «Я в укритті», тривожна валізка, підготовка укриття, готовність,
// пошук із синонімами, нові поля сховища. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  BAG, PREP, ALARM_STEPS, ALARM_FOLDS, FIRST_STEPS, WHILE_BLOCKS, BLOCKED, AFTER_STEPS, SECTIONS, PRAISE, SHARE_TEXT,
  BAG_SOURCES, PREP_SOURCES, ALARM_SOURCES, FIRST_SOURCES, AFTER_SOURCES,
  applies, itemsFor, progress, readiness, readinessPraise, elapsedMin, durText, daysSince, bagDue, sectionsFor,
} from './shelter.js';
import { SOURCES, PLACES } from './data.js';
import { BY_ID } from './solutions.js';
import { buildContext, recommend, quickActions, searchLibrary, safetyGate } from './engine.js';
import { cleanData, defaults, migrate, exportData, importData, SCHEMA } from './store.js';

const base = (o = {}) => ({
  profile: { place: 'apartment', equip: [], limits: [], duration: 'd3', budget: 0, ...(o.profile || {}) },
  state: { adults: 1, kids: 0, elderly: 0, pets: 0, petKg: 0, power: null, gas: null, tap: null, waterL: null, batteryPct: null, roomC: null, ...(o.state || {}) },
  reserve: o.reserve || [],
  season: o.season || 'winter',
  alarm: o.alarm,
});
const ctxOf = (o) => buildContext(base(o));
const ALL_BLOCKS = [...ALARM_FOLDS, ...WHILE_BLOCKS, BLOCKED];

test('чек-листи: унікальні ключі, непорожні тексти, умови лише kids/pets', () => {
  for (const [name, groups] of [['валізка', BAG], ['укриття', PREP]]) {
    const keys = groups.flatMap((g) => g.items.map((i) => i.key));
    assert.equal(new Set(keys).size, keys.length, `${name}: повтор ключа`);
    for (const it of groups.flatMap((g) => g.items)) {
      assert.match(it.key, /^[\w-]{1,40}$/, `${name}: ключ ${it.key}`);
      assert.ok(it.label.length > 5, `${name}: ${it.key}`);
      assert.ok(!it.when || ['kids', 'pets'].includes(it.when), `${name}: ${it.key}`);
    }
  }
  assert.ok(BAG.flatMap((g) => g.items).length >= 25, 'валізка за МОН має бути повною');
});

test('усі джерела, посилання на рішення та інструменти існують', () => {
  const keys = [...BAG_SOURCES, ...PREP_SOURCES, ...ALARM_SOURCES, ...FIRST_SOURCES, ...AFTER_SOURCES, ...ALL_BLOCKS.flatMap((b) => b.sources)];
  for (const k of keys) assert.ok(SOURCES[k], `немає джерела ${k}`);
  for (const k of keys) assert.ok(SOURCES[k].url.startsWith('https://'), k);
  for (const b of ALL_BLOCKS) {
    if (b.link) assert.ok(BY_ID.get(b.link), `немає рішення ${b.link}`);
    if (b.tool) assert.ok(['light', 'breathe', 'signal'].includes(b.tool), b.tool);
    assert.ok(b.items.length >= 2 && b.sources.length >= 1, b.id);
  }
  for (const s of SECTIONS) assert.ok(s.href || s.tool, s.title);
});

test('безпека змісту: в укриття — без свічок і вогню; надвір під час тривоги не кличемо', () => {
  const all = [...ALARM_STEPS, ...FIRST_STEPS, ...ALL_BLOCKS.flatMap((b) => b.items), ...BAG.flatMap((g) => g.items.map((i) => `${i.label} ${i.hint || ''}`))].join(' ').toLowerCase();
  // Свічки згадуються лише як заборона
  for (const m of all.matchAll(/свіч/g)) {
    const around = all.slice(Math.max(0, m.index - 60), m.index + 10);
    assert.ok(/не |забор|замість|жодних|без /.test(around), `свічки без заборони: …${around}…`);
  }
  assert.ok(ALARM_STEPS[0].includes('одразу'), 'перший крок — одразу в укриття');
  assert.ok(ALARM_FOLDS.find((f) => f.id === 'walls').items.some((t) => t.includes('крайній захід')), 'правило двох стін — лише крайній захід');
  assert.ok(BLOCKED.items.some((t) => t.includes('хвилину тиші')), 'сигнали під час «хвилини тиші»');
  assert.ok(AFTER_STEPS[0].includes('10–15'), 'після відбою — зачекати');
  assert.ok(PRAISE.start && PRAISE.after && SHARE_TEXT.in && SHARE_TEXT.after);
});

test('пункти для дітей і тварин з’являються лише тоді, коли вони є', () => {
  const none = { kids: 0, pets: 0, limits: new Set() };
  const fam = { kids: 2, pets: 1, limits: new Set() };
  const keysNone = itemsFor(BAG, none).flatMap((g) => g.items.map((i) => i.key));
  const keysFam = itemsFor(BAG, fam).flatMap((g) => g.items.map((i) => i.key));
  assert.ok(!keysNone.includes('kidnote') && !keysNone.includes('leash'));
  assert.ok(keysFam.includes('kidnote') && keysFam.includes('leash') && keysFam.includes('toy'));
  assert.ok(!itemsFor(BAG, none).some((g) => g.key === 'kids'), 'порожня група не показується');
  assert.ok(applies({ when: 'pets' }, { kids: 0, pets: 0, limits: new Set(['animals']) }), 'обмеження «поруч є тварини» теж рахується');
});

test('прогрес: рахує лише доречні й відомі пункти', () => {
  const c = { kids: 0, pets: 0, limits: new Set() };
  const total = itemsFor(BAG, c).flatMap((g) => g.items).length;
  assert.deepEqual(progress(BAG, [], c), { done: 0, total, pct: 0 });
  const p = progress(BAG, ['docs', 'water', 'kidnote', 'from-future-version', 'docs'], c);
  assert.equal(p.done, 2, 'дитячий пункт без дітей і невідомий ключ не рахуються');
  const all = itemsFor(BAG, c).flatMap((g) => g.items.map((i) => i.key));
  assert.equal(progress(BAG, all, c).pct, 100);
});

test('готовність: середнє з трьох частин і похвала за рівнем', () => {
  const ctx = ctxOf({});
  const r0 = readiness({ bag: [], prep: [] }, ctx);
  assert.equal(r0.bag.done, 0);
  assert.ok(r0.pct >= 0 && r0.pct <= 100);
  const bagAll = itemsFor(BAG, ctx).flatMap((g) => g.items.map((i) => i.key));
  const prepAll = itemsFor(PREP, ctx).flatMap((g) => g.items.map((i) => i.key));
  const r1 = readiness({ bag: bagAll, prep: prepAll }, ctx);
  assert.equal(r1.bag.pct, 100);
  assert.equal(r1.prep.pct, 100);
  assert.equal(r1.pct, Math.round((100 + 100 + r1.res.pct) / 3));
  assert.match(readinessPraise(0), /Почніть/);
  assert.match(readinessPraise(25), /початок/);
  assert.match(readinessPraise(60), /добре/);
  assert.match(readinessPraise(90), /Майже/);
  assert.match(readinessPraise(100), /готові/);
});

test('таймер укриття: тривалість по-людськи', () => {
  assert.equal(elapsedMin(1000, 500), 0, 'годинник назад — не мінус');
  assert.equal(elapsedMin(0, 59999), 0);
  assert.equal(elapsedMin(0, 60000 * 47), 47);
  assert.equal(durText(0), 'менше хвилини');
  assert.equal(durText(0, true), 'щойно');
  assert.equal(durText(5), '5 хв');
  assert.equal(durText(60), '1 год');
  assert.equal(durText(65), '1 год 5 хв');
  assert.equal(durText(1500), 'понад 1 добу');
  assert.equal(durText(3000), 'понад 2 доби');
});

test('валізка: нагадування перевірити раз на 3 місяці', () => {
  const day = 86400000;
  const now = Date.UTC(2026, 10, 12);
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince(now - 3 * day, now), 3);
  assert.equal(bagDue(null, now), true);
  assert.equal(bagDue(now - 30 * day, now), false);
  assert.equal(bagDue(now - 91 * day, now), true);
});

test('пошук: розділи укриття й синоніми', () => {
  const hrefs = (q) => sectionsFor(q).map((s) => s.href || s.tool);
  assert.ok(hrefs('підвал').includes('#/shelter') && hrefs('підвал').includes('#/prep'));
  assert.ok(hrefs('Тривожна валізка').includes('#/bag'));
  assert.ok(hrefs('пам’ятка').includes('#/sheet'), 'апостроф не заважає');
  assert.ok(hrefs('нічник').includes('light'));
  assert.ok(hrefs('завали').includes('signal'));
  assert.deepEqual(sectionsFor('аб'), []);
  const ctx = ctxOf({});
  const ids = (q) => searchLibrary({ q }, ctx).map((s) => s.id);
  assert.ok(ids('повербанк').some((id) => id.startsWith('energy-')), 'розмовне «повербанк»');
  assert.ok(ids('підвал').includes('heat-shelter'));
  assert.ok(ids('бомбосховище').includes('cool-shelter'));
  assert.ok(ids('свічка').includes('energy-light'), 'свічка → безпечне світло');
  assert.ok(ids('свічка').includes('myth-candle-heater'), 'і пояснення, чому свічка не обігрівач');
});

test('режим «Я в укритті»: місце — укриття, надвір не можна, температура вдома не враховується', () => {
  const c = ctxOf({ state: { roomC: 14 }, alarm: true });
  assert.equal(c.place, 'shelter');
  assert.equal(c.alarm, true);
  assert.ok(c.limits.has('noOutside'));
  assert.equal(c.roomC, null);
  const heat = recommend('heat', c, '30', 3);
  assert.equal(heat.items[0].sol.id, 'heat-shelter', 'першим — тепло саме в укритті');
  assert.ok(heat.blocked.some((b) => b.sol.id === 'heat-relocate'), 'виходити надвір під час тривоги не радимо');
  const cool = recommend('cool', c, '30', 3);
  assert.ok(!cool.irrelevant, 'задуха в укритті актуальна й коли вдома прохолодно');
  assert.equal(cool.items[0].sol.id, 'cool-shelter');
  const food = quickActions('food', c);
  assert.ok(food.length >= 2 && food.every((a) => !/холодильник/.test(a.text)), food.map((a) => a.text).join(' | '));
  const home = ctxOf({ state: { roomC: 14 } });
  assert.notEqual(recommend('heat', home, '30', 3).items[0].sol.id, 'heat-shelter', 'удома картка укриття не нав’язується');
  assert.ok(!recommend('heat', home, 'long', 50).items.some((i) => i.sol.id === 'heat-shelter'));
});

test('інваріант тривоги: на 300 випадкових ситуаціях жодного горіння й виходу надвір', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const places = Object.keys(PLACES);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  for (let i = 0; i < 300; i++) {
    const c = ctxOf({
      profile: { place: pick(places), equip: ['burner', 'stove', 'car12', 'station', 'thermos', 'powerbank'].filter(() => rand() < 0.5), limits: [], budget: pick([0, 500, 5000]) },
      state: { power: rand() < 0.5, gas: rand() < 0.5, tap: rand() < 0.5, roomC: Math.round(rand() * 40), kids: rand() < 0.3 ? 1 : 0 },
      season: pick(['winter', 'spring', 'summer', 'autumn']),
      alarm: true,
    });
    for (const need of ['heat', 'food', 'water', 'energy', 'cool', 'hygiene']) {
      for (const mode of ['5', '30', 'long']) {
        for (const it of recommend(need, c, mode, 10).items) {
          assert.ok(!it.sol.uses.combustion && !it.sol.uses.flame, `вогонь у тривозі: ${it.sol.id}`);
          assert.ok(it.sol.uses.outside !== true && it.sol.uses.outside !== 'unlessCar', `надвір у тривозі: ${it.sol.id}`);
          assert.ok(safetyGate(it.sol, c).ok);
        }
      }
    }
  }
});

test('сховище v2: нові поля, перевірка, міграція з v1, експорт та імпорт', () => {
  assert.equal(SCHEMA, 2);
  const d = defaults();
  assert.deepEqual(d.bag, []);
  assert.deepEqual(d.shelter, { since: null, after: null, count: 0, minutes: 0, last: null });
  const now = Date.UTC(2026, 10, 12, 20, 0);
  const c = cleanData({
    bag: ['docs', 'docs', 5, null, 'з пробілом', 'x'.repeat(50), 'future-key'],
    bagAt: 'не дата', prep: 'не масив',
    shelter: { since: now, after: now - 1000, count: -3, minutes: 'багато' },
    settings: { theme: 'black' },
  });
  assert.deepEqual(c.bag, ['docs', 'future-key'], 'дублікати й сміття відкинуто, невідомий ключ збережено');
  assert.equal(c.bagAt, null);
  assert.deepEqual(c.prep, []);
  assert.equal(c.shelter.since, now);
  assert.equal(c.shelter.count, 0);
  assert.equal(c.shelter.minutes, 0);
  assert.equal(c.settings.theme, 'black');
  assert.equal(cleanData({ shelter: { after: now } }).shelter.after, null, 'відбій без початку не має сенсу');
  assert.equal(cleanData({ shelter: { since: 123 } }).shelter.since, null, 'неправдоподібна дата');
  assert.equal(cleanData({ settings: { theme: 'neon' } }).settings.theme, 'auto');
  // Дані 1.x без нових полів
  const v1 = { v: 1, reserve: [{ key: 'drinkWater', name: 'Питна вода', cat: 'water', qty: 12, unit: 'л', ok: true }], favs: ['heat-room'], notes: 'тест' };
  const m = cleanData(migrate(v1));
  assert.equal(m.v, 2);
  assert.equal(m.reserve.length, 1);
  assert.deepEqual(m.favs, ['heat-room']);
  assert.deepEqual(m.bag, []);
  assert.equal(m.shelter.count, 0);
  // Експорт та імпорт зберігають валізку й укриття
  const withBag = cleanData({ ...v1, bag: ['docs', 'water'], bagAt: now, prep: ['addr'] });
  const exp = exportData(withBag);
  assert.deepEqual(exp.bag, ['docs', 'water']);
  assert.deepEqual(exp.prep, ['addr']);
  const imp = importData(JSON.stringify(exp), defaults());
  assert.ok(imp.ok);
  assert.deepEqual(imp.data.bag, ['docs', 'water']);
  assert.equal(imp.data.bagAt, now);
  assert.deepEqual(imp.data.prep, ['addr']);
  const old = importData(JSON.stringify({ app: 'avtonomno', reserve: [] }), withBag);
  assert.ok(old.ok);
  assert.deepEqual(old.data.bag, ['docs', 'water'], 'старий файл без валізки не стирає позначки');
});

test('план на тривогу: обрізання, експорт та імпорт разом із лічильником укриттів', () => {
  const d = cleanData({ plan: { shelter: 'П'.repeat(300), meet: 42 } });
  assert.equal(d.plan.shelter.length, 120);
  assert.equal(d.plan.meet, '');
  assert.deepEqual(defaults().plan, { shelter: '', meet: '' });
  const src = cleanData({ plan: { shelter: 'Підвал 2-го під’їзду', meet: 'Біля школи' }, shelter: { since: Date.UTC(2026, 10, 16), count: 7, minutes: 300 } });
  const exp = exportData(src);
  assert.deepEqual(exp.plan, { shelter: 'Підвал 2-го під’їзду', meet: 'Біля школи' });
  assert.deepEqual(Object.keys(exp.shelter).sort(), ['count', 'last', 'minutes'], 'увімкнений режим укриття не експортується');
  const cur = cleanData({ shelter: { since: Date.UTC(2026, 10, 16, 10), count: 1 } });
  const imp = importData(JSON.stringify(exp), cur);
  assert.ok(imp.ok);
  assert.equal(imp.data.plan.shelter, 'Підвал 2-го під’їзду');
  assert.equal(imp.data.shelter.count, 7);
  assert.equal(imp.data.shelter.since, Date.UTC(2026, 10, 16, 10), 'поточний режим укриття не збивається імпортом');
  const old = importData(JSON.stringify({ app: 'avtonomno', reserve: [] }), src);
  assert.equal(old.data.plan.meet, 'Біля школи', 'старий файл без плану не стирає план');
});

test('Service Worker кешує кожен модуль застосунку', () => {
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((x) => x[1]));
  const modules = readdirSync(new URL('.', import.meta.url)).filter((f) => f.endsWith('.js') && f !== 'sw.js');
  for (const f of modules) assert.ok(listed.has(f), `модуль ${f} не в кеші офлайн`);
  assert.match(sw, /const VERSION = 'avtonomno-v2\.\d+\.\d+'/);
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  assert.ok(sw.includes(`avtonomno-v${pkg.version}'`), 'версія кешу збігається з package.json');
});

test('ярлики застосунку: укриття, перша допомога, холодно, валізка', () => {
  const m = JSON.parse(readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
  const urls = (m.shortcuts || []).map((s) => s.url);
  assert.deepEqual(urls, ['./#/shelter', './#/aid', './#/need/heat', './#/bag']);
  for (const s of m.shortcuts) assert.ok(!/[Zz]/.test(s.name + s.short_name), s.name);
});
