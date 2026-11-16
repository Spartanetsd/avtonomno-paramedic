// @ts-check
// Спільні компоненти інтерфейсу, форматування та реєстр дій.

import { LEVELS, SOURCES, costBand } from './data.js';
import { RISK_LEVELS } from './safety.js';
import { PICS } from './pics.js';
import { num } from './calc.js';

/** Глобальні дії застосунку (заповнює app.js). */
export const app = {
  /** @param {string} hash */
  go(hash) { location.hash = hash; },
  render() {},
  /** @returns {import('./types').Ctx} */
  ctx() { return /** @type {any} */ (null); },
  /** @param {string} _msg @param {{action?:string, label?:string}} [_opt] */
  toast(_msg, _opt) {},
};

/** @type {Record<string, (el: HTMLElement, ev: Event) => void>} */
export const actions = {};

/** @param {Record<string, (el: HTMLElement, ev: Event) => void>} map */
export function on(map) {
  Object.assign(actions, map);
}

/** @param {unknown} s */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => /** @type {Record<string,string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** @param {string} id @param {string} [cls] */
export function icon(id, cls = '') {
  return `<svg class="ic ${cls}" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
}

/** @param {string} id @param {string} [cls] */
export function illo(id, cls = '') {
  return `<svg class="illo ${cls}" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
}

/**
 * Українська множина: 1 — one, 2–4 — few, інше — many.
 * @param {number} n @param {string} one @param {string} few @param {string} many
 */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** @param {number} min */
export function minutes(min) {
  if (!min || min <= 0) return 'одразу';
  if (min < 60) return `${min} хв`;
  if (min < 1440) {
    const h = Math.round((min / 60) * 2) / 2;
    return `${String(h).replace('.', ',')} год`;
  }
  const d = Math.round(min / 1440);
  return `${d} ${plural(d, 'доба', 'доби', 'діб')}`;
}

/** @param {number} n */
export function dots(n) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<i class="dot${i <= n ? ' on' : ''}"></i>`;
  return `<span class="dots" role="img" aria-label="Складність ${n} з 5">${s}</span>`;
}

/** @param {1|2|3|4} level */
export function levelBadge(level) {
  return `<span class="badge lv lv${level}">${esc(LEVELS[level].label)}</span>`;
}

/** @param {'info'|'caution'|'danger'} risk */
export function riskBadge(risk) {
  if (risk === 'info') return '';
  const r = RISK_LEVELS[risk];
  return `<span class="badge risk ${risk}">${icon(r.icon)}${esc(r.label)}</span>`;
}

/**
 * Вартість для показу з урахуванням наявного.
 * @param {number} cost @param {number} costNow
 */
export function costText(cost, costNow) {
  if (!cost) return 'Без витрат';
  if (costNow === 0) return 'Без витрат — потрібне є';
  return `${costBand(cost)} · орієнтовно`;
}

/**
 * Попередження/інформаційний блок.
 * @param {'info'|'caution'|'danger'} level @param {string} title @param {string} body @param {string} [extra]
 */
export function note(level, title, body, extra = '') {
  const r = RISK_LEVELS[level];
  return `<div class="note ${level}" role="${level === 'danger' ? 'alert' : 'note'}">
    <div class="note-h">${icon(r.icon)}<span class="note-l">${esc(r.label)}</span>${title ? `<strong>${esc(title)}</strong>` : ''}</div>
    ${body ? `<p>${esc(body)}</p>` : ''}${extra}
  </div>`;
}

/** @param {string[]} keys */
export function sourcesList(keys) {
  const items = keys.map((k) => SOURCES[k]).filter(Boolean);
  if (!items.length) return '';
  return `<ul class="sources">${items.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${icon('i-ext')}<span><b>${esc(s.org)}</b> — ${esc(s.title)}</span></a></li>`).join('')}</ul>
  <p class="hint">Посилання відкриваються, коли є інтернет.</p>`;
}

/**
 * Сегментований перемикач.
 * @param {string} act @param {{v:string, label:string, icon?:string}[]} opts @param {string} value @param {string} label
 */
export function seg(act, opts, value, label) {
  return `<div class="seg" role="group" aria-label="${esc(label)}">${opts
    .map((o) => `<button type="button" class="seg-b" data-act="${act}" data-v="${esc(o.v)}" aria-pressed="${o.v === value}">${o.icon ? icon(o.icon) : ''}<span>${esc(o.label)}</span></button>`)
    .join('')}</div>`;
}

/**
 * Чип-перемикач.
 * @param {string} act @param {string} v @param {string} label @param {boolean} pressed
 */
export function chip(act, v, label, pressed) {
  return `<button type="button" class="chip" data-act="${act}" data-v="${esc(v)}" aria-pressed="${pressed}">${pressed ? icon('i-check') : ''}<span>${esc(label)}</span></button>`;
}

/**
 * Порожній стан.
 * @param {string} il @param {string} title @param {string} text @param {string} [btn]
 */
export function empty(il, title, text, btn = '') {
  const art = PICS[il] ? picImg(il, 'pic-e', 'il-lamp') : illo(il);
  return `<div class="empty">${art}<h2>${esc(title)}</h2><p>${esc(text)}</p>${btn}</div>`;
}

/**
 * Ілюстрація з підписом-підтримкою (figure). Якщо файл не завантажився — figure ховається (див. app.js).
 * @param {string} key ключ із PICS
 * @param {{ cls?: string, eager?: boolean, cap?: boolean, note?: boolean }} [o]
 */
export function pic(key, o = {}) {
  const p = PICS[key];
  if (!p) return '';
  const cap = o.cap !== false && p.cap ? `<span class="praise">${esc(p.cap)}</span>` : '';
  const pn = o.note && p.note ? `<span class="pnote">${esc(p.note)}</span>` : '';
  const cls = ['pic', p.shape || '', o.cls || ''].filter(Boolean).join(' ');
  const load = o.eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<figure class="${cls}"><img src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" decoding="async" ${load}>${cap || pn ? `<figcaption>${cap}${pn}</figcaption>` : ''}</figure>`;
}

/**
 * Картинка без підпису: іконка картки чи малюнок порожнього стану.
 * @param {string} key @param {string} [cls] @param {string} [fallback] id SVG-ілюстрації на випадок, якщо файл недоступний
 */
export function picImg(key, cls = '', fallback = '') {
  const p = PICS[key];
  if (!p) return fallback ? illo(fallback) : '';
  const c = [cls, p.shape || ''].filter(Boolean).join(' ');
  return `<img class="${c}" src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" decoding="async" loading="lazy"${fallback ? ` data-illo="${fallback}"` : ''}>`;
}

/* ───────────── Введення чисел без стрибків ───────────── */

/**
 * Охайний вигляд числа після введення: «1.50» → «1,5», «007» → «7», «5,» → «5», «10 000» → «10000».
 * Нечисло лишається як є — його підсвітить перевірка.
 * @param {string} v
 */
export function tidyNum(v) {
  const s = String(v).trim();
  if (s === '') return '';
  const n = num(s);
  // Дуже малі й дуже великі числа JavaScript пише як «1e-7» — такі лишаємо, як ввели
  if (Number.isNaN(n) || (n !== 0 && Math.abs(n) < 1e-6) || Math.abs(n) >= 1e21) return s;
  return String(Object.is(n, -0) ? 0 : n).replace('.', ',');
}

/**
 * Стан числового поля за його правилами: data-min, data-max, data-int (ціле), data-opt (можна порожнє),
 * data-pct (частка; 85 означає 85 %). Під час набору не сварить за порожнє поле, кому в кінці
 * чи число, менше за мінімум, — його ще дописують: «1» на шляху до «15».
 * @param {HTMLInputElement} inp @param {boolean} typing
 * @returns {'ok'|'bad'}
 */
export function numFieldState(inp, typing) {
  const raw = inp.value.trim();
  if (raw === '') return typing || inp.dataset.opt ? 'ok' : 'bad';
  if (typing && /^[+-]?$|[.,]$/.test(raw)) return 'ok';
  let n = num(raw);
  if (Number.isNaN(n)) return 'bad';
  if (inp.dataset.pct && n > 1 && n <= 100) n /= 100;
  if (inp.dataset.int && !Number.isInteger(n)) return 'bad';
  if (inp.dataset.max != null && inp.dataset.max !== '' && n > Number(inp.dataset.max)) return 'bad';
  if (!typing && inp.dataset.min != null && inp.dataset.min !== '' && n < Number(inp.dataset.min)) return 'bad';
  return 'ok';
}

/**
 * Числове поле, зручне на телефоні: при фокусі вміст виділяється (новий набір замінює старе),
 * Enter ховає клавіатуру, після введення число охайно форматується, червона рамка —
 * лише коли значення справді хибне.
 * @param {HTMLInputElement} inp
 * @param {(value: string) => void} onValue
 */
export function bindNumField(inp, onValue) {
  inp.addEventListener('focus', () => {
    setTimeout(() => {
      if (document.activeElement !== inp) return;
      try { inp.setSelectionRange(0, inp.value.length); } catch { /* поле без виділення */ }
    }, 0);
  });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  inp.addEventListener('input', () => {
    inp.setAttribute('aria-invalid', String(numFieldState(inp, true) === 'bad'));
    onValue(inp.value);
  });
  inp.addEventListener('blur', () => {
    const t = tidyNum(inp.value);
    if (t !== inp.value) { inp.value = t; onValue(t); }
    inp.setAttribute('aria-invalid', String(numFieldState(inp, false) === 'bad'));
  });
}

/**
 * Оновлює частину сторінки так, щоб елемент-орієнтир лишився на тому ж місці екрана.
 * Safari на iPhone не «закріплює» прокрутку сам, тож зміни вище за поле зсували б усе.
 * @param {Element|null} anchor
 * @param {() => void} fn оновлення
 * @param {() => Element|null} [refind] як знайти орієнтир, якщо оновлення його замінило
 */
export function keepInPlace(anchor, fn, refind) {
  const before = anchor && anchor.isConnected ? anchor.getBoundingClientRect().top : null;
  fn();
  if (before == null) return;
  const now = anchor && anchor.isConnected ? anchor : refind ? refind() : null;
  if (!now) return;
  const d = now.getBoundingClientRect().top - before;
  if (Math.abs(d) > 1) window.scrollBy(0, d);
}

/**
 * Тема, контрастність і анімація на корені документа.
 * «Чорна» — це темна тема з чистим чорним тлом (data-black).
 * @param {import('./types').Settings} s
 */
export function applyTheme(s) {
  const root = document.documentElement;
  if (s.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = s.theme === 'black' ? 'dark' : s.theme;
  if (s.theme === 'black') root.dataset.black = '1'; else root.removeAttribute('data-black');
  if (s.contrast) root.dataset.contrast = 'more'; else root.removeAttribute('data-contrast');
  if (s.motion) root.dataset.motion = 'reduce'; else root.removeAttribute('data-motion');
  const dark = s.theme === 'dark' || s.theme === 'black' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const color = s.theme === 'black' ? '#000000' : dark ? '#0B1424' : '#F8F5EF';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
}

/**
 * Смужка прогресу.
 * @param {number} pct @param {string} label доступна назва
 */
export function bar(pct, label) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return `<span class="bar${v >= 100 ? ' full' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-label="${esc(label)}"><i style="width:${v}%"></i></span>`;
}

/** @param {string} title @param {string} [back] @param {string} [sub] */
export function pageHead(title, back = '', sub = '') {
  return `<div class="ph">${back ? `<a class="back" href="${esc(back)}" aria-label="Назад">${icon('i-back')}<span>Назад</span></a>` : ''}
    <h1 tabindex="-1">${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div>`;
}

/** Готове речення про кількість людей. @param {number} n */
export function peopleText(n) {
  return `${n} ${plural(n, 'людина', 'людини', 'людей')}`;
}

/** @param {number} t */
export function tempText(t) {
  const r = Math.round(t * 10) / 10;
  return `${r > 0 ? '+' : ''}${String(r).replace('.', ',')} °C`;
}

/** @param {import('./types').DayState} s */
export function peopleList(s) {
  /** @type {string[]} */
  const p = [];
  if (s.adults) p.push(`${s.adults} ${plural(s.adults, 'дорослий', 'дорослих', 'дорослих')}`);
  if (s.kids) p.push(`${s.kids} ${plural(s.kids, 'дитина', 'дитини', 'дітей')}`);
  if (s.elderly) p.push(`${s.elderly} ${plural(s.elderly, 'літня людина', 'літні людини', 'літніх людей')}`);
  if (s.pets) p.push(`${s.pets} ${plural(s.pets, 'тварина', 'тварини', 'тварин')}`);
  return p.join(', ');
}
