// @ts-check
// «Автономно» — головний модуль: маршрутизація, головні екрани, тема, офлайн-режим.

import * as store from './store.js';
import { NEEDS, NEED_ORDER, SEASONS, SEASON_ORDER, LEVELS, seasonByDate } from './data.js';
import { BY_ID, findAny } from './solutions.js';
import { buildContext, recommend, quickActions, planFromState, searchLibrary, feasibility, safetyGate, keyLabel, groupLabel, has } from './engine.js';
import { stateAlerts, SYMPTOMS } from './safety.js';
import { PHYSICS_BY_ID } from './physics.js';
import { fmt } from './calc.js';
import { app, actions, on, esc, icon, illo, minutes, dots, levelBadge, riskBadge, costText, note, sourcesList, seg, chip, empty, pageHead, tempText, peopleList, pic, picImg, applyTheme, plural } from './ui.js';
import { homePicKey } from './pics.js';
import { screens } from './screens.js';
import { calcScreens } from './calcui.js';
import { readiness, sectionsFor, elapsedMin, durText } from './shelter.js';
import { shelterScreens, readyHtml, updateChip, TOOL_ICON } from './shelterui.js';
import { aidScreens } from './aidui.js';
import './tools.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */

const main = /** @type {HTMLElement} */ (document.getElementById('main'));

/* ───────────── Контекст ───────────── */

export function ctx() {
  const d = store.get();
  // У режимі «Я в укритті» підбір рахує місце укриттям: жодного вогню й горіння, надвір не можна
  return buildContext({ profile: d.profile, state: d.state, reserve: d.reserve, season: d.settings.season || seasonByDate(new Date()), alarm: inShelter() });
}

/** Режим «Я в укритті» ввімкнено (і відбою ще не було). */
function inShelter() {
  const sh = store.get().shelter;
  return sh.since != null && sh.after == null;
}

/* ───────────── Маршрути ───────────── */

/** @type {[RegExp, (m: RegExpMatchArray, q: URLSearchParams) => View][]} */
const ROUTES = [
  [/^\/?$/, () => viewHome()],
  [/^\/need\/(heat|food|water|energy|cool|hygiene)$/, (m, q) => viewNeed(/** @type {any} */ (m[1]), q)],
  [/^\/s\/([\w-]+)$/, (m) => viewSolution(m[1])],
  [/^\/all$/, (_m, q) => viewLibrary(q)],
  [/^\/season\/(winter|spring|summer|autumn)$/, (m) => viewSeason(/** @type {any} */ (m[1]))],
  [/^\/plan$/, () => viewPlan()],
  [/^\/saved$/, () => viewSaved()],
  [/^\/safety$/, () => screens.safety()],
  [/^\/shelter$/, () => shelterScreens.shelter()],
  [/^\/bag$/, () => shelterScreens.bag()],
  [/^\/prep$/, () => shelterScreens.prep()],
  [/^\/sheet$/, () => shelterScreens.sheet()],
  [/^\/share$/, () => shelterScreens.share()],
  [/^\/aid$/, () => aidScreens.aid()],
  [/^\/res$/, () => screens.resources()],
  [/^\/reserve$/, () => screens.reserve()],
  [/^\/state$/, () => screens.state()],
  [/^\/setup\/done$/, () => screens.setupDone()],
  [/^\/setup(?:\/(\d))?$/, (m) => screens.setup(Number(m[1] || 1))],
  [/^\/about$/, () => screens.about(swInfo)],
  [/^\/calc$/, () => calcScreens.list()],
  [/^\/calc\/(battery|heat|water|plan)$/, (m) => calcScreens.calc(m[1])],
  [/^\/physics\/(\w+)$/, (m) => calcScreens.physics(m[1])],
];

let lastPath = '';
let navCount = 0;

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', q: new URLSearchParams(qs || '') };
}

function render() {
  const { path, q } = parseHash();
  /** @type {View | null} */
  let view = null;
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) { view = fn(m, q); break; }
  }
  if (!view) view = notFound();
  const samePath = path === lastPath;
  if (!samePath && Date.now() - toastAt > 800 && !toastEl.querySelector('[data-act="sw-update"], [data-act="res-undo"]')) hideToast();
  const scrollY = window.scrollY;
  main.innerHTML = view.html;
  document.title = view.title ? `${view.title} · Автономно` : 'Автономно';
  setTab(view.tab);
  updateChip(path);
  if (view.after) view.after();
  if (samePath) {
    window.scrollTo(0, scrollY);
  } else {
    window.scrollTo(0, 0);
    if (navCount > 0) {
      const h1 = /** @type {HTMLElement|null} */ (main.querySelector('h1'));
      if (h1) h1.focus({ preventScroll: true });
    }
    main.classList.remove('enter');
    void main.offsetWidth;
    main.classList.add('enter');
  }
  lastPath = path;
  navCount++;
}
app.render = render;
app.ctx = ctx;
app.go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

/** @param {string} tab */
function setTab(tab) {
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const on = /** @type {HTMLElement} */ (a).dataset.tab === tab;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

/** @returns {View} */
function notFound() {
  return { title: 'Не знайдено', tab: '', html: `${pageHead('Сторінку не знайдено', '#/')}${empty('il-lamp', 'Тут нічого немає', 'Можливо, посилання застаріло.', '<a class="btn primary" href="#/">На головну</a>')}` };
}

/* ───────────── Головний екран ───────────── */

/** @returns {View} */
function viewHome() {
  const d = store.get();
  const c = ctx();
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Доброї ночі.' : hour < 12 ? 'Доброго ранку.' : hour < 17 ? 'Добрий день.' : hour < 23 ? 'Добрий вечір.' : 'Доброї ночі.';
  // Під час тривоги живий статус — найперше, що бачить людина
  const live = d.shelter.since != null;
  const setup = !d.profile.setupDone && !d.profile.setupDismissed
    ? `<section class="card setup">
        <div><h2>Налаштуйте за хвилину</h2><p class="muted">Де ви, що є під рукою, які обмеження — і підбір стане точнішим. Можна пропустити.</p></div>
        <div class="row-btns"><a class="btn primary" href="#/setup/1">Налаштувати</a><button class="btn ghost" type="button" data-act="setup-dismiss">Пізніше</button></div>
      </section>` : '';
  const needs = NEED_ORDER.map((n) => `<a class="need need-${n}" href="#/need/${n}">${picImg(`ico-${n}`, 'ico', NEEDS[n].illo)}<span class="need-t">${esc(NEEDS[n].label)}</span><span class="need-s">${esc(NEEDS[n].sub)}</span></a>`).join('');
  return {
    title: '',
    tab: 'home',
    html: `
    ${live ? alarmCard(d) : ''}
    ${pic(homePicKey(hour), { cls: 'hero', eager: true })}
    <section class="hello">
      <p class="greet">${greet}</p>
      <h1 tabindex="-1">Знайдемо рішення.</h1>
      <p class="sub">Що потрібно вирішити зараз?</p>
    </section>
    ${live ? '' : alarmCard(d)}
    ${setup}
    <nav class="needs" aria-label="Що потрібно вирішити">${needs}</nav>
    ${stateCard(d, c)}
    ${readyHtml(readiness(d, c), true)}
    <div class="rows">
      <a class="row" href="#/season/${c.season}">${icon(SEASONS[c.season].icon)}<span>Сценарій сезону: ${esc(SEASONS[c.season].label)}</span>${icon('i-chev', 'end')}</a>
      <a class="row" href="#/all">${icon('i-book')}<span>Усі рішення й пошук</span>${icon('i-chev', 'end')}</a>
      <a class="row" href="#/saved">${icon('i-star')}<span>Збережене${d.favs.length ? ` <span class="muted">· ${d.favs.length}</span>` : ''}</span>${icon('i-chev', 'end')}</a>
      <a class="row" href="#/aid">${icon('i-aid')}<span>Перша допомога</span>${icon('i-chev', 'end')}</a>
      <a class="row" href="#/safety">${icon('i-shield')}<span>Безпека та екстрені номери</span>${icon('i-chev', 'end')}</a>
    </div>
    <p class="offline-line"><a href="#/about" class="ob-link" id="offline-badge">${offlineBadge()}</a></p>`,
  };
}

/**
 * Вхід у режим тривоги — завжди на видноті; під час тривоги — живий таймер.
 * @param {import('./types').AppData} d
 */
function alarmCard(d) {
  const sh = d.shelter;
  if (sh.since != null && sh.after == null) {
    return `<a class="card alarm live" href="#/shelter"><i class="live-dot" aria-hidden="true"></i><span class="al-t"><b>Ви в укритті · <span class="sh-live-t short">${esc(durText(elapsedMin(sh.since, Date.now()), true))}</span></b><span>Відкрити режим укриття</span></span>${icon('i-chev', 'end')}</a>`;
  }
  if (sh.since != null) {
    return `<a class="card alarm" href="#/shelter"><span class="al-i">${icon('i-check')}</span><span class="al-t"><b>Відбій тривоги</b><span>Кроки після виходу з укриття</span></span>${icon('i-chev', 'end')}</a>`;
  }
  return `<a class="card alarm" href="#/shelter"><span class="al-i">${icon('i-shelter')}</span><span class="al-t"><b>Повітряна тривога?</b><span>Що робити й режим «Я в укритті»</span></span>${icon('i-chev', 'end')}</a>`;
}

/**
 * @param {import('./types').AppData} d
 * @param {import('./types').Ctx} c
 */
function stateCard(d, c) {
  const s = d.state;
  /** @type {string[]} */
  const items = [];
  if (s.power != null) items.push(s.power ? 'Світло є' : 'Світла немає');
  if (s.gas != null) items.push(s.gas ? 'Газ є' : 'Газу немає');
  if (s.tap != null) items.push(s.tap ? 'Вода з крана є' : 'Води з крана немає');
  if (c.waterL != null) items.push(`Питної води ${fmt(c.waterL, 1)} л`);
  if (s.batteryPct != null) items.push(`Заряд ${Math.round(s.batteryPct)} %`);
  if (s.roomC != null) items.push(`У кімнаті ${tempText(s.roomC)}`);
  const ppl = peopleList(s);
  if (ppl) items.push(ppl);
  const top = stateAlerts(c).find((a) => a.level !== 'info');
  const filled = s.power != null || s.gas != null || s.tap != null || c.waterL != null || s.batteryPct != null || s.roomC != null;
  return `<section class="card state" aria-labelledby="st-h">
    <div class="card-h"><h2 id="st-h">Мій стан сьогодні</h2><a class="linkbtn" href="#/state">Змінити</a></div>
    ${filled ? `<ul class="tags">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="muted">Ще не вказано. Кілька фактів — світло, вода, температура — зроблять підбір точнішим.</p>`}
    ${top ? `<p class="mini-alert ${top.level}">${icon(top.level === 'danger' ? 'i-alert' : 'i-warn')}<span>${esc(top.title)}: ${esc(firstSentence(top.text))}</span></p>` : ''}
    <a class="btn primary wide" href="#/plan">Знайти рішення</a>
  </section>`;
}

/** @param {string} t */
function firstSentence(t) {
  const i = t.indexOf('. ');
  return i > 0 ? t.slice(0, i + 1) : t;
}

/* ───────────── Швидке рішення ───────────── */

const MODES = [
  { v: '5', label: 'Є 5 хвилин' },
  { v: '30', label: 'Є 30 хвилин' },
  { v: 'long', label: 'Хочу вирішити надовго' },
];

/**
 * @param {import('./types').Need} need
 * @param {URLSearchParams} q
 * @returns {View}
 */
function viewNeed(need, q) {
  const c = ctx();
  const mode = /** @type {import('./types').Mode} */ (['5', '30', 'long'].includes(q.get('m') || '') ? q.get('m') : '30');
  const meta = NEEDS[need];
  const alerts = stateAlerts(c).filter((a) => a.need === need);
  const acts = quickActions(need, c);
  const r = recommend(need, c, mode, 3);
  const alertsHtml = alerts.map((a) => note(a.level, a.title, a.text, a.action && BY_ID.get(a.action) ? `<a class="note-a" href="#/s/${a.action}">${esc(BY_ID.get(a.action)?.title || '')}${icon('i-chev')}</a>` : '')).join('');
  const recs = r.irrelevant
    ? `${note('info', 'Зараз це не потрібно', r.noneText)}<button class="btn ghost wide" type="button" data-act="mode" data-v="long">Підготуватися наперед</button>`
    : r.none
      ? `<div class="none-art">${picImg('empty-none', 'pic-e')}</div>${note('caution', 'Безпечного рішення не знайдено', r.noneText)}`
      : r.items.map((it, i) => recCard(it, i === 0 && r.items.length > 1)).join('');
  const help = r.wouldHelp.length ? `<p class="hint">${icon('i-info')} Більше варіантів, якщо є: ${esc(r.wouldHelp.join('; '))}. <a href="#/res">Оновити резерв</a></p>` : '';
  const signs = signsFor(need, c);
  const blocked = r.blocked.length
    ? `<details class="card fold"><summary>${icon('i-alert')}<span>Не рекомендовано зараз (${r.blocked.length})</span></summary>
        <ul class="blocked">${r.blocked.map((b) => `<li><a href="#/s/${b.sol.id}">${esc(b.sol.title)}</a><span>${esc(b.why)}</span></li>`).join('')}</ul></details>` : '';
  return {
    title: meta.title,
    tab: 'home',
    html: `${pageHead(meta.title, '#/', `${meta.label}: ${meta.sub}`)}
    ${inShelter() ? note('info', 'Ви в укритті', 'Підбір це враховує: жодного вогню й горіння, нічого, для чого треба виходити надвір.', '<a class="note-a" href="#/shelter">Режим укриття' + icon('i-chev') + '</a>') : ''}
    ${alertsHtml}
    ${r.irrelevant && !acts.length ? '' : `<section class="card now" aria-labelledby="now-h">
      <h2 id="now-h">Зробіть зараз</h2>
      ${acts.length ? `<ol class="now-list">${acts.map((a, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span>${a.id ? `<a href="#/s/${a.id}">${esc(a.text)}</a>` : `<span>${esc(a.text)}</span>`}</li>`).join('')}</ol>` : `<p>${esc(r.noneText)}</p>`}
    </section>`}
    ${r.irrelevant ? '' : pic(`need-${need}`)}
    ${seg('mode', MODES, mode, 'Скільки є часу')}
    <h2 class="h2">Найкращі варіанти для вас</h2>
    <div class="recs" aria-live="polite">${recs}</div>
    ${help}
    ${signs}
    ${blocked}
    <div class="rows"><a class="row" href="#/all?need=${need}">${icon('i-book')}<span>Усі рішення: ${esc(meta.label.toLowerCase())}</span>${icon('i-chev', 'end')}</a></div>`,
  };
}

/**
 * Картка рекомендації. Перша — «Найкраще зараз» із першими кроками.
 * @param {import('./types').Rec} rec @param {boolean} [top]
 */
function recCard(rec, top = false) {
  const s = rec.sol;
  const c = ctx();
  const gate = safetyGate(s, c);
  return `<a class="card rec${top ? ' top' : ''}" href="#/s/${s.id}">
    ${top ? `<p class="top-l">${icon('i-star-f')}Найкраще зараз</p>` : ''}
    <div class="rec-top">${levelBadge(s.level)}${riskBadge(gate.level)}</div>
    <h3>${esc(s.title)}</h3>
    <p class="muted">${esc(s.result)}</p>
    ${top ? `<ol class="mini-steps">${s.steps.slice(0, 2).map((x) => `<li>${esc(x)}</li>`).join('')}</ol><p class="more">Усі ${s.steps.length} ${plural(s.steps.length, 'крок', 'кроки', 'кроків')}${icon('i-chev')}</p>` : ''}
    <ul class="meta">
      <li>${icon('i-clock')}<span>${minutes(s.prepMin)}</span></li>
      <li>${icon('i-coin')}<span>${esc(costText(s.cost, rec.costNow))}</span></li>
      <li>${dots(s.difficulty)}</li>
    </ul>
    ${rec.reasons.length ? `<p class="why"><b>Чому:</b> ${rec.reasons.map(esc).join(' · ')}</p>` : ''}
    ${rec.warnings.map((w) => `<p class="warnline">${icon('i-warn')}<span>${esc(w)}</span></p>`).join('')}
  </a>`;
}

/**
 * Ознаки небезпеки для категорії.
 * @param {import('./types').Need} need
 * @param {import('./types').Ctx} c
 */
function signsFor(need, c) {
  /** @type {string[]} */
  let ids = [];
  if (need === 'heat') ids = ['hypo', 'frost'];
  if (need === 'cool') ids = ['stroke', 'exhaust'];
  if (need === 'food' && (c.equip.has('burner') || c.gas)) ids = ['co'];
  if (need === 'energy' && c.equip.has('car12')) ids = ['co'];
  if (!ids.length) return '';
  const blocks = ids.map((id) => SYMPTOMS.find((x) => x.id === id)).filter(Boolean).map((sy) => {
    if (!sy) return '';
    return `<details class="card fold sign ${sy.level}"><summary>${icon(sy.level === 'danger' ? 'i-alert' : 'i-warn')}<span>Ознаки небезпеки: ${esc(sy.title.toLowerCase())}</span></summary>
      <h3>Ознаки</h3><ul>${sy.signs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3>Що робити</h3><ol>${sy.act.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      ${need === 'heat' && sy.id === 'hypo' ? `<p class="hint">Коли переходити в тепле місце: у кімнаті +12 °C і нижче й тепліше не стає; є ознаки переохолодження; зігрітися можна лише небезпечно. <a href="#/s/heat-relocate">Детальніше</a></p>` : ''}
    </details>`;
  });
  return `<h2 class="h2">Коли це небезпечно</h2>${blocks.join('')}`;
}

/* ───────────── Картка рішення ───────────── */

/** @type {Record<string, Set<number>>} */
const stepsDone = {};

/** @param {string} id @returns {View} */
function viewSolution(id) {
  const any = findAny(id);
  if (!any) return notFound();
  if ('myth' in any) return viewMyth(any);
  const s = any;
  const c = ctx();
  const f = feasibility(s, c);
  const gate = safetyGate(s, c);
  const d = store.get();
  const fav = d.favs.includes(id);
  const done = stepsDone[id] || new Set();
  const alt = BY_ID.get(s.altId);
  const ph = PHYSICS_BY_ID.get(s.physics.law);
  const needKeys = [...s.needs.map((k) => ({ label: keyLabel(k), ok: has(c, k) })), ...(s.needsAny || []).map((g) => ({ label: groupLabel(g.join('|')), ok: g.some((k) => has(c, k)) }))];
  const placeRule = s.places && s.places[c.place];
  return {
    title: s.title,
    tab: '',
    html: `<div class="ph">
      <button class="back" type="button" data-act="back" aria-label="Назад">${icon('i-back')}<span>Назад</span></button>
      <div class="badges">${levelBadge(s.level)}${riskBadge(gate.level)}<span class="badge plain">${esc(NEEDS[s.need].label)}</span></div>
      <h1 tabindex="-1">${esc(s.title)}</h1>
      <p class="sub">Вирішує: ${esc(s.problem)}</p>
    </div>
    <div class="row-btns">
      <button class="btn ${fav ? 'primary' : 'ghost'}" type="button" data-act="fav" data-v="${s.id}" aria-pressed="${fav}">${icon(fav ? 'i-star-f' : 'i-star')}<span>${fav ? 'Збережено' : 'Зберегти'}</span></button>
    </div>
    ${!gate.ok ? note(gate.level, 'Зараз не рекомендовано', gate.why || '') : ''}
    ${gate.ok && placeRule === 'caution' ? note('caution', 'Обережність', 'У вашому місці перебування це рішення допустиме лише за суворих умов, описаних нижче.') : ''}
    <dl class="facts">
      <div><dt>${icon('i-calendar')}Сезони</dt><dd>${s.seasons.length === 4 ? 'Цілий рік' : s.seasons.map((x) => SEASONS[x].label).join(', ')}</dd></div>
      <div><dt>${icon('i-coin')}Вартість</dt><dd>${esc(costText(s.cost, f.costNow))}</dd></div>
      <div><dt>${icon('i-clock')}Підготовка</dt><dd>${minutes(s.prepMin)}</dd></div>
      <div><dt>${icon('i-target')}Результат через</dt><dd>${minutes(s.resultMin)}</dd></div>
      <div><dt>${icon('i-gauge')}Складність</dt><dd>${dots(s.difficulty)} <span class="sr-only">${s.difficulty} з 5</span></dd></div>
      <div><dt>${icon('i-layers')}Рівень</dt><dd>${esc(LEVELS[s.level].short)} · ${esc(LEVELS[s.level].label)}</dd></div>
    </dl>
    ${s.id === 'heat-relocate' ? pic('warm-place') : ''}
    <section class="sec"><h2>Очікуваний результат</h2><p>${esc(s.result)}</p></section>
    <section class="sec"><h2>Що потрібно</h2>
      <ul class="mat">${s.materials.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      ${needKeys.length ? `<ul class="have">${needKeys.map((k) => `<li class="${k.ok ? 'ok' : 'no'}">${icon(k.ok ? 'i-check' : 'i-close')}<span>${esc(k.label)}: ${k.ok ? 'є' : 'бракує'}</span></li>`).join('')}</ul>` : ''}
    </section>
    <section class="sec"><h2>Кроки</h2>
      <ol class="steps">${s.steps.map((st, i) => `<li><button type="button" class="step" data-act="step" data-id="${s.id}" data-i="${i}" aria-pressed="${done.has(i)}"><span class="box" aria-hidden="true">${icon('i-check')}</span><span class="num">${i + 1}</span><span class="txt">${esc(st)}</span></button></li>`).join('')}</ol>
      <p class="steps-st${done.size && done.size === s.steps.length ? ' all' : ''}" id="steps-st" aria-live="polite">${stepsStatus(done.size, s.steps.length)}</p>
    </section>
    <section class="sec">${note(s.risk === 'caution' ? 'caution' : 'info', 'Обмеження та ризики', '', `<ul>${s.limits.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${c.vulnerable && s.vulnerableRisk ? `<p><b>Для вразливих людей:</b> ${esc(s.vulnerableRisk)}</p>` : ''}`)}</section>
    ${alt ? `<section class="sec"><h2>Безпечна альтернатива</h2><a class="card mini" href="#/s/${alt.id}"><span class="mini-t">${esc(alt.title)}</span><span class="muted">${esc(s.altText)}</span>${icon('i-chev', 'end')}</a></section>` : ''}
    <section class="sec"><h2>Фізичний принцип</h2><p>${esc(s.physics.text)}</p>
      ${ph ? `<a class="row" href="#/physics/${ph.id}">${icon('i-atom')}<span>Пояснює фізика: ${esc(ph.name)} · ${esc(ph.topic)}</span>${icon('i-chev', 'end')}</a>` : ''}
    </section>
    <section class="sec"><h2>Джерела</h2>${sourcesList(s.sources)}</section>`,
  };
}

/** Підказка під кроками: скільки виконано й похвала наприкінці. @param {number} n @param {number} total */
function stepsStatus(n, total) {
  if (!n) return 'Торкніться кроку, щоб позначити виконаним.';
  if (n >= total) return `${icon('i-check')}<b>Усі кроки виконано — чудова робота!</b> Ви подбали про себе й близьких.`;
  return `Виконано ${n} з ${total}. Так тримати!`;
}

/** @param {import('./types').Myth} m @returns {View} */
function viewMyth(m) {
  return {
    title: m.title,
    tab: '',
    html: `<div class="ph">
      <button class="back" type="button" data-act="back" aria-label="Назад">${icon('i-back')}<span>Назад</span></button>
      <div class="badges">${riskBadge('danger')}</div>
      <h1 tabindex="-1">${esc(m.title)}</h1>
    </div>
    ${note('danger', 'Не робіть цього', m.why)}
    ${m.physics ? `<section class="sec"><h2>Фізика</h2><p>${esc(m.physics)}</p></section>` : ''}
    <section class="sec"><h2>Що робити замість</h2>${m.instead.map((id) => BY_ID.get(id)).filter(Boolean).map((s) => s ? `<a class="card mini" href="#/s/${s.id}"><span class="mini-t">${esc(s.title)}</span><span class="muted">${esc(s.result)}</span>${icon('i-chev', 'end')}</a>` : '').join('')}</section>
    <section class="sec"><h2>Джерела</h2>${sourcesList(m.sources)}</section>`,
  };
}

/* ───────────── Бібліотека: пошук і фільтри ───────────── */

const lib = { q: '', need: /** @type {string|null} */ (null), season: /** @type {string|null} */ (null), level: /** @type {number|null} */ (null), onlyNow: false };

/** @param {URLSearchParams} q @returns {View} */
function viewLibrary(q) {
  const qn = q.get('need');
  if (qn && qn in NEEDS) lib.need = qn;
  if (q.get('now') === '1') lib.onlyNow = true;
  return {
    title: 'Усі рішення',
    tab: 'home',
    html: `${pageHead('Усі рішення', '#/', 'Пошук, фільтри та небезпечні міфи')}
    <div class="search">${icon('i-search')}<input id="lib-q" type="search" inputmode="search" autocomplete="off" placeholder="Наприклад: термос, вода, світло" aria-label="Пошук рішень" value="${esc(lib.q)}"></div>
    <div id="lib-filters">${libFilters()}</div>
    <div id="lib-out" aria-live="polite">${libResults()}</div>`,
    after() {
      const inp = /** @type {HTMLInputElement|null} */ (document.getElementById('lib-q'));
      inp?.addEventListener('input', () => { lib.q = inp.value; refreshLib(false); });
    },
  };
}

function libFilters() {
  const needOpts = [{ v: '', label: 'Усі' }, ...NEED_ORDER.map((n) => ({ v: n, label: NEEDS[n].label }))];
  const seasonOpts = [{ v: '', label: 'Будь-який' }, ...SEASON_ORDER.map((s) => ({ v: s, label: SEASONS[s].label }))];
  const levelOpts = [{ v: '', label: 'Будь-який' }, ...[1, 2, 3, 4].map((l) => ({ v: String(l), label: LEVELS[/** @type {1|2|3|4} */ (l)].label }))];
  const row = (/** @type {string} */ title, /** @type {string} */ act, /** @type {{v:string,label:string}[]} */ opts, /** @type {string} */ cur) =>
    `<div class="frow"><span class="flabel">${title}</span><div class="chips">${opts.map((o) => chip(act, o.v, o.label, o.v === cur)).join('')}</div></div>`;
  const extra = (lib.season ? 1 : 0) + (lib.level ? 1 : 0) + (lib.onlyNow ? 1 : 0);
  return `${row('Категорія', 'lib-need', needOpts, lib.need || '')}
    <details class="card fold lib-more"${extra ? ' open' : ''}><summary>${icon('i-layers')}<span>Ще фільтри${extra ? ` · обрано ${extra}` : ''}</span></summary>
      ${row('Сезон', 'lib-season', seasonOpts, lib.season || '')}
      ${row('Рівень', 'lib-level', levelOpts, lib.level ? String(lib.level) : '')}
      <div class="frow"><div class="chips">${chip('lib-now', '1', 'Можна зробити зараз', lib.onlyNow)}</div></div>
    </details>`;
}

function libResults() {
  const res = searchLibrary({ q: lib.q, need: lib.need, season: lib.season, level: lib.level, onlyNow: lib.onlyNow }, ctx());
  const secs = sectionsFor(lib.q);
  const secHtml = secs.length ? `<div class="rows sec-hits" aria-label="Розділи">${secs.map((x) => x.href
    ? `<a class="row" href="${x.href}">${icon(x.icon)}<span>${esc(x.title)}</span>${icon('i-chev', 'end')}</a>`
    : `<button class="row" type="button" data-act="tool" data-v="${x.tool}">${icon(TOOL_ICON[/** @type {'light'|'breathe'|'signal'|'cpr'} */ (x.tool)])}<span>${esc(x.title)}</span>${icon('i-chev', 'end')}</button>`).join('')}</div>` : '';
  if (!res.length) return secHtml || empty('empty-search', 'Нічого не знайдено', 'Спробуйте інше слово або приберіть фільтри. Ми поруч.');
  return `${secHtml}<p class="count">Знайдено: ${res.length}</p><div class="list">${res.map((s) => {
    if ('myth' in s) return `<a class="card item myth" href="#/s/${s.id}"><div class="rec-top">${riskBadge('danger')}<span class="badge plain">${esc(NEEDS[s.need].label)}</span></div><h3>${esc(s.title)}</h3><p class="muted">Чому ні — і що робити замість</p></a>`;
    return `<a class="card item" href="#/s/${s.id}"><div class="rec-top">${levelBadge(s.level)}${riskBadge(s.risk)}<span class="badge plain">${esc(NEEDS[s.need].label)}</span></div><h3>${esc(s.title)}</h3><p class="muted">${esc(s.problem)}</p><ul class="meta"><li>${icon('i-clock')}<span>${minutes(s.prepMin)}</span></li><li>${dots(s.difficulty)}</li></ul></a>`;
  }).join('')}</div>`;
}

/** @param {boolean} filters */
function refreshLib(filters) {
  const out = document.getElementById('lib-out');
  if (out) out.innerHTML = libResults();
  if (filters) {
    const f = document.getElementById('lib-filters');
    const wasOpen = !!f?.querySelector('details.lib-more')?.hasAttribute('open');
    if (f) f.innerHTML = libFilters();
    if (wasOpen) f?.querySelector('details.lib-more')?.setAttribute('open', '');
  }
}

on({
  'lib-need': (el) => { lib.need = el.dataset.v || null; refreshLib(true); },
  'lib-season': (el) => { lib.season = el.dataset.v || null; refreshLib(true); },
  'lib-level': (el) => { lib.level = el.dataset.v ? Number(el.dataset.v) : null; refreshLib(true); },
  'lib-now': () => { lib.onlyNow = !lib.onlyNow; refreshLib(true); },
});

/* ───────────── Сезонний сценарій ───────────── */

/** @param {import('./types').Season} s @returns {View} */
function viewSeason(s) {
  const se = SEASONS[s];
  const c = ctx();
  return {
    title: `${se.label}: сценарій`,
    tab: 'home',
    html: `${pageHead(`${se.label}: сценарій`, '#/', se.intro)}
    ${pic(`season-${s}`)}
    <section class="card rule">${icon(se.icon)}<p>${esc(se.rule)}</p></section>
    ${c.season !== s ? `<button class="btn ghost wide" type="button" data-act="season" data-v="${s}">Зробити «${esc(se.label)}» поточним сезоном</button>` : ''}
    <div class="season-row">
      ${seg('season-go', SEASON_ORDER.map((x) => ({ v: x, label: SEASONS[x].label, icon: SEASONS[x].icon })), s, 'Інший сезон')}
      <p class="hint">${store.get().settings.season == null ? 'Поточний сезон підібрано за датою.' : '<button class="linkbtn" type="button" data-act="season-auto">Повернути вибір сезону за датою</button>'}</p>
    </div>
    <h2 class="h2">Головні завдання</h2>
    <ol class="tasks">${se.tasks.map((t) => `<li class="card task"><h3>${esc(t.t)}</h3><div class="links">${t.ids.map((id) => BY_ID.get(id)).filter(Boolean).map((x) => x ? `<a class="pill" href="#/s/${x.id}">${esc(x.title)}${icon('i-chev')}</a>` : '').join('')}</div></li>`).join('')}</ol>
    <h2 class="h2">Попередження сезону</h2>
    ${se.warn.map((w) => note('caution', '', w)).join('')}`,
  };
}

/* ───────────── План за станом ───────────── */

/** @returns {View} */
function viewPlan() {
  const c = ctx();
  const d = store.get();
  const p = planFromState(c);
  const filled = d.state.power != null || d.state.gas != null || d.state.tap != null || d.state.roomC != null || c.waterL != null || d.state.batteryPct != null;
  return {
    title: 'Ваш план',
    tab: 'home',
    html: `${pageHead('Ваш план зараз', '#/', 'Підібрано за станом, ресурсами й сезоном')}
    ${!filled ? `<p class="hint">${icon('i-info')} Стан ще не вказано — план загальний. <a href="#/state">Вказати стан</a></p>` : ''}
    ${p.alerts.map((a) => note(a.level, a.title, a.text, a.action && BY_ID.get(a.action) ? `<a class="note-a" href="#/s/${a.action}">${esc(BY_ID.get(a.action)?.title || '')}${icon('i-chev')}</a>` : '')).join('')}
    ${p.needs.map((n, i) => `<section class="card plan">
      <div class="plan-h"><span class="n">${i + 1}</span>${illo(NEEDS[n.need].illo, 'sm')}<h2>${esc(NEEDS[n.need].label)}</h2></div>
      ${n.actions.length ? `<ul class="now-list compact">${n.actions.map((a) => `<li>${a.id ? `<a href="#/s/${a.id}">${esc(a.text)}</a>` : esc(a.text)}</li>`).join('')}</ul>` : `<p class="muted">${esc(n.noneText)}</p>`}
      ${n.rec ? `<a class="pill" href="#/s/${n.rec.sol.id}">Рішення: ${esc(n.rec.sol.title)}${icon('i-chev')}</a>` : ''}
      <a class="linkbtn" href="#/need/${n.need}">Більше варіантів</a>
    </section>`).join('')}`,
  };
}

/* ───────────── Збережене ───────────── */

/** @returns {View} */
function viewSaved() {
  const favs = store.get().favs.map((id) => findAny(id)).filter(Boolean);
  return {
    title: 'Збережене',
    tab: 'res',
    html: `${pageHead('Збережене', '#/res', 'Рішення, до яких хочеться повертатися')}
    ${favs.length ? `<div class="list">${favs.map((s) => s ? `<div class="card item fav">
        <a href="#/s/${s.id}" class="fav-a"><h3>${esc(s.title)}</h3><p class="muted">${esc('myth' in s ? 'Небезпечний міф' : s.result)}</p></a>
        <button class="iconbtn" type="button" data-act="fav" data-v="${s.id}" aria-label="Прибрати зі збереженого">${icon('i-star-f')}</button>
      </div>` : '').join('')}</div>` : empty('empty-saved', 'Поки порожньо', 'Відкрийте будь-яке рішення й натисніть «Зберегти» — воно з’явиться тут і буде доступне офлайн.', '<a class="btn primary" href="#/all">До всіх рішень</a>')}`,
  };
}

/* ───────────── Дії ───────────── */

on({
  season: (el) => {
    const v = el.dataset.v;
    store.update((d) => { d.settings.season = /** @type {any} */ (v); });
    render();
  },
  'season-auto': () => { store.update((d) => { d.settings.season = null; }); render(); },
  'season-go': (el) => app.go(`#/season/${el.dataset.v}`),
  mode: (el) => {
    const { path } = parseHash();
    history.replaceState(null, '', `#${path}?m=${el.dataset.v}`);
    render();
    const b = /** @type {HTMLElement|null} */ (main.querySelector(`.seg-b[data-act="mode"][data-v="${el.dataset.v}"]`));
    b?.focus();
  },
  fav: (el) => {
    const id = el.dataset.v || '';
    let added = false;
    store.update((d) => {
      if (d.favs.includes(id)) d.favs = d.favs.filter((x) => x !== id);
      else { d.favs.push(id); added = true; }
    });
    app.toast(added ? 'Збережено — доступно в «Збереженому»' : 'Прибрано зі збереженого');
    render();
  },
  step: (el) => {
    const id = el.dataset.id || '';
    const i = Number(el.dataset.i);
    const set = (stepsDone[id] = stepsDone[id] || new Set());
    if (set.has(i)) set.delete(i); else set.add(i);
    el.setAttribute('aria-pressed', String(set.has(i)));
    const st = document.getElementById('steps-st');
    if (st) {
      const total = main.querySelectorAll('.steps .step').length;
      st.innerHTML = stepsStatus(set.size, total);
      st.classList.toggle('all', set.size === total);
    }
  },
  back: () => {
    if (navCount > 1 && history.length > 1) history.back();
    else app.go('#/');
  },
  'setup-dismiss': () => { store.update((d) => { d.profile.setupDismissed = true; }); render(); },
  'toast-close': () => hideToast(),
  'sw-update': () => applyUpdate(),
});

/* ───────────── Тема та доступність ───────────── */

export function applySettings() {
  applyTheme(store.get().settings);
}

/* ───────────── Сповіщення ───────────── */

const toastEl = /** @type {HTMLElement} */ (document.getElementById('toast'));
let toastAt = 0;
/** @type {ReturnType<typeof setTimeout>|null} */
let toastTimer = null;
app.toast = (msg, opt = {}) => {
  toastEl.innerHTML = `<span>${esc(msg)}</span>${opt.action ? `<button type="button" class="btn small primary" data-act="${opt.action}">${esc(opt.label || 'OK')}</button>` : ''}<button type="button" class="iconbtn" data-act="toast-close" aria-label="Закрити">${icon('i-close')}</button>`;
  toastEl.classList.add('show');
  toastAt = Date.now();
  if (toastTimer) clearTimeout(toastTimer);
  if (!opt.action) toastTimer = setTimeout(hideToast, 3200);
};
function hideToast() {
  toastEl.classList.remove('show');
}

/* ───────────── Офлайн-режим (реальний стан Service Worker) ───────────── */

/** @type {{status:'checking'|'ready'|'partial'|'unsupported'|'error', cached:number, total:number, picsCached:number, picsTotal:number, version:string, reg: ServiceWorkerRegistration|null, install: any, failed: {version:string, missing:string[]}|null}} */
const swInfo = { status: 'checking', cached: 0, total: 0, picsCached: 0, picsTotal: 0, version: '', reg: null, install: null, failed: null };
let reloading = false;
/** Коли відкрито сторінку: оновлення, знайдене одразу після запуску, ставимо без питань. */
const openedAt = Date.now();
let lastUpdateCheck = Date.now();

/** Щойно відкрили застосунок і ще нічого не вводять — нову версію можна ставити одразу. */
function justOpened() {
  const a = document.activeElement;
  return Date.now() - openedAt < 6000 && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

function offerUpdate() {
  if (justOpened()) { applyUpdate(); return; }
  app.toast('Доступна нова версія застосунку', { action: 'sw-update', label: 'Оновити' });
}

function offlineBadge() {
  const net = navigator.onLine ? '' : ' · зараз без інтернету';
  switch (swInfo.status) {
    case 'ready': return `<span class="ob ok">${icon('i-offline')}Готово до роботи офлайн${net}</span>`;
    case 'partial': return `<span class="ob wait">${icon('i-sync')}Кешування: ${swInfo.cached} з ${swInfo.total}${net}</span>`;
    case 'unsupported': return `<span class="ob off">${icon('i-info')}Офлайн-режим недоступний у цьому браузері${net}</span>`;
    case 'error': return `<span class="ob off">${icon('i-warn')}Офлайн-режим не підтверджено${net}</span>`;
    default: return `<span class="ob wait">${icon('i-sync')}Перевіряю офлайн-режим…${net}</span>`;
  }
}

function refreshBadge() {
  const b = document.getElementById('offline-badge');
  if (b) b.innerHTML = offlineBadge();
  const a = document.getElementById('about-offline');
  if (a) a.innerHTML = screens.offlineDetails(swInfo);
}

async function initSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
    swInfo.status = 'unsupported';
    refreshBadge();
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    swInfo.reg = reg;
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
        if (nw.state === 'activated') checkOffline();
      });
    });
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate();
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type === 'CACHED') { swInfo.failed = null; checkOffline(); }
      // Нова версія не встановилася: сервер не віддав частину файлів. Показуємо в «Про застосунок»
      if (d.type === 'INSTALL_FAILED' && Array.isArray(d.missing) && d.missing.length && d.missing.length < d.total) {
        swInfo.failed = { version: String(d.version || ''), missing: d.missing.slice(0, 12).map(String) };
        refreshBadge();
      }
    });
    // Телефон тримає застосунок у фоні днями: перевіряємо оновлення, коли до нього повертаються
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - lastUpdateCheck < 30 * 60000) return;
      lastUpdateCheck = Date.now();
      reg.update().catch(() => {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); else checkOffline(); });
    await navigator.serviceWorker.ready;
    checkOffline();
  } catch {
    swInfo.status = 'error';
    refreshBadge();
  }
}

let picsTries = 0;

function checkOffline() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    const target = reg.active;
    if (!target) return;
    const ch = new MessageChannel();
    const t = setTimeout(() => { swInfo.status = 'error'; refreshBadge(); }, 5000);
    ch.port1.onmessage = (e) => {
      clearTimeout(t);
      const d = e.data || {};
      swInfo.cached = d.cached || 0;
      swInfo.total = d.total || 0;
      swInfo.picsCached = d.picsCached || 0;
      swInfo.picsTotal = d.picsTotal || 0;
      swInfo.version = d.version || '';
      swInfo.status = d.ready ? 'ready' : 'partial';
      refreshBadge();
      if (!d.ready) { setTimeout(checkOffline, 2500); return; }
      // Застосунок уже працює офлайн; ілюстрації дозберігаються у фоні, коли є мережа
      if (d.picsTotal && d.picsCached < d.picsTotal && navigator.onLine && picsTries < 12) {
        if (picsTries === 0) target.postMessage({ type: 'CACHE_PICS' });
        picsTries++;
        setTimeout(checkOffline, 3000);
      }
    };
    target.postMessage({ type: 'STATUS' }, [ch.port2]);
  });
}

function applyUpdate() {
  const w = swInfo.reg && swInfo.reg.waiting;
  if (!w) { location.reload(); return; }
  reloading = true;
  store.saveNow();
  w.postMessage({ type: 'SKIP_WAITING' });
}

// Картинка недоступна (офлайн до першого кешування тощо): ховаємо ілюстрацію або повертаємо SVG
document.addEventListener('error', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement)) return;
  const fig = t.closest('figure.pic');
  if (fig instanceof HTMLElement) { fig.hidden = true; return; }
  if (t.dataset.illo) t.outerHTML = illo(t.dataset.illo);
  else t.hidden = true;
}, true);

window.addEventListener('online', refreshBadge);
window.addEventListener('online', () => { picsTries = 0; checkOffline(); });
window.addEventListener('offline', refreshBadge);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); swInfo.install = e; /** @type {any} */ (window).__avInstall = e; refreshBadge(); });
window.addEventListener('appinstalled', () => { swInfo.install = null; refreshBadge(); });
window.addEventListener('av-recheck', () => checkOffline());

/* ───────────── Запуск ───────────── */

document.addEventListener('click', (e) => {
  const el = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-act]'));
  if (!el) return;
  const fn = actions[el.dataset.act || ''];
  if (fn) { e.preventDefault(); fn(el, e); }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applySettings);

store.load();
applySettings();
if (!store.isPersistent()) setTimeout(() => app.toast('Браузер не дозволяє зберігати дані — вони діятимуть до закриття сторінки.'), 600);
window.addEventListener('hashchange', render);
window.addEventListener('pagehide', () => store.saveNow());
// Синхронізація між вкладками: інша вкладка змінила дані — підхоплюємо, а не перезаписуємо
window.addEventListener('storage', (e) => {
  if (e.key !== store.STORE_KEY) return;
  store.load();
  applySettings();
  render();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.saveNow(); });
render();
/** @type {any} */ (window).__avReady = true;
initSW();
// Поки на телефоні відкрита клавіатура, нижнє меню й липкі кнопки не закривають поля
const TYPE_SEL = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="button"]):not([readonly]), textarea';
const coarse = matchMedia('(pointer: coarse)');
const touch = () => coarse.matches || navigator.maxTouchPoints > 0;
document.addEventListener('focusin', (e) => {
  if (touch() && e.target instanceof Element && e.target.matches(TYPE_SEL)) document.documentElement.classList.add('typing');
});
document.addEventListener('focusout', () => {
  setTimeout(() => {
    const a = document.activeElement;
    if (!(a instanceof Element && a.matches(TYPE_SEL))) { document.documentElement.classList.remove('typing'); syncVV(); }
  }, 80);
});
// Клавіатура може зсунути видиму область униз (visualViewport.offsetTop > 0) —
// тоді живий рядок відповіді прилипає до видимого верху екрана, а не до схованого
const vv = window.visualViewport;
let vvRaf = 0;
function syncVV() {
  vvRaf = 0;
  const top = vv && document.documentElement.classList.contains('typing') ? Math.max(0, Math.round(vv.offsetTop)) : 0;
  document.documentElement.style.setProperty('--vv-top', `${top}px`);
}
if (vv) {
  const queue = () => { if (!vvRaf) vvRaf = requestAnimationFrame(syncVV); };
  vv.addEventListener('resize', queue);
  vv.addEventListener('scroll', queue);
}
// Живий таймер режиму укриття: позначка в шапці й лічильники на сторінці
setInterval(() => updateChip(parseHash().path), 15000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateChip(parseHash().path); });

