// Тести 2.3: «Перша допомога», метроном реанімації, сайт проєкту pro.html. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  AID, AID_FIRST, AID_FIRST_SOURCES, AID_KIT, AID_KIT_SOURCES, AID_MORE, AID_PRINCIPLES,
  CPR_RATE, CPR_PUSHES, CPR_BREATH_S, CPR_SWAP_S, clock, cprBeat, cprInterval,
} from './aid.js';
import { SOURCES } from './data.js';
import { SYMPTOMS } from './safety.js';
import { sectionsFor, SECTIONS } from './shelter.js';

const read = (/** @type {string} */ f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');

test('перша допомога: кожна тема має кроки, рівень і чинні джерела МОЗ', () => {
  const ids = AID.map((t) => t.id);
  assert.deepEqual(new Set(ids).size, ids.length, 'ідентифікатори унікальні');
  for (const id of ['bleed', 'unresp', 'cpr', 'choke']) assert.ok(ids.includes(id), id);
  for (const t of AID) {
    assert.ok(t.title && t.short && t.lead, t.id);
    assert.ok(t.short.length <= 16, `${t.id}: коротка назва вміщається в кнопку`);
    assert.ok(t.steps.length >= 3 && t.steps.length <= 8, `${t.id}: кроків ${t.steps.length}`);
    for (const s of [...t.steps, ...(t.never || []), ...(t.kids || [])]) assert.ok(s.length <= 220 && /[.!?»)]$/.test(s), `${t.id}: «${s}»`);
    assert.ok(['danger', 'caution'].includes(t.level));
    assert.ok(t.sources.length >= 1);
    for (const k of t.sources) assert.ok(SOURCES[k], `${t.id}: немає джерела ${k}`);
    assert.ok(t.sources.some((k) => /МОЗ/.test(SOURCES[k].org)), `${t.id}: потрібне джерело МОЗ`);
  }
  for (const k of [...AID_FIRST_SOURCES, ...AID_KIT_SOURCES]) assert.ok(SOURCES[k], k);
  for (const id of AID_MORE) assert.ok(SYMPTOMS.some((s) => s.id === id), id);
  assert.equal(AID_PRINCIPLES.length, 3);
  assert.ok(AID_FIRST[0].includes('безпечно'), 'спершу — власна безпека');
  assert.ok(AID_KIT.some((k) => /Турнікет/.test(k.label)));
});

test('перша допомога: числа збігаються з наказом МОЗ № 441', () => {
  const cpr = AID.find((t) => t.id === 'cpr');
  const text = cpr ? cpr.steps.join(' ') : '';
  assert.match(text, /5–6 см/);
  assert.match(text, /100–120 за хвилину/);
  assert.match(text, /30 натискань 2 вдихи/);
  assert.match(text, /10 секунд/);
  assert.match(text, /2 хвилини/);
  assert.match((cpr?.kids || []).join(' '), /5 вдихів.*15 натискань і 2 вдихи/);
  const unresp = AID.find((t) => t.id === 'unresp')?.steps.join(' ') || '';
  assert.match(unresp, /10 секунд/);
  assert.match(unresp, /3–5 хвилин/);
  const choke = AID.find((t) => t.id === 'choke')?.steps.join(' ') || '';
  assert.match(choke, /5 ковзних ударів/);
  assert.match(choke, /5 поштовхів у живіт/);
  const bleed = AID.find((t) => t.id === 'bleed');
  assert.match(bleed?.steps.join(' ') || '', /якомога вище/);
  assert.match(bleed?.steps.join(' ') || '', /час накладання/);
  assert.match(bleed?.never?.join(' ') || '', /не знімайте турнікет/);
  const burn = SYMPTOMS.find((s) => s.id === 'burn');
  assert.match(burn?.act.join(' ') || '', /щонайменше 20 хвилин/);
  assert.ok(burn?.sources.includes('mohOrder'));
});

test('метроном реанімації: темп у межах 100–120, цикл 30:2', () => {
  assert.ok(CPR_RATE >= 100 && CPR_RATE <= 120);
  assert.equal(CPR_PUSHES, 30);
  assert.ok(CPR_BREATH_S <= 5);
  assert.equal(CPR_SWAP_S, 120);
  assert.ok(Math.abs(cprInterval() - 545.45) < 0.1);
  assert.deepEqual(cprBeat(1, true), { k: 1, breathe: false });
  assert.deepEqual(cprBeat(29, true), { k: 29, breathe: false });
  assert.deepEqual(cprBeat(30, true), { k: 30, breathe: true });
  assert.deepEqual(cprBeat(31, true), { k: 1, breathe: false });
  assert.deepEqual(cprBeat(30, false), { k: 30, breathe: false }, 'лише натискання — без пауз');
  assert.deepEqual(cprBeat(60, true), { k: 30, breathe: true });
  assert.deepEqual(cprBeat(0, true), { k: 1, breathe: false });
  assert.equal(clock(0), '0:00');
  assert.equal(clock(59.9), '0:59');
  assert.equal(clock(125), '2:05');
  assert.equal(clock(-3), '0:00');
});

test('пошук веде до першої допомоги й метронома', () => {
  for (const q of ['кровотеча', 'турнікет', 'джгут', 'реанімація', 'удавився', 'аптечка', 'судоми', 'Перша допомога']) {
    assert.ok(sectionsFor(q).some((s) => s.href === '#/aid'), q);
  }
  assert.ok(sectionsFor('метроном').some((s) => s.tool === 'cpr'));
  for (const q of ['екрана', 'покрівля', 'зупинка опалення', 'напад паніки']) {
    assert.ok(!sectionsFor(q).some((s) => s.href === '#/aid'), `зайвий збіг: ${q}`);
  }
  assert.ok(SECTIONS.every((s) => s.title && (s.href || s.tool)));
});

test('сайт проєкту pro.html: зв’язаний із застосунком, плоскі відносні шляхи', () => {
  const html = read('pro.html');
  assert.match(html, /<html lang="uk">/);
  assert.match(html, /href="landing\.css"/);
  assert.match(html, /src="policeman-paramedic\.webp"/);
  assert.match(html, /Рекомендують <span>поліцейські-парамедики<\/span>/);
  assert.match(html, /Фото: Національна поліція України/);
  assert.match(html, /не означає офіційного схвалення/);
  for (const h of ['./', './#/aid', './#/need/energy', './#/need/water', './#/need/heat', './#/plan', './#/shelter']) {
    assert.ok(html.includes(`href="${h}"`), `немає посилання ${h}`);
  }
  for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const p = m[1];
    if (p === './' || /^https?:/.test(p)) continue;
    assert.ok(!p.startsWith('/') && !p.includes('/'), `шлях не плоский: ${p}`);
    assert.ok(existsSync(new URL(`./${p}`, import.meta.url)), `немає файла ${p}`);
  }
  assert.ok(read('screens.js').includes('href="./pro.html"'), 'з «Про застосунок» є посилання на сайт');
  const sw = read('sw.js');
  for (const f of ['pro.html', 'landing.css', 'policeman-paramedic.webp', 'aid.js', 'aidui.js']) assert.ok(sw.includes(`'./${f}'`), `sw: ${f}`);
  assert.match(sw, /PAGES = \['\.\/pro\.html'\]/, 'сайт проєкту не підміняється оболонкою застосунку');
  const core = sw.slice(sw.indexOf('const CORE'), sw.indexOf('];', sw.indexOf('const CORE')));
  for (const f of ['pro.html', 'landing.css', 'policeman-paramedic.webp']) assert.ok(!core.includes(f), `${f} — необов’язковий, не блокує оновлення застосунку`);
  assert.match(sw, /const EXTRA = \['\.\/pro\.html', '\.\/landing\.css', '\.\/policeman-paramedic\.webp'\]/);
  assert.match(sw, /INSTALL_FAILED/, 'невдале оновлення не мовчить');
  assert.match(read('pages-deploy.yml'), /cp \*\.html \*\.css /, 'робочий процес публікує pro.html і landing.css');
  const photo = readFileSync(new URL('./policeman-paramedic.webp', import.meta.url));
  assert.equal(photo.toString('ascii', 8, 12), 'WEBP');
  assert.ok(photo.length < 120 * 1024);
});
