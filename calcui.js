// @ts-check
// Екрани калькуляторів і «Пояснює фізика».
// Введення без стрибків: відповідь — у липкому рядку вгорі, сторінка не перебудовується під час набору,
// пресети змінюють значення на місці, блок результату не стає нижчим, поки людина вводить.

import * as store from './store.js';
import { battery, waterHeat, waterNeeds, energyPlan, fmt, fmtHours, daysText, K_PRESETS, WATER_PRESETS, ENERGY_CATS, DEVICE_PRESETS, num } from './calc.js';
import { PHYSICS, PHYSICS_BY_ID, jouleWh, faradayHours, carnotEta, fourierRelative, newtonTemp, NEWTON_VESSELS } from './physics.js';
import { SOLUTIONS } from './solutions.js';
import { app, on, esc, icon, note, pageHead, chip, pic, tidyNum, numFieldState, bindNumField, keepInPlace } from './ui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */
/**
 * Відповідь калькулятора: підпис, число й короткий підсумок для живого рядка, деталі — під формою.
 * bad — поля, які суперечать одне одному (наприклад, бажана температура не вища за початкову).
 * @typedef {{ok:boolean, label:string, value:string, sub:string, html:string, msg?:string, tone?:'warn', bad?:string[]}} CalcOut
 */

/* ───────────── Збережені значення ───────────── */

const BATTERY_PRESETS = [
  { id: 'pb10', label: 'Павербанк 10 000 мА·год', voltage: '3,7', capacity: '10000', unit: 'mAh', k: '0,7', maxW: '' },
  { id: 'pb20', label: 'Павербанк 20 000 мА·год', voltage: '3,7', capacity: '20000', unit: 'mAh', k: '0,7', maxW: '' },
  { id: 'st300', label: 'Станція 300 Вт·год', voltage: '', capacity: '300', unit: 'Wh', k: '0,85', maxW: '300' },
  { id: 'st500', label: 'Станція 500 Вт·год', voltage: '', capacity: '500', unit: 'Wh', k: '0,85', maxW: '600' },
  { id: 'st1000', label: 'Станція 1000 Вт·год', voltage: '', capacity: '1000', unit: 'Wh', k: '0,85', maxW: '1500' },
  { id: 'car60', label: 'Автоакумулятор 12 В 60 А·год', voltage: '12', capacity: '60', unit: 'Ah', k: '0,3', maxW: '150' },
  { id: 'lfp100', label: 'LiFePO4 12 В 100 А·год', voltage: '12,8', capacity: '100', unit: 'Ah', k: '0,9', maxW: '' },
];

const LOAD_CHIPS = [
  { label: 'Телефон', w: '10' }, { label: 'LED-лампа', w: '5' }, { label: 'Роутер', w: '10' },
  { label: 'Ноутбук', w: '45' }, { label: 'Електроковдра', w: '60' }, { label: 'Чайник', w: '2000' },
];

const HEATER_CHIPS = [
  { label: 'Чайник 2000 Вт', w: '2000', eff: '0,85' },
  { label: 'Дорожній чайник 800 Вт', w: '800', eff: '0,85' },
  { label: 'Індукція 1000 Вт', w: '1000', eff: '0,8' },
  { label: 'Електроплитка 1000 Вт', w: '1000', eff: '0,6' },
];

const VOLT_HINT = 'Для павербанків — 3,6–3,7 В (напруга елементів, не 5 В).';

/** @returns {Record<string, any>} */
function defaultsFor(/** @type {string} */ name) {
  const s = store.get().state;
  const c = app.ctx();
  switch (name) {
    case 'battery': return { preset: 'pb20', voltage: '3,7', capacity: '20000', unit: 'mAh', loadW: '10', k: '0,7', maxW: '' };
    case 'heat': return { liters: '1', t0: '15', t1: '100', powerW: '2000', eff: '0,85', inverter: false, maxW: '' };
    case 'water': return { preset: 'basic', adults: String(s.adults ?? 1), kids: String(s.kids ?? 0), elderly: String(s.elderly ?? 0), days: '3', drink: '2,5', cook: '3', hygiene: '2', petKg: s.petKg ? String(s.petKg) : '', hot: false, haveL: c && c.waterL != null ? String(c.waterL).replace('.', ',') : '' };
    case 'plan': return { availableWh: '500', days: '1', devices: [
      { name: 'Телефон (заряджання)', watts: '10', hours: '1,5', cat: 3 },
      { name: 'LED-лампа', watts: '5', hours: '5', cat: 2 },
      { name: 'Wi‑Fi роутер', watts: '10', hours: '12', cat: 3 },
    ] };
    default: return {};
  }
}

/** @param {string} name */
function getCalc(name) {
  const d = store.get();
  if (!d.calc[name]) store.update((dd) => { dd.calc[name] = defaultsFor(name); });
  return store.get().calc[name];
}

/** @param {string} name @param {Record<string, any>} patch */
function setCalc(name, patch) {
  store.update((d) => { d.calc[name] = { ...(d.calc[name] || defaultsFor(name)), ...patch }; });
}

/* ───────────── Поля ───────────── */

/**
 * Правило поля: межі для миттєвої підказки, ціле число, необов’язкове, частка чи відсотки.
 * @typedef {{min?:number, max?:number, int?:boolean, opt?:boolean, pct?:boolean}} Rule
 */

/** @param {Rule} r */
function ruleAttrs(r) {
  return [
    r.min != null ? `data-min="${r.min}"` : '',
    r.max != null ? `data-max="${r.max}"` : '',
    r.int ? 'data-int="1"' : '',
    r.opt ? 'data-opt="1"' : '',
    r.pct ? 'data-pct="1"' : '',
  ].filter(Boolean).join(' ');
}

/**
 * Числове поле калькулятора. Цілі числа — цифрова клавіатура, дробові — з комою.
 * @param {string} calc @param {string} key @param {string} label @param {string} value
 * @param {string} [unit] @param {string} [hint] @param {Rule} [rule]
 */
function field(calc, key, label, value, unit = '', hint = '', rule = {}) {
  const id = `c-${calc}-${key}`;
  return `<div class="field" id="f-${calc}-${key}"><label for="${id}">${esc(label)}</label>
    <div class="inrow"><input id="${id}" type="text" inputmode="${rule.int ? 'numeric' : 'decimal'}" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false" data-calc="${calc}" data-k="${key}" ${ruleAttrs(rule)} value="${esc(value)}"${hint ? ` aria-describedby="${id}-h"` : ''}>${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>
    ${hint ? `<p class="hint" id="${id}-h">${esc(hint)}</p>` : ''}</div>`;
}

/** @param {{level:string, text:string}[]} ws */
function warnHtml(ws) {
  return ws.map((w) => note(/** @type {any} */ (w.level), '', w.text)).join('');
}

/** @param {string[]} errors */
function errHtml(errors) {
  return `<div class="note caution"><div class="note-h">${icon('i-warn')}<span class="note-l">Перевірте дані</span></div><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
}

/** @param {string[]} steps @param {string} [extra] */
function howHtml(steps, extra = '') {
  return `<details class="card fold how"><summary>${icon('i-calc')}<span>Як це пораховано?</span></summary><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>${extra}</details>`;
}

/** Порожня відповідь, поки даних бракує. @param {string} label @param {string[]} errors @param {string[]} [fields] @returns {CalcOut} */
function bad(label, errors, fields = []) {
  return { ok: false, label, value: '—', sub: '', msg: errors[0] || 'Перевірте дані', html: errHtml(errors), bad: fields };
}

/* ───────────── Живий рядок відповіді ───────────── */

/**
 * Живий рядок має сталу висоту (два рядки, довге — з трикрапкою), тож поля під ним не зсуваються.
 * @param {CalcOut} o
 */
function liveHtml(o) {
  return `<div class="calc-live${o.ok ? '' : ' stale'}${o.ok && o.tone === 'warn' ? ' warn' : ''}" id="calc-live" aria-live="polite" aria-atomic="true">
    <span class="cl-l">${esc(o.ok ? o.label : o.msg || o.label)}</span>
    <span class="cl-row"><b class="cl-v">${esc(o.ok ? o.value : '—')}</b><span class="cl-s">${esc(o.ok ? o.sub : '')}</span></span>
  </div>`;
}

/**
 * Оновлює рядок відповіді на місці. Коли даних бракує, лишає останнє число блідим,
 * а замість підпису пояснює, чого бракує, — нічого не зникає й не стрибає.
 * @param {CalcOut} o
 */
function setLive(o) {
  const el = document.getElementById('calc-live');
  if (!el) return;
  el.classList.toggle('stale', !o.ok);
  el.classList.toggle('warn', o.ok && o.tone === 'warn');
  const l = el.querySelector('.cl-l');
  const v = el.querySelector('.cl-v');
  const s = el.querySelector('.cl-s');
  if (l) l.textContent = o.ok ? o.label : focusedEmpty() ? 'Введіть значення — результат оновиться' : o.msg || 'Перевірте дані';
  if (v && o.ok) v.textContent = o.value;
  if (s) s.textContent = o.ok ? o.sub : '';
}

/**
 * Поля, що суперечать одне одному, отримують червону рамку. Поле, яке людина саме набирає,
 * не сварять посеред набору («7» на шляху до «70») — його перевірять, коли вона закінчить.
 * @param {string} name @param {CalcOut} o
 */
function markBad(name, o) {
  for (const key of o.bad || []) {
    const el = document.getElementById(`c-${name}-${key}`);
    if (el instanceof HTMLInputElement && el !== document.activeElement) el.setAttribute('aria-invalid', 'true');
  }
}

function focusedEmpty() {
  const a = document.activeElement;
  return a instanceof HTMLInputElement && a.type === 'text' && a.value.trim() === '';
}

/** Поточний калькулятор на екрані — щоб пресети перераховували без перебудови сторінки. */
let active = { name: '', update: () => {} };

/**
 * Поля калькулятора: збереження, миттєва підказка (червона рамка), перерахунок без стрибків.
 * @param {string} name
 * @param {() => CalcOut} out
 * @param {(inp: HTMLInputElement|HTMLSelectElement) => Record<string, any>} [extra] додаткові зміни при введенні
 */
function bindCalc(name, out, extra) {
  const form = /** @type {HTMLElement|null} */ (document.querySelector(`[data-form="${name}"]`));
  const outEl = document.getElementById('calc-out');
  const update = () => {
    const o = out();
    setLive(o);
    markBad(name, o);
    if (!outEl) return;
    // Поки людина вводить, блок результату не стає нижчим: інакше сторінка підскакує
    if (form && form.contains(document.activeElement)) outEl.style.minHeight = `${outEl.offsetHeight}px`;
    outEl.innerHTML = o.html;
  };
  active = { name, update };
  form?.querySelectorAll('[data-calc]').forEach((el) => {
    const inp = /** @type {HTMLInputElement|HTMLSelectElement} */ (el);
    const k = inp.dataset.k || '';
    // Поле, якого торкнулася людина, лишається на тому ж місці екрана, хоч би що змінилося вище
    if (inp instanceof HTMLSelectElement || inp.type === 'checkbox') {
      inp.addEventListener('change', () => keepInPlace(inp, () => {
        setCalc(name, { [k]: inp instanceof HTMLInputElement && inp.type === 'checkbox' ? inp.checked : inp.value, ...(extra ? extra(inp) : {}) });
        update();
      }));
      return;
    }
    bindNumField(/** @type {HTMLInputElement} */ (inp), (value) => keepInPlace(inp, () => {
      setCalc(name, { [k]: value, ...(extra ? extra(inp) : {}) });
      update();
    }));
  });
  form?.addEventListener('focusout', (e) => {
    setTimeout(() => markBad(name, out()), 0);
    const next = /** @type {Node|null} */ (/** @type {FocusEvent} */ (e).relatedTarget);
    if (next && form.contains(next)) return;
    const left = /** @type {Element|null} */ (e.target instanceof Element ? e.target : null);
    setTimeout(() => {
      if (outEl && outEl.style.minHeight && !form.contains(document.activeElement)) keepInPlace(left, () => { outEl.style.minHeight = ''; });
    }, 0);
  });
}

/**
 * Пресет змінює значення полів на місці й перераховує — без перебудови сторінки.
 * @param {string} name @param {Record<string, any>} patch
 */
function setVals(name, patch) {
  setCalc(name, patch);
  for (const [k, v] of Object.entries(patch)) {
    const el = document.getElementById(`c-${name}-${k}`);
    if (el instanceof HTMLInputElement && el.type === 'text') { el.value = String(v); el.setAttribute('aria-invalid', String(numFieldState(el, false) === 'bad')); }
    else if (el instanceof HTMLSelectElement) el.value = String(v);
  }
  if (active.name === name) active.update();
}

/** Сторінка калькулятора: заголовок, живий рядок відповіді, форма, деталі. @param {string} title @param {string} sub @param {CalcOut} o @param {string} name @param {string} form @param {string} [after] */
function calcPage(title, sub, o, name, form, after = '') {
  return `${pageHead(title, '#/calc', sub)}
    ${liveHtml(o)}
    <section class="card form" data-form="${name}">${form}</section>
    ${after}
    <section id="calc-out">${o.html}</section>`;
}

/* ───────────── Список ───────────── */

/** @returns {View} */
function listView() {
  const cards = [
    { id: 'battery', t: 'Автономність акумулятора', d: 'Скільки годин пропрацює прилад від павербанка, станції чи акумулятора', i: 'i-battery' },
    { id: 'heat', t: 'Нагрівання води', d: 'Скільки енергії й часу потрібно, щоб нагріти чи закип’ятити воду', i: 'i-thermo' },
    { id: 'water', t: 'Запас води', d: 'Скільки води потрібно людям і тваринам на кілька діб', i: 'i-drop' },
    { id: 'plan', t: 'Енергопріоритети', d: 'Як розподілити заряд між критичним, світлом, зв’язком і їжею', i: 'i-bolt' },
  ];
  return {
    title: 'Розрахунки',
    tab: 'calc',
    html: `${pageHead('Розрахунки', '', 'Робочі інструменти — без інтернету')}
    ${pic('calc')}
    <div class="list">${cards.map((c) => `<a class="card calc-card" href="#/calc/${c.id}"><span class="cc-i">${icon(c.i)}</span><span><b>${esc(c.t)}</b><span class="muted">${esc(c.d)}</span></span>${icon('i-chev', 'end')}</a>`).join('')}</div>
    <h2 class="h2" id="phys">Пояснює фізика</h2>
    <p class="hint">Принципи, пов’язані з роботами відомих учених. Факти, висновки й ілюстрації позначено окремо; цитати не вигадано.</p>
    <div class="phys-grid">${PHYSICS.map((p) => physCard(p)).join('')}</div>`,
  };
}

/** @param {typeof PHYSICS[number]} p */
function physCard(p) {
  return `<article class="card phys" id="ph-${p.id}">
    <div class="phys-h">${portrait(p.id)}<div><h3>${esc(p.name)}</h3><p class="muted">${esc(p.topic)}</p></div></div>
    <p>${esc(p.principle)}</p>
    <p class="example">${icon('i-home')}<span>${esc(p.example)}</span></p>
    <div class="row-btns"><button class="btn small primary" type="button" data-act="phys-open" data-v="${p.id}" aria-expanded="false" aria-controls="phx-${p.id}">Зрозуміти за 30 секунд</button><a class="linkbtn" href="#/physics/${p.id}">Детальніше</a></div>
    <div class="phys-x" id="phx-${p.id}" hidden>
      ${pic(`phys-${p.id}`, { cap: false, note: true })}
      <p><span class="tag fact">Науковий факт</span>${esc(p.fact)}</p>
      <p><span class="tag eng">Інженерний висновок</span>${esc(p.engineering)}</p>
      <p><span class="tag ill">Ілюстрація застосунку</span>${esc(p.illustration)}</p>
    </div>
  </article>`;
}

/** Абстрактна іконка-портрет у єдиному стилі (символ, не зображення людини). @param {string} id */
function portrait(id) {
  return `<span class="portrait" aria-hidden="true"><svg><use href="#p-${id}"></use></svg></span>`;
}

on({
  'phys-open': (el) => {
    const id = el.dataset.v;
    const box = document.getElementById(`phx-${id}`);
    if (!box) return;
    const open = box.hasAttribute('hidden');
    if (open) box.removeAttribute('hidden'); else box.setAttribute('hidden', '');
    el.setAttribute('aria-expanded', String(open));
    el.textContent = open ? 'Згорнути' : 'Зрозуміти за 30 секунд';
  },
});

/* ───────────── Калькулятори ───────────── */

/** @param {string} id @returns {View} */
function calcView(id) {
  if (id === 'battery') return batteryView();
  if (id === 'heat') return heatView();
  if (id === 'water') return waterView();
  return planView();
}

/* Акумулятор */

/** Поле напруги потрібне лише для мА·год і А·год. @param {string} unit */
function syncVolt(unit) {
  const f = document.getElementById('f-battery-voltage');
  if (f) f.hidden = unit === 'Wh';
  const h = document.getElementById('c-battery-voltage-h');
  if (h) h.textContent = unit === 'mAh' ? VOLT_HINT : 'Номінальна напруга: 12 В, 12,8 В (LiFePO4), 24 В…';
}

/** @returns {View} */
function batteryView() {
  const v = getCalc('battery');
  const voltField = field('battery', 'voltage', 'Напруга', v.voltage, 'В', v.unit === 'mAh' ? VOLT_HINT : 'Номінальна напруга: 12 В, 12,8 В (LiFePO4), 24 В…', { min: 0.1, max: 1000 });
  return {
    title: 'Автономність акумулятора',
    tab: 'calc',
    html: calcPage('Автономність акумулятора', 'Запас енергії й час роботи з урахуванням утрат', batteryOut(), 'battery', `
      <div class="field"><label for="c-battery-preset">Джерело</label>
        <select id="c-battery-preset">${BATTERY_PRESETS.map((p) => `<option value="${p.id}"${v.preset === p.id ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}<option value="custom"${v.preset === 'custom' ? ' selected' : ''}>Власні значення</option></select></div>
      <div class="grid2">
        ${field('battery', 'capacity', 'Ємність', v.capacity, '', '', { min: 0.001, max: 10000000 })}
        <div class="field"><label for="c-battery-unit">Одиниця</label><select id="c-battery-unit" data-calc="battery" data-k="unit">${[['mAh', 'мА·год'], ['Ah', 'А·год'], ['Wh', 'Вт·год']].map(([k, l]) => `<option value="${k}"${v.unit === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      ${v.unit === 'Wh' ? voltField.replace('<div class="field"', '<div class="field" hidden') : voltField}
      ${field('battery', 'loadW', 'Потужність навантаження', v.loadW, 'Вт', '', { min: 0.01, max: 100000 })}
      <div class="chips">${LOAD_CHIPS.map((c) => `<button type="button" class="chip" data-act="b-load" data-v="${c.w}">${esc(c.label)} · ${c.w} Вт</button>`).join('')}</div>
      ${field('battery', 'k', 'Коефіцієнт корисного використання', v.k, '', 'Від 0,05 до 1 (або у відсотках). Оберіть типовий:', { min: 0.05, max: 1, pct: true })}
      <div class="chips">${K_PRESETS.map((p) => `<button type="button" class="chip" data-act="b-k" data-v="${String(p.k).replace('.', ',')}">${esc(p.label)} · ${String(p.k).replace('.', ',')}</button>`).join('')}</div>
      ${field('battery', 'maxW', 'Потужність виходу джерела', v.maxW, 'Вт', 'Необов’язково: перевірить, чи «потягне» вихід ваш прилад.', { min: 0.1, opt: true })}`),
    after() {
      bindCalc('battery', batteryOut, (inp) => {
        if (inp.dataset.k === 'unit') syncVolt(inp.value);
        if (inp.dataset.k === 'loadW') return {};
        const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('c-battery-preset'));
        if (sel) sel.value = 'custom';
        return { preset: 'custom' };
      });
      const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('c-battery-preset'));
      sel?.addEventListener('change', () => {
        const p = BATTERY_PRESETS.find((x) => x.id === sel.value);
        if (!p) { setCalc('battery', { preset: 'custom' }); return; }
        syncVolt(p.unit);
        setVals('battery', { preset: p.id, voltage: p.voltage, capacity: p.capacity, unit: p.unit, k: p.k, maxW: p.maxW });
      });
    },
  };
}

/** @returns {CalcOut} */
function batteryOut() {
  const v = getCalc('battery');
  const r = battery({ voltage: v.voltage, capacity: v.capacity, unit: v.unit, loadW: v.loadW, k: v.k, maxW: v.maxW });
  const label = 'Орієнтовний час роботи';
  if (!r.ok) return bad(label, r.errors || []);
  const danger = (r.warnings || []).some((w) => w.level === 'danger');
  return {
    ok: true,
    label,
    value: fmtHours(r.hours || 0),
    sub: danger ? 'вихід джерела не потягне цей прилад' : `${fmt(r.usableWh || 0)} Вт·год доступно`,
    tone: danger ? 'warn' : undefined,
    html: `<div class="card result">
      <p class="r-label">Деталі</p>
      <ul class="r-list">
        <li>Номінальний запас: <b>${fmt(r.nominalWh || 0)} Вт·год</b></li>
        <li>Доступно з урахуванням утрат: <b>${fmt(r.usableWh || 0)} Вт·год</b></li>
        <li>Утрати (перетворення, нагрів, резерв): <b>≈${fmt(r.lossWh || 0)} Вт·год</b></li>
      </ul>
      <button class="btn ghost small" type="button" data-act="b-to-plan" data-v="${Math.round(r.usableWh || 0)}">${icon('i-bolt')}<span>Розподілити цей запас за пріоритетами</span></button>
    </div>
    ${warnHtml(r.warnings || [])}
    ${note('info', 'Потужність ≠ запас', 'Потужність виходу (Вт) визначає, які прилади можна ввімкнути. Запас (Вт·год) — як довго. Інвертор на 1000 Вт не означає 1000 Вт·год енергії.')}
    ${howHtml(r.steps || [], '<p class="hint">Точна частина — множення напруги на ємність. Коефіцієнт використання — оцінка: перевірте його тестом із реальним навантаженням.</p>')}`,
  };
}

on({
  'b-load': (el) => setVals('battery', { loadW: el.dataset.v }),
  'b-k': (el) => setVals('battery', { k: el.dataset.v, preset: 'custom' }),
  'b-to-plan': (el) => { setCalc('plan', { availableWh: el.dataset.v }); app.go('#/calc/plan'); },
});

/* Нагрівання води */

/** @returns {View} */
function heatView() {
  const v = getCalc('heat');
  return {
    title: 'Нагрівання води',
    tab: 'calc',
    html: calcPage('Нагрівання води', 'Мінімальна енергія — точно; час — з урахуванням тепловтрат', heatOut(), 'heat', `
      <div class="grid2">${field('heat', 'liters', 'Об’єм води', v.liters, 'л', '', { min: 0.01, max: 500 })}${field('heat', 'powerW', 'Потужність нагрівача', v.powerW, 'Вт', '', { min: 1, max: 20000 })}</div>
      <div class="chips">${HEATER_CHIPS.map((c) => `<button type="button" class="chip" data-act="h-preset" data-w="${c.w}" data-e="${c.eff}">${esc(c.label)}</button>`).join('')}</div>
      <div class="grid2">${field('heat', 't0', 'Початкова температура', v.t0, '°C', '', { min: 0, max: 99 })}${field('heat', 't1', 'Бажана температура', v.t1, '°C', '', { min: 1, max: 100 })}</div>
      <div class="grid2">${field('heat', 'eff', 'ККД нагрівача', v.eff, '', '0,1–1 або 10–100 %', { min: 0.1, max: 1, pct: true })}${field('heat', 'maxW', 'Вихід станції', v.maxW, 'Вт', 'Необов’язково', { min: 0.1, opt: true })}</div>
      <label class="check"><input type="checkbox" data-calc="heat" data-k="inverter"${v.inverter ? ' checked' : ''}><span>Живлення від станції через інвертор 230 В</span></label>`),
    after() { bindCalc('heat', heatOut); },
  };
}

/** @returns {CalcOut} */
function heatOut() {
  const v = getCalc('heat');
  const r = waterHeat({ liters: v.liters, t0: v.t0, t1: v.t1, powerW: v.powerW, eff: v.eff, inverter: !!v.inverter, maxW: v.maxW });
  const label = 'Орієнтовний час нагріву';
  if (!r.ok) return bad(label, r.errors || [], num(v.t1) <= num(v.t0) ? ['t1'] : []);
  const tail = `${warnHtml(r.warnings || [])}
    ${howHtml(r.steps || [], '<p class="hint">Точна частина — Q = c·m·ΔT. Тепловтрати — оцінка за законом охолодження Ньютона для посудини з кришкою; вода спершу має температуру повітря.</p>')}`;
  const exact = `<li><span class="tag fact">Точно</span> Мінімальна теплова енергія: <b>${fmt(r.qWh || 0)} Вт·год</b> (${fmt((r.qJ || 0) / 1000)} кДж)</li>`;
  const tMax = Math.min(r.tMax || 0, 100);
  if (!r.reachable) {
    return {
      ok: true,
      tone: 'warn',
      label: `Не нагріє до ${fmt(num(v.t1))} °C — найвища температура`,
      value: `≈${fmt(tMax, 0)} °C`,
      sub: `потрібно від ${fmt(r.needW || 0)} Вт`,
      html: `<div class="card result warn">
        <p class="r-label">Деталі</p>
        <ul class="r-list">${exact}
          <li><span class="tag eng">Орієнтовно</span> Найвища температура з цією потужністю: <b>≈${fmt(tMax, 0)} °C</b></li>
          <li><span class="tag eng">Орієнтовно</span> Щоб нагріти за 30 хв, потрібно: <b>≈${fmt(r.power30W || 0, 0)} Вт</b></li>
        </ul>
      </div>${tail}`,
    };
  }
  return {
    ok: true,
    label,
    value: fmtHours((r.minutes || 0) / 60),
    sub: `${fmt(r.sourceWh || 0)} Вт·год від джерела`,
    html: `<div class="card result">
      <p class="r-label">Деталі</p>
      <ul class="r-list">${exact}
        <li><span class="tag eng">Орієнтовно</span> Від джерела з ККД і тепловтратами: <b>${fmt(r.sourceWh || 0)} Вт·год</b></li>
        ${v.inverter ? `<li><span class="tag eng">Орієнтовно</span> З акумулятора станції: <b>${fmt(r.batteryWh || 0)} Вт·год</b></li>` : ''}
      </ul>
    </div>${tail}`,
  };
}

on({
  'h-preset': (el) => setVals('heat', { powerW: el.dataset.w, eff: el.dataset.e }),
});

/* Запас води */

/** @param {string} preset */
function waterNoteText(preset) {
  return (WATER_PRESETS.find((p) => p.id === preset) || { note: 'Власні значення' }).note;
}

/** @returns {View} */
function waterView() {
  const v = getCalc('water');
  const cnt = { min: 0, max: 1000, int: true };
  return {
    title: 'Запас води',
    tab: 'calc',
    html: calcPage('Запас води', 'Орієнтовна потреба з поясненням припущень', waterOut(), 'water', `
      <span class="flabel">Норма на людину</span>
      <div class="chips" id="w-presets">${WATER_PRESETS.map((p) => chip('w-preset', p.id, `${p.label}`, v.preset === p.id)).join('')}</div>
      <p class="hint" id="w-note">${esc(waterNoteText(v.preset))}</p>
      <div class="grid3">${field('water', 'adults', 'Дорослі', v.adults, '', '', cnt)}${field('water', 'kids', 'Діти', v.kids, '', '', cnt)}${field('water', 'elderly', 'Літні', v.elderly, '', '', cnt)}</div>
      ${field('water', 'days', 'Кількість діб', v.days, 'дн.', '', { min: 0.5, max: 365 })}
      <div class="grid3">${field('water', 'drink', 'Пиття', v.drink, 'л', '', { min: 0, max: 20 })}${field('water', 'cook', 'Їжа', v.cook, 'л', '', { min: 0, max: 50 })}${field('water', 'hygiene', 'Гігієна', v.hygiene, 'л', '', { min: 0, max: 100 })}</div>
      ${field('water', 'petKg', 'Тварини: загальна маса', v.petKg, 'кг', 'Орієнтовно 50–60 мл на кг маси на добу (загальне ветеринарне правило).', { min: 0, max: 500, opt: true })}
      ${field('water', 'haveL', 'Є зараз питної води', v.haveL, 'л', 'Необов’язково', { min: 0, opt: true })}
      <label class="check"><input type="checkbox" data-calc="water" data-k="hot"${v.hot ? ' checked' : ''}><span>Спека: потреба в питті подвоюється</span></label>`),
    after() {
      bindCalc('water', waterOut, (inp) => {
        if (!['drink', 'cook', 'hygiene'].includes(inp.dataset.k || '')) return {};
        markPreset('custom', true);
        return { preset: 'custom' };
      });
    },
  };
}

/**
 * Позначає обрану норму без перебудови сторінки.
 * @param {string} id
 * @param {boolean} [typing] людина саме набирає число нижче — підказка не стає коротшою,
 *   інакше все під нею (разом із полем) підскочило б угору
 */
function markPreset(id, typing = false) {
  document.querySelectorAll('#w-presets [data-act="w-preset"]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === id)));
  const n = document.getElementById('w-note');
  if (!n) return;
  n.style.minHeight = typing ? `${n.offsetHeight}px` : '';
  n.textContent = waterNoteText(id);
}

/** @returns {CalcOut} */
function waterOut() {
  const v = getCalc('water');
  const r = waterNeeds({ adults: v.adults, kids: v.kids, elderly: v.elderly, days: v.days, drink: v.drink, cook: v.cook, hygiene: v.hygiene, petKg: v.petKg, hot: !!v.hot, haveL: v.haveL });
  const days = num(v.days);
  const label = days >= 0.5 && days <= 365 ? `Потрібно на ${daysText(days, true)}` : 'Потрібно води';
  if (!r.ok) return bad(label, r.errors || [], (r.errors || []).some((e) => e.includes('хоча б одну')) ? ['adults'] : []);
  const short = r.daysCovered != null && r.daysCovered < days;
  return {
    ok: true,
    label,
    value: `${fmt(r.total || 0)} л`,
    sub: r.daysCovered != null ? `наявного вистачить на ${daysText(r.daysCovered, true)}` : `${fmt(r.daily || 0)} л на добу`,
    tone: short ? 'warn' : undefined,
    html: `<div class="card result">
      <p class="r-label">Деталі</p>
      <ul class="r-list">
        <li>На добу: <b>${fmt(r.daily || 0)} л</b></li>
        <li>Лише на пиття за весь період: <b>${fmt(r.drinkingOnly || 0)} л</b></li>
        ${r.daysCovered != null ? `<li>Наявного запасу вистачить на <b>${daysText(r.daysCovered, true)}</b> за цією нормою, а лише на пиття — на <b>${daysText(r.drinkDaysCovered ?? 0, true)}</b></li>` : ''}
      </ul>
    </div>
    ${note('info', 'Припущення', `Норми — орієнтир: Sphere — 2,5–3 л на пиття, 7,5–15 л загальної базової потреби; Ready.gov — щонайменше ≈3,8 л на людину на добу для пиття й санітарії. Потреба зростає: ${(r.increases || []).join('; ')}.`)}
    ${howHtml(r.steps || [])}`,
  };
}

on({
  'w-preset': (el) => {
    const p = WATER_PRESETS.find((x) => x.id === el.dataset.v);
    if (!p) return;
    markPreset(p.id);
    setVals('water', { preset: p.id, drink: String(p.drink).replace('.', ','), cook: String(p.cook).replace('.', ','), hygiene: String(p.hygiene).replace('.', ',') });
  },
});

/* Енергопріоритети */

/** @returns {View} */
function planView() {
  const v = getCalc('plan');
  const devs = /** @type {any[]} */ (v.devices || []);
  const devList = `<h2 class="h2">Пристрої</h2>
    <ol class="devs">${devs.map((d, i) => `<li class="card dev">
      <div class="field"><label for="dv-n-${i}">Назва</label><input id="dv-n-${i}" type="text" maxlength="60" enterkeyhint="done" data-dev="${i}" data-k="name" value="${esc(d.name)}"></div>
      <div class="grid3">
        <div class="field"><label for="dv-w-${i}">Вт</label><input id="dv-w-${i}" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" data-dev="${i}" data-k="watts" data-min="0" data-max="20000" value="${esc(d.watts)}"></div>
        <div class="field"><label for="dv-h-${i}">Год/добу</label><input id="dv-h-${i}" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" data-dev="${i}" data-k="hours" data-min="0" data-max="24" value="${esc(d.hours)}"></div>
        <div class="field"><label for="dv-c-${i}">Пріоритет</label><select id="dv-c-${i}" data-dev="${i}" data-k="cat">${ENERGY_CATS.map((c) => `<option value="${c.id}"${Number(d.cat) === c.id ? ' selected' : ''}>${c.id} · ${esc(c.label)}</option>`).join('')}</select></div>
      </div>
      <div class="dev-ctl">
        ${d.medical ? '<span class="badge risk danger">Медичний</span>' : ''}
        <button type="button" class="iconbtn" data-act="dv-up" data-i="${i}" aria-label="Вище: ${esc(d.name)}"${i === 0 ? ' disabled' : ''}>${icon('i-up')}</button>
        <button type="button" class="iconbtn" data-act="dv-down" data-i="${i}" aria-label="Нижче: ${esc(d.name)}"${i === devs.length - 1 ? ' disabled' : ''}>${icon('i-down')}</button>
        <button type="button" class="iconbtn" data-act="dv-del" data-i="${i}" aria-label="Видалити: ${esc(d.name)}">${icon('i-trash')}</button>
      </div>
    </li>`).join('')}</ol>
    <div class="chips">${DEVICE_PRESETS.map((p, i) => `<button type="button" class="chip" data-act="dv-add" data-i="${i}">${icon('i-plus')}<span>${esc(p.name)}</span></button>`).join('')}<button type="button" class="chip" data-act="dv-add" data-i="-1">${icon('i-plus')}<span>Свій пристрій</span></button></div>`;
  return {
    title: 'Енергопріоритети',
    tab: 'calc',
    html: calcPage('Енергопріоритети', 'Розподіл заряду за важливістю', planOut(), 'plan', `
      <div class="grid2">${field('plan', 'availableWh', 'Доступний запас', v.availableWh, 'Вт·год', 'Вже з урахуванням утрат', { min: 0.1 })}${field('plan', 'days', 'На скільки діб', v.days, 'дн.', '', { min: 0.5, max: 60 })}</div>
      <a class="linkbtn" href="#/calc/battery">${icon('i-battery')}Порахувати запас у калькуляторі акумулятора</a>`, devList),
    after() {
      bindCalc('plan', planOut);
      const outEl = document.getElementById('calc-out');
      const box = document.querySelector('.devs');
      document.querySelectorAll('[data-dev]').forEach((el) => {
        const inp = /** @type {HTMLInputElement|HTMLSelectElement} */ (el);
        const save = (/** @type {string} */ value) => keepInPlace(inp, () => {
          const i = Number(inp.dataset.dev);
          const list = [...(getCalc('plan').devices || [])];
          list[i] = { ...list[i], [inp.dataset.k || '']: inp.dataset.k === 'cat' ? Number(value) : value };
          setCalc('plan', { devices: list });
          if (outEl && box && box.contains(document.activeElement)) outEl.style.minHeight = `${outEl.offsetHeight}px`;
          active.update();
        });
        if (inp instanceof HTMLSelectElement) inp.addEventListener('change', () => save(inp.value));
        else if (inp.dataset.k === 'name') inp.addEventListener('input', () => save(inp.value));
        else bindNumField(inp, save);
      });
      box?.addEventListener('focusout', (e) => {
        const left = e.target instanceof Element ? e.target : null;
        setTimeout(() => { if (outEl && outEl.style.minHeight && !box.contains(document.activeElement)) keepInPlace(left, () => { outEl.style.minHeight = ''; }); }, 0);
      });
    },
  };
}

/** @returns {CalcOut} */
function planOut() {
  const v = getCalc('plan');
  const r = energyPlan({ availableWh: v.availableWh, days: v.days, devices: v.devices || [] });
  const label = 'Якщо вмикати все за планом, запасу вистачить на';
  if (!r.ok) return bad(label, r.errors || []);
  const st = { full: ['ok', 'Повністю'], partial: ['part', 'Частково'], none: ['no', 'Не вистачає'] };
  const finite = Number.isFinite(r.autonomyDays || 0);
  const short = finite && (r.autonomyDays || 0) < num(v.days);
  return {
    ok: true,
    label,
    value: finite ? daysText(r.autonomyDays || 0, true) : 'без обмежень',
    sub: finite ? `потреба ${fmt(r.totalNeed || 0)} Вт·год на добу` : 'пристрої не споживають енергії',
    tone: short ? 'warn' : undefined,
    html: `<div class="card result">
      <p class="r-label">Деталі</p>
      <ul class="r-list"><li>Бюджет на добу: <b>${fmt(r.budget || 0)} Вт·год</b></li><li>Потреба на добу: <b>${fmt(r.totalNeed || 0)} Вт·год</b></li>${(r.unusedWh || 0) > 0.5 ? `<li>Залишок на добу: <b>${fmt(r.unusedWh || 0)} Вт·год</b></li>` : ''}</ul>
    </div>
    ${r.medical ? note('danger', 'Медичний пристрій', 'Застосунок не визначає, чи безпечно живити медичний пристрій від цього джерела. Перевірте вимоги в інструкції до пристрою або в лікаря; майте резервний план.') : ''}
    <div class="card"><h3>Розподіл на добу</h3><table class="tbl"><thead><tr><th>Пристрій</th><th>Потрібно</th><th>Стан</th></tr></thead><tbody>
      ${(r.rows || []).map((row) => `<tr class="${st[row.status][0]}"><td><span class="pr">${row.cat}</span>${esc(row.name)}</td><td>${fmt(row.need)} Вт·год</td><td>${st[row.status][1]}${row.status === 'partial' ? ` · ${esc(fmtHours(row.hoursCovered))}` : ''}</td></tr>`).join('')}
    </tbody></table></div>
    ${howHtml(r.steps || [])}`,
  };
}

on({
  'dv-add': (el) => {
    const i = Number(el.dataset.i);
    const p = i >= 0 ? DEVICE_PRESETS[i] : { name: 'Мій пристрій', watts: 10, hours: 1, cat: 5, medical: false };
    const cur = getCalc('plan');
    setCalc('plan', { devices: [...(cur.devices || []), { name: p.name, watts: String(p.watts).replace('.', ','), hours: String(p.hours).replace('.', ','), cat: p.cat, medical: !!p.medical }] });
    app.render();
  },
  'dv-del': (el) => {
    const i = Number(el.dataset.i);
    const cur = getCalc('plan');
    setCalc('plan', { devices: (cur.devices || []).filter((/** @type {any} */ _x, /** @type {number} */ j) => j !== i) });
    app.render();
  },
  'dv-up': (el) => moveDev(Number(el.dataset.i), -1),
  'dv-down': (el) => moveDev(Number(el.dataset.i), 1),
});

/** @param {number} i @param {number} dir */
function moveDev(i, dir) {
  const cur = getCalc('plan');
  const list = [...(cur.devices || [])];
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  setCalc('plan', { devices: list });
  app.render();
  const b = /** @type {HTMLElement|null} */ (document.querySelector(`[data-act="${dir < 0 ? 'dv-up' : 'dv-down'}"][data-i="${j}"]`));
  b?.focus();
}

/* ───────────── Фізика: сторінка вченого ───────────── */

/** @param {string} id @returns {View} */
function physicsView(id) {
  const p = PHYSICS_BY_ID.get(id);
  if (!p) return { title: 'Не знайдено', tab: 'calc', html: `${pageHead('Не знайдено', '#/calc')}` };
  const related = SOLUTIONS.filter((s) => s.physics.law === id).slice(0, 8);
  return {
    title: p.name,
    tab: 'calc',
    html: `${pageHead(p.name, '#/calc', `${p.years} · ${p.topic}`)}
    ${pic(`phys-${p.id}`, { note: true, eager: true })}
    <p class="lead">${esc(p.principle)}</p>
    <section class="sec"><h2>Науковий факт</h2><p>${esc(p.fact)}</p></section>
    <section class="sec"><h2>Інженерний висновок</h2><p>${esc(p.engineering)}</p></section>
    <section class="sec"><h2>Ілюстрація застосунку</h2><p>${esc(p.illustration)}</p><p class="muted">${esc(p.example)}</p></section>
    <section class="card model"><h2>Спробуйте</h2><div id="model">${modelHtml(id)}</div><p class="hint">Ілюстративна модель зі спрощеннями — не точний прогноз.</p></section>
    ${related.length ? `<h2 class="h2">Де це допомагає</h2><div class="links">${related.map((s) => `<a class="pill" href="#/s/${s.id}">${esc(s.title)}${icon('i-chev')}</a>`).join('')}</div>` : ''}`,
    after() { bindModel(id); },
  };
}

/** @type {Record<string, Record<string, number|string>>} */
const model = {
  joule: { w: 100, h: 2 },
  faraday: { w: 5 },
  carnot: { th: 600, tc: 20 },
  fourier: { area: 1, cm: 0 },
  newton: { vessel: 'thermos', h: 6 },
  einstein: { step: 0 },
};

/** @param {string} id @param {string} k @param {string} label @param {number} min @param {number} max @param {number} step @param {string} unit */
function slider(id, k, label, min, max, step, unit) {
  const v = Number(model[id][k]);
  return `<div class="field"><label for="m-${k}">${esc(label)}: <output id="o-${k}">${fmt(v)} ${esc(unit)}</output></label><input id="m-${k}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-model="${id}" data-k="${k}"></div>`;
}

/** @param {string} id */
function modelHtml(id) {
  const m = model[id];
  if (id === 'joule') {
    const wh = jouleWh(Number(m.w), Number(m.h));
    return `${slider(id, 'w', 'Потужність', 1, 2500, 1, 'Вт')}${slider(id, 'h', 'Час', 0.1, 24, 0.1, 'год')}
      <p class="r-big sm">${fmt(wh)} Вт·год</p>
      <p class="muted">Це ≈${fmt(wh / 74, 1)} павербанка на 20 000 мА·год (≈74 Вт·год номінально) або ${fmt((wh / 500) * 100, 0)} % станції на 500 Вт·год.</p>`;
  }
  if (id === 'faraday') {
    const h = faradayHours(Number(m.w));
    return `${slider(id, 'w', 'Потужність, яку ви вкладаєте в ручку', 2, 30, 1, 'Вт')}
      <p class="r-big sm">${esc(fmtHours(h))}</p>
      <p class="muted">Стільки крутити, щоб передати телефону ≈15 Вт·год за ККД перетворення ≈0,6 (ілюстрація).</p>`;
  }
  if (id === 'carnot') {
    const eta = carnotEta(Number(m.th), Number(m.tc));
    return `${slider(id, 'th', 'Температура нагрівача', 50, 1000, 10, '°C')}${slider(id, 'tc', 'Температура довкілля', -20, 40, 1, '°C')}
      <p class="r-big sm">${fmt(eta * 100, 0)} %</p>
      <p class="muted">Найбільша можлива частка тепла, що стала б роботою в ідеальній машині. Реальні двигуни мають значно менший ККД.</p>`;
  }
  if (id === 'fourier') {
    const rel = fourierRelative(Number(m.area), Number(m.cm));
    return `${slider(id, 'area', 'Частка площі, яку обігріваєте', 0.2, 1, 0.05, '')}${slider(id, 'cm', 'Додаткове утеплення (ковдри, штори)', 0, 10, 0.5, 'см')}
      <p class="r-big sm">${fmt(rel * 100, 0)} % від початкових утрат</p>
      <p class="muted">Менша тепла зона й товщий шар зменшують утрати тепла. Модель: R₀ = 0,5 м²·К/Вт, утеплювач k ≈ 0,04 Вт/(м·К).</p>`;
  }
  if (id === 'newton') {
    const vs = NEWTON_VESSELS.find((x) => x.id === m.vessel) || NEWTON_VESSELS[2];
    const tEnv = 20;
    const t = newtonTemp(95, tEnv, Number(m.h), vs.tau);
    return `<div class="chips">${NEWTON_VESSELS.map((x) => chip('m-vessel', x.id, x.label, x.id === vs.id)).join('')}</div>
      ${slider(id, 'h', 'Минуло часу', 0, 12, 0.25, 'год')}
      <p class="r-big sm">${fmt(t, 0)} °C</p>
      <p class="muted">Окріп 95 °C у кімнаті +20 °C. ${t >= 60 ? 'Страва ще вище 60 °C.' : 'Нижче 60 °C — для їжі це вже «небезпечна зона» 4–60 °C.'}</p>`;
  }
  const steps = [
    ['Чого бракує?', 'Тепла: у кімнаті +13 °C.'],
    ['Скільки є і скільки треба?', 'Двоє людей ≈ 200 Вт тепла; до комфортних 18 °C бракує 5 °C.'],
    ['Куди губиться?', 'Вікна, щілини під дверима, холодна підлога.'],
    ['Найменший безпечний крок?', 'Тепла зона в одній кімнаті; перевірити температуру через годину.'],
  ];
  const s = Number(m.step);
  return `<ol class="einst">${steps.map(([q, a], i) => `<li class="${i <= s ? 'on' : ''}"><b>${esc(q)}</b>${i < s ? `<span>${esc(a)}</span>` : ''}</li>`).join('')}</ol>
    <button class="btn small primary" type="button" data-act="m-einstein">${s < steps.length ? 'Наступне питання' : 'Почати знову'}</button>`;
}

/** @param {string} id */
function bindModel(id) {
  document.querySelectorAll(`input[data-model="${id}"]`).forEach((el) => {
    const inp = /** @type {HTMLInputElement} */ (el);
    inp.addEventListener('input', () => {
      model[id][inp.dataset.k || ''] = Number(inp.value);
      const box = document.getElementById('model');
      if (!box) return;
      const focusK = inp.dataset.k;
      box.innerHTML = modelHtml(id);
      bindModel(id);
      const again = /** @type {HTMLInputElement|null} */ (document.getElementById(`m-${focusK}`));
      again?.focus();
    });
  });
}

on({
  'm-vessel': (el) => { model.newton.vessel = el.dataset.v || 'thermos'; const b = document.getElementById('model'); if (b) { b.innerHTML = modelHtml('newton'); bindModel('newton'); } },
  'm-einstein': () => {
    const s = Number(model.einstein.step);
    model.einstein.step = s >= 4 ? 0 : s + 1;
    const b = document.getElementById('model');
    if (b) { b.innerHTML = modelHtml('einstein'); bindModel('einstein'); }
  },
});

export const calcScreens = { list: listView, calc: calcView, physics: physicsView };
