// @ts-check
// Екрани «Укриття» (тривога → в укритті → відбій), «Тривожна валізка», «Підготувати укриття»,
// «Пам’ятка для друку», картка готовності та позначка режиму в шапці.

import * as store from './store.js';
import { SOURCES } from './data.js';
import { BY_ID } from './solutions.js';
import { EMERGENCY } from './safety.js';
import {
  BAG, BAG_SOURCES, PREP, PREP_SOURCES, ALARM_STEPS, ALARM_SOURCES, ALARM_FOLDS, FIRST_STEPS, FIRST_SOURCES,
  WHILE_BLOCKS, BLOCKED, AFTER_STEPS, AFTER_SOURCES, PRAISE, SHARE_TEXT, SHEET_RULES,
  itemsFor, progress, applies, elapsedMin, durText, daysSince, bagDue, sheetText,
} from './shelter.js';
import { qrSvg } from './qr.js';
import { app, on, esc, icon, note, pageHead, pic, sourcesList, bar, plural } from './ui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */
/** @typedef {import('./shelter.js').Block} Block */
/** @typedef {import('./shelter.js').CheckGroup} CheckGroup */

export const TOOL_ICON = { light: 'i-moon', breathe: 'i-wave', signal: 'i-sound', cpr: 'i-heart' };
export const TOOL_LABEL = { light: 'Нічник', breathe: 'Дихаємо разом', signal: 'Сигнал «Я\u00A0тут»', cpr: 'Метроном реанімації' };

/** @param {string[]} a */
const uniq = (a) => [...new Set(a)];

/** Короткий перелік джерел посиланнями. @param {string[]} keys */
function srcLinks(keys) {
  return keys.map((k) => SOURCES[/** @type {keyof typeof SOURCES} */ (k)]).filter(Boolean)
    .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.org)}</a>`).join(', ');
}

/** Кнопка інструмента на весь екран. @param {'light'|'breathe'|'signal'|'cpr'} k @param {string} [cls] */
function toolBtn(k, cls = 'pill') {
  return `<button class="${cls}" type="button" data-act="tool" data-v="${k}">${icon(TOOL_ICON[k])}<span>${esc(TOOL_LABEL[k])}</span></button>`;
}

/** Розгортний блок порад. @param {Block} f @param {boolean} [open] */
function foldHtml(f, open = false) {
  const lv = f.level || 'info';
  const ic = lv === 'danger' ? 'i-alert' : lv === 'caution' ? 'i-warn' : 'i-info';
  const sol = f.link ? BY_ID.get(f.link) : null;
  const extra = [f.tool ? toolBtn(f.tool) : '', sol ? `<a class="pill" href="#/s/${sol.id}">${esc(sol.title)}${icon('i-chev')}</a>` : ''].join('');
  return `<details class="card fold sign ${lv}" data-fold="${f.id}"${open ? ' open' : ''}><summary>${icon(ic)}<span>${esc(f.title)}</span></summary>
    <ul class="sh-list">${f.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    ${extra ? `<div class="links">${extra}</div>` : ''}
    <p class="src">Джерела: ${srcLinks(f.sources)}</p>
  </details>`;
}

/**
 * «Ваш план»: власне укриття й місце зустрічі — видно першим під час тривоги.
 * @param {{shelter:string, meet:string}} plan
 */
function planCard(plan) {
  if (!plan.shelter && !plan.meet) {
    return `<a class="card plan empty-plan" href="#/prep">${icon('i-shelter')}<span><b>Вкажіть своє укриття</b><span class="muted">Адреса й місце зустрічі родини з’являться тут — саме тоді, коли знадобляться.</span></span>${icon('i-chev', 'end')}</a>`;
  }
  return `<section class="card plan" aria-labelledby="plan-h">
    <h2 id="plan-h">Ваш план</h2>
    ${plan.shelter ? `<p class="plan-l">${icon('i-shelter')}<span><span class="muted">Укриття</span><b>${esc(plan.shelter)}</b></span></p>` : ''}
    ${plan.meet ? `<p class="plan-l">${icon('i-home')}<span><span class="muted">Зустрічаємося, якщо немає зв’язку</span><b>${esc(plan.meet)}</b></span></p>` : ''}
    <a class="note-a" href="#/prep">Змінити${icon('i-chev')}</a>
  </section>`;
}

/** @param {string[]} items */
function numbered(items) {
  return `<ol class="now-list">${items.map((t, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol>`;
}

/** @param {string[]} nums */
function callsHtml(nums) {
  return `<ul class="calls">${EMERGENCY.filter((e) => nums.includes(e.num)).map((e) => `<li><a class="call" href="tel:${e.num}">${icon('i-phone')}<b>${e.num}</b><span>${esc(e.label)}</span></a></li>`).join('')}</ul>`;
}

/* ───────────── Укриття ───────────── */

/** @returns {View} */
function shelterView() {
  const sh = store.get().shelter;
  if (sh.since != null && sh.after != null) return afterView();
  if (sh.since != null) return inView();
  return alarmView();
}

/** Тривога: що робити, кнопка «Я в укритті», якщо не встигаєте. @returns {View} */
function alarmView() {
  const d = store.get();
  const c = app.ctx();
  const b = progress(BAG, d.bag, c);
  const cnt = d.shelter.count;
  return {
    title: 'Укриття',
    tab: 'shelter',
    html: `${pageHead('Повітряна тривога', '', 'Почули сирену — одразу в укриття')}
    ${planCard(d.plan)}
    <section class="card sh-go" aria-labelledby="go-h">
      <h2 id="go-h">Що робити зараз</h2>
      ${numbered(ALARM_STEPS)}
    </section>
    <div class="row-btns sticky-actions">
      <button class="btn primary sh-big" type="button" data-act="sh-start">${icon('i-shelter')}<span>Я в укритті</span></button>
    </div>
    <p class="hint center">Таймер покаже, скільки ви в безпеці, а підбір рішень врахує, що ви в укритті.${cnt ? ` Ви вчасно ховалися вже ${cnt} ${plural(cnt, 'раз', 'рази', 'разів')} — так тримати.` : ''}</p>
    ${pic('shelter')}
    <h2 class="h2">Якщо до укриття не дістатися</h2>
    ${ALARM_FOLDS.map((f) => foldHtml(f)).join('')}
    <div class="rows">
      <a class="row" href="#/bag">${icon('i-bag')}<span>Тривожна валізка <span class="muted">· ${b.done} з ${b.total}</span></span>${icon('i-chev', 'end')}</a>
      <a class="row" href="#/prep">${icon('i-list')}<span>Підготувати укриття заздалегідь</span>${icon('i-chev', 'end')}</a>
      <a class="row" href="#/sheet">${icon('i-print')}<span>Пам’ятка для укриття — роздрукувати</span>${icon('i-chev', 'end')}</a>
    </div>
    <section class="sec"><h2>Джерела</h2>${sourcesList(uniq([...ALARM_SOURCES, ...ALARM_FOLDS.flatMap((f) => f.sources)]))}</section>`,
  };
}

/** В укритті: таймер, перші хвилини, інструменти, поради. @returns {View} */
function inView() {
  const d = store.get();
  const c = app.ctx();
  const min = elapsedMin(d.shelter.since || Date.now(), Date.now());
  return {
    title: 'В укритті',
    tab: 'shelter',
    html: `<section class="card sh-live" aria-labelledby="sh-h">
      <h1 class="sh-l" id="sh-h" tabindex="-1">${icon('i-shelter')}<span>Ви в укритті</span></h1>
      <p class="sh-t"><span class="sh-live-t short">${esc(durText(min, true))}</span></p>
      <p class="praise">${esc(PRAISE.start)}</p>
    </section>
    ${min >= 720 ? note('info', 'Режим укриття ввімкнено вже давно', 'Якщо ви вже вдома, натисніть «Відбій тривоги» внизу: тоді поради знову стануть домашніми.') : ''}
    <h2 class="h2">Перші хвилини</h2>
    ${numbered(FIRST_STEPS)}
    <button class="btn ghost wide" type="button" data-act="sh-share" data-v="in">${icon('i-share')}<span>Повідомити рідних</span></button>
    <div class="tools3">${toolBtn('light', 'tool-b')}${toolBtn('breathe', 'tool-b')}${toolBtn('signal', 'tool-b')}</div>
    <p class="src">Джерела: ${srcLinks(FIRST_SOURCES)}</p>
    <h2 class="h2">Поки сидимо</h2>
    ${WHILE_BLOCKS.map((b) => foldHtml(b, !!b.when && applies(b, c))).join('')}
    ${foldHtml(BLOCKED)}
    <div class="rows">
      <a class="row" href="#/aid">${icon('i-aid')}<span>Перша допомога: кровотеча, реанімація, удавився</span>${icon('i-chev', 'end')}</a>
      <a class="row" href="#/share">${icon('i-share')}<span>Показати сусідам QR-код застосунку</span>${icon('i-chev', 'end')}</a>
    </div>
    <section class="card sos" aria-labelledby="sos-h"><h2 id="sos-h">Екстрені номери</h2>${callsHtml(['112', '101', '103'])}</section>
    <div class="row-btns sticky-actions">
      <button class="btn primary" type="button" data-act="sh-clear">${icon('i-check')}<span>Відбій тривоги</span></button>
    </div>`,
  };
}

/** @type {Set<number>} */
const afterDone = new Set();

/** Відбій: похвала й безпечний вихід. @returns {View} */
function afterView() {
  const sh = store.get().shelter;
  const min = elapsedMin(sh.since || Date.now(), sh.after || Date.now());
  return {
    title: 'Відбій',
    tab: 'shelter',
    html: `${pageHead('Відбій тривоги', '', `Ви були в укритті ${durText(min)}`)}
    ${pic('after', { cap: false })}
    <p class="praise big">${esc(PRAISE.after)}</p>
    <h2 class="h2">Що зробити після відбою</h2>
    <ol class="steps">${AFTER_STEPS.map((t, i) => `<li><button type="button" class="step" data-act="af-step" data-i="${i}" aria-pressed="${afterDone.has(i)}"><span class="box" aria-hidden="true">${icon('i-check')}</span><span class="num">${i + 1}</span><span class="txt">${esc(t)}</span></button></li>`).join('')}</ol>
    <button class="btn ghost wide" type="button" data-act="sh-share" data-v="after">${icon('i-share')}<span>Повідомити рідних, що все гаразд</span></button>
    <div class="rows"><a class="row" href="#/aid">${icon('i-aid')}<span>Є поранені — перша допомога</span>${icon('i-chev', 'end')}</a></div>
    <section class="sec"><h2>Джерела</h2>${sourcesList(AFTER_SOURCES)}</section>
    <div class="row-btns sticky-actions even">
      <button class="btn primary" type="button" data-act="sh-finish">Завершити</button>
      <button class="btn ghost" type="button" data-act="sh-back">Тривога триває</button>
    </div>`,
  };
}

/* ───────────── Чек-листи: валізка й укриття ───────────── */

/** @param {'bag'|'prep'} kind @param {CheckGroup} g @param {Set<string>} set */
function checkGroup(kind, g, set) {
  return `<section class="sec chk-g"><h2>${esc(g.title)}</h2><ul class="chks">${g.items.map((it) => `<li><button type="button" class="chk" data-act="${kind}-tog" data-k="${it.key}" aria-pressed="${set.has(it.key)}"><span class="box" aria-hidden="true">${icon('i-check')}</span><span class="txt">${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span></button></li>`).join('')}</ul></section>`;
}

/**
 * Картка прогресу з похвалою.
 * @param {'bag'|'prep'} kind @param {{done:number,total:number,pct:number}} p @param {number|null} at
 */
function progHtml(kind, p, at) {
  const label = kind === 'bag' ? 'Зібрано' : 'Готово';
  const praise = p.pct >= 100 ? (kind === 'bag' ? 'Усе зібрано — ви молодець!' : 'Укриття готове — чудова робота!')
    : p.done === 0 ? (kind === 'bag' ? 'Почніть із документів і води — це найважливіше.' : 'Почніть із пошуку найближчих укриттів.')
      : p.pct >= 50 ? 'Більше половини — так тримати!' : 'Гарний початок. Кожен пункт — це спокій потім.';
  let check = '';
  if (kind === 'bag') {
    const now = Date.now();
    const dd = daysSince(at, now);
    const due = at != null && bagDue(at, now);
    const txt = dd == null ? 'Перевіряйте валізку раз на 3 місяці: термін придатності води, їжі й ліків, заряд павербанка.'
      : dd === 0 ? 'Остання перевірка: сьогодні.'
        : `Остання перевірка: ${dd} ${plural(dd, 'день', 'дні', 'днів')} тому.${due ? ' Час перевірити термін придатності й заряд.' : ''}`;
    check = `<p class="${due ? 'warnline' : 'hint'}">${icon(due ? 'i-warn' : 'i-calendar')}<span>${esc(txt)}</span></p>
      <button class="btn small ghost" type="button" data-act="bag-checked">${icon('i-check')}<span>Позначити перевірку</span></button>`;
  }
  return `<div class="prog-h"><span class="prog-n">${p.done}<small> з ${p.total}</small></span><span><b>${label}</b><span class="muted">${esc(praise)}</span></span></div>
    ${bar(p.pct, `${label} ${p.done} з ${p.total}`)}${check}`;
}

/** @returns {View} */
function bagView() {
  const d = store.get();
  const c = app.ctx();
  const set = new Set(d.bag);
  return {
    title: 'Тривожна валізка',
    tab: 'res',
    html: `${pageHead('Тривожна валізка', '#/res', 'За рекомендаціями МОН і ДСНС. Позначайте, що вже зібрано.')}
    ${pic('bag')}
    <section class="card prog" id="bag-prog">${progHtml('bag', progress(BAG, d.bag, c), d.bagAt)}</section>
    ${itemsFor(BAG, c).map((g) => checkGroup('bag', g, set)).join('')}
    <p class="hint">${icon('i-info')} Пункти для дітей і тварин з’являються, якщо вони є в «Моєму стані сьогодні».</p>
    <section class="sec"><h2>Джерела</h2>${sourcesList(BAG_SOURCES)}</section>`,
  };
}

/** @returns {View} */
function prepView() {
  const d = store.get();
  const c = app.ctx();
  const set = new Set(d.prep);
  const heat = BY_ID.get('heat-shelter');
  return {
    title: 'Підготувати укриття',
    tab: 'res',
    html: `${pageHead('Підготувати укриття', '#/res', 'Поки спокійно: найближчі укриття, облаштований підвал і домовленості з сусідами')}
    ${pic('prep')}
    <section class="card plan-edit" aria-labelledby="pe-h">
      <h2 id="pe-h">Ваш план на тривогу</h2>
      <div class="field"><label for="plan-shelter">Моє укриття</label><input id="plan-shelter" type="text" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder="Напр.: підвал 2-го під’їзду, вхід з двору" value="${esc(d.plan.shelter)}"></div>
      <div class="field"><label for="plan-meet">Де зустрічаємося, якщо немає зв’язку</label><input id="plan-meet" type="text" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder="Напр.: біля школи №5" value="${esc(d.plan.meet)}"></div>
      <p class="hint">Під час тривоги це буде першим на екрані «Укриття» й на роздрукованій пам’ятці.</p>
    </section>
    <section class="card prog" id="prep-prog">${progHtml('prep', progress(PREP, d.prep, c), null)}</section>
    ${itemsFor(PREP, c).map((g) => checkGroup('prep', g, set)).join('')}
    <div class="rows">
      <a class="row" href="#/sheet">${icon('i-print')}<span>Пам’ятка для укриття — роздрукувати</span>${icon('i-chev', 'end')}</a>
      ${heat ? `<a class="row" href="#/s/${heat.id}">${icon('i-thermo')}<span>${esc(heat.title)}</span>${icon('i-chev', 'end')}</a>` : ''}
      <a class="row" href="#/shelter">${icon('i-shelter')}<span>Що робити під час тривоги</span>${icon('i-chev', 'end')}</a>
    </div>
    <section class="sec"><h2>Джерела</h2>${sourcesList(PREP_SOURCES)}</section>`,
    after() {
      for (const [id, key] of /** @type {const} */ ([['plan-shelter', 'shelter'], ['plan-meet', 'meet']])) {
        const inp = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
        if (!inp) continue;
        inp.addEventListener('input', () => store.update((dd) => { dd.plan[key] = inp.value.slice(0, 120); }));
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
        inp.addEventListener('blur', () => { const t = inp.value.trim(); if (t !== inp.value) { inp.value = t; store.update((dd) => { dd.plan[key] = t; }); } });
      }
    },
  };
}

/** @param {'bag'|'prep'} kind @param {HTMLElement} el */
function toggleCheck(kind, el) {
  const k = el.dataset.k || '';
  let onNow = false;
  store.update((d) => {
    const s = new Set(d[kind]);
    if (s.has(k)) s.delete(k); else s.add(k);
    onNow = s.has(k);
    d[kind] = [...s];
  });
  el.setAttribute('aria-pressed', String(onNow));
  refreshProg(kind);
  const d = store.get();
  const p = progress(kind === 'bag' ? BAG : PREP, d[kind], app.ctx());
  if (onNow && p.total && p.done === p.total) app.toast(kind === 'bag' ? 'Валізка зібрана повністю — ви подбали про близьких!' : 'Укриття підготовлене — дякуємо, що дбаєте й про сусідів!');
}

/** @param {'bag'|'prep'} kind */
function refreshProg(kind) {
  const box = document.getElementById(`${kind}-prog`);
  const d = store.get();
  if (box) box.innerHTML = progHtml(kind, progress(kind === 'bag' ? BAG : PREP, d[kind], app.ctx()), d.bagAt);
}

/* ───────────── Пам’ятка для друку ───────────── */

function appUrl() {
  return location.href.split('#')[0];
}

/** QR-код адреси застосунку; якщо адреса задовга — нічого. @param {string} label */
function appQr(label) {
  try { return qrSvg(appUrl(), label); } catch { return ''; }
}

/** @returns {View} */
function sheetView() {
  const plan = store.get().plan;
  const fill = (/** @type {string} */ v) => (v ? `<b class="ln-v">${esc(v)}</b>` : '<span class="ln"></span>');
  return {
    title: 'Пам’ятка для укриття',
    tab: 'res',
    html: `${pageHead('Пам’ятка для укриття', '#/res', 'Роздрукуйте й повісьте в укритті вашого будинку')}
    <div class="row-btns noprint">
      <button class="btn primary" type="button" data-act="print">${icon('i-print')}<span>Друкувати</span></button>
      <button class="btn ghost" type="button" data-act="share-sheet">${icon('i-share')}<span>Надіслати текстом</span></button>
    </div>
    <p class="hint noprint">Текстом — щоб переслати в чат будинку чи ОСББ. На аркуші є QR-код: сусіди відкриють застосунок камерою телефона.</p>
    <article class="sheet" aria-label="Пам’ятка для друку">
      <div class="sheet-head">
        <div class="sheet-hl">
          <h2>Укриття: що робити</h2>
          <p class="sheet-fill">Адреса укриття: ${fill(plan.shelter)}</p>
          <p class="sheet-fill">Ключі — у кого: <span class="ln"></span></p>
          <p class="sheet-fill">Телефон: <span class="ln"></span></p>
        </div>
        <figure class="sheet-qr">${appQr('QR-код: адреса застосунку «Автономно»')}<figcaption>Застосунок «Автономно» — скануйте камерою</figcaption></figure>
      </div>
      <section><h3>Екстрені номери</h3><ul class="sheet-nums">${EMERGENCY.map((e) => `<li><b>${e.num}</b> ${esc(e.label)}</li>`).join('')}</ul></section>
      <section><h3>Під час тривоги</h3><ol>${ALARM_STEPS.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></section>
      <section><h3>В укритті</h3><ul>${SHEET_RULES.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section><h3>Якщо вихід завалено</h3><ul>${BLOCKED.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <section><h3>Після відбою</h3><ul>${AFTER_STEPS.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <p class="sheet-foot">За рекомендаціями ДСНС, МОН, ЮНІСЕФ і Держпродспоживслужби. Офлайн-помічник «Автономно» працює без інтернету: ${esc(appUrl())}</p>
    </article>`,
  };
}

/* ───────────── Поділитися: QR-код на екрані ───────────── */

/** @returns {View} */
function shareView() {
  const qr = appQr('QR-код: відкрити застосунок «Автономно»');
  return {
    title: 'Поділитися',
    tab: 'res',
    html: `${pageHead('Поділитися з сусідами', '#/res', 'Покажіть код — сусід відкриє «Автономно» камерою свого телефона')}
    ${qr ? `<div class="qr-card">${qr}</div>` : ''}
    <p class="qr-url">${esc(appUrl())}</p>
    <div class="row-btns">
      <button class="btn primary" type="button" data-act="share-app">${icon('i-share')}<span>Надіслати посилання</span></button>
      <button class="btn ghost" type="button" data-act="share-sheet">${icon('i-list')}<span>Пам’ятка текстом</span></button>
    </div>
    <p class="hint">Камера не бачить код — збільште яскравість екрана. Щоб застосунок працював без інтернету, сусідові треба один раз відкрити його з мережею й дочекатися напису «Готово до роботи офлайн».</p>
    <div class="rows"><a class="row" href="#/sheet">${icon('i-print')}<span>Пам’ятка з QR-кодом — роздрукувати для під’їзду</span>${icon('i-chev', 'end')}</a></div>`,
  };
}

/* ───────────── Готовність ───────────── */

/**
 * Картка готовності: компактна (головна) або з переходами (розділ «Готовність»).
 * @param {ReturnType<typeof import('./shelter.js').readiness>} r
 * @param {boolean} compact
 */
export function readyHtml(r, compact) {
  const rows = [
    { href: '#/bag', ic: 'i-bag', t: 'Тривожна валізка', p: r.bag },
    { href: '#/prep', ic: 'i-list', t: 'Укриття', p: r.prep },
    { href: '#/reserve', ic: 'i-box', t: 'Важливі запаси', p: r.res },
  ];
  const head = (/** @type {string} */ title) => `<div class="rd-h"><span class="rd-n" style="--p:${r.pct}" role="img" aria-label="Готовність ${r.pct} відсотків"><span>${r.pct}<small>%</small></span></span><span class="rd-l"><b>${title}</b><span class="muted">${esc(r.praise)}</span></span>${compact ? icon('i-chev', 'end') : ''}</div>`;
  if (compact) {
    return `<a class="card ready" href="#/res">${head('Готовність')}
      <span class="rd-mini">${rows.map((x) => `<span class="rd-m"><span>${esc(x.t)}</span>${bar(x.p.pct, `${x.t}: ${x.p.done} з ${x.p.total}`)}</span>`).join('')}</span>
    </a>`;
  }
  return `<section class="card ready full">${head('Ваша готовність')}</section>
    <div class="rows">${rows.map((x) => `<a class="row rd-row" href="${x.href}">${icon(x.ic)}<span class="rd-t"><span>${esc(x.t)} <span class="muted">· ${x.p.done} з ${x.p.total}</span></span>${bar(x.p.pct, `${x.t}: ${x.p.done} з ${x.p.total}`)}</span>${icon('i-chev', 'end')}</a>`).join('')}</div>`;
}

/* ───────────── Позначка «В укритті» в шапці ───────────── */

/** Оновлює позначку в шапці та всі живі таймери на сторінці. @param {string} path */
export function updateChip(path) {
  const sh = store.get().shelter;
  const now = Date.now();
  const min = sh.since != null ? elapsedMin(sh.since, now) : 0;
  if (sh.since != null && sh.after == null) {
    document.querySelectorAll('.sh-live-t').forEach((n) => { n.textContent = durText(min, n.classList.contains('short')); });
  }
  const chip = document.getElementById('sh-chip');
  if (!chip) return;
  // На головній і в самому режимі укриття статус уже видно великою карткою — позначка не дублює
  const show = sh.since != null && path !== '/shelter' && path !== '/';
  chip.hidden = !show;
  if (!show) return;
  chip.innerHTML = sh.after != null
    ? `${icon('i-check')}<span>Відбій</span>`
    : `<i class="live-dot" aria-hidden="true"></i><span>В укритті · ${esc(durText(min, true))}</span>`;
  chip.setAttribute('aria-label', sh.after != null ? 'Відбій тривоги: кроки після виходу' : `Ви в укритті ${durText(min)}. Відкрити режим укриття`);
}

/* ───────────── Поділитися ───────────── */

/** Поділитися текстом: системне меню, інакше — копія в буфер. @param {string} text */
export async function shareText(text) {
  const nav = /** @type {any} */ (navigator);
  if (nav.share) {
    try { await nav.share({ text }); return; } catch (e) { if (e && /** @type {any} */ (e).name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); app.toast('Текст скопійовано — вставте в месенджер чи SMS'); return; } catch { /* немає доступу до буфера */ }
  app.toast(text);
}

async function shareApp() {
  const url = appUrl();
  const text = '«Автономно» — офлайн-помічник: що робити без світла, тепла й води та під час тривоги.';
  const nav = /** @type {any} */ (navigator);
  if (nav.share) {
    try { await nav.share({ title: 'Автономно', text, url }); return; } catch (e) { if (e && /** @type {any} */ (e).name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); app.toast('Посилання скопійовано — надішліть сусідам'); return; } catch { /* немає доступу до буфера */ }
  app.toast(url);
}

/* ───────────── Дії ───────────── */

on({
  'sh-start': () => {
    store.update((d) => { d.shelter.since = Date.now(); d.shelter.after = null; });
    afterDone.clear();
    app.go('#/shelter');
    window.scrollTo(0, 0);
  },
  'sh-clear': () => {
    store.update((d) => { if (d.shelter.since == null) d.shelter.since = Date.now(); d.shelter.after = Date.now(); });
    afterDone.clear();
    app.render();
    window.scrollTo(0, 0);
  },
  'sh-back': () => {
    store.update((d) => { d.shelter.after = null; });
    app.render();
    window.scrollTo(0, 0);
  },
  'sh-finish': () => {
    let n = 0;
    store.update((d) => {
      const s = d.shelter;
      if (s.since != null) {
        const end = s.after ?? Date.now();
        s.count += 1;
        s.minutes += elapsedMin(s.since, end);
        s.last = end;
        n = s.count;
      }
      s.since = null;
      s.after = null;
    });
    afterDone.clear();
    app.go('#/');
    if (n) app.toast(`Ви вчасно ховалися вже ${n} ${plural(n, 'раз', 'рази', 'разів')}. Бережіть себе.`);
  },
  'sh-share': (el) => { shareText(el.dataset.v === 'after' ? SHARE_TEXT.after : SHARE_TEXT.in); },
  'share-app': () => { shareApp(); },
  'share-sheet': () => { shareText(sheetText(appUrl())); },
  print: () => window.print(),
  'af-step': (el) => {
    const i = Number(el.dataset.i);
    if (afterDone.has(i)) afterDone.delete(i); else afterDone.add(i);
    el.setAttribute('aria-pressed', String(afterDone.has(i)));
  },
  'bag-tog': (el) => toggleCheck('bag', el),
  'prep-tog': (el) => toggleCheck('prep', el),
  'bag-checked': () => {
    store.update((d) => { d.bagAt = Date.now(); });
    refreshProg('bag');
    app.toast('Чудово! Наступна перевірка — через 3 місяці');
  },
});

export const shelterScreens = {
  shelter: shelterView,
  bag: bagView,
  prep: prepView,
  sheet: sheetView,
  share: shareView,
};
