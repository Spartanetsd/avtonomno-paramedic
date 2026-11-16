// @ts-check
// Екран «Перша допомога»: що сталося → короткі кроки → що не робити. Працює офлайн.

import { SOURCES } from './data.js';
import { SYMPTOMS, EMERGENCY } from './safety.js';
import { AID, AID_FIRST, AID_FIRST_SOURCES, AID_KIT, AID_KIT_SOURCES, AID_MORE } from './aid.js';
import { on, esc, icon, note, pageHead, sourcesList } from './ui.js';

/** @typedef {{title:string, html:string, tab:string, after?:() => void}} View */
/** @typedef {import('./aid.js').AidTopic} AidTopic */

/** Найчастіші ситуації — великими кнопками нагорі. */
const QUICK = ['bleed', 'cpr', 'unresp', 'choke'];
const QUICK_ICON = { bleed: 'i-drop', cpr: 'i-heart', unresp: 'i-info', choke: 'i-alert' };

/** @param {string[]} a */
const uniq = (a) => [...new Set(a)];

/** @param {string[]} keys */
function srcLinks(keys) {
  return keys.map((k) => SOURCES[/** @type {keyof typeof SOURCES} */ (k)]).filter(Boolean)
    .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.org)}</a>`).join(', ');
}

/** @param {AidTopic} t */
function topicHtml(t) {
  return `<details class="card fold sign aid ${t.level}" id="aid-${t.id}" data-aid="${t.id}"><summary>${icon(t.level === 'danger' ? 'i-alert' : 'i-warn')}<span>${esc(t.title)}</span></summary>
    <p class="aid-lead">${esc(t.lead)}</p>
    <ol class="now-list">${t.steps.map((x, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><span>${esc(x)}</span></li>`).join('')}</ol>
    ${t.tool === 'cpr' ? `<button class="btn primary wide aid-tool" type="button" data-act="tool" data-v="cpr">${icon('i-heart')}<span>Метроном для реанімації</span></button>` : ''}
    ${t.kids ? `<h3>Діти</h3><ul class="sh-list">${t.kids.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${t.never ? `<h3>Не робіть</h3><ul class="sh-list never">${t.never.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <p class="src">Джерела: ${srcLinks(t.sources)}</p>
  </details>`;
}

/** Ознаки небезпечних станів — той самий вигляд, що й у розділі «Безпека». */
function moreHtml() {
  return AID_MORE.map((id) => SYMPTOMS.find((x) => x.id === id)).filter(Boolean).map((sy) => {
    if (!sy) return '';
    return `<details class="card fold sign ${sy.level}" data-aid="${sy.id}"><summary>${icon(sy.level === 'danger' ? 'i-alert' : 'i-warn')}<span>${esc(sy.title)}</span></summary>
      <h3>Ознаки</h3><ul>${sy.signs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3>Що робити</h3><ol>${sy.act.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="src">Джерела: ${srcLinks(sy.sources)}</p>
    </details>`;
  }).join('');
}

/** @returns {View} */
function aidView() {
  const calls = EMERGENCY.filter((e) => e.num === '103' || e.num === '112');
  const quick = QUICK.map((id) => AID.find((t) => t.id === id)).filter(Boolean);
  const allSrc = uniq([...AID_FIRST_SOURCES, ...AID.flatMap((t) => t.sources), ...AID_KIT_SOURCES]);
  return {
    title: 'Перша допомога',
    tab: '',
    html: `${pageHead('Перша допомога', '#/', 'Спершу — власна безпека. Потім — 103 і кроки нижче.')}
    <section class="card sos aid-sos" aria-label="Екстрені номери">
      <ul class="calls">${calls.map((e) => `<li><a class="call" href="tel:${e.num}">${icon('i-phone')}<b>${e.num}</b><span>${esc(e.label)}</span></a></li>`).join('')}</ul>
    </section>
    <nav class="aid-grid" aria-label="Що сталося">${quick.map((t) => t ? `<button type="button" class="aid-q ${t.level}" data-act="aid-go" data-v="${t.id}">${icon(QUICK_ICON[/** @type {keyof typeof QUICK_ICON} */ (t.id)])}<span>${esc(t.short)}</span></button>` : '').join('')}</nav>
    <section class="card aid-first" aria-labelledby="aid-first-h">
      <h2 id="aid-first-h">Спершу — завжди</h2>
      <ol class="now-list">${AID_FIRST.map((x, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><span>${esc(x)}</span></li>`).join('')}</ol>
      <p class="src">Джерела: ${srcLinks(AID_FIRST_SOURCES)}</p>
    </section>
    <h2 class="h2">Що сталося</h2>
    ${AID.map(topicHtml).join('')}
    <h2 class="h2">Холод, чадний газ, опіки, спека</h2>
    ${moreHtml()}
    <h2 class="h2">Аптечка під рукою</h2>
    <section class="card">
      <ul class="kit">${AID_KIT.map((k) => `<li>${icon('i-check')}<span><b>${esc(k.label)}</b>${k.hint ? `<small>${esc(k.hint)}</small>` : ''}</span></li>`).join('')}</ul>
      <p class="src">Джерела: ${srcLinks(AID_KIT_SOURCES)}</p>
    </section>
    <div class="rows">
      <a class="row" href="#/bag">${icon('i-bag')}<span>Тривожна валізка — там теж є аптечка</span>${icon('i-chev', 'end')}</a>
      <a class="row" href="#/safety">${icon('i-shield')}<span>Безпека: заборони й небезпечні міфи</span>${icon('i-chev', 'end')}</a>
    </div>
    ${note('info', 'Потренуйтеся наживо', 'Реанімацію й турнікет запам’ятовують руки, а не очі. Пройдіть очний курс домедичної допомоги — тоді ці кроки спрацюють і в стресі.')}
    <p class="hint">Застосунок не замінює медиків. Телефонуйте 103 або 112 і виконуйте вказівки диспетчера.</p>
    <section class="sec"><h2>Джерела</h2>${sourcesList(allSrc)}</section>`,
  };
}

on({
  'aid-go': (b) => {
    const d = /** @type {HTMLDetailsElement|null} */ (document.getElementById(`aid-${b.dataset.v}`));
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: 'start' });
    /** @type {HTMLElement|null} */ (d.querySelector('summary'))?.focus({ preventScroll: true });
  },
});

export const aidScreens = { aid: aidView };
