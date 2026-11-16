// Тести QR-коду: еталонні значення зі стандарту ISO/IEC 18004 і структура матриці.
// Під час розробки кожен код ще й розпізнавали трьома незалежними декодерами (OpenCV, WeChat, ArUco):
// 223 коди, версії 1–10, усі 8 масок, кирилиця — усі прочитано.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rsRemainder, formatBits, versionBits, dataCapacity, pickVersion, dataCodewords, qrMatrix, qrSvg, MAX_VERSION } from './qr.js';
import { sheetText, ALARM_STEPS, SHEET_RULES } from './shelter.js';

test('корекція помилок Ріда — Соломона: еталон «HELLO WORLD», версія 1-M', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(rsRemainder(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('біти формату для рівня M і всіх восьми масок — за таблицею стандарту', () => {
  const table = ['101010000010010', '101000100100101', '101111001111100', '101101101001011', '100010111111001', '100000011001110', '100111110010111', '100101010100000'];
  table.forEach((bits, mask) => assert.equal(formatBits(mask).toString(2).padStart(15, '0'), bits, `маска ${mask}`));
});

test('біти версії 7–10 — за таблицею стандарту', () => {
  assert.equal(versionBits(7).toString(2).padStart(18, '0'), '000111110010010100');
  assert.equal(versionBits(8).toString(2).padStart(18, '0'), '001000010110111100');
  assert.equal(versionBits(9).toString(2).padStart(18, '0'), '001001101010011001');
  assert.equal(versionBits(10).toString(2).padStart(18, '0'), '001010010011010011');
});

test('місткість і вибір версії', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10].map(dataCapacity), [16, 28, 44, 64, 86, 216]);
  assert.equal(pickVersion(14), 1);
  assert.equal(pickVersion(15), 2);
  assert.equal(pickVersion(26), 2);
  assert.equal(pickVersion(27), 3);
  assert.equal(pickVersion(213), MAX_VERSION);
  assert.equal(pickVersion(214), 0, 'задовгий текст — не вигадуємо код');
  assert.throws(() => qrMatrix('x'.repeat(300)));
});

test('кодові слова даних: режим байтів, довжина, доповнення 0xEC/0x11', () => {
  const cw = dataCodewords([0x41, 0x42], 1);
  assert.equal(cw.length, 16);
  assert.deepEqual(cw.slice(0, 4), [0x40, 0x24, 0x14, 0x20]);
  assert.deepEqual(cw.slice(4, 8), [0xec, 0x11, 0xec, 0x11]);
});

test('матриця: розмір, шукачі, смуги синхронізації, темний модуль', () => {
  for (const text of ['A', 'https://spartanetsd.github.io/avtonomno/', 'Автономно — офлайн-помічник', 'x'.repeat(200)]) {
    const { size, version, modules: m, mask } = qrMatrix(text);
    assert.equal(size, version * 4 + 17);
    assert.ok(mask >= 0 && mask <= 7);
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      assert.equal(m[cy][cx], true, 'центр шукача темний');
      assert.equal(m[cy - 2][cx], false, 'світле кільце шукача');
      assert.equal(m[cy - 3][cx], true, 'темна рамка шукача');
    }
    for (let i = 8; i < size - 8; i++) {
      assert.equal(m[6][i], i % 2 === 0, `горизонтальна смуга, ${i}`);
      assert.equal(m[i][6], i % 2 === 0, `вертикальна смуга, ${i}`);
    }
    assert.equal(m[size - 8][8], true, 'темний модуль');
  }
});

test('однаковий текст — однаковий код; маска задається для перевірки', () => {
  const a = qrMatrix('https://example.org/');
  const b = qrMatrix('https://example.org/');
  assert.deepEqual(a.modules, b.modules);
  const c = qrMatrix('https://example.org/', 3);
  assert.equal(c.mask, 3);
});

test('SVG: тиха зона, доступна назва, безпечне екранування', () => {
  const svg = qrSvg('https://example.org/', 'Код "застосунку" <тест>');
  const { size } = qrMatrix('https://example.org/');
  assert.ok(svg.includes(`viewBox="0 0 ${size + 8} ${size + 8}"`));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('aria-label="Код &quot;застосунку&quot; &lt;тест&gt;"'));
  assert.ok(!/[Zz]/.test(svg.replace(/https?:\/\/\S+/g, '')));
});

test('пам’ятка текстом для чату будинку', () => {
  const t = sheetText('https://example.org/app/');
  assert.ok(t.startsWith('УКРИТТЯ: ЩО РОБИТИ'));
  assert.ok(t.includes('112 — єдиний номер'));
  assert.ok(t.includes('101 — рятувальники ДСНС'), 'абревіатури не псуються');
  assert.ok(t.includes(`1. ${ALARM_STEPS[0]}`));
  assert.ok(t.includes(`• ${SHEET_RULES[0]}`));
  assert.ok(t.includes('хвилину тиші'));
  assert.ok(t.trim().endsWith('https://example.org/app/'));
  assert.ok(!t.includes('undefined'));
});
