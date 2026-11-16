// Тести рушія рекомендацій і безпеки. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, recommend, quickActions, planFromState, reserveInsight, searchLibrary, safetyGate } from './engine.js';
import { SOLUTIONS, MYTHS } from './solutions.js';
import { stateAlerts } from './safety.js';
import { NEED_ORDER, SEASON_ORDER, PLACES, LIMITS, EQUIP } from './data.js';

/** Базовий контекст із можливістю перевизначення */
function ctxOf({ profile = {}, state = {}, reserve = [], season = 'winter' } = {}) {
  return buildContext({
    profile: { place: 'apartment', equip: [], limits: [], duration: 'd3', budget: 0, ...profile },
    state: { power: false, gas: false, tap: true, waterL: null, batteryPct: null, roomC: null, adults: 1, kids: 0, elderly: 0, pets: 0, petKg: 0, ...state },
    reserve,
    season,
  });
}

test('сценарій із промпту: зима, квартира, без світла й газу, +12 °C, 0 грн, виходити небезпечно', () => {
  const ctx = ctxOf({
    profile: { equip: ['thermos'], limits: ['noOutside'], budget: 0 },
    state: { roomC: 12, adults: 2 },
    reserve: [
      { id: 'a', key: 'blankets', name: 'Ковдри', cat: 'warm', qty: 4, unit: 'шт', ok: true },
    ],
  });
  const r = recommend('heat', ctx, '30');
  assert.equal(r.items[0].sol.id, 'heat-room', 'першою має бути тепла зона в одній кімнаті');
  const ids = r.items.map((i) => i.sol.id);
  assert.ok(ids.includes('heat-layers') || ids.includes('heat-canopy'));
  for (const it of r.items) {
    assert.ok(!it.sol.uses.flame, 'жодного полум’я');
    assert.ok(!it.sol.uses.combustion, 'жодного горіння');
    assert.equal(it.costNow, 0, 'бюджет 0 грн');
  }
  // попередження про переохолодження/холод є
  const al = stateAlerts(ctx).filter((a) => a.need === 'heat');
  assert.ok(al.length >= 1);
  // вихід надвір не пропонується
  assert.ok(r.blocked.some((b) => b.sol.id === 'heat-relocate'));
});

test('небезпечні міфи ніколи не рекомендуються — перебір тисяч контекстів', () => {
  const places = Object.keys(PLACES);
  const limits = Object.keys(LIMITS);
  const equipKeys = EQUIP.map((e) => e.key);
  const mythIds = new Set(MYTHS.map((m) => m.id));
  let rnd = 42;
  const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
  let checked = 0;
  for (let i = 0; i < 400; i++) {
    const ctx = ctxOf({
      profile: {
        place: places[Math.floor(rand() * places.length)],
        equip: equipKeys.filter(() => rand() < 0.4),
        limits: limits.filter(() => rand() < 0.3),
        budget: [0, 500, 2000, 5000, 1000000][Math.floor(rand() * 5)],
        duration: ['h12', 'd3', 'd7', 'd7plus'][Math.floor(rand() * 4)],
      },
      state: { power: rand() < 0.5, gas: rand() < 0.5, tap: rand() < 0.5, roomC: Math.round(rand() * 45 - 5), waterL: Math.round(rand() * 30) },
      season: SEASON_ORDER[Math.floor(rand() * 4)],
    });
    for (const need of NEED_ORDER) {
      for (const mode of ['5', '30', 'long']) {
        const r = recommend(need, ctx, /** @type {any} */ (mode), 10);
        for (const it of [...r.items, ...r.more]) {
          checked++;
          assert.ok(!mythIds.has(it.sol.id), `міф у рекомендаціях: ${it.sol.id}`);
          assert.notEqual(it.sol.risk, 'danger');
          if (ctx.limits.has('noFlame')) assert.ok(!it.sol.uses.flame, `полум’я при забороні: ${it.sol.id}`);
          if (ctx.place === 'shelter') assert.ok(!it.sol.uses.combustion, `горіння в укритті: ${it.sol.id}`);
          if (ctx.limits.has('noOutside')) {
            const out = it.sol.uses.outside === true || (it.sol.uses.outside === 'unlessCar' && ctx.place !== 'car');
            assert.ok(!out, `вихід надвір при забороні: ${it.sol.id}`);
          }
          assert.ok(it.costNow <= ctx.budget, `поза бюджетом: ${it.sol.id}`);
        }
      }
    }
  }
  assert.ok(checked > 5000);
});

test('пальник: заборонений в укритті й автомобілі, обережність у квартирі', () => {
  const burner = SOLUTIONS.find((s) => s.id === 'food-burner');
  assert.ok(burner);
  assert.equal(safetyGate(burner, ctxOf({ profile: { place: 'shelter', equip: ['burner'] } })).ok, false);
  assert.equal(safetyGate(burner, ctxOf({ profile: { place: 'car', equip: ['burner'] } })).ok, false);
  assert.equal(safetyGate(burner, ctxOf({ profile: { place: 'apartment', equip: ['burner'], limits: ['noFlame'] } })).ok, false);
  const g = safetyGate(burner, ctxOf({ profile: { place: 'apartment', equip: ['burner'] } }));
  assert.equal(g.ok, true);
  assert.equal(g.level, 'caution');
});

test('пальник у квартирі ранжується нижче за безпечні варіанти', () => {
  const ctx = ctxOf({ profile: { equip: ['burner', 'thermos'], budget: 5000 } });
  const r = recommend('food', ctx, '30', 10);
  const ids = r.items.map((i) => i.sol.id);
  assert.ok(ids.includes('food-burner'));
  assert.ok(ids.indexOf('food-burner') > ids.indexOf('food-nocook'));
});

test('рекомендації змінюються залежно від ресурсів', () => {
  const without = recommend('food', ctxOf(), '30').items.map((i) => i.sol.id);
  const withThermos = recommend('food', ctxOf({ profile: { equip: ['thermos', 'station'] } }), '30').items.map((i) => i.sol.id);
  assert.ok(!without.includes('food-thermos'));
  assert.ok(withThermos.includes('food-thermos') || withThermos.includes('food-lowpower'));
  assert.notDeepEqual(without, withThermos);

  const e1 = recommend('energy', ctxOf(), '30').items.map((i) => i.sol.id);
  const e2 = recommend('energy', ctxOf({ profile: { equip: ['powerbank', 'station'] } }), '30').items.map((i) => i.sol.id);
  assert.notDeepEqual(e1, e2);
});

test('наявне обладнання робить рішення безкоштовним і проходить бюджет 0', () => {
  const r = recommend('heat', ctxOf({ reserve: [{ id: 'h', key: 'hotBottle', name: 'Грілка', cat: 'warm', qty: 1, unit: 'шт', ok: true }] }), '30', 10);
  const hb = r.items.find((i) => i.sol.id === 'heat-bottle');
  assert.ok(hb, 'грілка з резерву доступна');
  assert.equal(hb.costNow, 0);
});

test('позначене «недоступно» в резерві прибирає рішення', () => {
  const ctx = ctxOf({ profile: { equip: ['thermos'] }, reserve: [{ id: 't', key: 'thermos', name: 'Термос', cat: 'thermos', qty: 1, unit: 'шт', ok: false }] });
  const ids = recommend('food', ctx, '30', 10).items.map((i) => i.sol.id);
  assert.ok(!ids.includes('food-thermos'));
});

test('бюджет: дорогі рішення не потрапляють у «надовго» при 0 грн', () => {
  const r = recommend('energy', ctxOf({ profile: { budget: 0 } }), 'long', 20);
  for (const it of [...r.items, ...r.more]) assert.equal(it.costNow, 0);
  const r2 = recommend('energy', ctxOf({ profile: { budget: 1000000, duration: 'd7plus' } }), 'long', 20);
  assert.ok([...r2.items, ...r2.more].some((i) => i.sol.level === 4));
});

test('сезон: влітку в спеку охолодження є, а зігрівання не нав’язується', () => {
  const ctx = ctxOf({ season: 'summer', state: { roomC: 33 } });
  assert.ok(recommend('cool', ctx, '5').items.length > 0);
  const h = recommend('heat', ctx, '5');
  assert.equal(h.items.length, 0);
  assert.ok(h.irrelevant && h.noneText.includes('+33'));
  assert.ok(recommend('heat', ctx, 'long').items.length > 0, 'наперед можна готуватися');
});

test('сезон не відкидає рішення: обрана потреба завжди має варіанти, якщо температура не суперечить', () => {
  for (const season of SEASON_ORDER) for (const need of NEED_ORDER) for (const mode of ['5', '30', 'long']) {
    const r = recommend(need, ctxOf({ season }), mode);
    assert.ok(r.items.length > 0, `${season} ${need} ${mode}`);
  }
  const cool = recommend('cool', ctxOf({ season: 'winter', state: { roomC: 28 } }), '30');
  assert.ok(cool.items.length > 0 && !cool.irrelevant);
  const cold = recommend('cool', ctxOf({ season: 'summer', state: { roomC: 16 } }), '30');
  assert.ok(cold.irrelevant && cold.items.length === 0);
  const inSeason = recommend('cool', ctxOf({ season: 'summer' }), '30', 10).items;
  const offSeason = recommend('cool', ctxOf({ season: 'winter' }), '30', 10).items;
  assert.ok(inSeason.length && offSeason.length);
});

test('план не повторює ту саму дію для різних потреб', () => {
  const p = planFromState(ctxOf({ state: { power: false, gas: false, tap: false, waterL: 1, adults: 2, roomC: 10 } }));
  const texts = p.needs.flatMap((n) => n.actions.map((a) => a.text));
  assert.equal(new Set(texts).size, texts.length, texts.join(' | '));
});

test('режим часу: «5 хвилин» лише швидкі кроки', () => {
  const r = recommend('heat', ctxOf(), '5', 10);
  for (const it of r.items) assert.ok(it.sol.prepMin <= 10);
});

test('«Зробіть зараз»: три короткі дії; при сильному холоді — перехід у тепло першим', () => {
  const a = quickActions('heat', ctxOf({ state: { roomC: 7 } }));
  assert.equal(a.length, 3);
  assert.equal(a[0].id, 'heat-relocate');
  const b = quickActions('water', ctxOf({ state: { waterL: 1, adults: 2 } }));
  assert.equal(b[0].id, 'water-calc');
});

test('попередження стану: вода, спека, детектор CO', () => {
  const al = stateAlerts(ctxOf({ state: { waterL: 5, adults: 2, tap: false } }));
  assert.ok(al.some((a) => a.id === 'water1' && a.level === 'danger'));
  const tapOn = stateAlerts(ctxOf({ state: { waterL: 5, adults: 2, tap: true } }));
  assert.ok(tapOn.some((a) => a.id === 'water1' && a.level === 'caution' && a.text.includes('з крана')), 'є водогін — наберіть запас, а не «небезпечно»');
  const hot = stateAlerts(ctxOf({ state: { roomC: 36 } }));
  assert.ok(hot.some((a) => a.id === 'hot35' && a.level === 'danger'));
  const co = stateAlerts(ctxOf({ profile: { equip: ['burner'] } }));
  assert.ok(co.some((a) => a.id === 'coalarm'));
});

test('план за станом: пріоритети відображають стан', () => {
  const p = planFromState(ctxOf({ state: { roomC: 8, waterL: 2, adults: 2 } }));
  assert.equal(p.alerts[0].level, 'danger');
  const needs = p.needs.map((n) => n.need);
  assert.ok(needs.indexOf('heat') <= 1);
  assert.ok(needs.includes('water'));
});

test('резерв: що можна зараз і чого бракує', () => {
  const empty = reserveInsight(ctxOf());
  assert.ok(empty.feasibleNow.length > 10);
  assert.ok(empty.missing.some((m) => m.key === 'light'));
  const full = reserveInsight(ctxOf({ profile: { equip: ['powerbank', 'thermos'] }, state: { waterL: 50 }, reserve: [
    { id: '1', key: 'lamp', name: 'Лампа', cat: 'light', qty: 1, unit: 'шт', ok: true },
    { id: '2', key: 'radio', name: 'Радіо', cat: 'comms', qty: 1, unit: 'шт', ok: true },
  ] }));
  assert.ok(!full.missing.some((m) => m.key === 'light' || m.key === 'power' || m.key === 'water'));
  assert.ok(full.feasibleNow.length > empty.feasibleNow.length);
});

test('пошук: знаходить і рішення, і небезпечні міфи; апостроф не заважає', () => {
  const c = ctxOf();
  assert.ok(searchLibrary({ q: 'термос' }, c).some((s) => s.id === 'food-thermos'));
  assert.ok(searchLibrary({ q: 'газова плита' }, c).some((s) => s.id === 'myth-gas-stove'));
  assert.ok(searchLibrary({ q: 'кипятіння' }, c).some((s) => s.id === 'water-boil'));
  assert.ok(searchLibrary({ need: 'water', level: 1 }, c).every((s) => s.need === 'water' && !('myth' in s) && s.level === 1));
  assert.ok(searchLibrary({ onlyNow: true }, c).every((s) => !('myth' in s)));
});
