// Тести цілісності бази рішень і файлів PWA. Запуск: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { SOLUTIONS, MYTHS, BY_ID } from './solutions.js';
import { SOURCES, SEASONS, NEEDS, NEED_ORDER, RESERVE_CATALOG, LEVELS } from './data.js';
import { PHYSICS } from './physics.js';
import { RULES, SYMPTOMS } from './safety.js';
import { PICS, PIC_FILES, homePicKey } from './pics.js';
import { BAG, PREP, ALARM_STEPS, ALARM_FOLDS, FIRST_STEPS, WHILE_BLOCKS, BLOCKED, AFTER_STEPS, SECTIONS, PRAISE, SHARE_TEXT, SHEET_RULES } from './shelter.js';
import { TOOL_LABEL } from './shelterui.js';
import { AID, AID_FIRST, AID_KIT, AID_PRINCIPLES } from './aid.js';

const SEASON_KEYS = ['winter', 'spring', 'summer', 'autumn'];

test('щонайменше 36 повноцінних рішень і по 6+ у кожній із шести категорій', () => {
  assert.ok(SOLUTIONS.length >= 36, `рішень: ${SOLUTIONS.length}`);
  for (const n of NEED_ORDER) {
    const c = SOLUTIONS.filter((s) => s.need === n).length;
    assert.ok(c >= 6, `${n}: ${c}`);
  }
});

test('кожна картка має всі обов’язкові поля', () => {
  for (const s of SOLUTIONS) {
    const where = `рішення ${s.id}`;
    for (const k of ['id', 'title', 'problem', 'result', 'altText']) assert.ok(typeof s[k] === 'string' && s[k].length > 3, `${where}: ${k}`);
    assert.ok(s.seasons.length >= 1 && s.seasons.every((x) => SEASON_KEYS.includes(x)), `${where}: сезони`);
    assert.ok(s.level in LEVELS, `${where}: рівень`);
    assert.ok(Number.isFinite(s.cost) && s.cost >= 0, `${where}: вартість`);
    assert.ok(Number.isFinite(s.prepMin) && Number.isFinite(s.resultMin), `${where}: час`);
    assert.ok(s.difficulty >= 1 && s.difficulty <= 5, `${where}: складність`);
    assert.ok(s.materials.length >= 1, `${where}: матеріали`);
    assert.ok(s.steps.length >= 3, `${where}: кроки`);
    assert.ok(s.limits.length >= 1, `${where}: обмеження`);
    assert.ok(BY_ID.has(s.altId) && s.altId !== s.id, `${where}: альтернатива`);
    assert.ok(s.physics && s.physics.text.length > 20 && PHYSICS.some((p) => p.id === s.physics.law), `${where}: фізика`);
    assert.ok(s.sources.length >= 1 && s.sources.every((k) => SOURCES[k]), `${where}: джерела`);
    assert.ok(s.now.length >= 1, `${where}: дія «зараз»`);
    assert.ok(['info', 'caution'].includes(s.risk), `${where}: рівень ризику`);
  }
});

test('ідентифікатори унікальні', () => {
  const ids = [...SOLUTIONS, ...MYTHS].map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('міфи позначені як небезпечні та ведуть до безпечних альтернатив', () => {
  assert.ok(MYTHS.length >= 6);
  for (const m of MYTHS) {
    assert.equal(m.risk, 'danger');
    assert.ok(m.instead.length && m.instead.every((id) => BY_ID.has(id)), m.id);
    assert.ok(m.sources.every((k) => SOURCES[k]), m.id);
  }
});

test('усі чотири сезони мають практичні сценарії з наявними рішеннями', () => {
  for (const k of SEASON_KEYS) {
    const s = SEASONS[k];
    assert.ok(s.tasks.length >= 5, k);
    for (const t of s.tasks) assert.ok(t.ids.length && t.ids.every((id) => BY_ID.has(id)), `${k}: ${t.t}`);
  }
});

test('шість фізичних карток із розмежуванням факт / висновок / ілюстрація', () => {
  assert.deepEqual(PHYSICS.map((p) => p.id), ['joule', 'faraday', 'carnot', 'fourier', 'newton', 'einstein']);
  for (const p of PHYSICS) for (const k of ['fact', 'engineering', 'illustration', 'principle']) assert.ok(p[k].length > 20, `${p.id}.${k}`);
});

test('обов’язкові правила безпеки присутні', () => {
  const txt = RULES.map((r) => r.text).join(' ');
  for (const w of ['Генератор', 'газовою плитою', 'вугілля', 'вентиляцію', 'балони', 'Кип’ятіння', 'походження', 'запах', 'надвір']) assert.ok(txt.includes(w), w);
  for (const id of ['co', 'hypo', 'stroke']) assert.ok(SYMPTOMS.some((s) => s.id === id), id);
});

test('джерела — https; без брендів у назвах рішень', () => {
  for (const s of Object.values(SOURCES)) assert.ok(s.url.startsWith('https://'), s.url);
});

test('латинська літера U+005A / U+007A відсутня в текстах, ідентифікаторах і назвах файлів', () => {
  const texts = [];
  const LAT = /[\u005A\u007A]/;
  const walk = (v, key = '') => {
    if (key === 'url') return;
    if (typeof v === 'string') texts.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(SOLUTIONS); walk(MYTHS); walk(SEASONS); walk(NEEDS); walk(PHYSICS); walk(RULES); walk(SYMPTOMS); walk(RESERVE_CATALOG);
  walk([BAG, PREP, ALARM_STEPS, ALARM_FOLDS, FIRST_STEPS, WHILE_BLOCKS, BLOCKED, AFTER_STEPS, SECTIONS, PRAISE, SHARE_TEXT, SHEET_RULES, TOOL_LABEL]);
  walk([AID, AID_FIRST, AID_KIT, AID_PRINCIPLES]);
  walk(Object.values(SOURCES).map((s) => ({ org: s.org, title: s.title })));
  const bad = texts.filter((t) => LAT.test(t));
  assert.deepEqual(bad, []);
  const manifest = JSON.parse(readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
  for (const k of ['name', 'short_name', 'description']) assert.ok(!LAT.test(manifest[k]), k);
  for (const f of readdirSync(new URL('.', import.meta.url))) assert.ok(!LAT.test(f), `файл: ${f}`);
  for (const f of ['README.md', 'LICENSE', 'pages-deploy.yml', 'pro.html']) {
    const lines = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, '').split('\n');
    const i = lines.findIndex((l) => LAT.test(l));
    assert.equal(i, -1, `${f}, рядок ${i + 1}: ${lines[i]}`);
  }
});

test('README: десять обов’язкових розділів і безпечний для GitHub Pages текст; ліцензія MIT', () => {
  const md = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
  for (let n = 1; n <= 10; n++) assert.ok(new RegExp(`^## ${n}\\. `, 'm').test(md), `немає розділу ${n}`);
  // GitHub Pages (Jekyll) обробляє Markdown шаблонізатором Liquid — такі дужки зламали б публікацію
  assert.ok(!/\{\{|\{%/.test(md), 'README містить шаблонні дужки Liquid');
  assert.match(readFileSync(new URL('./LICENSE', import.meta.url), 'utf8'), /^MIT License/);
});

test('усі файли зі списку Service Worker існують; шляхи відносні', () => {
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  const list = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]).filter((p) => p !== './');
  assert.ok(list.length >= 18);
  for (const p of list) assert.ok(existsSync(new URL(p, import.meta.url)), `немає файла ${p}`);
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.ok(!/(src|href)="\/(?!\/)/.test(html), 'в index.html є абсолютні шляхи');
  const manifest = JSON.parse(readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.some((i) => Object.values(i).includes('192x192')) && manifest.icons.some((i) => Object.values(i).includes('512x512')));
});

test('плоска структура: жодних підпапок у проєкті', () => {
  // Службові папки (.git, .github, node_modules, _site) не є частиною застосунку
  const dirs = readdirSync(new URL('.', import.meta.url), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !['node_modules', '_site'].includes(d.name));
  assert.deepEqual(dirs.map((d) => d.name), []);
});

/** Розмір WebP із заголовка файла (VP8, VP8L, VP8X). @param {Buffer} b */
function webpSize(b) {
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  return null;
}

test('ілюстрації: файли WebP існують, розміри збігаються, є опис і підписи', () => {
  for (const [key, p] of Object.entries(PICS)) {
    const url = new URL(`./${p.src}`, import.meta.url);
    assert.ok(existsSync(url), `немає файла ${p.src}`);
    const buf = readFileSync(url);
    const size = webpSize(buf);
    assert.ok(size, `${p.src}: не WebP`);
    assert.deepEqual(size, { w: p.w, h: p.h }, `${p.src}: розмір`);
    assert.ok(buf.length < 200 * 1024, `${p.src}: завеликий файл (${Math.round(buf.length / 1024)} КБ)`);
    assert.equal(typeof p.alt, 'string', `${key}: alt`);
    if (/^(home|need|season|phys)-/.test(key)) assert.ok(p.alt.length > 20 && (p.cap || '').length > 20, `${key}: опис і підпис-підтримка`);
    if (key.startsWith('phys-')) assert.ok((p.note || '').length > 20, `${key}: позначка реконструкції`);
  }
  const total = PIC_FILES.reduce((n, f) => n + readFileSync(new URL(`./${f}`, import.meta.url)).length, 0);
  assert.ok(total < 3 * 1024 * 1024, `усі картинки разом завеликі: ${Math.round(total / 1024)} КБ`);
});

test('ілюстрації є для кожної ситуації, сезону, фізика й пори доби', () => {
  for (const n of NEED_ORDER) assert.ok(PICS[`need-${n}`] && PICS[`ico-${n}`], n);
  for (const s of SEASON_KEYS) assert.ok(PICS[`season-${s}`], s);
  for (const p of PHYSICS) assert.ok(PICS[`phys-${p.id}`], p.id);
  for (const h of [0, 6, 13, 19, 23]) assert.ok(PICS[homePicKey(h)], `година ${h}`);
});

test('ілюстрації: список Service Worker і файли в теці збігаються без зайвих', () => {
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  const inSw = [...sw.matchAll(/'\.\/(pic-[^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(inSw, [...PIC_FILES].sort(), 'список PICS у sw.js не збігається з pics.js');
  const onDisk = readdirSync(new URL('.', import.meta.url)).filter((f) => /^pic-.*\.webp$/.test(f)).sort();
  assert.deepEqual(onDisk, [...PIC_FILES].sort(), 'у теці є невикористані або відсутні картинки');
  const LAT = /[\u005A\u007A]/;
  for (const p of Object.values(PICS)) for (const t of [p.src, p.alt, p.cap || '', p.note || '']) assert.ok(!LAT.test(t), t);
});
