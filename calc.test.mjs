// Тести калькуляторів. Запуск: npm test (node --test, без залежностей).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battery, waterHeat, waterNeeds, energyPlan, num, fmt, fmtHours, ratio, dayWord, daysText, lossCoeff } from './calc.js';
import { jouleWh, carnotEta, newtonTemp, fourierRelative, faradayHours } from './physics.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('num: кома як десятковий роздільник, порожнє — NaN', () => {
  assert.equal(num('2,5'), 2.5);
  assert.equal(num(' 1 000 '), 1000);
  assert.ok(Number.isNaN(num('')));
  assert.ok(Number.isNaN(num('abc')));
});

test('акумулятор: 12 В × 100 А·год × 0,85 ÷ 100 Вт = 10,2 год', () => {
  const r = battery({ voltage: 12, capacity: 100, unit: 'Ah', loadW: 100, k: 0.85 });
  assert.equal(r.ok, true);
  close(r.nominalWh, 1200);
  close(r.usableWh, 1020);
  close(r.hours, 10.2);
});

test('акумулятор: павербанк 20 000 мА·год при 3,7 В = 74 Вт·год', () => {
  const r = battery({ voltage: '3,7', capacity: '20000', unit: 'mAh', loadW: '10', k: '0,7' });
  assert.equal(r.ok, true);
  close(r.nominalWh, 74);
  close(r.usableWh, 51.8);
  close(r.hours, 5.18);
});

test('акумулятор: Вт·год не потребують напруги', () => {
  const r = battery({ capacity: 500, unit: 'Wh', loadW: 5, k: 0.85 });
  assert.equal(r.ok, true);
  close(r.hours, 85);
});

test('акумулятор: попередження, коли навантаження більше за вихід (потужність ≠ запас)', () => {
  const r = battery({ capacity: 1000, unit: 'Wh', loadW: 2000, k: 0.85, maxW: 1000 });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.level === 'danger'));
});

test('акумулятор: некоректні дані повертають помилки, а не NaN', () => {
  const r = battery({ voltage: 0, capacity: -1, unit: 'Ah', loadW: 0, k: 2 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 3);
});

test('нагрівання: 1 л від 20 до 100 °C — точно ≈93,02 Вт·год', () => {
  const r = waterHeat({ liters: 1, t0: 20, t1: 100, powerW: 2000, eff: 0.9 });
  assert.equal(r.ok, true);
  close(r.qWh, (4186 * 80) / 3600);
  close(r.minSourceWh, r.qWh / 0.9);
  close(r.minutesNoLoss, (r.minSourceWh / 2000) * 60);
  // Тепловтрати потужному чайнику майже не заважають: +1–3 %
  assert.ok(r.minutes > r.minutesNoLoss && r.minutes < r.minutesNoLoss * 1.03, `${r.minutes} vs ${r.minutesNoLoss}`);
  assert.ok(r.minutes > 3 && r.minutes < 3.2);
  close(r.sourceWh, (2000 * r.minutes) / 60);
});

test('нагрівання: тепловтрати за законом Ньютона — мала потужність воду не нагріє', () => {
  // Скріншот користувача: 12 Вт, 1 л, з 15 до 70 °C — раніше застосунок показував «6 год 15 хв»
  const r = waterHeat({ liters: '1', t0: '15', t1: '70', powerW: '12', eff: '0,85' });
  assert.equal(r.ok, true);
  assert.equal(r.reachable, false);
  assert.equal(r.minutes, Infinity);
  close(r.k, lossCoeff(1));
  close(r.tMax, 15 + (12 * 0.85) / lossCoeff(1));
  assert.ok(r.tMax > 30 && r.tMax < 36, String(r.tMax));
  assert.ok(r.minPowerW > 30 && r.minPowerW < 40, String(r.minPowerW));
  assert.ok(r.power30W > 150 && r.power30W < 190, String(r.power30W));
  assert.ok(r.warnings.some((w) => w.level === 'danger' && w.text.includes('не нагріється')));
  // Потужність, достатня для 30 хв, справді нагріває приблизно за 30 хв
  const r30 = waterHeat({ liters: 1, t0: 15, t1: 70, powerW: r.power30W, eff: 0.85 });
  assert.ok(r30.reachable && Math.abs(r30.minutes - 30) < 0.01, String(r30.minutes));
  // 100 Вт — нагріє, але помітно довше, ніж без утрат, і чесно про це скаже
  const r100 = waterHeat({ liters: 1, t0: 15, t1: 70, powerW: 100, eff: 0.85 });
  assert.ok(r100.reachable && r100.minutes > r100.minutesNoLoss * 1.15);
  assert.ok(r100.warnings.some((w) => w.level === 'caution' && w.text.includes('Тепловтрати')));
  // Більший об’єм — більші втрати, але менші на літр
  assert.ok(lossCoeff(5) > lossCoeff(1) && lossCoeff(5) / 5 < lossCoeff(1));
});

test('нагрівання: «потрібно від N Вт» збігається з тим, що справді нагріє', () => {
  for (const liters of [0.2, 1, 3, 10, 50]) for (const [t0, t1] of [[20, 40], [15, 70], [0, 100]]) for (const eff of [0.5, 0.85, 1]) {
    const base = { liters, t0, t1, eff };
    const { needW } = waterHeat({ ...base, powerW: 20000 });
    assert.ok(Number.isInteger(needW) && needW >= 1);
    assert.equal(waterHeat({ ...base, powerW: needW }).reachable, true, `${liters} л ${t0}→${t1} ККД ${eff}: ${needW} Вт мали б нагріти`);
    if (needW > 1) assert.equal(waterHeat({ ...base, powerW: needW - 1 }).reachable, false, `${liters} л ${t0}→${t1} ККД ${eff}: ${needW - 1} Вт не мали б нагріти`);
  }
  // Попередження називає те саме число, що й живий рядок
  const r = waterHeat({ liters: '1', t0: '15', t1: '70', powerW: '12', eff: '0,85' });
  assert.ok(r.warnings[0].text.includes(`щонайменше ${r.needW} Вт`), r.warnings[0].text);
});

test('нагрівання: ККД у відсотках, межі потужності, хибний вихід станції', () => {
  const pct = waterHeat({ liters: 1, t0: 15, t1: 100, powerW: 2000, eff: '85' });
  const frac = waterHeat({ liters: 1, t0: 15, t1: 100, powerW: 2000, eff: '0,85' });
  assert.equal(pct.ok, true);
  close(pct.minutes, frac.minutes);
  assert.equal(waterHeat({ liters: 1, t0: 15, t1: 100, powerW: 2000, eff: '150' }).ok, false);
  assert.equal(waterHeat({ liters: 1, t0: 15, t1: 100, powerW: 'Infinity', eff: 0.85 }).ok, false);
  assert.equal(waterHeat({ liters: 1, t0: 15, t1: 100, powerW: 2000, eff: 0.85, maxW: 'abc' }).ok, false);
  const one = waterHeat({ liters: 1, t0: 15, t1: 15, powerW: 2000, eff: 0.85 });
  assert.equal(one.ok, false);
  assert.equal(one.errors.filter((e) => e.includes('вищою')).length, 1);
});

test('нагрівання: інвертор додає втрати, бажана t не нижча за початкову', () => {
  const r = waterHeat({ liters: 2, t0: 15, t1: 100, powerW: 800, eff: 0.85, inverter: true });
  assert.equal(r.ok, true);
  close(r.batteryWh, r.sourceWh / 0.85);
  const bad = waterHeat({ liters: 1, t0: 80, t1: 60, powerW: 1000, eff: 0.8 });
  assert.equal(bad.ok, false);
});

test('вода: 2 дорослих × 3 доби × 7,5 л = 45 л; пиття окремо', () => {
  const r = waterNeeds({ adults: 2, kids: 0, elderly: 0, days: 3, drink: 2.5, cook: 3, hygiene: 2 });
  assert.equal(r.ok, true);
  close(r.total, 45);
  close(r.drinkingOnly, 15);
});

test('вода: спека подвоює пиття, тварини враховуються за масою', () => {
  const r = waterNeeds({ adults: 1, kids: 0, elderly: 0, days: 1, drink: 3, cook: 0, hygiene: 0, petKg: 20, hot: true });
  assert.equal(r.ok, true);
  close(r.daily, 6 + 20 * 0.06 * 1.5);
});

test('вода: наявний запас дає кількість діб', () => {
  const r = waterNeeds({ adults: 2, kids: 0, elderly: 0, days: 3, drink: 2.5, cook: 0, hygiene: 1.3, haveL: 15.2 });
  assert.equal(r.ok, true);
  close(r.daysCovered, 2);
});

test('енергопріоритети: спершу критичне, далі за порядком', () => {
  const r = energyPlan({
    availableWh: 100, days: 1, devices: [
      { name: 'Інше', watts: 50, hours: 2, cat: 5 },
      { name: 'Світло', watts: 5, hours: 4, cat: 2 },
      { name: 'Критичне', watts: 30, hours: 2, cat: 1 },
    ],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows.map((x) => x.name), ['Критичне', 'Світло', 'Інше']);
  assert.equal(r.rows[0].status, 'full');
  assert.equal(r.rows[1].status, 'full');
  assert.equal(r.rows[2].status, 'partial');
  close(r.rows[2].got, 20);
  close(r.autonomyDays, 100 / 180);
});

test('енергопріоритети: медичний пристрій позначається', () => {
  const r = energyPlan({ availableWh: 500, days: 2, devices: [{ name: 'Медичний', watts: 40, hours: 8, cat: 1, medical: true }] });
  assert.equal(r.ok, true);
  assert.equal(r.medical, true);
});

test('форматування українською', () => {
  assert.equal(fmt(2.5), '2,5');
  assert.equal(fmt(1234), '1 234');
  assert.equal(fmtHours(1.5), '1 год 30 хв');
  assert.equal(fmtHours(0.25), '15 хв');
  assert.equal(fmtHours(Infinity), '∞');
});

test('доби: правильні форми слова, зокрема для дробових', () => {
  assert.equal(dayWord(1), 'доба');
  assert.equal(dayWord(1, true), 'добу');
  assert.equal(dayWord(2), 'доби');
  assert.equal(dayWord(5), 'діб');
  assert.equal(dayWord(11), 'діб');
  assert.equal(dayWord(21), 'доба');
  assert.equal(dayWord(22, true), 'доби');
  assert.equal(dayWord(2.5), 'доби');
  assert.equal(daysText(1.5, true), '1,5 доби');
  assert.equal(daysText(1, true), '1 добу');
  assert.equal(daysText(2.96), '3 доби', 'слово за округленим числом');
  assert.equal(fmtHours(24 * 5), '5 діб', 'раніше було «5 доби»');
  assert.equal(fmtHours(24 * 21), '21 доба');
  assert.equal(fmtHours(24 * 2.5), '2,5 доби');
});

test('введення чисел: лише скінченні числа, кома й пробіли, відсотки для часток', () => {
  assert.ok(Number.isNaN(num('Infinity')));
  assert.ok(Number.isNaN(num('1e999')));
  assert.ok(Number.isNaN(num('5e3')), 'експоненти людина не вводить — це помилка набору');
  assert.ok(Number.isNaN(num('1,2,3')));
  assert.ok(Number.isNaN(num('12 Вт')));
  assert.ok(Number.isNaN(num(Infinity)));
  assert.equal(num(' 10 000 '), 10000);
  assert.equal(num('10\u00A0000'), 10000);
  assert.equal(num('5,'), 5);
  assert.equal(num(',5'), 0.5);
  assert.equal(num('-3'), -3);
  assert.equal(ratio('85'), 0.85);
  assert.equal(ratio('0,85'), 0.85);
  assert.equal(ratio('1'), 1);
  assert.equal(ratio('100'), 1);
  assert.equal(ratio('150'), 150, 'понад 100 % — це помилка, її покаже перевірка');
  const r = battery({ voltage: '3,7', capacity: '20000', unit: 'mAh', loadW: '10', k: '70' });
  assert.equal(r.ok, true);
  close(r.usableWh, 74 * 0.7);
});

test('вода: нечислові люди — помилка, а не мовчазний нуль; доби від 0,5', () => {
  const bad = waterNeeds({ adults: 'два', kids: '', elderly: '', days: 3, drink: 2.5, cook: 3, hygiene: 2 });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes('цілі числа')));
  const half = waterNeeds({ adults: 2, kids: '', elderly: '', days: '0,5', drink: 2.5, cook: 3, hygiene: 2 });
  assert.equal(half.ok, true);
  close(half.total, 7.5);
  assert.equal(waterNeeds({ adults: 2, kids: 0, elderly: 0, days: '0,2', drink: 2.5, cook: 3, hygiene: 2 }).ok, false);
});

test('фізичні міні-моделі', () => {
  assert.equal(jouleWh(100, 2), 200);
  close(carnotEta(600, 20), 1 - 293.15 / 873.15);
  close(newtonTemp(95, 20, 0, 5), 95);
  assert.ok(newtonTemp(95, 20, 6, 20) > newtonTemp(95, 20, 6, 0.45));
  close(fourierRelative(1, 0), 1);
  assert.ok(fourierRelative(0.5, 2) < 0.5);
  close(faradayHours(5), 15 / 3);
});
