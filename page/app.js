// NFS Most Wanted for Batocera: prepares "NFS Most Wanted.sh/" from the player's own copy, in the browser.
//  1. the game is read from its ISO (iso.js, nothing extracted) or a folder (File System Access API, or
//     <input webkitdirectory> elsewhere);
//  2. default.xex picks the package (paquets/index.json) and gives its key: SHA-256("nfsmw-batocera/paquet/1\0" +
//     default.xex), AES-256-GCM, see batocera/make_paquet.py;
//  3. the shader library is built with the nfsmw-nx installer's modules (shaders/), the icon sets and the gamelist
//     pictures with the repository's Python tools under Pyodide (outils/);
//  4. everything is written into the chosen ports/ folder (or a zip without the game files).
import { writeZip } from './zip.js';
import { readXiso } from './iso.js';
// Page language: ?lang=, else the last choice, else the browser's; the switch reloads the page (i18n.js).
import { LANG, L } from './i18n.js';

const $ = (id) => document.getElementById(id);

const PORT = 'NFS Most Wanted.sh';
const params = new URLSearchParams(location.search);
const PYODIDE = new URL(params.get('pyodide') || 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/', location.href).href;
const FFMPEG = new URL(params.get('ffmpeg') || 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/', location.href).href;
const SALT = new TextEncoder().encode('nfsmw-batocera/paquet/1\0');
// SHA-256 of the shader library this port expects (Android/Vulkan 1.1 variant of shader_common.h), by default.xex.
const LIBRARIES = {
  aad15fc218d034de3131f746e0b763dd8049a40dd676efc87667fcaf4fc72694:
    'b84602ca9bf6efd84f54ad1509297baccd57c04ffcda494c77f5780a433f95a7',
};
// Every known default.xex (tools/editions/regional/ediciones.json). plan: the port for that executable is
// 'prevu' (planned: it needs that default.xex once to be compiled) or 'non'; vf: what the French dub option does.
const EDITIONS = {
  aebdf3c14d1e4e4ed2c130d94bc1a0e97bd6d5bf39bdfdef33c3909c9cc4ba4c: { nom: 'USA (NTSC)', en: 'USA (NTSC)', pays: 'us', plan: 'prevu', vf: 'a verifier', langue: 'anglais' },
  e2ea2ff11bf84cb30430d824d7bfe699a3acf3e7400d21b9a7c938e3d7a10474: { nom: 'PAL anglaise (UK)', en: 'PAL English (UK)', pays: 'gb', plan: 'prevu', vf: 'oui', langue: 'anglais' },
  '229c5ed5dcc67871982000fb923acfd59494f21f30996b25f36b30a8d85c9b7b': { nom: 'PAL France', en: 'PAL France', pays: 'fr', plan: 'prevu', vf: 'deja', langue: 'français' },
  aad15fc218d034de3131f746e0b763dd8049a40dd676efc87667fcaf4fc72694: { nom: 'PAL Espagne', en: 'PAL Spain', pays: 'es', plan: 'prevu', vf: 'non', langue: 'espagnol' },
  '23ece29d18724ea28971d52f936964d127148bd2359ff24795da7442b9069bf4': { nom: 'PAL Allemagne', en: 'PAL Germany', pays: 'de', plan: 'prevu', vf: 'non', langue: 'allemand' },
  acb09332bcafc15e8e21dc15062f1963804a3176fa4db48fea7f6c8afbdff066: { nom: 'PAL Italie', en: 'PAL Italy', pays: 'it', plan: 'prevu', vf: 'non', langue: 'italien' },
  '23af89d49a713ff948af7b9bc06557b06e94e8629adc40a29513ab6f5cafb33d': { nom: 'Japon', en: 'Japan', pays: 'jp', plan: 'non', vf: 'non', langue: 'japonais' },
  '47683b515e5461a2e356c45a4417f30fe69c3f6c6ea0d3352829f35f1fb33abe': { nom: 'Corée', en: 'Korea', pays: 'kr', plan: 'non', vf: 'non', langue: 'coréen' },
  '0cd7b9fa3957de085e298c91faa726116ad0079abaefead82c2f3337ee432e64': { nom: 'Asie (chinois trad.)', en: 'Asia (trad. Chinese)', pays: 'tw', plan: 'non', vf: 'non', langue: 'chinois' },
  a2dd0156c26603cf32e33b52fa906422bde74e5065da87115d5b747aa5d90ff8: { nom: 'Pologne (fans)', en: 'Poland (fans)', pays: 'pl', plan: 'non', vf: 'non', langue: 'polonais' },
};
const VF_CHIP = { oui: L('VF avec Xbox FR', 'French with Xbox FR'), 'a verifier': L('VF à vérifier', 'French: to check'),
  deja: L('déjà en VF', 'already French'), non: '' };
const LANGUE_EN = { anglais: 'English', 'français': 'French', espagnol: 'Spanish', allemand: 'German', italien: 'Italian',
  japonais: 'Japanese', 'coréen': 'Korean', chinois: 'Chinese', polonais: 'Polish' };
const edName = (e) => (LANG === 'en' ? e.en : e.nom);
const langName = (l) => (LANG === 'en' ? LANGUE_EN[l] || l : l);

// Small flags, drawn here (emoji flags do not show on Windows). viewBox 30x20.
function flag(code) {
  const v = (a, b, c) => `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
  const h = (a, b, c) => `<rect width="30" height="7" fill="${a}"/><rect y="7" width="30" height="6" fill="${b}"/><rect y="13" width="30" height="7" fill="${c}"/>`;
  const body = {
    fr: v('#0055a4', '#fff', '#ef4135'),
    it: v('#009246', '#fff', '#ce2b37'),
    de: h('#000', '#dd0000', '#ffce00'),
    es: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>',
    pl: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#dc143c"/>',
    jp: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>',
    kr: '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5.5" fill="#0047a0"/><path d="M9.5 10a5.5 5.5 0 0 1 11 0a2.75 2.75 0 0 1-5.5 0a2.75 2.75 0 0 0-5.5 0" fill="#cd2e3a"/><g stroke="#000" stroke-width="1.2"><path d="M3 4l3 3M24 13l3 3M3 16l3-3M24 7l3-3"/></g>',
    tw: '<rect width="30" height="20" fill="#fe0000"/><rect width="15" height="10" fill="#000095"/><circle cx="7.5" cy="5" r="2.6" fill="#fff"/>',
    gb: '<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.4"/>',
    us: `${Array.from({ length: 7 }, (_, i) => `<rect y="${i * 20 / 6.5}" width="30" height="${20 / 13}" fill="#b22234"/>`).join('')}<rect width="13" height="${20 * 7 / 13}" fill="#3c3b6e"/><g fill="#fff">${Array.from({ length: 12 }, (_, i) => `<circle cx="${1.8 + (i % 4) * 3.1}" cy="${1.8 + Math.floor(i / 4) * 3.4}" r=".7"/>`).join('')}</g>`,
    xbox: '<rect width="30" height="20" fill="#0a0a0a"/><circle cx="15" cy="10" r="7" fill="none" stroke="#7ee08a" stroke-width="2"/><path d="M11 6l8 8M19 6l-8 8" stroke="#7ee08a" stroke-width="2"/>',
  }[code] || '<rect width="30" height="20" fill="#555"/>';
  return `<svg class="flag" viewBox="0 0 30 20" aria-hidden="true">${body}</svg>`;
}
// Version of the site (page/build_site.sh writes the commit here): appended to every file the page fetches, so a
// new version is never mixed with files a browser kept in its cache.
const BUILD = 'dev';
const V = `?v=${BUILD}`;
const PY_FILES = ['jdlz.py', 'tpk.py', 'huff.py', 'xenos.py', 'dxt.py', 'ps_buttons.py', 'gamelist_media.py',
  'black_edition_title.py', 'SedgwickAveDisplay-Regular.ttf'];

const state = { game: null, dest: null, xex: null, xexSha: null, paquet: null };
let INDEX = { paquets: [] };
// Size of NFS/ZZDATA0.BIN by disc (the nfsmw-nx installer manifest): tells where the data comes from when the
// default.xex was swapped (a PAL English disc with the Spanish executable, as the Android port wanted).
const DISC_DATA = {
  381569024: L('anglais (PAL UK ou USA)', 'English (PAL UK or USA)'), 387301706: L('traduction russe (fans, base PAL anglaise)', 'Russian fan translation (PAL English based)'),
  369948672: L('PAL Espagne, France ou Italie', 'PAL Spain, France or Italy'), 363659264: L('PAL Espagne', 'PAL Spain'),
  375844864: L('PAL Allemagne', 'PAL Germany'), 355878912: L('Japon', 'Japan'),
};
const XEX_DATA = {  // the data sizes that go with each default.xex
  aad15fc218d034de3131f746e0b763dd8049a40dd676efc87667fcaf4fc72694: [369948672, 363659264],
  aebdf3c14d1e4e4ed2c130d94bc1a0e97bd6d5bf39bdfdef33c3909c9cc4ba4c: [381569024],
  e2ea2ff11bf84cb30430d824d7bfe699a3acf3e7400d21b9a7c938e3d7a10474: [381569024],
  '229c5ed5dcc67871982000fb923acfd59494f21f30996b25f36b30a8d85c9b7b': [369948672],
  acb09332bcafc15e8e21dc15062f1963804a3176fa4db48fea7f6c8afbdff066: [369948672],
  '23ece29d18724ea28971d52f936964d127148bd2359ff24795da7442b9069bf4': [375844864],
};

// The player's machine: aarch64 (Retroid Pocket, Odin, Raspberry Pi 5...), x86_64 (a PC with Batocera) or both, in
// one folder (bin/aarch64/ and bin/x86_64/, the rest shared). Each machine has its own package (paquets/index.json
// "arch"; the older entries have none and are aarch64), both opened by the same default.xex.
const ARCHES = ['both', 'aarch64', 'x86_64'];
state.arch = (() => { try { return localStorage.getItem('nfsmw-arch'); } catch { return null; } })();
if (!ARCHES.includes(state.arch)) state.arch = 'both';
const archList = () => (state.arch === 'both' ? ['aarch64', 'x86_64'] : [state.arch]);
const findPaquets = (sha) => archList().map((a) => INDEX.paquets.find((p) => p.xex_sha256 === sha && (p.arch || 'aarch64') === a));
// The first package when every machine asked for has one (state.paquet: "a port exists"), else undefined.
const findPaquet = (sha) => { const all = findPaquets(sha); return all.every(Boolean) ? all[0] : undefined; };
const ready = (sha) => !!findPaquet(sha);
function showArch() {
  for (const a of ARCHES) $(`arch-${a}`).classList.toggle('on', a === state.arch);
}
for (const a of ARCHES) {
  $(`arch-${a}`).onclick = () => {
    if (a === state.arch) return;
    state.arch = a;
    try { localStorage.setItem('nfsmw-arch', a); } catch { /* remembered for this visit only */ }
    showArch();
    editionsTable(state.xexSha);
    if (state.lastGame) {  // the same game, with the other machine's package
      $('game-facts').replaceChildren();
      chooseGame(state.lastGame).catch((x) => fact('game-facts', String(x.message || x), 'bad'));
    }
  };
}
showArch();

async function editionsTable(highlight) {
  const grid = $('editions-grid');
  grid.replaceChildren();
  for (const [sha, e] of Object.entries(EDITIONS)) {
    const card = document.createElement('div');
    card.className = `ed${sha === highlight ? ' mine' : ''}`;
    const port = ready(sha) ? `<span class="chip ready">${L('Prêt', 'Ready')}</span>`
      : e.plan === 'prevu' ? `<span class="chip soon">${L('Bientôt', 'Soon')}</span>` : `<span class="chip">${L('Pas prévu', 'Not planned')}</span>`;
    const vf = VF_CHIP[e.vf] ? `<span class="chip vf">${VF_CHIP[e.vf]}</span>` : '';
    card.innerHTML = `${flag(e.pays)}<div class="name">${edName(e)}${sha === highlight ? ` · <span class="ok">${L('votre ISO', 'your ISO')}</span>` : ''}</div><div class="chips">${port}${vf}</div>`;
    grid.append(card);
  }
}
fetch(`paquets/index.json${V}`).then((r) => (r.ok ? r.json() : { paquets: [] })).then((i) => { INDEX = i; editionsTable(); })
  .catch(() => editionsTable());
const canWrite = typeof window.showDirectoryPicker === 'function';

// ------------------------------------------------------------------ small helpers

const archName = (a) => (a === 'x86_64' ? L('PC (x86_64)', 'PC (x86_64)') : a === 'both' ? L('ARM et PC', 'ARM and PC') : L('ARM (Retroid…)', 'ARM (Retroid…)'));

const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (bytes) => hex(await crypto.subtle.digest('SHA-256', bytes));
const size = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(2)} ${L('Go', 'GB')}` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} ${L('Mo', 'MB')}` : `${Math.round(n / 1e3)} ${L('ko', 'kB')}`;

function slot(id, html, filled) {
  const el = $(id);
  el.classList.toggle('filled', !!filled);
  el.querySelector('.v').className = `v${filled ? '' : ' muted'}`;
  el.querySelector('.v').innerHTML = html;
}

// What the player will get, from the edition, the dub and what the folder already holds.
function announce() {
  const out = $('output');
  const e = EDITIONS[state.xexSha];
  if (!state.paquet || !e) { out.hidden = true; return; }
  const items = [`${flag(e.pays)} NFS Most Wanted ${edName(e)}, ${state.arch === 'x86_64'
    ? L('port natif Batocera pour PC (x86_64, processeur avec AVX2, carte graphique Vulkan)', 'native Batocera port for PC (x86_64, a processor with AVX2, a Vulkan graphics card)')
    : state.arch === 'both'
      ? L('port natif Batocera pour les deux machines dans un seul dossier : Retroid Pocket 5 (60 FPS en course en 1280x720) et PC x86_64 (AVX2, Vulkan), avec le même jeu et les mêmes sauvegardes', 'native Batocera port for both machines in one folder: Retroid Pocket 5 (60 FPS in races at 1280x720) and x86_64 PC (AVX2, Vulkan), with the same game and saves')
      : L('port natif Batocera : 60 FPS en course en 1280x720 sur Retroid Pocket 5', 'native Batocera port: 60 FPS in races at 1280x720 on the Retroid Pocket 5')}`];
  if (state.destDubbed) items.push(L('<b>VF</b> : celle déjà faite dans le dossier choisi est gardée, rien n\'est refait', '<b>French dub</b>: the one already done in the chosen folder is kept, nothing is done again'));
  else if (state.vfXbox) items.push(L('<b>Votre version européenne 360 (PAL anglaise) patchée en français</b> : textes, 32 des 36 vidéos et toutes les voix en jeu', '<b>Your European 360 version (PAL English) patched into French</b>: text, 32 of the 36 movies and all in-game voices'));
  else if (state.dubbed) items.push(L('<b>VF</b> : le doublage français déjà présent dans votre dossier est gardé', '<b>French dub</b>: the one already in your folder is kept'));
  else if (e.vf === 'deja') items.push(L('Jeu en français (votre disque)', 'Game in French (your disc)'));
  else {
    const lg = langName(state.englishData ? 'anglais' : e.langue);
    items.push(L(`Textes et voix : ${lg}, ou la langue de Batocera si le disque l'a`, `Text and voices: ${lg}, or Batocera's language if the disc has it`));
    if (e.vf === 'oui' || state.englishData) items.push(`<span class="muted">${L('Ajoutez l\'ISO Xbox française pour la VF complète', 'Add the French original Xbox ISO for the full French dub')}</span>`);
  }
  items.push(L('Icônes PlayStation (par défaut), GameCube ou Xbox 360, au choix dans EmulationStation', 'PlayStation (default), GameCube or Xbox 360 button icons, chosen in EmulationStation'));
  items.push(L('Shaders fabriqués à partir de votre disque, images de l\'écran titre pour la fiche du jeu', 'Shaders built from your disc, title screen pictures for the game\'s entry'));
  items.push(L('<b>Black Edition</b> à activer dans les options : BMW M3 GTR de route, Camaro SS, 8 voitures tunées, l\'épreuve 70 du Challenge Series et 3 courses en plus, avec son écran titre (tiré de votre jeu, en noir et blanc, « Black Edition » sous le logo)', '<b>Black Edition</b> in the options: road BMW M3 GTR, Camaro SS, 8 tuned cars, Challenge Series event 70 and 3 more races, with its own title screen (made from your game, in black and white, "Black Edition" under the logo)'));
  items.push(L('Options dans EmulationStation, sauvegardes, vibration, Hotkey + Start pour quitter', 'Options in EmulationStation, saves, rumble, Hotkey + Start to quit'));
  const time = state.vfXbox && !state.destDubbed ? L('quelques minutes, plus la copie du jeu, plus 1 à 3 heures de VF', 'a few minutes, plus the game copy, plus 1 to 3 hours for the French dub')
    : L('quelques minutes, plus la copie du jeu (7 Go)', 'a few minutes, plus the game copy (7 GB)');
  out.innerHTML = `<h3>${L('Ce que vous obtenez', 'What you get')}</h3><ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul><p class="muted small">${L('Durée', 'Time')} : ${time}.</p>`;
  out.hidden = false;
}

function fact(list, text, cls = '') {
  const li = document.createElement('li');
  li.innerHTML = text;
  if (cls) li.className = cls;
  $(list).append(li);
}

function log(text) {
  const el = $('log');
  el.style.display = 'block';
  el.textContent += text + '\n';
  el.scrollTop = el.scrollHeight;
}

function progress(fraction, text) {
  $('progress-row').hidden = false;
  $('progress').value = Math.max(0, Math.min(1, fraction));
  if (text) $('status').textContent = text;
}

async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} : ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

// ------------------------------------------------------------------ the game folder

// Every file under a directory handle: {path: 'NFS/ZZDATA0.BIN', get: () => File}.
async function walkHandle(dir, prefix = '', out = []) {
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'directory') await walkHandle(h, prefix + name + '/', out);
    else out.push({ path: prefix + name, get: () => h.getFile() });
  }
  return out;
}

function walkInput(files) {
  // webkitRelativePath starts with the chosen folder's name.
  return [...files].map((f) => ({ path: f.webkitRelativePath.split('/').slice(1).join('/'), get: async () => f }));
}

// The game: the files under the folder holding default.xex (shallowest one), with lower-case lookups.
function gameFrom(all) {
  const xexes = all.filter((f) => /(^|\/)default\.xex$/i.test(f.path) && !/(^|\/)mods\//i.test(f.path))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  if (!xexes.length) return null;
  const root = xexes[0].path.slice(0, -'default.xex'.length);
  const files = all.filter((f) => f.path.startsWith(root)).map((f) => ({ ...f, rel: f.path.slice(root.length) }));
  const byName = new Map(files.map((f) => [f.rel.toLowerCase(), f]));
  // An installed "NFS Most Wanted.sh": the port's own files sit one level up (mods/, nfsmw_shaders.nfsp).
  const up = root.replace(/game_root\/$/i, '');
  const port = up !== root ? new Map(all.filter((f) => f.path.startsWith(up))
    .map((f) => [f.path.slice(up.length).toLowerCase(), f])) : new Map();
  return { root, files: files.filter((f) => !/^(mods|data|logs)\//i.test(f.rel)), byName, port };
}

// NFS/ZDIR.BIN: 24-byte entries (hash, archive, sector in the archive, global sector, size, checksum); the hash is
// bStringHash of the path with backslashes (GLOBAL\GLOBALB.LZC).
function bHash(s) {
  let h = 0xffffffff;
  for (const c of new TextEncoder().encode(s)) h = (Math.imul(h, 33) + c) >>> 0;
  return h >>> 0;
}

async function fromArchives(game, path) {
  const loose = game.byName.get(path.toLowerCase());
  const zdir = new DataView((await (await game.byName.get('nfs/zdir.bin').get()).arrayBuffer()));
  const want = bHash(path.replace(/\//g, '\\'));
  for (let o = 0; o + 24 <= zdir.byteLength; o += 24) {
    if (zdir.getUint32(o, true) !== want) continue;
    const archive = zdir.getUint32(o + 4, true), sector = zdir.getUint32(o + 8, true), n = zdir.getUint32(o + 16, true);
    const zz = game.byName.get(`nfs/zzdata${archive}.bin`);
    if (!zz) throw new Error(L(`NFS/ZZDATA${archive}.BIN manque`, `NFS/ZZDATA${archive}.BIN is missing`));
    const file = await zz.get();
    return new Uint8Array(await file.slice(sector * 2048, sector * 2048 + n).arrayBuffer());
  }
  if (loose) return new Uint8Array(await (await loose.get()).arrayBuffer());
  throw new Error(L(`${path} introuvable dans NFS/ZDIR.BIN`, `${path} not found in NFS/ZDIR.BIN`));
}

async function chooseGame(all) {
  state.lastGame = all;
  const game = gameFrom(all);
  if (!game) {
    fact('game-facts', L('Pas de <code>default.xex</code> dans ce dossier.', 'No <code>default.xex</code> in this folder.'), 'bad');
    return;
  }
  for (const need of ['nfs/zdir.bin', 'nfs/zzdata0.bin']) {
    if (!game.byName.has(need)) {
      fact('game-facts', L(`Il manque <code>${need.toUpperCase()}</code> : est-ce bien le jeu extrait ?`, `<code>${need.toUpperCase()}</code> is missing: is this the extracted game?`), 'bad');
      return;
    }
  }
  const xex = new Uint8Array(await (await game.byName.get('default.xex').get()).arrayBuffer());
  const xexSha = await sha256(xex);
  const paquet = findPaquet(xexSha);
  state.paquets = paquet ? findPaquets(xexSha) : [];
  editionsTable(xexSha);
  const total = (await Promise.all(game.files.map(async (f) => (await f.get()).size))).reduce((a, b) => a + b, 0);
  fact('game-facts', `${game.files.length} ${L('fichiers', 'files')}, ${size(total)}${game.root ? ` (${L('dans', 'in')} <code>${game.root}</code>)` : ''}`);
  const edition = EDITIONS[xexSha];
  fact('game-facts', `${L('Édition', 'Edition')} : ${edition ? `${flag(edition.pays)} <strong>${edName(edition)}</strong>` : `<strong>${L('inconnue', 'unknown')}</strong>`}`, paquet ? 'ok' : 'bad');
  slot('slot-360', `${edition ? flag(edition.pays) : ''}<strong>${edition ? edName(edition) : L('édition inconnue', 'unknown edition')}</strong> <span class="muted">${state.iso ? state.iso.name : L('dossier', 'folder')}</span>`, true);
  // A swapped default.xex: say where the data comes from (the port follows the executable, the language the data).
  const zz0 = await (await game.byName.get('nfs/zzdata0.bin').get()).size;
  state.englishData = zz0 === 381569024;
  fact('game-facts', `${L('Données du disque', 'Disc data')} : <strong>${DISC_DATA[zz0] || L('inconnues', 'unknown')}</strong> <span class="muted">(NFS/ZZDATA0.BIN ${zz0} ${L('octets', 'bytes')})</span>`);
  if (XEX_DATA[xexSha] && DISC_DATA[zz0] && !XEX_DATA[xexSha].includes(zz0)) {
    fact('game-facts', L(`Copie modifiée : exécutable ${edName(edition)}, données du disque <strong>${DISC_DATA[zz0]}</strong>. Le port suit l'exécutable (${edName(edition)}) ; la langue et la VF suivent les données.`,
      `Modified copy: ${edName(edition)} executable, disc data <strong>${DISC_DATA[zz0]}</strong>. The port follows the executable (${edName(edition)}); the language and the French dub follow the data.`));
  }
  {  // default.xex alone, to identify a copy or to add an edition to the port
    const li = document.createElement('li');
    li.className = 'muted';
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([xex])), download: 'default.xex', textContent: L('Enregistrer default.xex seul', 'Save default.xex alone'),
    });
    link.style.color = 'inherit';
    li.append(link, L(` (empreinte ${xexSha.slice(0, 8)}…, pour un rapport ou une nouvelle édition)`, ` (fingerprint ${xexSha.slice(0, 8)}…, for a report or a new edition)`));
    $('game-facts').append(li);
  }
  if (!paquet) {
    state.paquet = null;
    announce();
    const other = INDEX.paquets.find((p) => p.xex_sha256 === xexSha);
    fact('game-facts', other
      ? L(`Pas encore de port ${archName(state.arch)} pour cette édition ; il existe pour ${archName(other.arch || 'aarch64')}.`, `No ${archName(state.arch)} port for this edition yet; there is one for ${archName(other.arch || 'aarch64')}.`)
      : !edition
      ? L('<code>default.xex</code> modifié ou édition inconnue : le port ne peut pas l\'utiliser.', 'Modified <code>default.xex</code> or unknown edition: the port cannot use it.')
      : edition.plan === 'prevu'
        ? L('Port pas encore prêt pour cette édition : il faut compiler son <code>default.xex</code> une fois. Voir le tableau ci-dessous.', 'No port for this edition yet: its <code>default.xex</code> has to be compiled once. See the table below.')
        : L('Cette édition n\'est pas prévue pour l\'instant.', 'This edition is not planned for now.'), 'bad');
    return;
  }
  state.dubbed = game.byName.has('movies/movies_report.txt') || game.byName.has('movies/rapport_films.txt');
  if (state.dubbed) {
    fact('game-facts', L('Doublage français de nfsmw-nx détecté : le jeu sera en VF.', 'nfsmw-nx French dub found: the game will be in French.'), 'ok');
  }
  if (game.byName.has('global/globalmemoryfile.bin')) {
    fact('game-facts', L('Mod détecté (<code>GLOBAL/GLOBALMEMORYFILE.BIN</code>) : il est gardé par les icônes.', 'Mod found (<code>GLOBAL/GLOBALMEMORYFILE.BIN</code>): the icon sets keep it.'));
  }
  Object.assign(state, { game, xex, xexSha, paquet, total });
  offerVf(edition);
  announce();
  $('s-dest').classList.remove('off');
  $('pick-dest').disabled = !canWrite;
  if (!canWrite) {
    $('copy-game').checked = false;
    $('copy-game').disabled = true;
    $('s-run').classList.remove('off');
    $('run').disabled = false;
    $('run').textContent = L('Fabriquer le zip', 'Make the zip');
  }
}

$('pick-game').onclick = async () => {
  if (!canWrite) return $('pick-game-input').click();
  try {
    const dir = await window.showDirectoryPicker({ id: 'nfsmw-jeu' });
    $('game-facts').replaceChildren();
    state.iso = null;
    const all = await walkHandle(dir);
    await chooseGame(all);
  } catch (e) {
    if (e.name !== 'AbortError') fact('game-facts', String(e.message || e), 'bad');
  }
};
async function chooseIso(file) {
  $('game-facts').replaceChildren();
  fact('game-facts', `${L('Lecture de', 'Reading')} <code>${file.name}</code>…`, 'muted');
  try {
    const all = await readXiso(file);
    state.iso = file;
    $('game-facts').replaceChildren();
    fact('game-facts', `ISO : <code>${file.name}</code>`);
    // ?extraire=Movies/attract_movie_english_pal.wmv: hands that one file of the ISO over as a download (to compare
    // a file of an installed folder with the disc's, when something goes wrong).
    const want = new URLSearchParams(location.search).get('extraire');
    if (want) {
      const f = all.find((x) => x.path.toLowerCase().endsWith(want.toLowerCase()));
      if (!f) fact('game-facts', L(`${want} : pas dans l'ISO`, `${want}: not in the ISO`), 'bad');
      else {
        const blob = await f.get();
        Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: f.path.split('/').pop() }).click();
        fact('game-facts', L(`${f.path} extrait (${size(blob.size)})`, `${f.path} extracted (${size(blob.size)})`), 'ok');
      }
    }
    await chooseGame(all);
  } catch (e) {
    $('game-facts').replaceChildren();
    fact('game-facts', String(e.message || e), 'bad');
  }
}
$('pick-iso').onclick = () => $('pick-iso-input').click();
$('pick-iso-input').onchange = async (e) => {
  if (!e.target.files[0]) return;
  await chooseIso(e.target.files[0]);
  if (state.pendingXbox && state.paquet && !state.vfXbox) await checkXbox(state.pendingXbox);
};
$('pick-game-input').onchange = (e) => ($('game-facts').replaceChildren(), state.iso = null, chooseGame(walkInput(e.target.files))).catch((x) => fact('game-facts', String(x.message || x), 'bad'));

$('pick-dest').onclick = async () => {
  try {
    const dir = await window.showDirectoryPicker({ id: 'nfsmw-ports', mode: 'readwrite' });
    $('dest-facts').replaceChildren();
    // Any folder: NFS Most Wanted.sh is created in it (roms/ports directly, or anywhere and copied later).
    // An existing "NFS Most Wanted.sh" chosen itself is written into.
    state.dest = dir;
    state.base = dir.name === PORT ? '' : `${PORT}/`;
    const where = state.base ? `${dir.name}/${PORT}/` : `${dir.name}/`;
    fact('dest-facts', `${L('Destination', 'Destination')} : <code>${where}</code>`, 'ok');
    if (state.base && dir.name.toLowerCase() !== 'ports') {
      fact('dest-facts', L(`Une fois fini, copiez le dossier <code>${PORT}</code> dans <code>roms/ports</code> de Batocera.`,
        `Once done, copy the <code>${PORT}</code> folder into Batocera's <code>roms/ports</code>.`), 'muted');
    }
    // One folder for both machines: bin/aarch64/ and bin/x86_64/ side by side, the game and the saves shared. It
    // must hold one edition only (the game files already there are kept as they are).
    const installed = await destInstalls();
    const other = installed.filter((a) => !archList().includes(a));
    const ds = await destState();
    Object.assign(state, ds);
    const { edition } = ds;
    if (edition && edition !== state.xexSha) {
      fact('dest-facts', L('Ce dossier contient une <b>autre édition</b> du jeu : choisissez un autre dossier (un dossier ne peut avoir qu\'une édition, partagée par les deux machines).',
        'This folder holds <b>another edition</b> of the game: choose another folder (a folder holds one edition, shared by both machines).'), 'bad');
      $('s-run').classList.add('off');
      $('run').disabled = true;
      return;
    }
    if (other.length) {
      fact('dest-facts', L(`Ce dossier a déjà la version ${archName(other[0])} : la version ${archName(state.arch)} s'y ajoute (${archList().map((a) => `<code>bin/${a}/</code>`).join(', ')}). Le jeu, les sauvegardes, les mods et les réglages sont partagés entre les deux.`,
        `This folder already has the ${archName(other[0])} version: the ${archName(state.arch)} one is added next to it (${archList().map((a) => `<code>bin/${a}/</code>`).join(', ')}). The game, saves, mods and settings are shared by both.`), 'ok');
    } else if (archList().some((a) => installed.includes(a))) {
      fact('dest-facts', L(`Mise à jour de la version ${archName(state.arch)} déjà installée ici ; le jeu et les sauvegardes sont gardés.`,
        `Update of the ${archName(state.arch)} version already installed here; the game and saves are kept.`), 'ok');
    }
    if (state.existing) {
      const kept = [L('le jeu', 'the game')];
      if (state.destDubbed) kept.push(L('sa VF', 'its French dub'));
      if (state.destTools) kept.push(L('les icônes, les images et l\'écran titre Black Edition', 'the icons, pictures and Black Edition title screen'));
      fact('dest-facts', L(`Ce dossier a déjà ce jeu : rien n'est refait. Gardés tels quels : ${kept.join(', ')} ; seuls les fichiers manquants sont ajoutés.`,
        `This folder already has this game: nothing is done again. Kept as they are: ${kept.join(', ')}; only missing files are added.`), 'ok');
      if (state.vfXbox && state.destDubbed) fact('dest-facts', L('La VF est déjà faite ici : l\'ISO Xbox ne sert pas.', 'The French dub is already done here: the Xbox ISO is not needed.'), 'muted');
    }
    announce();
    $('s-run').classList.remove('off');
    $('run').disabled = false;
  } catch (e) {
    if (e.name !== 'AbortError') fact('dest-facts', String(e.message || e), 'bad');
  }
};

// ------------------------------------------------------------------ French dub (page/vf/)

// patch_text.py on GLOBALMEMORYFILE.BIN: the pack's copies of the English text get a hash nobody asks for, so the
// game reads LANGUAGES\\ENGLISH.BIN (and the system messages) through ZDIR.BIN, where they point to the French ones.
function hideTextCopies(pack) {
  const out = pack.slice();
  const v = new DataView(out.buffer);
  if (out.length < 16 || v.getUint32(8, true) !== 0x53219999) return out;
  const count = v.getUint32(12, true);
  for (const en of [bHash('LANGUAGES\\ENGLISH.BIN'), 0x21d83a59]) {
    const hidden = bHash(`FRENCH_DUB\\HIDDEN_${en.toString(16).toUpperCase().padStart(8, '0')}`);
    for (let i = 0; i < count; i++) if (v.getUint32(16 + 20 * i, true) === en) v.setUint32(16 + 20 * i, hidden, true);
  }
  return out;
}

function offerVf(edition) {
  state.vfXbox = null;
  $('vf').hidden = false;
  $('vf-facts').replaceChildren();
  if (state.pendingXbox) checkXbox(state.pendingXbox);
  else if ((edition && edition.vf === 'oui') || state.englishData) fact('vf-facts', L('VF possible : ajoutez l\'ISO de la Xbox d\'origine en français.', 'French dub possible: add the French original Xbox ISO.'), 'muted');
}

function vfWorker(message, onFile) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(`./vf/vf-worker.js${V}`, import.meta.url), { type: 'module' });
    let writes = Promise.resolve();
    worker.onmessage = ({ data: m }) => {
      if (m.type === 'progress') progress(m.fraction, m.text);
      else if (m.type === 'log') log(m.text);
      else if (m.type === 'file') writes = writes.then(() => onFile(m.rel, m.data));
      else if (m.type === 'error') { worker.terminate(); reject(new Error(m.message)); }
      else if (m.type === 'result') writes.then(() => { worker.terminate(); resolve(m); }, reject);
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || 'VF : erreur du worker')); };
    worker.postMessage({ ...message, lang: LANG, x360: state.iso, xbox: state.vfXbox || message.xbox, pyodide: PYODIDE, ffmpeg: FFMPEG });
  });
}

$('pick-xbox').onclick = () => $('pick-xbox-input').click();
$('pick-xbox-input').onchange = (e) => e.target.files[0] && checkXbox(e.target.files[0]);

async function checkXbox(file) {
  state.pendingXbox = file;
  state.vfXbox = null;
  $('vf').hidden = false;
  $('vf-facts').replaceChildren();
  slot('slot-xbox', `${flag('fr')}<strong>${file.name}</strong>`, false);
  if (!state.iso || !state.paquet) {
    fact('vf-facts', L('ISO Xbox gardée : elle sera vérifiée dès que l\'ISO 360 (d\'une édition prise en charge) sera choisie.', 'Xbox ISO kept: it is checked as soon as the 360 ISO (of a supported edition) is chosen.'), 'muted');
    return;
  }
  if (!canWrite) {
    fact('vf-facts', L('La VF a besoin de Chrome ou Edge sur un ordinateur.', 'The French dub needs Chrome or Edge on a computer.'), 'bad');
    return;
  }
  fact('vf-facts', L(`Vérification de <code>${file.name}</code> avec l'ISO Xbox 360 (une minute)…`, `Checking <code>${file.name}</code> with the Xbox 360 ISO (a minute)…`), 'muted');
  try {
    const r = await vfWorker({ type: 'check', xbox: file }, async () => {});
    $('vf-facts').replaceChildren();
    const report = `${r.problem ? `Problème : ${r.problem}\n\n` : ''}${r.diagnostic}\n`;
    const li = document.createElement('li');
    li.append(Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([report], { type: 'text/plain' })), download: 'nfsmw-vf-rapport.txt',
      textContent: L('Enregistrer le rapport', 'Save the report'),
    }), L(' (noms et tailles de fichiers seulement)', ' (file names and sizes only)'));
    announce();
    if (r.problem) {
      // Say which disc is the problem: the Xbox one, or the 360 one (the dub needs PAL English data).
      const xboxBad = /not the French edition/.test(r.problem);
      slot('slot-xbox', `${flag('fr')}<strong>${file.name}</strong> <span class="${xboxBad ? 'bad' : 'muted'}">${xboxBad
        ? L('pas la version française', 'not the French edition') : L('en attente d\'une ISO 360 PAL anglaise', 'waiting for a PAL English 360 ISO')}</span>`, false);
      const why = /not the French edition/.test(r.problem) ? L('cette ISO Xbox n\'est pas la version française', 'this Xbox ISO is not the French edition')
        : /PAL \(English\)/.test(r.problem) ? L('la VF part des données d\'un disque 360 PAL anglais', 'the dub starts from the data of a PAL English 360 disc') : r.problem;
      fact('vf-facts', L(`VF pas possible avec ces deux ISO : ${why}. Le rapport ci-dessous dit ce qu'il y a dedans.`, `No French dub with these two ISOs: ${why}. The report below says what they hold.`), 'bad');
    } else {
      state.vfXbox = file;
      slot('slot-xbox', `${flag('fr')}<strong>${L('Xbox, française', 'Xbox, French')}</strong> <span class="muted">${file.name}</span>`, true);
      announce();
      fact('vf-facts', L('ISO Xbox française reconnue : la VF (textes, vidéos, voix) sera ajoutée après la copie du jeu. Comptez 1 à 3 heures, page ouverte.', 'French Xbox ISO recognised: the French dub (text, movies, voices) is added after the game copy. 1 to 3 hours, keep the page open.'), 'ok');
    }
    $('vf-facts').append(li);
  } catch (x) {
    $('vf-facts').replaceChildren();
    fact('vf-facts', String(x.message || x), 'bad');
  }
}

// ------------------------------------------------------------------ drag and drop

// Which disc is it: a 360 one has default.xex, an original Xbox one default.xbe.
async function dropped(file) {
  let names;
  try {
    names = (await readXiso(file)).map((f) => f.path.toLowerCase());
  } catch {
    fact('game-facts', L(`<code>${file.name}</code> n'est pas une ISO Xbox ou Xbox 360.`, `<code>${file.name}</code> is not an Xbox or Xbox 360 ISO.`), 'bad');
    return;
  }
  if (names.includes('default.xex')) {
    await chooseIso(file);
    if (state.pendingXbox && state.paquet && !state.vfXbox) await checkXbox(state.pendingXbox);
  } else if (names.includes('default.xbe')) await checkXbox(file);
  else fact('game-facts', L(`<code>${file.name}</code> : ni default.xex ni default.xbe.`, `<code>${file.name}</code>: neither default.xex nor default.xbe.`), 'bad');
}

const zone = $('drop');
zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('over'));
zone.addEventListener('drop', async (e) => {
  e.preventDefault();
  zone.classList.remove('over');
  // Handles must be asked for during the event; folders come through them (Chrome, Edge).
  const items = [...e.dataTransfer.items].filter((i) => i.kind === 'file');
  const handles = await Promise.all(items.map((i) => (i.getAsFileSystemHandle ? i.getAsFileSystemHandle() : null)));
  const files = items.map((i) => i.getAsFile());
  // 360 disc first, so the Xbox one is checked against it
  const order = [];
  for (let k = 0; k < items.length; k++) {
    if (handles[k] && handles[k].kind === 'directory') {
      $('game-facts').replaceChildren();
      state.iso = null;
      await chooseGame(await walkHandle(handles[k]));
      slot('slot-360', `${$('slot-360').querySelector('.v').innerHTML}`, !!state.paquet);
    } else if (files[k]) order.push(files[k]);
  }
  order.sort((a, b) => b.size - a.size);  // the 360 disc (7-8 GB) is larger than the Xbox one (about 4 GB)
  for (const f of order) await dropped(f);
});

// Movies an earlier run already dubbed: in the destination with another size than on the disc. Looked up before the
// game copy (which would put the English ones back) and not converted again: a run stopped halfway resumes there.
// A folder of the destination, without creating it (throws if it is not there).
async function destDir(path) {
  let dir = state.dest;
  for (const p of path.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(p);
  return dir;
}

// The machines already installed in the destination: bin/<arch>/, or an executable at the top (before 2026-11-18,
// moved into bin/ by the launcher at its next start).
async function destInstalls() {
  const found = [];
  try {
    for await (const [name, h] of (await destDir(`${state.base}bin`)).entries()) if (h.kind === 'directory') found.push(name);
  } catch { /* no bin/ */ }
  try {
    const exe = await (await (await destDir(state.base)).getFileHandle('nfsmw')).getFile();
    const m = new Uint8Array(await exe.slice(18, 19).arrayBuffer())[0];
    const arch = m === 0xb7 ? 'aarch64' : m === 0x3e ? 'x86_64' : null;
    if (arch && !found.includes(arch)) found.push(arch);
  } catch { /* none at the top */ }
  return found;
}

async function destHas(path, dir = false) {
  try {
    const parts = path.split('/').filter(Boolean);
    const parent = await destDir(parts.slice(0, -1).join('/'));
    await (dir ? parent.getDirectoryHandle(parts[parts.length - 1]) : parent.getFileHandle(parts[parts.length - 1]));
    return true;
  } catch {
    return false;
  }
}

// What the destination already holds of this game, so that nothing is done twice: the same edition (then a game
// file already there is never replaced: the French dub changes their sizes), a finished French dub (its movies
// report, and no vf-cache/ left: the page removes it at the very end), the icon sets and the Black Edition title.
async function destState() {
  const edition = await destEdition();
  const existing = !!edition && edition === state.xexSha;
  const dubbed = existing && (await destHas(`${state.base}game_root/Movies/rapport_films.txt`)
    || (await destHas(`${state.base}game_root/Movies/movies_report.txt`) && !(await destHas(`${state.base}game_root/vf-cache`, true))));
  let black = false;  // mods/black-edition/, however it is spelled (blackedition, Black Edition...), as mods.py reads it
  try {
    for await (const [name, h] of (await destDir(`${state.base}mods`)).entries()) {
      if (name.replace(/\.zip$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'blackedition' && (h.kind === 'directory' || /\.zip$/i.test(name))) black = true;
    }
  } catch { /* no mods/ */ }
  const tools = existing && black && await destHas(`${state.base}mods/icones`, true);
  return { edition, existing, destDubbed: dubbed, destTools: tools };
}

// SHA-256 of the default.xex already in the destination's game_root/, or null.
async function destEdition() {
  try {
    const xex = await (await (await destDir(`${state.base}game_root`)).getFileHandle('default.xex')).getFile();
    return await sha256(new Uint8Array(await xex.arrayBuffer()));
  } catch {
    return null;
  }
}

// The shader library of an earlier run, if the destination holds the same edition (same default.xex): a resumed
// run does not compile the shaders again.
async function destLibrary() {
  try {
    const xex = new Uint8Array(await (await (await (await destDir(`${state.base}game_root`)).getFileHandle('default.xex')).getFile()).arrayBuffer());
    if (await sha256(xex) !== state.xexSha) return null;
    // In game_root/ (shared by both machines' executables), or at the top for an install made before 2026-11-18.
    for (const where of [`${state.base}game_root`, state.base]) {
      try {
        const lib = await (await (await destDir(where)).getFileHandle('nfsmw_shaders.nfsp')).getFile();
        if (lib.size > 24) return lib;
      } catch { /* not there */ }
    }
    return null;
  } catch {
    return null;
  }
}

async function dubbedMovies() {
  const done = [];
  try {
    let dir = state.dest;
    for (const p of `${state.base}game_root/Movies`.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(p);
    for (const f of state.game.files) {
      if (!/^movies\/[^/]+_english_pal\.wmv$/i.test(f.rel)) continue;
      const name = f.rel.slice(7).toLowerCase();
      try {
        const there = await (await dir.getFileHandle(name)).getFile();
        if (there.size !== (await f.get()).size) done.push(name);
      } catch { /* not there */ }
    }
  } catch { /* no Movies folder yet */ }
  return done;
}

async function runVf() {
  log(L('VF : début (1 à 3 heures ; gardez la page ouverte)', 'French dub: start (1 to 3 hours; keep the page open)'));
  const t0 = Date.now();
  const done = state.vfDone || [];
  if (done.length) log(L(`VF : ${done.length} vidéos déjà converties par un essai précédent, sautées`, `French dub: ${done.length} movies already converted by an earlier run, skipped`));
  // Voice groups an earlier run encoded (game_root/vf-cache/): given back so they are not encoded again.
  const cache = {};
  let cacheDir = null;
  try {
    cacheDir = await destDir(`${state.base}game_root/vf-cache`);
    for await (const [name, h] of cacheDir.entries()) {
      if (h.kind === 'file' && /^voix-\d+-\d+\.bin$/.test(name)) cache[name] = new Uint8Array(await (await h.getFile()).arrayBuffer());
    }
  } catch { /* first run */ }
  await vfWorker({ type: 'run', done, cache }, async (rel, data) => {
    await writeTo(state.dest, `${state.base}game_root/${rel}`, data);
    if (!rel.startsWith('vf-cache/')) log(`VF : ${rel} (${size(data.length)})`);
  });
  try {  // finished: the cache is not needed any more
    await (await destDir(`${state.base}game_root`)).removeEntry('vf-cache', { recursive: true });
  } catch { /* nothing to remove */ }
  log(L(`VF : terminée en ${Math.round((Date.now() - t0) / 60000)} min`, `French dub: done in ${Math.round((Date.now() - t0) / 60000)} min`));
}

// ------------------------------------------------------------------ the package

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function openPaquet() {
  const files = {};
  for (const p of state.paquets.length ? state.paquets : [state.paquet]) Object.assign(files, await openOne(p));
  return files;
}

async function openOne(p) {
  progress(0.01, L('Téléchargement du port…', 'Downloading the port…'));
  const blob = await fetchBytes(`paquets/${p.fichier}${V}`);
  if (await sha256(blob) !== p.sha256) throw new Error(L('le port téléchargé est abîmé : rechargez la page', 'the downloaded port is damaged: reload the page'));
  const magic = new TextDecoder().decode(blob.subarray(0, 8));
  if (magic !== 'NFSMWPK1') throw new Error(L('port illisible', 'unreadable port'));
  const keyBytes = await crypto.subtle.digest('SHA-256', concat(SALT, state.xex));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  let plain;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: blob.subarray(8, 20), additionalData: blob.subarray(0, 8) }, key, blob.subarray(20)));
  } catch {
    throw new Error(L('ce default.xex n\'ouvre pas le port', 'this default.xex does not open the port'));
  }
  const data = await gunzip(plain);
  const n = new DataView(data.buffer).getUint32(0, true);
  const index = JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + n)));
  const files = {};
  let at = 4 + n;
  for (const f of index.files) {
    files[f.path] = data.subarray(at, at + f.size);
    at += f.size;
  }
  log(`port : ${index.version} (${index.files.length} fichiers)`);
  return files;
}

// An install from before 2026-11-18 has its executable at the top: once this run has written bin/<its processor>/,
// the old files go (the launcher would also do it at its next start), its shader library into game_root/ and its
// pipeline cache into bin/<processor>/cache/.
async function tidyOldLayout() {
  let root;
  try {
    root = await destDir(state.base);
    const exe = await (await root.getFileHandle('nfsmw')).getFile();
    const m = new Uint8Array(await exe.slice(18, 19).arrayBuffer())[0];
    const arch = m === 0xb7 ? 'aarch64' : m === 0x3e ? 'x86_64' : null;
    if (!arch || !archList().includes(arch)) return;
    try {
      const pipelines = await (await (await root.getDirectoryHandle('cache')).getFileHandle('nfsmw_nativo_pipelines.bin')).getFile();
      await writeTo(state.dest, `${state.base}bin/${arch}/cache/nfsmw_nativo_pipelines.bin`, pipelines, null, true);
      await (await root.getDirectoryHandle('cache')).removeEntry('nfsmw_nativo_pipelines.bin');
    } catch { /* no pipeline cache */ }
    for (const name of ['nfsmw', 'librexruntime.so', 'librexgpu-xenos.so', 'VERSION', 'lib']) {
      try { await root.removeEntry(name, { recursive: true }); } catch { /* not there */ }
    }
    log(L(`ancienne installation ${archName(arch)} rangée : l'exécutable est maintenant dans bin/${arch}/`, `older ${archName(arch)} install tidied: the executable is now in bin/${arch}/`));
  } catch { /* nothing at the top */ }
  try {
    const lib = await (await root.getFileHandle('nfsmw_shaders.nfsp')).getFile();
    await writeTo(state.dest, `${state.base}game_root/nfsmw_shaders.nfsp`, lib, null, true);
    await root.removeEntry('nfsmw_shaders.nfsp');
  } catch { /* none at the top */ }
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ------------------------------------------------------------------ icons and gamelist pictures (Pyodide)

async function pythonTools(game) {
  progress(0.08, L('Chargement de Python dans le navigateur…', 'Loading Python in the browser…'));
  const { loadPyodide } = await import(PYODIDE + 'pyodide.mjs');
  const py = await loadPyodide({ indexURL: PYODIDE });
  await py.loadPackage(['numpy', 'pillow'], { messageCallback: () => {} });
  py.FS.mkdirTree('/outils');
  for (const f of [...PY_FILES, 'DejaVuSans-Bold.ttf']) py.FS.writeFile(`/outils/${f}`, await fetchBytes(`outils/${f}${V}`));

  progress(0.12, L('Lecture des textures du jeu…', 'Reading the game\'s textures…'));
  const globalb = await fromArchives(game, 'GLOBAL/GLOBALB.LZC');
  const dyntex = await fromArchives(game, 'GLOBAL/DYNTEX.BIN');
  const frontb = await fromArchives(game, 'FRONTEND/FRONTB.LZC');
  const globala = await fromArchives(game, 'GLOBAL/GLOBALA.BUN');  // the game's logo (Black Edition title screen)
  // GLOBALMEMORYFILE.BIN: the one saved by an earlier install (Xbox 360 set), else a mod's loose copy, else the disc's.
  const saved = game.port.get('mods/icones/xbox360/globalmemoryfile.bin');
  const loose = game.byName.get('global/globalmemoryfile.bin');
  const memfile = saved ? new Uint8Array(await (await saved.get()).arrayBuffer())
    : loose ? new Uint8Array(await (await loose.get()).arrayBuffer())
      : await fromArchives(game, 'GLOBAL/GLOBALMEMORYFILE.BIN');
  // With the French dub the pack's copies of the English text are hidden (patch_text.py), in the icon sets' copies too.
  const pack = state.vfXbox || state.dubbed || state.destDubbed ? hideTextCopies(memfile) : memfile;
  for (const [n, b] of Object.entries({ globalb, dyntex, frontb, globala, memfile: pack })) py.FS.writeFile(`/in_${n}`, b);

  progress(0.16, L('Icônes PlayStation, GameCube et Xbox 360…', 'PlayStation, GameCube and Xbox 360 icons…'));
  py.globals.set('js_log', (t) => log(t));
  py.globals.set('js_progress', (f) => progress(f, L('Écran titre Black Edition (une minute environ)…',
    'Black Edition title screen (about a minute)…')));
  await py.runPythonAsync(`
import os, sys
sys.path.insert(0, '/outils')
os.chdir('/outils')
import ps_buttons, gamelist_media
rd = lambda n: open('/in_' + n, 'rb').read()
out = ps_buttons.icon_sets(rd('globalb'), rd('memfile'), rd('dyntex'), log=lambda *a: js_log(' '.join(map(str, a))))
out.update(gamelist_media.media(rd('frontb')))
js_progress(0.22)
import black_edition_title
out['mods/black-edition/black-edition.zip'] = black_edition_title.mod_zip(
    rd('frontb'), rd('globalb'), rd('globala'), log=lambda *a: js_log(' '.join(map(str, a))))
for name, data in out.items():
    path = '/sortie/' + name
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(data)
`);
  const files = {};
  const walk = (dir, rel) => {
    for (const n of py.FS.readdir(dir)) {
      if (n === '.' || n === '..') continue;
      const p = `${dir}/${n}`;
      if (py.FS.isDir(py.FS.stat(p).mode)) walk(p, `${rel}${n}/`);
      else files[rel + n] = py.FS.readFile(p);
    }
  };
  walk('/sortie', '');
  log(`icônes et images : ${Object.keys(files).length} fichiers`);
  return files;
}

// ------------------------------------------------------------------ shaders (nfsmw-nx installer modules)

async function existingLibrary(game) {
  const want = LIBRARIES[state.xexSha];
  for (const f of [game.port.get('nfsmw_shaders.nfsp'), game.byName.get('nfsmw_shaders.nfsp')]) {
    if (!f) continue;
    const bytes = new Uint8Array(await (await f.get()).arrayBuffer());
    if (await sha256(bytes) === want) return bytes;
  }
  return null;
}

async function shaders(game) {
  const ready = await existingLibrary(game);
  if (ready) {
    log('shaders : nfsmw_shaders.nfsp déjà là et correct, repris tel quel');
    return ready;
  }
  progress(0.3, L('Chargement du compilateur de shaders…', 'Loading the shader compiler…'));
  const S = './shaders/';
  const [{ default: createHlsl }, { default: createDxc }, { default: createPack }, { default: createLzx },
    { readXexImage }, { ContainerScanner }, { buildShaderLibrary }, i18n] = await Promise.all([
    import(S + 'wasm/hlsl.mjs'), import(S + 'wasm/dxc_web.mjs'), import(S + 'wasm/pack.mjs'), import(S + 'wasm/lzx.mjs'),
    import(S + 'lib/xex.js'), import(S + 'lib/containers.js'), import(S + 'lib/shaders.js'), import(S + 'lib/i18n.js')]);
  try { i18n.setLanguage('fr'); } catch { /* the builder's messages stay in English */ }
  const quiet = () => ({ print: () => {}, printErr: () => {} });
  const [hlsl, dxc, pack, lzx] = await Promise.all([createHlsl(quiet()), createDxc(quiet()), createPack(quiet()), createLzx(quiet())]);
  const manifest = JSON.parse(new TextDecoder().decode(await fetchBytes(S + 'release/manifest.json' + V)));
  const shaderCommon = await fetchBytes(S + 'shader_common.h' + V);
  const build = manifest.builds.find((b) => b.xex_sha256 === state.xexSha);

  const { image } = await readXexImage(state.xex, async (c, bits, n) => {
    lzx.FS.writeFile('/i.lzx', c);
    if (lzx.callMain(['/i.lzx', '/i.bin', String(bits), String(n)])) throw new Error('default.xex : LZX');
    return lzx.FS.readFile('/i.bin');
  });
  const exe = new ContainerScanner('xex_');
  exe.scanWhole('default.xex', image);

  // Same files and order as the installer: NFS/*.bin by lower-case path.
  const disc = new ContainerScanner('');
  const list = [];
  for (const f of game.files) {
    if (!/^nfs\/[^/]+\.bin$/i.test(f.rel)) continue;
    const file = await f.get();
    if (file.size >= 24 && file.size <= 1024 ** 3) list.push({ rel: 'NFS/' + f.rel.slice(4), file });
  }
  list.sort((a, b) => a.rel.toLowerCase().localeCompare(b.rel.toLowerCase()));
  const total = list.reduce((s, f) => s + f.file.size, 0);
  let read = 0;
  for (const { rel, file } of list) {
    disc.beginFile(rel, file.size);
    const CHUNK = 16 << 20;
    for (let at = 0; at < file.size; at += CHUNK) {
      const piece = new Uint8Array(await file.slice(at, at + CHUNK).arrayBuffer());
      disc.push(piece, at + CHUNK >= file.size);
      read += piece.length;
      progress(0.32 + 0.18 * (read / total), L(`Recherche des shaders dans ${rel}…`, `Looking for shaders in ${rel}…`));
    }
  }
  const containers = [...disc.found, ...exe.found];
  const blurSha = build ? build.blur_container_sha256 : 'e80cca037bd4becd8a192daa4583e3a3a9281e06436015746583f30701a296f9';
  let blur = null;
  for (const c of containers) {
    if (await sha256(c.bytes) === blurSha) { blur = c.name.slice(0, -4); break; }
  }
  if (!blur) throw new Error(L('shader de composition introuvable : la copie du jeu est-elle complète ?', 'composition shader not found: is the copy of the game complete?'));
  log(`shaders : ${containers.length} trouvés, compilation…`);
  let done = 0;
  const library = await buildShaderLibrary(containers, { hlsl, dxc, pack }, shaderCommon, (t) => {
    if (/^Compil/.test(t)) done += 25;
    progress(0.5 + 0.3 * Math.min(1, done / containers.length), L('Compilation des shaders…', 'Compiling the shaders…'));
  }, blur);
  const got = await sha256(library);
  const want = LIBRARIES[state.xexSha];
  if (want && got !== want) throw new Error(L(`bibliothèque de shaders inattendue (${got.slice(0, 12)}…)`, `unexpected shader library (${got.slice(0, 12)}…)`));
  log(`shaders : ${size(library.length)}, vérifiés`);
  return library;
}

// ------------------------------------------------------------------ writing

async function dirOf(root, parts) {
  let d = root;
  for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
  return d;
}

async function writeTo(root, path, data, onBytes, keep = false) {
  try {
    return await writeFile(root, path, data, onBytes, keep);
  } catch (e) {  // say which file: Chrome refuses some names on a real disk ("Name is not allowed")
    throw new Error(`${path} : ${e.message || e}`);
  }
}

// Extensions Chrome refuses to create on a real disk (Safe Browsing "dangerous" on Windows, plus .lnk/.scf/.url):
// such a file is written with .txt added and renamed back by run.sh (es_features_nfsmw.cfg is the only one in the
// port); a game file with one is reported.
const REFUSED = /\.(cfg|dll|ini|manifest|scf|dng|lnk|url)$/i;  // download_file_types.asciipb, Chromium main
const safeName = (path) => (REFUSED.test(path) ? `${path}.txt` : path);

async function writeFile(root, path, data, onBytes, keep = false) {
  path = safeName(path);
  const parts = path.split('/');
  const dir = await dirOf(root, parts.slice(0, -1));
  const name = parts[parts.length - 1];
  if (data instanceof Blob) {
    try {  // skip a game file that is already there with the same size; with keep, whatever its size (the same game)
      const old = await (await dir.getFileHandle(name)).getFile();
      if (keep || old.size === data.size) { onBytes?.(data.size); return false; }
    } catch { /* not there yet */ }
  }
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  if (data instanceof Blob) {
    const counter = new TransformStream({ transform(chunk, c) { onBytes?.(chunk.length); c.enqueue(chunk); } });
    await data.stream().pipeThrough(counter).pipeTo(w);
  } else {
    await w.write(data);
    await w.close();
  }
  return true;
}

async function run() {
  $('run').disabled = true;
  $('pick-game').disabled = true;
  $('pick-iso').disabled = true;
  $('pick-xbox').disabled = true;
  $('pick-dest').disabled = true;
  $('log').textContent = '';
  $('status').className = 'muted';
  state.portWritten = false;
  const out = {};  // path under NFS Most Wanted.sh/ -> bytes
  try {
    if (canWrite && state.dest) Object.assign(state, await destState());  // the folder may have changed since
    const vfToDo = state.vfXbox && !state.destDubbed;
    Object.assign(out, await openPaquet());
    if (canWrite && state.destTools) log(L('icônes, images et écran titre Black Edition : déjà là, gardés', 'icons, pictures and Black Edition title screen: already there, kept'));
    else Object.assign(out, await pythonTools(state.game));
    if (!canWrite) {
      out['game_root/nfsmw_shaders.nfsp'] = await shaders(state.game);
      progress(0.85, L('Fabrication du zip…', 'Making the zip…'));
      const zip = writeZip(Object.entries(out).map(([p, d]) => [`${PORT}/${p}`, d]));
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(zip), download: 'nfsmw-batocera.zip' });
      a.click();
      log(L(`zip : ${size(zip.size)}. Décompressez-le dans roms/ports/, puis copiez default.xex, NFS/ et Movies/ dans ${PORT}/game_root/.`, `zip: ${size(zip.size)}. Extract it into roms/ports/, then copy default.xex, NFS/ and Movies/ into ${PORT}/game_root/.`));
    } else {
      // The port first: if the shaders fail, the rest is in place and the error says what is missing.
      const entries = Object.entries(out);
      let i = 0;
      for (const [p, d] of entries) {
        // The settings already in the folder are the player's (shared by both machines): kept.
        if (p === 'nfsmw.toml' && await destHas(`${state.base}nfsmw.toml`)) continue;
        await writeTo(state.dest, `${state.base}${p}`, d);
        progress(0.2 + 0.08 * (++i / entries.length), `${L('Écriture de', 'Writing')} ${p}…`);
      }
      log(`écrit : ${entries.length} fichiers dans ${PORT}/`);
      state.portWritten = true;
      if (await destLibrary()) log(L('shaders : déjà fabriqués par un essai précédent, gardés', 'shaders: already built by an earlier run, kept'));
      else await writeTo(state.dest, `${state.base}game_root/nfsmw_shaders.nfsp`, await shaders(state.game));
      await tidyOldLayout();
      state.vfDone = vfToDo ? await dubbedMovies() : [];
      if ($('copy-game').checked) {
        let copied = 0, written = 0;
        for (const f of state.game.files) {
          if (state.vfDone.includes(f.rel.slice(7).toLowerCase()) && /^movies\//i.test(f.rel)) continue;  // dubbed by an earlier run
          const file = await f.get();
          const isNew = await writeTo(state.dest, `${state.base}game_root/${f.rel}`, file, (n) => {
            copied += n;
            progress(0.82 + 0.18 * (copied / state.total), `${L('Copie du jeu', 'Copying the game')} : ${size(copied)} / ${size(state.total)}`);
          }, state.existing);
          if (isNew) written++;
        }
        log(`jeu : ${written} fichiers copiés, ${state.game.files.length - written} déjà présents`);
      } else {
        log(L(`copiez default.xex, NFS/ et Movies/ dans ${PORT}/game_root/`, `copy default.xex, NFS/ and Movies/ into ${PORT}/game_root/`));
      }
      if (vfToDo) await runVf();
      else if (state.vfXbox) log(L('VF : déjà faite dans ce dossier, gardée', 'French dub: already done in this folder, kept'));
    }
    progress(1, L('Terminé.', 'Done.'));
    $('s-done').hidden = false;
  } catch (e) {
    console.error(e);
    $('status').className = 'bad';
    $('status').textContent = `${L('Erreur', 'Error')} : ${e.message || e}`;
    log(String(e.stack || e));
    if (state.portWritten) {
      log(L(`Le port est écrit dans ${PORT}/ ; il ne manque que la suite. Relancez une fois le problème réglé : les fichiers déjà copiés sont sautés.`, `The port is written in ${PORT}/; only the rest is missing. Run again once the problem is fixed: files already copied are skipped.`));
    }
  } finally {
    $('pick-game').disabled = false;
    $('pick-iso').disabled = false;
    $('pick-xbox').disabled = false;
    $('run').disabled = false;
    $('pick-dest').disabled = !canWrite;
  }
}
$('run').onclick = run;

if (!canWrite) $('s-browser').hidden = false;

// Browser tests (?test): the functions that read and write the destination, on a folder the test prepares.
if (new URLSearchParams(location.search).has('test')) window.nfsmwTest = { state, destState, destInstalls, writeTo, sha256 };
