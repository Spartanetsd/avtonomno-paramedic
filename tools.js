// @ts-check
// Інструменти на весь екран: нічник, «Дихаємо разом», звуковий сигнал «Я тут», метроном реанімації.
// Працюють офлайн. Поки інструмент відкритий, екран не гасне (Wake Lock, якщо браузер підтримує).

import { icon, on } from './ui.js';
import { CPR_RATE, CPR_BREATH_S, CPR_SWAP_S, cprBeat, cprInterval, clock } from './aid.js';

/** @typedef {'light'|'breathe'|'signal'|'cpr'} ToolKind */

/** @type {HTMLElement|null} */
let el = null;
/** @type {any} */
let lock = null;
/** @type {any} */
let audio = null;
/** @type {ReturnType<typeof setTimeout>[]} */
let timers = [];
/** @type {HTMLElement|null} */
let lastFocus = null;
let lightLevel = 1;
/** Запис в історії: кнопка «Назад» на Android закриває інструмент, а не сторінку під ним. */
let pushed = false;
/** Світловий сигнал SOS у режимі «Я тут». */
let flashOn = false;
/** Номер запуску світлового сигналу: старий ланцюжок таймерів зупиняється сам. */
let flashGen = 0;
/** Метроном реанімації: режим 30:2 і звук (налаштування живуть, поки відкрита сторінка). */
let cprBreaths = false;
let cprSound = true;
/** Номер запуску метронома: старий ланцюжок таймерів зупиняється сам. */
let cprGen = 0;
/** Час початку реанімації: перемикання режиму не скидає хронометр. */
let cprT0 = 0;

/** Рівні нічника: від ледь помітного теплого до яскравого. */
export const LIGHT_LEVELS = [
  { bg: 'radial-gradient(circle at 50% 42%, #4A2108, #160800 72%)', fg: '#E39A5A', label: 'Ледь-ледь' },
  { bg: 'radial-gradient(circle at 50% 42%, #E07F35, #6B2A08 78%)', fg: '#FFF1DF', label: 'Тепле' },
  { bg: 'radial-gradient(circle at 50% 42%, #FFD39A, #E39143 80%)', fg: '#2A1505', label: 'Яскравіше' },
  { bg: 'radial-gradient(circle at 50% 42%, #FFFFFF, #FFE7C4 85%)', fg: '#3A2410', label: 'Найяскравіше' },
];

/** Сигнал: 3 короткі гудки кожні SIGNAL_EVERY секунд. */
export const SIGNAL_EVERY = 10;
/** Дихання: вдих BREATH_IN с, видих BREATH_OUT с — близько 6 подихів на хвилину. */
export const BREATH_IN = 4;
export const BREATH_OUT = 6;

export function isToolOpen() {
  return !!el;
}

/** @param {ToolKind} k */
export function openTool(k) {
  if (el) closeTool(true);
  else {
    lastFocus = /** @type {HTMLElement|null} */ (document.activeElement);
    try { history.pushState({ avTool: true }, ''); pushed = true; } catch { pushed = false; }
  }
  el = document.createElement('div');
  el.className = `tool tool-${k}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (k === 'light') renderLight();
  if (k === 'breathe') renderBreathe();
  if (k === 'signal') renderSignal();
  if (k === 'cpr') renderCpr();
  document.body.appendChild(el);
  setInert(true);
  keepAwake();
  /** @type {HTMLElement|null} */ (el.querySelector('[data-first]'))?.focus();
}

/** @param {boolean} [swap] інший інструмент відкривається одразу — історію й фокус не чіпаємо */
export function closeTool(swap = false) {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
  flashOn = false;
  cprGen++;
  if (audio) { try { audio.close(); } catch { /* уже закрито */ } audio = null; }
  if (lock) { lock.release().catch(() => {}); lock = null; }
  el?.remove();
  el = null;
  if (swap) return;
  setInert(false);
  if (pushed) { pushed = false; history.back(); }
  lastFocus?.focus?.();
  lastFocus = null;
}

/** Поки інструмент відкритий, решта сторінки недоступна для фокуса й читачів екрана. @param {boolean} v */
function setInert(v) {
  document.querySelectorAll('body > header, body > main, body > nav, body > .skip, #toast').forEach((n) => {
    if (v) n.setAttribute('inert', ''); else n.removeAttribute('inert');
  });
}

async function keepAwake() {
  try {
    const wl = /** @type {any} */ (navigator).wakeLock;
    if (wl && document.visibilityState === 'visible') lock = await wl.request('screen');
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (el && document.visibilityState === 'visible') keepAwake(); });
document.addEventListener('keydown', (e) => { if (el && e.key === 'Escape') closeTool(); });
// «Назад» (жест чи кнопка) закриває інструмент; запис історії вже знято браузером
window.addEventListener('popstate', () => { if (el) { pushed = false; closeTool(); } });

/* ───────────── Нічник ───────────── */

function renderLight() {
  if (!el) return;
  const lv = LIGHT_LEVELS[lightLevel];
  el.style.setProperty('--tool-bg', lv.bg);
  el.style.setProperty('--tool-fg', lv.fg);
  el.setAttribute('aria-label', 'Нічник');
  el.innerHTML = `<button type="button" class="tool-x" data-act="tool-close" aria-label="Закрити нічник" data-first>${icon('i-close')}</button>
    <button type="button" class="tool-area" data-act="light-next" aria-label="Змінити яскравість. Зараз: ${lv.label}"></button>
    <p class="tool-hint"><b>${lv.label}</b> · торкніться екрана, щоб змінити яскравість. Екран не згасне, поки нічник відкритий.</p>`;
}

/* ───────────── Дихаємо разом ───────────── */

function renderBreathe() {
  if (!el) return;
  el.setAttribute('aria-label', 'Дихаємо разом');
  el.style.setProperty('--br-in', `${BREATH_IN}s`);
  el.style.setProperty('--br-cycle', `${BREATH_IN + BREATH_OUT}s`);
  el.innerHTML = `<button type="button" class="tool-x" data-act="tool-close" aria-label="Закрити вправу" data-first>${icon('i-close')}</button>
    <div class="br-wrap" aria-hidden="true"><div class="br-c"></div></div>
    <p class="br-t" id="br-t">Вдих</p>
    <p class="tool-hint">Повільний вдих носом — ${BREATH_IN} секунди, видих — ${BREATH_OUT}. Дихайте разом із дитиною, тримаючи її за руку.</p>`;
  const phase = (/** @type {boolean} */ inhale) => {
    const t = document.getElementById('br-t');
    if (t) t.textContent = inhale ? 'Вдих' : 'Видих';
    timers.push(setTimeout(() => phase(!inhale), (inhale ? BREATH_IN : BREATH_OUT) * 1000));
  };
  phase(true);
}

/* ───────────── Сигнал «Я тут» ───────────── */

function renderSignal() {
  if (!el) return;
  el.setAttribute('aria-label', 'Звуковий сигнал «Я тут»');
  const AC = /** @type {any} */ (window).AudioContext || /** @type {any} */ (window).webkitAudioContext;
  let ok = false;
  if (AC) {
    try { audio = new AC(); audio.resume?.(); ok = true; } catch { audio = null; }
  }
  el.innerHTML = `<p class="sg-h">${ok ? 'Сигнал «Я тут» увімкнено' : 'Звук недоступний у цьому браузері'}</p>
    <p class="sg-n" id="sg-n">${ok ? 'Сигнал лунає' : 'Стукайте по трубах чи батареях і користуйтеся свистком'}</p>
    <p class="tool-hint">Три гучні гудки кожні ${SIGNAL_EVERY} секунд. Між ними прислухайтеся й стукайте по трубах чи батареях. Екран чорний, щоб берегти заряд.</p>
    <p class="tool-hint">На iPhone вимкніть беззвучний режим і збільште гучність — інакше сигналу не буде чути.</p>
    <button type="button" class="btn ghost sg-flash" data-act="flash-tog" aria-pressed="false">Світловий сигнал SOS</button>
    <button type="button" class="btn primary sg-stop" data-act="tool-close" data-first>Зупинити сигнал</button>`;
  if (!ok) return;
  let left = 0;
  const tick = () => {
    if (left <= 0) { beepBurst(); left = SIGNAL_EVERY; }
    const n = document.getElementById('sg-n');
    if (n) n.textContent = left === SIGNAL_EVERY ? 'Сигнал лунає' : `Наступний сигнал за ${left} с`;
    left--;
    timers.push(setTimeout(tick, 1000));
  };
  tick();
}

/**
 * Ритм SOS (· · · — — — · · ·) для світлового сигналу: [екран світлий?, тривалість мс].
 * Одиниця 300 мс — не більше двох спалахів на секунду, безпечно для людей зі світлочутливістю.
 */
export const SOS_PATTERN = (() => {
  const u = 300;
  /** @type {[boolean, number][]} */
  const seq = [];
  const letter = (/** @type {number} */ len) => { for (let i = 0; i < 3; i++) { seq.push([true, len * u]); seq.push([false, i < 2 ? u : 3 * u]); } };
  letter(1); letter(3); letter(1);
  seq[seq.length - 1] = [false, 7 * u];
  return seq;
})();

function flashStep(/** @type {number} */ i, /** @type {number} */ gen) {
  if (!el || !flashOn || gen !== flashGen) return;
  const [light, ms] = SOS_PATTERN[i % SOS_PATTERN.length];
  el.classList.toggle('flash', light);
  timers.push(setTimeout(() => flashStep(i + 1, gen), ms));
}

/** Три короткі гудки близько 2,8 кГц — у цьому діапазоні слух найчутливіший. */
function beepBurst() {
  if (!audio) return;
  const t0 = audio.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'square';
    o.frequency.value = 2800;
    const s = t0 + i * 0.5;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.8, s + 0.02);
    g.gain.setValueAtTime(0.8, s + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.32);
    o.connect(g).connect(audio.destination);
    o.start(s);
    o.stop(s + 0.34);
  }
}

/* ───────────── Метроном реанімації ───────────── */

/** Новий AudioContext або null, якщо звук недоступний. */
function makeAudio() {
  const AC = /** @type {any} */ (window).AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return null;
  try { const a = new AC(); a.resume?.(); return a; } catch { return null; }
}

function renderCpr() {
  if (!el) return;
  el.setAttribute('aria-label', 'Метроном реанімації');
  if (!audio) audio = makeAudio();
  cprT0 = performance.now();
  el.innerHTML = `<button type="button" class="tool-x" data-act="tool-close" aria-label="Закрити метроном" data-first>${icon('i-close')}</button>
    <p class="cpr-t"><span id="cpr-t">0:00</span> · ${CPR_RATE} натискань за хвилину</p>
    <div class="cpr-wrap" aria-hidden="true"><div class="cpr-c" id="cpr-c"><b id="cpr-n">1</b></div></div>
    <p class="cpr-s" id="cpr-s" role="status">Натискайте в ритм</p>
    <div class="cpr-ctl">
      <button type="button" class="btn ghost" data-act="cpr-mode">${cprModeText()}</button>
      <button type="button" class="btn ghost" data-act="cpr-sound"${audio ? '' : ' disabled'}>${!audio ? 'Звук недоступний' : cprSoundText()}</button>
    </div>
    <p class="tool-hint">Центр грудної клітки, руки прямі. Глибина 5–6 см, давайте грудям повністю розправитися. Телефонуйте 103 або 112 на гучному зв’язку.</p>`;
  cprRun();
}

const cprModeText = () => (cprBreaths ? 'Режим: 30 натискань і 2 вдихи' : 'Режим: лише натискання');
const cprSoundText = () => (cprSound ? 'Звук: увімкнено' : 'Звук: вимкнено');

/** Запуск ритму: точний графік від старту, без накопичення похибки таймерів. */
function cprRun() {
  const gen = ++cprGen;
  const step = cprInterval();
  const t0 = cprT0 || performance.now();
  let next = performance.now();
  let n = 0;
  /** Кінець паузи на вдихи (мс від performance.now) або 0. */
  let pauseEnd = 0;
  let swapShown = Math.floor((next - t0) / 1000 / CPR_SWAP_S);
  let flip = false;
  const $ = (/** @type {string} */ id) => document.getElementById(id);
  const say = (/** @type {string} */ t) => { const s = $('cpr-s'); if (s && s.textContent !== t) s.textContent = t; };
  const tick = () => {
    if (!el || gen !== cprGen) return;
    const now = performance.now();
    const sec = (now - t0) / 1000;
    const t = $('cpr-t');
    if (t) t.textContent = clock(sec);
    const swapNo = Math.floor(sec / CPR_SWAP_S);
    if (pauseEnd) {
      if (now < pauseEnd) {
        const left = Math.ceil((pauseEnd - now) / 1000);
        const nb = $('cpr-n');
        if (nb) nb.textContent = String(left);
        timers.push(setTimeout(tick, Math.min(250, pauseEnd - now)));
        return;
      }
      pauseEnd = 0;
      next = now;
    }
    n++;
    const beat = cprBeat(n, cprBreaths);
    const nb = $('cpr-n');
    if (nb) nb.textContent = String(beat.k);
    const c = $('cpr-c');
    if (c) { c.classList.toggle('b1', flip); c.classList.toggle('b2', !flip); c.classList.remove('pause'); flip = !flip; }
    click(beat.k === 1 ? 1300 : 1000);
    if (swapNo > swapShown) {
      swapShown = swapNo;
      say('Минуло 2 хвилини. Поміняйтеся, якщо є кому');
      click(600, 0.25);
    } else if (beat.k === 1) {
      say(cprBreaths ? 'Натискайте в ритм · 30 натискань, потім 2 вдихи' : 'Натискайте в ритм без зупинок');
    }
    if (beat.breathe) {
      pauseEnd = now + step + CPR_BREATH_S * 1000;
      timers.push(setTimeout(() => {
        if (!el || gen !== cprGen) return;
        say(`2 вдихи — разом до ${CPR_BREATH_S} секунд`);
        const c2 = $('cpr-c');
        if (c2) c2.classList.add('pause');
      }, step));
    }
    next += step;
    timers.push(setTimeout(tick, Math.max(0, next - performance.now())));
  };
  tick();
}

/** Короткий клац у ритм. @param {number} hz @param {number} [len] секунди */
function click(hz, len = 0.06) {
  if (!audio || !cprSound) return;
  try {
    const t = audio.currentTime + 0.01;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'square';
    o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + len + 0.02);
  } catch { /* звук не обов’язковий */ }
}

on({
  tool: (b) => openTool(/** @type {ToolKind} */ (b.dataset.v)),
  'tool-close': () => closeTool(),
  'flash-tog': (b) => {
    flashOn = !flashOn;
    b.setAttribute('aria-pressed', String(flashOn));
    b.textContent = flashOn ? 'Вимкнути світловий сигнал' : 'Світловий сигнал SOS';
    flashGen++;
    if (flashOn) flashStep(0, flashGen); else el?.classList.remove('flash');
  },
  'cpr-mode': (b) => {
    cprBreaths = !cprBreaths;
    b.textContent = cprModeText();
    cprRun();
  },
  'cpr-sound': (b) => {
    cprSound = !cprSound;
    b.textContent = cprSoundText();
  },
  'light-next': () => { lightLevel = (lightLevel + 1) % LIGHT_LEVELS.length; renderLight(); /** @type {HTMLElement|null} */ (el?.querySelector('.tool-area'))?.focus(); },
});
