// @ts-check
// Укриття, тривожна валізка й підготовка підвалу: зміст і чиста логіка без DOM.
// Тексти спираються на офіційні рекомендації (ключі джерел — у data.js → SOURCES).

import { reserveInsight, norm } from './engine.js';
import { EMERGENCY } from './safety.js';
import { AID, AID_WORDS } from './aid.js';
import { plural } from './ui.js';

/** @typedef {import('./types').Ctx} Ctx */
/** @typedef {{key:string, label:string, hint?:string, when?:'kids'|'pets'}} CheckItem */
/** @typedef {{key:string, title:string, items:CheckItem[]}} CheckGroup */
/** @typedef {{id:string, title:string, level?:'info'|'caution'|'danger', items:string[], sources:string[], link?:string, tool?:'light'|'breathe'|'signal', when?:'kids'|'pets'}} Block */

/* ───────────── Тривожна валізка (МОН, ДСНС, Держпродспоживслужба) ───────────── */

/** @type {CheckGroup[]} */
export const BAG = [
  { key: 'docs', title: 'Документи й гроші', items: [
    { key: 'docs', label: 'Паспорт, свідоцтва про народження дітей та інші документи', hint: 'У водонепроникному пакеті' },
    { key: 'copies', label: 'Копії документів', hint: 'Паперові та фото в телефоні' },
    { key: 'cash', label: 'Готівка дрібними купюрами й банківська картка' },
    { key: 'medinfo', label: 'Аркуш із медичною інформацією', hint: 'Група крові, алергії, хронічні хвороби, ліки' },
    { key: 'kidnote', label: 'Записка в кишені дитини', hint: 'Прізвище та ім’я дитини й батьків, адреса, номери телефонів', when: 'kids' },
  ] },
  { key: 'water', title: 'Вода й їжа', items: [
    { key: 'water', label: 'Питна вода — щонайменше 1,5 л на людину' },
    { key: 'food', label: 'Їжа на 3 доби, яка не псується', hint: 'Консерви з ключем, батончики, горіхи, сухофрукти, хлібці' },
    { key: 'babyfood', label: 'Дитяче харчування, пляшечка, підгузки', when: 'kids' },
  ] },
  { key: 'health', title: 'Здоров’я й гігієна', items: [
    { key: 'meds', label: 'Ліки, які приймаєте постійно, — щонайменше на тиждень' },
    { key: 'firstaid', label: 'Аптечка', hint: 'Бинти, пластирі, антисептик, знеболювальне; за можливості — турнікет' },
    { key: 'hygiene', label: 'Зубна щітка, паста, мило, туалетний папір, засоби особистої гігієни' },
    { key: 'wipes', label: 'Вологі серветки й антисептик для рук' },
    { key: 'trash', label: 'Сміттєві пакети' },
  ] },
  { key: 'light', title: 'Світло й зв’язок', items: [
    { key: 'headlamp', label: 'Налобний ліхтар і запасні батарейки', hint: 'Замість свічок: відкритий вогонь в укритті заборонений' },
    { key: 'powerbank', label: 'Заряджений павербанк і кабелі' },
    { key: 'phonelist', label: 'Паперовий список важливих номерів' },
    { key: 'radio', label: 'Радіо на батарейках' },
    { key: 'whistle', label: 'Свисток', hint: 'Щоб подати сигнал рятувальникам, не зриваючи голос' },
    { key: 'spare', label: 'Запасний кнопковий телефон', hint: 'За можливості' },
  ] },
  { key: 'warm', title: 'Тепло й відпочинок', items: [
    { key: 'mat', label: 'Каремат або килимок', hint: 'Щоб не сидіти на холодному бетоні' },
    { key: 'sleep', label: 'Спальник або термоковдра' },
    { key: 'clothes', label: 'Теплий одяг, змінна білизна й шкарпетки' },
    { key: 'rain', label: 'Дощовик і зручне взуття' },
    { key: 'tarp', label: 'Тент або щільна плівка' },
  ] },
  { key: 'kids', title: 'Для дітей', items: [
    { key: 'toy', label: 'Улюблена іграшка, олівці й розмальовка', when: 'kids' },
    { key: 'audio', label: 'Аудіоказки й ігри, завантажені в телефон для офлайну', when: 'kids' },
  ] },
  { key: 'pets', title: 'Для тварин', items: [
    { key: 'leash', label: 'Повідок і намордник або переноска', when: 'pets' },
    { key: 'petfood', label: 'Корм і вода на кілька днів, миска', when: 'pets' },
    { key: 'petdocs', label: 'Ветеринарний паспорт, пелюшки, пакети', when: 'pets' },
  ] },
  { key: 'other', title: 'Корисні дрібниці', items: [
    { key: 'tool', label: 'Мультитул або ніж, скотч' },
    { key: 'pen', label: 'Ручка й блокнот' },
    { key: 'map', label: 'Паперова карта місцевості' },
    { key: 'keys', label: 'Запасні ключі від дому' },
    { key: 'glasses', label: 'Запасні окуляри чи лінзи, батарейки до слухового апарата', hint: 'Якщо користуєтеся' },
  ] },
];
export const BAG_SOURCES = ['monBag', 'podilShelter', 'dsnsBlocked', 'dpssPets'];

/* ───────────── Укриття: підготувати заздалегідь ───────────── */

/** @type {CheckGroup[]} */
export const PREP = [
  { key: 'find', title: 'Знайти', items: [
    { key: 'addr', label: 'Знайдіть 2–3 найближчі укриття й запишіть адреси', hint: 'Мапа укриттів є в застосунку «Дія»; адреси — у нотатки' },
    { key: 'near', label: 'Оберіть найближче укриття, а не найзахищеніше', hint: 'Головне — встигнути дійти (ДСНС)' },
    { key: 'signs', label: 'Запам’ятайте позначки «Укриття» та «Об’єкт цивільного захисту»', hint: 'І хто відчиняє двері під час тривоги' },
    { key: 'route', label: 'Пройдіть маршрут удень разом із родиною', hint: 'Домовтеся про місце зустрічі, якщо зв’язку не буде' },
    { key: 'walls', label: 'Визначте вдома місце за правилом двох стін', hint: 'Лише на випадок, коли до укриття не встигаєте' },
  ] },
  { key: 'check', title: 'Оглянути укриття', items: [
    { key: 'exits', label: 'Є два виходи, і жоден не заставлений', hint: 'Один із них може бути аварійним' },
    { key: 'walls2', label: 'Знайдіть місце біля несучих стін, подалі від входу' },
    { key: 'vent', label: 'Вентиляційні отвори й продухи нічим не закриті' },
    { key: 'fire', label: 'Знаєте, де вогнегасник' },
  ] },
  { key: 'equip', title: 'Облаштувати', items: [
    { key: 'mats', label: 'Каремати, ковдри, стільці — щоб не сидіти на бетоні' },
    { key: 'water', label: 'Питна вода в закритих ємностях', hint: 'Орієнтир — 2 л на людину на добу' },
    { key: 'light', label: 'Акумуляторні ліхтарі й батарейки', hint: 'Свічки й відкритий вогонь в укритті заборонені' },
    { key: 'aid', label: 'Аптечка' },
    { key: 'toilet', label: 'Відро з кришкою й пакети для туалету в окремій відгородженій зоні' },
    { key: 'radio', label: 'Радіо на батарейках для оголошень' },
    { key: 'sheet', label: 'Пам’ятка на стіні: номери, адреса, відповідальні', hint: 'Готова пам’ятка є в цьому застосунку — її можна роздрукувати' },
  ] },
  { key: 'agree', title: 'Домовитися', items: [
    { key: 'keys', label: 'Хто відповідає за ключі, щоб двері були відчинені під час тривоги' },
    { key: 'help', label: 'Хто допомагає літнім сусідам і людям з інвалідністю' },
    { key: 'kidsplan', label: 'Поясніть дітям план і намалюйте разом карту укриття', hint: 'Де вхід і вихід, де ваше місце (ЮНІСЕФ)' },
    { key: 'pets', label: 'Тварини: повідок чи переноска; домовтеся про місця з сусідами-алергіками', when: 'pets' },
  ] },
];
export const PREP_SOURCES = ['diiaShelters', 'bdpuShelter', 'dsnsShelterReq', 'podilShelter', 'dsnsBlocked', 'unicefShelter', 'dpssPets'];

/* ───────────── Режим «Укриття»: тривога → в укритті → відбій ───────────── */

export const ALARM_STEPS = [
  'Почули сирену — одразу йдіть до найближчого укриття, не чекаючи вибухів.',
  'Візьміть тривожну валізку, документи, телефон і воду.',
  'Якщо є хвилина — вимкніть газ, воду й світло, зачиніть вікна.',
  'Допоможіть дітям і літнім сусідам. Ліфтом не користуйтеся.',
  'Повідомте рідних, куди йдете.',
];
export const ALARM_SOURCES = ['dsnsAlarm', 'podilShelter', 'bdpuShelter'];

/** Коли до укриття не встигнути. @type {Block[]} */
export const ALARM_FOLDS = [
  { id: 'walls', title: 'Не встигаєте до укриття', level: 'caution', items: [
    'Вдома оберіть приміщення без вікон або коридор, щоб між вами й вулицею було дві стіни.',
    'Сядьте на підлогу біля несучої стіни, подалі від вікон і скла.',
    'Сходовий майданчик між поверхами — теж варіант. Ліфт — ні.',
    'Це крайній захід: він зменшує ризик, але не усуває його. Укриття завжди краще.',
  ], sources: ['dsnsAlarm', 'dsnsRubble'] },
  { id: 'street', title: 'Тривога застала на вулиці', level: 'caution', items: [
    'Не залишайтеся на відкритому місці: шукайте укриття, підземний перехід чи будь-яке заглиблення.',
    'Укриття немає — ляжте в заглиблення (канаву, яму), голову прикрийте руками.',
    'Поруч дитина — спершу покладіть у заглиблення її й прикрийте собою.',
  ], sources: ['dsnsStreet', 'dsnsAlarm'] },
  { id: 'car', title: 'В авто чи громадському транспорті', level: 'caution', items: [
    'Транспорт не є укриттям: зупиніться, вийдіть і шукайте укриття чи заглиблення.',
    'Не намагайтеся втекти від обстрілу на швидкості.',
    'Міст чи естакада — не сховок.',
    'У маршрутці чи трамваї попросіть водія зупинитися, відійдіть від дороги й будівель і ляжте.',
  ], sources: ['mvsCar', 'dsnsStreet'] },
];

export const FIRST_STEPS = [
  'Сядьте біля несучої стіни, подалі від входу. Не сідайте на бетон — підкладіть каремат чи ковдру.',
  'Запам’ятайте, де виходи й вогнегасник.',
  'Повідомте рідних одним повідомленням — і бережіть заряд.',
];
export const FIRST_SOURCES = ['bdpuShelter', 'podilShelter'];

/** Поки сидимо в укритті. @type {Block[]} */
export const WHILE_BLOCKS = [
  { id: 'kids', title: 'Діти', when: 'kids', tool: 'breathe', items: [
    'Поясніть простими словами, що відбувається і що ви робите разом.',
    'Обійміть, візьміть за руку. Стежте, чи дитина не затримує дихання, — дихайте разом повільно.',
    'Запитайте, як вона почувається; дозвольте «прогарчати» страх, як ведмедик.',
    'Казки, аудіокниги, ігри й звичний розпорядок дня заспокоюють.',
  ], sources: ['unicefShelter'] },
  { id: 'warm', title: 'Тепло', link: 'heat-shelter', items: [
    'Під себе — каремат, картон чи складену ковдру: бетон забирає тепло найшвидше.',
    'Шапка, сухі шкарпетки, одяг шарами; гарячий напій із термоса.',
    'Жодних свічок, пальників чи обігрівачів на паливі — ризик чадного газу й пожежі.',
  ], sources: ['podilShelter', 'cdcWinter', 'cdcCO'] },
  { id: 'air', title: 'Повітря', link: 'cool-shelter', items: [
    'Задушливо — менше рухайтеся й говоріть тихіше.',
    'Діти, літні й хворі — ближче до вентиляційних отворів.',
    'Не паліть і не запалюйте нічого.',
    'Пожежа, загазованість чи нестача повітря — виходити дозволено й до відбою.',
  ], sources: ['kyivShelter', 'podilShelter'] },
  { id: 'pets', title: 'Тварини', when: 'pets', items: [
    'Перебувати в укритті з домашніми тваринами можна.',
    'Собака — на повідку, кіт і дрібні тварини — у переносці.',
    'Не залишайте тварину без нагляду; поважайте сусідів з алергією чи страхом перед тваринами.',
  ], sources: ['dpssPets'] },
  { id: 'charge', title: 'Заряд і зв’язок', tool: 'light', items: [
    'Один телефон — на зв’язку, решта — в режимі енергозбереження.',
    'Яскравість мінімальна; чорна тема береже заряд на OLED-екранах.',
    'Новини — з офіційних каналів і радіо; не знімайте й не публікуйте наслідки ударів.',
  ], sources: ['podilShelter', 'cdcOutage'] },
  { id: 'rules', title: 'Правила укриття', items: [
    'Не ходіть без потреби, не шуміть, не чіпайте обладнання й не відчиняйте герметичні двері.',
    'Не паліть, не запалюйте свічок і ліхтарів із відкритим полум’ям.',
    'Виконуйте вказівки відповідального й слухайте оголошення.',
  ], sources: ['podilShelter', 'kyivShelter', 'bdpuShelter'] },
];

/** Якщо вихід завалено. @type {Block} */
export const BLOCKED = { id: 'blocked', title: 'Якщо вихід завалено', level: 'danger', tool: 'signal', items: [
  'Не панікуйте й не розбирайте завали самостійно, якщо не впевнені.',
  'Подавайте сигнали час від часу: стукайте по трубах чи батареях, свистіть, світіть ліхтариком. Бережіть сили.',
  'Рятувальники оголошують «хвилину тиші»: щойно стихли голоси й техніка — подайте сигнал.',
  'Є зв’язок — телефонуйте 112 або 101, назвіть адресу й скільки вас.',
  'Поруч дитина — візьміть за руку, дихайте разом повільно, розповідайте історії.',
], sources: ['dsnsBlocked', 'dsnsSilence', 'dsnsRubble', 'rubbleKids'] };

export const AFTER_STEPS = [
  'Не поспішайте виходити: зачекайте кілька хвилин (ДСНС радить 10–15) і слухайте вказівки.',
  'Не торкайтеся уламків і підозрілих предметів — телефонуйте 101 або 102.',
  'Не відпускайте дітей гратися надворі одразу після відбою.',
  'Вдома відчули запах газу — не вмикайте світло, відчиніть вікна й телефонуйте 104.',
  'Повідомте рідних, що все гаразд.',
  'Поповніть валізку: вода, заряд, ліки.',
];
export const AFTER_SOURCES = ['dsnsAfter', 'kyivShelter'];

/** Короткі правила для пам’ятки на стіні укриття. */
export const SHEET_RULES = [
  'Сідайте біля несучих стін, подалі від входу; під себе — каремат чи ковдру.',
  'Не паліть, не запалюйте свічок і вогню; не шуміть і не ходіть без потреби.',
  'Діти, літні й хворі — ближче до вентиляції.',
  'Тварини — на повідку або в переносці, під наглядом.',
  'Виходити — після відбою або в разі пожежі, загазованості чи нестачі повітря.',
];

/**
 * Пам’ятка простим текстом — для чату будинку чи ОСББ.
 * @param {string} url адреса застосунку
 */
export function sheetText(url) {
  const list = (/** @type {string[]} */ a, /** @type {boolean} */ num) => a.map((t, i) => `${num ? `${i + 1}.` : '•'} ${t}`).join('\n');
  return [
    'УКРИТТЯ: ЩО РОБИТИ',
    '',
    `Екстрені номери: ${EMERGENCY.map((e) => `${e.num} — ${e.label[0].toLowerCase()}${e.label.slice(1)}`).join('; ')}.`,
    '',
    'Під час тривоги:',
    list(ALARM_STEPS, true),
    '',
    'В укритті:',
    list(SHEET_RULES, false),
    '',
    'Якщо вихід завалено:',
    list(BLOCKED.items, false),
    '',
    'Після відбою:',
    list(AFTER_STEPS.slice(0, 4), false),
    '',
    `Офлайн-помічник «Автономно» — працює без інтернету: ${url}`,
  ].join('\n');
}

export const PRAISE = {
  start: 'Ви вчасно сховалися. Це найважливіше.',
  after: 'Ви впоралися. Дякуємо, що бережете себе й близьких.',
};

export const SHARE_TEXT = {
  in: 'Я в укритті, зі мною все гаразд. Напишу після відбою.',
  after: 'Відбій. Ми вийшли з укриття, все гаразд.',
};

/* ───────────── Логіка ───────────── */

/**
 * Чи стосується пункт цієї родини.
 * @param {CheckItem | Block} it
 * @param {{kids:number, pets:number, limits?:Set<string>}} c
 */
export function applies(it, c) {
  if (!it.when) return true;
  if (it.when === 'kids') return c.kids > 0;
  return c.pets > 0 || !!(c.limits && c.limits.has('animals'));
}

/**
 * Групи лише з доречними пунктами.
 * @param {CheckGroup[]} groups
 * @param {{kids:number, pets:number, limits?:Set<string>}} c
 */
export function itemsFor(groups, c) {
  return groups.map((g) => ({ ...g, items: g.items.filter((it) => applies(it, c)) })).filter((g) => g.items.length);
}

/**
 * Скільки зроблено з доречних пунктів. Невідомі ключі (напр. з новішої версії) не рахуються.
 * @param {CheckGroup[]} groups
 * @param {string[]} checked
 * @param {{kids:number, pets:number, limits?:Set<string>}} c
 */
export function progress(groups, checked, c) {
  const items = itemsFor(groups, c).flatMap((g) => g.items);
  const set = new Set(checked);
  const done = items.filter((i) => set.has(i.key)).length;
  return { done, total: items.length, pct: items.length ? Math.round((done * 100) / items.length) : 0 };
}

/** @param {number} pct */
export function readinessPraise(pct) {
  if (pct >= 100) return 'Ви готові. Це велика турбота про себе й близьких.';
  if (pct >= 80) return 'Майже все готово — ви молодець.';
  if (pct >= 40) return 'Ви вже добре підготувалися. Ще кілька кроків.';
  if (pct > 0) return 'Гарний початок. Кожен пункт — ще трохи спокою.';
  return 'Почніть з однієї речі сьогодні — це вже турбота.';
}

/**
 * Загальна готовність: валізка, укриття, важливі запаси.
 * @param {{bag:string[], prep:string[]}} d
 * @param {Ctx} ctx
 */
export function readiness(d, ctx) {
  const bag = progress(BAG, d.bag, ctx);
  const prep = progress(PREP, d.prep, ctx);
  const ess = reserveInsight(ctx).essentials;
  const okN = ess.filter((e) => e.ok).length;
  const res = { done: okN, total: ess.length, pct: ess.length ? Math.round((okN * 100) / ess.length) : 0 };
  const pct = Math.round((bag.pct + prep.pct + res.pct) / 3);
  return { bag, prep, res, pct, praise: readinessPraise(pct) };
}

/** @param {number} since мс @param {number} now мс */
export function elapsedMin(since, now) {
  return Math.max(0, Math.floor((now - since) / 60000));
}

/**
 * Тривалість по-людськи.
 * @param {number} min
 * @param {boolean} [short] коротко — для шапки
 */
export function durText(min, short = false) {
  if (min < 1) return short ? 'щойно' : 'менше хвилини';
  if (min < 60) return `${min} хв`;
  if (min >= 1440) {
    const dd = Math.floor(min / 1440);
    return `понад ${dd} ${plural(dd, 'добу', 'доби', 'діб')}`;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} год ${m} хв` : `${h} год`;
}

/** Скільки днів минуло від позначки (мс), або null. @param {number|null} at @param {number} now */
export function daysSince(at, now) {
  return at == null ? null : Math.max(0, Math.floor((now - at) / 86400000));
}

/** Валізку час перевірити: ніколи не перевіряли або понад 90 днів тому. @param {number|null} at @param {number} now */
export function bagDue(at, now) {
  const dd = daysSince(at, now);
  return dd == null || dd > 90;
}

/* ───────────── Швидкий перехід із пошуку ───────────── */

/** @type {{href?:string, tool?:'light'|'breathe'|'signal'|'cpr', title:string, icon:string, words:string[]}[]} */
export const SECTIONS = [
  { href: '#/aid', title: 'Перша допомога: кровотеча, реанімація, удавився', icon: 'i-aid', words: [...AID_WORDS, ...AID.flatMap((t) => t.words)] },
  { tool: 'cpr', title: 'Метроном для реанімації', icon: 'i-heart', words: ['реаніма', 'метроном', 'слр', 'масаж серц', 'не дих'] },
  { href: '#/shelter', title: 'Я в укритті: що робити під час тривоги', icon: 'i-shelter', words: ['укритт', 'підвал', 'тривог', 'сирен', 'обстріл', 'завал', 'вибух', 'двох стін', 'дві стіни', 'бомбосховищ', 'сховищ'] },
  { href: '#/bag', title: 'Тривожна валізка', icon: 'i-bag', words: ['валіз', 'тривожн', 'рюкзак', 'документ', 'евакуац'] },
  { href: '#/prep', title: 'Підготувати укриття заздалегідь', icon: 'i-list', words: ['підвал', 'укритт', 'облаштув', 'сусід', 'бомбосховищ'] },
  { href: '#/sheet', title: 'Пам’ятка для укриття — роздрукувати', icon: 'i-print', words: ['памятк', 'друк', 'шпаргал', 'роздрук'] },
  { tool: 'light', title: 'Нічник на весь екран', icon: 'i-moon', words: ['нічник', 'нічне', 'темно', 'темряв'] },
  { tool: 'breathe', title: 'Дихаємо разом — заспокоїтися', icon: 'i-wave', words: ['дихан', 'дихат', 'панік', 'страх', 'заспоко', 'стрес', 'боїт'] },
  { tool: 'signal', title: 'Звуковий сигнал «Я тут»', icon: 'i-sound', words: ['сигнал', 'завал', 'свисток', 'рятувальник'] },
];

/** Розділи, що відповідають запиту. @param {string} q */
export function sectionsFor(q) {
  const n = norm(q);
  if (n.length < 3) return [];
  return SECTIONS.filter((s) => s.words.some((w) => n.includes(w) || (n.length >= 4 && w.startsWith(n))));
}
