// @ts-check
// QR-код без бібліотек і без мережі: щоб сусід у підвалі відсканував застосунок з вашого екрана
// чи з роздрукованої пам’ятки. Режим байтів (UTF-8), рівень корекції M (до 15 % пошкоджень),
// версії 1–10 (до 213 байтів). Алгоритм — за стандартом ISO/IEC 18004.

/** Рівень корекції M у полі формату. */
const ECC_M_BITS = 0;
/** Кодових слів корекції на блок і кількість блоків для рівня M, версії 1–10 (індекс = версія). */
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
export const MAX_VERSION = 10;

/** Множення в полі GF(2⁸) з модулем x⁸+x⁴+x³+x²+1. @param {number} x @param {number} y */
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** Твірний многочлен Ріда — Соломона заданого степеня. @param {number} degree */
function rsDivisor(degree) {
  const r = new Array(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < degree) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}

/**
 * Кодові слова корекції помилок для блоку даних.
 * @param {number[]} data @param {number} degree
 */
export function rsRemainder(data, degree) {
  const div = rsDivisor(degree);
  const r = new Array(degree).fill(0);
  for (const b of data) {
    const factor = b ^ /** @type {number} */ (r.shift());
    r.push(0);
    for (let i = 0; i < degree; i++) r[i] ^= gfMul(div[i], factor);
  }
  return r;
}

/** Кількість модулів під дані (без службових візерунків). @param {number} ver */
function rawModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const na = Math.floor(ver / 7) + 2;
    n -= (25 * na - 10) * na - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

/** Скільки байтів даних уміщує версія на рівні M. @param {number} ver */
export function dataCapacity(ver) {
  return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
}

/** Центри вирівнювальних візерунків. @param {number} ver */
function alignPositions(ver) {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const na = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
  const res = [6];
  for (let pos = size - 7; res.length < na; pos -= step) res.splice(1, 0, pos);
  return res;
}

/**
 * 15 бітів формату: рівень корекції й маска, захищені кодом БЧХ.
 * @param {number} mask 0–7
 */
export function formatBits(mask) {
  const data = (ECC_M_BITS << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** 18 бітів версії (для версій від 7). @param {number} ver */
export function versionBits(ver) {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}

/** @param {number} mask @param {number} x @param {number} y */
function maskBit(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** Рядок у байти UTF-8. @param {string} text */
function utf8(text) {
  return Array.from(new TextEncoder().encode(text));
}

/**
 * Найменша версія, у яку вміщується текст.
 * @param {number} len довжина в байтах
 * @returns {number} версія або 0, якщо задовго
 */
export function pickVersion(len) {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const ccBits = v <= 9 ? 8 : 16;
    if (4 + ccBits + len * 8 <= dataCapacity(v) * 8) return v;
  }
  return 0;
}

/**
 * Кодові слова даних: режим байтів, довжина, байти, завершення, доповнення.
 * @param {number[]} bytes @param {number} ver
 */
export function dataCodewords(bytes, ver) {
  /** @type {number[]} */
  const bits = [];
  const put = (/** @type {number} */ val, /** @type {number} */ len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCapacity(ver) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    out.push(b);
  }
  for (let pad = 0xec; out.length < cap / 8; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/**
 * Розбиття на блоки, корекція помилок і переплетення.
 * @param {number[]} data @param {number} ver
 */
function interleave(data, ver) {
  const nb = NUM_BLOCKS[ver];
  const ecLen = ECC_PER_BLOCK[ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const numShort = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb);
  /** @type {number[][]} */
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, ecLen);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  /** @type {number[]} */
  const res = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => { if (i !== shortLen - ecLen || j >= numShort) res.push(b[i]); });
  }
  return res;
}

/**
 * Штраф маски за стандартом: довгі смуги, квадрати 2×2, схожість на шукачі, баланс темного.
 * @param {boolean[][]} m
 */
function penalty(m) {
  const n = m.length;
  let p = 0;
  const line = (/** @type {(i:number)=>boolean} */ get) => {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) run++;
      else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    // Візерунок, схожий на шукач: 1011101 з чотирма світлими з одного боку
    for (let i = 0; i + 10 < n; i++) {
      const s = Array.from({ length: 11 }, (_, k) => (get(i + k) ? 1 : 0)).join('');
      if (s === '10111010000' || s === '00001011101') p += 40;
    }
  };
  for (let y = 0; y < n; y++) line((i) => m[y][i]);
  for (let x = 0; x < n; x++) line((i) => m[i][x]);
  for (let y = 0; y + 1 < n; y++) {
    for (let x = 0; x + 1 < n; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
  }
  let dark = 0;
  for (const row of m) for (const c of row) if (c) dark++;
  const total = n * n;
  p += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return p;
}

/**
 * Матриця QR-коду: true — темний модуль.
 * @param {string} text
 * @param {number} [forceMask] для тестів
 * @returns {{size:number, version:number, mask:number, modules:boolean[][]}}
 */
export function qrMatrix(text, forceMask) {
  const bytes = utf8(text);
  const ver = pickVersion(bytes.length);
  if (!ver) throw new Error('Текст задовгий для QR-коду');
  const size = ver * 4 + 17;
  /** @type {boolean[][]} */
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  /** @type {boolean[][]} */
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (/** @type {number} */ x, /** @type {number} */ y, /** @type {boolean} */ dark) => { mod[y][x] = dark; fn[y][x] = true; };

  // Смуги синхронізації
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  // Шукачі з роздільниками
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    }
  }
  // Вирівнювальні візерунки
  const al = alignPositions(ver);
  al.forEach((ax, i) => al.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  // Місця для формату (заповнимо після вибору маски) і темний модуль
  const drawFormat = (/** @type {number} */ mask) => {
    const bits = formatBits(mask);
    const b = (/** @type {number} */ i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, b(i));
    set(8, 7, b(6));
    set(8, 8, b(7));
    set(7, 8, b(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  // Інформація про версію
  if (ver >= 7) {
    const vb = versionBits(ver);
    for (let i = 0; i < 18; i++) {
      const dark = ((vb >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const c = Math.floor(i / 3);
      set(a, c, dark);
      set(c, a, dark);
    }
  }
  // Дані зигзагом знизу вгору, у парах стовпців справа наліво
  const cw = interleave(dataCodewords(bytes, ver), ver);
  let bit = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bit < cw.length * 8) {
          mod[y][x] = ((cw[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
          bit++;
        }
      }
    }
  }
  // Маска: найменший штраф (або задана для тестів)
  const apply = (/** @type {number} */ mask) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskBit(mask, x, y)) mod[y][x] = !mod[y][x];
  };
  let best = forceMask ?? -1;
  if (best < 0) {
    let min = Infinity;
    for (let mk = 0; mk < 8; mk++) {
      apply(mk);
      drawFormat(mk);
      const pen = penalty(mod);
      if (pen < min) { min = pen; best = mk; }
      apply(mk);
    }
  }
  apply(best);
  drawFormat(best);
  return { size, version: ver, mask: best, modules: mod };
}

/**
 * QR-код як SVG: один контур, тиха зона 4 модулі, масштабується без втрат.
 * @param {string} text
 * @param {string} label доступна назва
 */
export function qrSvg(text, label) {
  const { size, modules } = qrMatrix(text);
  const q = 4;
  const n = size + q * 2;
  // Темні модулі рядками: суміжні зливаються в одну смугу. Контури не замикаємо явно —
  // заливка замикає їх сама, а шлях лишається коротшим.
  let d = '';
  modules.forEach((row, y) => {
    for (let x = 0; x < size; x++) {
      if (!row[x]) continue;
      let len = 1;
      while (x + len < size && row[x + len]) len++;
      d += `M${x + q} ${y + q}h${len}v1h-${len}`;
      x += len - 1;
    }
  });
  const safe = label.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c);
  return `<svg class="qr" viewBox="0 0 ${n} ${n}" role="img" aria-label="${safe}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
