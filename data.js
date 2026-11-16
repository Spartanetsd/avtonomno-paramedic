// @ts-check
// Довідники «Автономно»: джерела, категорії, ресурси, сезонні сценарії.
// Модуль без DOM — використовується і в браузері, і в тестах Node.

/** @typedef {import('./types').Source} Source */
/** @typedef {import('./types').Season} Season */
/** @typedef {import('./types').Need} Need */

/** Перевірені джерела. Ключі використовуються в картках рішень. */
/** @type {Record<string, Source>} */
export const SOURCES = {
  cdcWater: { org: 'CDC', title: 'Як зробити воду безпечною в надзвичайній ситуації', url: 'https://www.cdc.gov/water-emergency/about/' },
  cdcWaterSupply: { org: 'CDC', title: 'Як створити аварійний запас води', url: 'https://www.cdc.gov/disasters/foodwater/prepare.html' },
  readyWater: { org: 'Ready.gov (FEMA)', title: 'Вода: потреби, зберігання, очищення', url: 'https://www.ready.gov/water' },
  sphere: { org: 'Sphere', title: 'Довідник Sphere: мінімальні стандарти водопостачання', url: 'https://handbook.hspstandards.org/en/sphere/' },
  cdcFood: { org: 'CDC', title: 'Безпека їжі після аварії чи відключення', url: 'https://www.cdc.gov/food-safety/foods/keep-food-safe-after-emergency.html' },
  usdaDanger: { org: 'USDA FSIS', title: '«Небезпечна зона» температур для їжі', url: 'https://www.fsis.usda.gov/news-events/news-press-releases/usda-urges-consumers-keep-clear-danger-zone-summer' },
  fdaBeans: { org: 'FDA (архівна копія)', title: 'Bad Bug Book: лектин червоної квасолі', url: 'https://webarchive.library.unt.edu/eot2008/20090512012540/http:/vm.cfsan.fda.gov/~mow/chap43.html' },
  cdcCO: { org: 'CDC', title: 'Отруєння чадним газом: основне', url: 'https://www.cdc.gov/carbon-monoxide/' },
  cdcOutageCO: { org: 'CDC', title: 'Як уникнути отруєння чадним газом під час відключень', url: 'https://www.cdc.gov/natural-disasters/psa-toolkit/avoiding-carbon-monoxide-poisoning.html' },
  cdcOutage: { org: 'CDC', title: 'Що робити під час відключення електроенергії', url: 'https://www.cdc.gov/natural-disasters/response/what-to-do-protect-yourself-during-a-power-outage.html' },
  cdcWinter: { org: 'CDC', title: 'Переохолодження та обмороження', url: 'https://www.cdc.gov/winter-weather/prevention/index.html' },
  cdcHeat: { org: 'CDC', title: 'Ознаки теплових уражень і що робити', url: 'https://www.cdc.gov/extreme-heat/signs-symptoms/index.html' },
  cdcHands: { org: 'CDC', title: 'Гігієна рук: питання й відповіді', url: 'https://www.cdc.gov/clean-hands/faq/index.html' },
  mohCO: { org: 'МОЗ України', title: 'У чому небезпека чадного газу та як уберегтися', url: 'https://moz.gov.ua/uk/u-chomu-nebezpeka-chadnogo-gazu-ta-jak-uberegtisja-vid-otruennja' },
  mohCO2: { org: 'МОЗ України', title: 'Що треба знати про отруєння чадним газом', url: 'https://moz.gov.ua/uk/scho-treba-znati-pro-otruennja-chadnim-gazom-i-jak-jomu-zapobigti' },
  mohGen: { org: 'МОЗ України', title: 'Правила безпеки під час використання електрогенераторів', url: 'https://moz.gov.ua/uk/pravila-bezpeki-pid-chas-vikoristannja-elektrogeneratoriv' },
  dsns: { org: 'ДСНС України', title: 'Портал безпеки ДСНС', url: 'https://bezpeka.dsns.gov.ua/' },
  kmdaBurner: { org: 'КМДА / ДСНС', title: 'Газові балони й туристичні пальники в приміщеннях', url: 'https://kyivcity.gov.ua/bezpeka_ta_pravoporiadok/pam_yatky/yak_bezpechno_vikoristovuvati_gazovi_baloni_i_turistichni_gazovi_palniki_u_zakritikh_primischennyakh/' },
  punkty: { org: 'Уряд України', title: 'Пункти незламності: де знайти найближчий', url: 'https://www.kmu.gov.ua/news/tryvaie-audyt-punktiv-nezlamnosti-po-vsii-kraini-oleksii-kuleba' },
  mvs: { org: 'МВС України', title: 'Міністерство внутрішніх справ України', url: 'https://mvs.gov.ua/' },
  ready: { org: 'Ready.gov (FEMA)', title: 'Підготовка до надзвичайних ситуацій', url: 'https://www.ready.gov/' },
  phe: { org: 'Public Health England', title: 'Мінімальна температура житла взимку: огляд досліджень', url: 'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/468196/Min_temp_threshold_for_homes_in_winter.pdf' },
  doeWindows: { org: 'U.S. DOE Energy Saver', title: 'Енергоефективні штори, жалюзі й маркізи', url: 'https://www.energy.gov/energysaver/energy-efficient-window-attachments' },
  epaMold: { org: 'EPA', title: 'Прибирання плісняви вдома', url: 'https://www.epa.gov/mold/mold-cleanup-your-home' },
  epaMoldGuide: { org: 'EPA', title: 'Пліснява, вологість і ваш дім', url: 'https://www.epa.gov/mold/brief-guide-mold-moisture-and-your-home' },
  batteryU: { org: 'Battery University', title: 'Заряджання акумуляторів за низьких і високих температур', url: 'https://batteryuniversity.com/article/bu-410-charging-at-high-and-low-temperatures' },
  hotBottle: { org: 'ACCC Product Safety', title: 'Безпечне використання грілок', url: 'https://www.productsafety.gov.au/consumers/be-safe-around-the-home/use-products-inside-the-home-safely/hot-water-bottles-guide' },
  toiletKC: { org: 'Public Health — Seattle & King County', title: 'Як облаштувати аварійний туалет', url: 'https://kingcounty.gov/depts/health/emergency-preparedness/preparing-yourself/emergency-toilets.aspx' },
  toiletOSU: { org: 'Oregon State University Extension', title: 'Санітарія в надзвичайних ситуаціях', url: 'https://extension.oregonstate.edu/catalog/pub/em-9334-survival-basics-sanitation-waste-management' },
  carWinter: { org: 'Maine Emergency Management Agency', title: 'Якщо ви застрягли в автомобілі взимку', url: 'https://www.maine.gov/mema/hazards/natural-hazards/severe-winter-storms/stranded-with-car' },
  pvgis: { org: 'Єврокомісія, JRC PVGIS', title: 'Інструмент оцінки сонячного випромінювання', url: 'https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-tools/daily-radiation_en' },
  solarKyiv: { org: 'profileSOLAR (дані NASA POWER)', title: 'Сезонна генерація сонячних панелей, Київ', url: 'https://profilesolar.com/locations/Ukraine/Kyiv/' },
  monBag: { org: 'МОН України', title: 'Рекомендований вміст тривожної валізи', url: 'https://mon.gov.ua/static-objects/mon/sites/1/civilniy-zahist/2022/03.02/Rekom.vmist.tryvozhnoyi.valizy.03.02.pdf' },
  kyivShelter: { org: 'ГУ ДСНС у м. Києві / КМДА', title: 'Як поводитися в укриттях цивільного захисту: правила', url: 'https://kyivcity.gov.ua/news/yak_povoditisya_v_ukrittyakh_tsivilnogo_zakhistu_kiyeva_pravila_povedinki/' },
  podilShelter: { org: 'Подільська РДА м. Києва', title: 'Правила поведінки в укритті (пам’ятка)', url: 'https://minio.kyivcity.gov.ua/kyivcity/sites/15/2025/21072025/%20%D0%BF%D0%BE%D0%B2%D0%B5%D0%B4%D1%96%D0%BA%D0%B8%20%D0%B2%20%D1%83%D0%BA%D1%80%D0%B8%D1%82%D1%82%D1%96%20-%20%D0%9F%D0%BE%D0%B4.%20%D0%A0%D0%94%D0%90.pdf' },
  bdpuShelter: { org: 'БДПУ (за рекомендаціями ДСНС)', title: 'Що робити, коли чутно сигнал «Слідувати в укриття»', url: 'https://www.bdpu.org.ua/wp-content/uploads/2025/04/shho-robyty-koly-chutno-sygnal-sliduvaty-v-ukryttya-bdpu.pdf' },
  diiaShelters: { org: 'Мінцифри / Дія', title: 'Мапа укриттів у застосунку «Дія»', url: 'https://diia.gov.ua/news/nova-posluga-v-diyi-znahodte-najblizhche-ukrittya-v-kilka-klikiv' },
  dsnsShelterReq: { org: 'Суспільне (вимоги ДСНС)', title: 'Що має бути в укритті: виходи, вода, аптечка, каремати', url: 'https://suspilne.media/265616-vognegasnik-voda-wi-fi-aptecka-ta-karemat-u-dsns-pokazali-perelik-vimog-do-skilnih-ukrittiv/' },
  dsnsAlarm: { org: 'Главком (алгоритм ДСНС)', title: 'Що робити під час повітряної тривоги', url: 'https://glavcom.ua/country/society/shcho-robiti-pid-chas-povitrjanoji-trivohi-alhoritm-dij-931374.html' },
  dsnsStreet: { org: 'ТСН (інструкція ДСНС)', title: 'Обстріл застав на вулиці: де сховатися', url: 'https://tsn.ua/ato/shcho-robyty-pid-chas-obstrilu-na-vulytsi-instruktsiia-dsns-3179228.html' },
  mvsCar: { org: 'Вікна (рекомендації МВС)', title: 'Як діяти, якщо обстріл застав за кермом чи в транспорті', url: 'https://vikna.tv/dlia-tebe/bezpeka/yak-diyaty-yakshho-obstril-zastav-za-kermom-rekomendatsiyi-mvs/amp/' },
  dsnsAfter: { org: 'Вікна (пояснення ДСНС)', title: 'Чому не варто виходити з укриття одразу після відбою', url: 'https://vikna.tv/dlia-tebe/bezpeka/pershi-hvylyny-pislya-vidboyu-najbilsh-nebezpechni/' },
  dsnsRubble: { org: 'АрміяInform (роз’яснення ДСНС)', title: 'Що робити, якщо ви опинилися під завалом', url: 'https://armyinform.com.ua/2023/01/18/shho-robyty-yakshho-vy-opynylys-pid-zavalom-rozyasnennya-dsns/' },
  dsnsBlocked: { org: 'УП. Життя (коментар ДСНС)', title: 'Що робити, якщо ви опинилися заблокованими в укритті', url: 'https://life.pravda.com.ua/society/u-dsns-rozpovili-algoritm-diy-u-razi-obvalu-vihodiv-v-ukritti-315726/' },
  dsnsSilence: { org: 'УП. Життя (поради ДСНС)', title: 'Епіцентр обстрілу й завали: «хвилина тиші»', url: 'https://life.pravda.com.ua/society/shcho-robiti-yakshcho-vi-stali-svidkom-vibuhu-chi-opinilis-pid-zavalami-poradi-dsns-302691/' },
  rubbleKids: { org: 'МВС, ДСНС і ЮНІСЕФ', title: 'Під завалами разом з дитиною: правила порятунку', url: 'https://www.kmu.gov.ua/news/pravyla-poriatunku-vid-dsns-ta-iunisef-shcho-robyty-iakshcho-vy-opynylysia-pid-zavalamy-razom-z-dytynoiu' },
  unicefShelter: { org: 'ЮНІСЕФ Україна', title: 'Як батькам підтримати дитину в укритті', url: 'https://www.unicef.org/ukraine/stories/how-to-support-a-child-in-a-shelter' },
  dpssPets: { org: 'Держпродспоживслужба', title: 'Укриття відкриті і для домашніх тварин', url: 'https://dpss.gov.ua/news/ukryttia-vidkryti-i-dlia-domashnikh-tvaryn-shcho-peredbachaie-zakonodavstvo' },
  mohOrder: { org: 'МОЗ України', title: 'Наказ № 441: порядки домедичної допомоги при невідкладних станах', url: 'https://moz.gov.ua/uk/decrees/nakaz-moz-ukraini-vid-09032022--441-pro-zatverdzhennja-porjadkiv-nadannja-domedichnoi-dopomogi-osobam-pri-nevidkladnih-stanah' },
  mohWar: { org: 'МОЗ України', title: 'Порядок домедичної допомоги в умовах бойових дій і воєнного стану', url: 'https://moz.gov.ua/uploads/8/40984-dn_441_09032022_dod29.pdf' },
  mohCivil: { org: 'МОЗ України (портал Уряду)', title: 'Базові правила домедичної допомоги для цивільних', url: 'https://www.kmu.gov.ua/news/moz-nahaduie-bazovi-pravyla-domedychnoi-dopomohy' },
  mohMyths: { org: 'МОЗ України', title: 'Міфи про допомогу при вдавленні та судомах', url: 'https://moz.gov.ua/uk/mifi-pro-nadannja-domedichnoi-dopomogi-u-razi-udavlennja-ta-pid-chas-sudom' },
  ercBls: { org: 'Європейська рада з реанімації (ERC)', title: 'Базова реанімація: головне (українською)', url: 'https://www.cprguidelines.eu/assets/poster-translations/BLS-Infographics_ukr.pdf' },
  mdnPwa: { org: 'MDN', title: 'Прогресивні вебзастосунки (PWA)', url: 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/' },
  ghPages: { org: 'GitHub Docs', title: 'GitHub Pages', url: 'https://docs.github.com/en/pages/' },
};

/** Шість основних потреб головного екрана */
/** @type {Record<Need, {label:string, sub:string, title:string, illo:string}>} */
export const NEEDS = {
  heat: { label: 'Зігрітися', sub: 'тепло та утеплення', title: 'Мені холодно', illo: 'il-heat' },
  food: { label: 'Приготувати їжу', sub: 'гарячі страви й напої', title: 'Потрібна їжа', illo: 'il-food' },
  water: { label: 'Знайти воду', sub: 'запаси, очищення, економія', title: 'Потрібна вода', illo: 'il-water' },
  energy: { label: 'Отримати енергію', sub: 'світло, заряджання, зв’язок', title: 'Потрібна енергія', illo: 'il-energy' },
  cool: { label: 'Охолодитися', sub: 'спека, вентиляція, тінь', title: 'Мені спекотно', illo: 'il-cool' },
  hygiene: { label: 'Побут і гігієна', sub: 'туалет, миття, прання', title: 'Побут і гігієна', illo: 'il-hygiene' },
};

export const NEED_ORDER = /** @type {Need[]} */ (['heat', 'food', 'water', 'energy', 'cool', 'hygiene']);

/** Рівні рішень */
export const LEVELS = {
  1: { label: 'Без витрат', short: 'Рівень 1' },
  2: { label: 'Дешево', short: 'Рівень 2' },
  3: { label: 'Практично', short: 'Рівень 3' },
  4: { label: 'Автономна система', short: 'Рівень 4' },
};

export const PLACES = {
  apartment: 'Квартира',
  house: 'Приватний будинок',
  shelter: 'Укриття або підвал',
  car: 'Автомобіль',
  temp: 'Тимчасове помешкання',
};

export const LIMITS = {
  noOutside: 'Не можна виходити назовні',
  noFlame: 'Не можна використовувати полум’я',
  lowWater: 'Дуже мало води',
  saveCharge: 'Необхідно економити заряд',
  vulnerable: 'Є діти, літні люди або люди з особливими потребами',
  animals: 'Поруч є тварини',
};

export const DURATIONS = {
  h12: 'До 12 годин',
  d3: '1–3 доби',
  d7: '4–7 діб',
  d7plus: 'Понад тиждень',
};

/** Бюджет: значення — верхня межа, грн. Використовується лише для фільтрації. */
export const BUDGETS = [
  { v: 0, label: '0 грн' },
  { v: 500, label: 'До 500 грн' },
  { v: 2000, label: 'До 2 000 грн' },
  { v: 5000, label: 'До 5 000 грн' },
  { v: 1000000, label: 'Понад 5 000 грн' },
];

/** Обладнання, яке питає майстер налаштування (Що доступно?) */
export const EQUIP = [
  { key: 'car12', label: 'Автомобіль із розеткою 12/24 В' },
  { key: 'powerbank', label: 'Павербанк' },
  { key: 'station', label: 'Портативна зарядна станція' },
  { key: 'solar', label: 'Сонячна панель' },
  { key: 'burner', label: 'Сертифікований туристичний пальник' },
  { key: 'stove', label: 'Дров’яна піч із належним димоходом' },
  { key: 'thermos', label: 'Термос' },
];

/** Комунальні послуги — частина «стану сьогодні» */
export const UTILITIES = [
  { key: 'power', label: 'Електромережа' },
  { key: 'gas', label: 'Газ' },
  { key: 'tap', label: 'Вода з крана' },
];

/** Категорії резерву (за промптом) */
export const RESERVE_CATS = [
  { key: 'water', label: 'Вода' },
  { key: 'food', label: 'Продукти' },
  { key: 'batteries', label: 'Акумулятори' },
  { key: 'light', label: 'Джерела світла' },
  { key: 'chargers', label: 'Зарядні пристрої' },
  { key: 'thermos', label: 'Термоси' },
  { key: 'warm', label: 'Засоби утеплення' },
  { key: 'comms', label: 'Засоби зв’язку' },
  { key: 'other', label: 'Інше обладнання' },
];

/** Каталог швидкого додавання до резерву. key — зв’язок із підбором рішень. */
export const RESERVE_CATALOG = [
  { key: 'drinkWater', label: 'Питна вода', cat: 'water', unit: 'л', qty: 10 },
  { key: 'techWater', label: 'Технічна вода', cat: 'water', unit: 'л', qty: 20 },
  { key: 'canister', label: 'Харчові ємності для води', cat: 'water', unit: 'шт', qty: 2 },
  { key: 'bleach', label: 'Хлорний відбілювач без ароматизаторів (5–9 %)', cat: 'water', unit: 'шт', qty: 1 },
  { key: 'waterTabs', label: 'Таблетки для знезараження води', cat: 'water', unit: 'шт', qty: 20 },
  { key: 'filter', label: 'Фільтр для води (похідний)', cat: 'water', unit: 'шт', qty: 1 },
  { key: 'cannedFood', label: 'Консерви', cat: 'food', unit: 'шт', qty: 6 },
  { key: 'grains', label: 'Пластівці, швидкі каші, кускус', cat: 'food', unit: 'кг', qty: 2 },
  { key: 'readyFood', label: 'Хлібці, горіхи, сухофрукти', cat: 'food', unit: 'уп', qty: 4 },
  { key: 'babyFood', label: 'Дитяче харчування', cat: 'food', unit: 'уп', qty: 4 },
  { key: 'powerbank', label: 'Павербанк', cat: 'batteries', unit: 'шт', qty: 1 },
  { key: 'station', label: 'Зарядна станція', cat: 'batteries', unit: 'шт', qty: 1 },
  { key: 'battery12', label: 'Акумулятор 12 В (LiFePO4) із захистом', cat: 'batteries', unit: 'шт', qty: 1 },
  { key: 'aaBatteries', label: 'Батарейки АА/ААА', cat: 'batteries', unit: 'шт', qty: 8 },
  { key: 'lamp', label: 'Акумуляторна LED-лампа', cat: 'light', unit: 'шт', qty: 1 },
  { key: 'headlamp', label: 'Налобний ліхтар', cat: 'light', unit: 'шт', qty: 1 },
  { key: 'cables', label: 'Кабелі та адаптери', cat: 'chargers', unit: 'шт', qty: 3 },
  { key: 'carCharger', label: 'USB-адаптер у гніздо авто 12 В', cat: 'chargers', unit: 'шт', qty: 1 },
  { key: 'solar', label: 'Сонячна панель', cat: 'chargers', unit: 'шт', qty: 1 },
  { key: 'thermos', label: 'Термос', cat: 'thermos', unit: 'шт', qty: 1 },
  { key: 'cooler', label: 'Термосумка з холодними акумуляторами', cat: 'thermos', unit: 'шт', qty: 1 },
  { key: 'blankets', label: 'Ковдри й пледи', cat: 'warm', unit: 'шт', qty: 4 },
  { key: 'sleepingBag', label: 'Спальник', cat: 'warm', unit: 'шт', qty: 1 },
  { key: 'hotBottle', label: 'Грілка', cat: 'warm', unit: 'шт', qty: 1 },
  { key: 'heatPad', label: 'Електроковдра або грілка-килимок', cat: 'warm', unit: 'шт', qty: 1 },
  { key: 'tent', label: 'Намет', cat: 'warm', unit: 'шт', qty: 1 },
  { key: 'mat', label: 'Каремат', cat: 'warm', unit: 'шт', qty: 1 },
  { key: 'sealTape', label: 'Ущільнювач або малярний скотч', cat: 'warm', unit: 'уп', qty: 1 },
  { key: 'radio', label: 'Радіо на батарейках', cat: 'comms', unit: 'шт', qty: 1 },
  { key: 'paperContacts', label: 'Паперовий список контактів', cat: 'comms', unit: 'шт', qty: 1 },
  { key: 'coAlarm', label: 'Детектор чадного газу', cat: 'other', unit: 'шт', qty: 1 },
  { key: 'smokeAlarm', label: 'Детектор диму', cat: 'other', unit: 'шт', qty: 1 },
  { key: 'extinguisher', label: 'Вогнегасник', cat: 'other', unit: 'шт', qty: 1 },
  { key: 'burner', label: 'Туристичний пальник (сертифікований)', cat: 'other', unit: 'шт', qty: 1 },
  { key: 'cartridges', label: 'Газові картриджі', cat: 'other', unit: 'шт', qty: 2 },
  { key: 'bucket', label: 'Відро з кришкою', cat: 'other', unit: 'шт', qty: 2 },
  { key: 'bags', label: 'Міцні сміттєві пакети', cat: 'other', unit: 'уп', qty: 1 },
  { key: 'antiseptic', label: 'Антисептик (від 60 % спирту)', cat: 'other', unit: 'шт', qty: 1 },
  { key: 'wipes', label: 'Вологі серветки', cat: 'other', unit: 'уп', qty: 2 },
  { key: 'fan', label: 'Вентилятор (USB або акумуляторний)', cat: 'other', unit: 'шт', qty: 1 },
  { key: 'hygrometer', label: 'Термометр-гігрометр', cat: 'other', unit: 'шт', qty: 1 },
  { key: 'firstAid', label: 'Аптечка', cat: 'other', unit: 'шт', qty: 1 },
];

/** Людські назви ключів ресурсів (для «Бракує: …») */
export const KEY_LABELS = {
  grid: 'електромережа',
  gas: 'газ',
  tap: 'вода з крана',
  heatSource: 'джерело тепла для окропу',
  car12: 'автомобіль із розеткою 12 В',
  powerbank: 'павербанк',
  station: 'зарядна станція',
  solar: 'сонячна панель',
  burner: 'сертифікований туристичний пальник',
  stove: 'дров’яна піч із димоходом',
  thermos: 'термос',
  battery12: 'акумулятор 12 В із захистом',
  bleach: 'хлорний відбілювач 5–9 %',
  waterTabs: 'таблетки для знезараження',
  filter: 'фільтр для води',
  hotBottle: 'грілка',
  heatPad: 'електроковдра чи грілка-килимок',
  fan: 'вентилятор',
  coAlarm: 'детектор чадного газу',
  lamp: 'акумуляторна лампа',
  headlamp: 'налобний ліхтар',
  radio: 'радіо на батарейках',
  cooler: 'термосумка',
  hygrometer: 'гігрометр',
  blankets: 'ковдри',
  bucket: 'відро з кришкою',
  bags: 'міцні пакети',
  antiseptic: 'антисептик',
  sleepingBag: 'спальник',
  tent: 'намет',
};

/** Звичайні побутові речі: вважаємо наявними, якщо в резерві їх не позначено як недоступні */
export const COMMON_KEYS = ['blankets', 'bucket', 'bags'];

/** Ключі, які не можна «купити»: це умови, а не речі */
export const CONDITION_KEYS = ['grid', 'gas', 'tap', 'heatSource'];

/**
 * Сезонні сценарії. ids — посилання на рішення.
 * @type {Record<Season, {label:string, icon:string, intro:string, rule:string, tasks:{t:string, ids:string[]}[], warn:string[]}>}
 */
export const SEASONS = {
  winter: {
    label: 'Зима',
    icon: 'i-snow',
    intro: 'Головне — зберегти тепло тіла та однієї кімнати. Не намагайтеся обігріти все помешкання.',
    rule: 'Тепло зберегти легше, ніж створити. Ніколи не гріємося газовою плитою, мангалом чи генератором у приміщенні.',
    tasks: [
      { t: 'Зберегти тепло тіла', ids: ['heat-layers', 'heat-body', 'heat-bottle'] },
      { t: 'Зменшити втрати тепла приміщення', ids: ['heat-windows', 'heat-drafts'] },
      { t: 'Створити теплу зону в одній кімнаті', ids: ['heat-room', 'heat-canopy', 'heat-floor'] },
      { t: 'Приготувати гарячу їжу й напої', ids: ['food-thermos', 'food-retained', 'food-lowpower'] },
      { t: 'Не дати запасам води замерзнути', ids: ['water-store'] },
      { t: 'Розумно використовувати електроенергію', ids: ['energy-budget', 'heat-electric'] },
      { t: 'Вчасно перейти в безпечне опалюване місце', ids: ['heat-relocate'] },
    ],
    warn: [
      'Ознаки переохолодження — сильне тремтіння, сплутаність, сонливість — це невідкладний стан.',
      'Будь-яке горіння в приміщенні — лише з відведенням диму назовні та детектором чадного газу.',
    ],
  },
  spring: {
    label: 'Весна',
    icon: 'i-sprout',
    intro: 'Дні теплішають, але ночі холодні, а в нетоплених приміщеннях — сирість і конденсат.',
    rule: 'Вдень — сонце й провітрювання, вночі — тепла ночівля. Воду й санітарію плануйте заздалегідь.',
    tasks: [
      { t: 'Пережити холодні ночі без опалення', ids: ['heat-canopy', 'heat-layers', 'heat-bottle'] },
      { t: 'Організувати воду та санітарію', ids: ['water-save', 'hyg-toilet', 'hyg-hands'] },
      { t: 'Боротися із сирістю й конденсатом', ids: ['hyg-damp'] },
      { t: 'Сушити одяг без небезпечних джерел тепла', ids: ['hyg-laundry'] },
      { t: 'Використовувати природне освітлення', ids: ['energy-daylight'] },
      { t: 'Підготувати автономне життєзабезпечення', ids: ['prep-power', 'energy-station', 'energy-solar'] },
    ],
    warn: [
      'Не сушіть речі на обігрівачах, лампах і біля відкритого вогню.',
      'Пліснява понад ≈1 м² — привід звернутися до фахівців.',
    ],
  },
  summer: {
    label: 'Літо',
    icon: 'i-sun',
    intro: 'Без кондиціонера головне — не пустити сонце всередину, провітрювати вночі й пити воду.',
    rule: 'Тінь удень, протяг уночі, вода постійно. За ознак теплового удару — 103 або 112.',
    tasks: [
      { t: 'Охолоджувати приміщення без кондиціонера', ids: ['cool-night', 'cool-shade'] },
      { t: 'Зменшити сонячне нагрівання', ids: ['cool-shade'] },
      { t: 'Підтримувати питний режим', ids: ['cool-water', 'water-calc'] },
      { t: 'Безпечно зберігати продукти', ids: ['food-storage'] },
      { t: 'Гігієна з обмеженою кількістю води', ids: ['hyg-wash', 'water-save'] },
      { t: 'Розпізнавати перегрівання та небезпечну спеку', ids: ['cool-alert', 'cool-body', 'cool-fan'] },
    ],
    warn: [
      'Коли повітря наближається до 35 °C, вентилятор не захищає від теплового удару.',
      'Не залишайте дітей і тварин в автомобілі навіть ненадовго.',
    ],
  },
  autumn: {
    label: 'Осінь',
    icon: 'i-leaf',
    intro: 'Найкращий час підготуватися до холодів: утеплити, запастися, перевірити техніку.',
    rule: 'Те, що зроблено восени спокійно, взимку не доведеться робити поспіхом.',
    tasks: [
      { t: 'Підготувати помешкання до холодів', ids: ['prep-home', 'heat-windows'] },
      { t: 'Не впускати холодне повітря', ids: ['heat-drafts'] },
      { t: 'Накопичити воду та необхідні запаси', ids: ['water-store', 'food-stock', 'water-calc'] },
      { t: 'Перевірити готовність джерел живлення', ids: ['prep-power', 'energy-budget'] },
      { t: 'Створити резервні схеми приготування їжі', ids: ['food-efficient', 'food-thermos', 'food-nocook'] },
      { t: 'Контролювати вологість і вентиляцію', ids: ['hyg-damp', 'prep-co'] },
    ],
    warn: [
      'Перевірте детектори диму й чадного газу та замініть батарейки.',
      'Не заклеюйте вентиляцію, утеплюючи вікна.',
    ],
  },
};

export const SEASON_ORDER = /** @type {Season[]} */ (['winter', 'spring', 'summer', 'autumn']);

/**
 * Сезон за датою — лише початкова пропозиція; користувач обирає сам.
 * @param {Date} d
 * @returns {Season}
 */
export function seasonByDate(d) {
  const m = d.getMonth() + 1;
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}

/**
 * Текст орієнтовної вартості за бюджетними межами.
 * @param {number} cost
 */
export function costBand(cost) {
  if (!cost) return 'Без витрат';
  if (cost <= 500) return 'до 500 грн';
  if (cost <= 2000) return 'до 2 000 грн';
  if (cost <= 5000) return 'до 5 000 грн';
  return 'понад 5 000 грн';
}
