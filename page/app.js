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
  aebdf3c14d1e4e4ed2c130d94bc1a0e97bd6d5bf39bdfdef33c3909c9cc4ba4c: { nom: 'USA (NTSC)', pays: 'us', plan: 'prevu', vf: 'a verifier', langue: 'anglais' },
  e2ea2ff11bf84cb30430d824d7bfe699a3acf3e7400d21b9a7c938e3d7a10474: { nom: 'PAL anglaise (UK)', pays: 'gb', plan: 'prevu', vf: 'oui', langue: 'anglais' },
  '229c5ed5dcc67871982000fb923acfd59494f21f30996b25f36b30a8d85c9b7b': { nom: 'PAL France', pays: 'fr', plan: 'prevu', vf: 'deja', langue: 'français' },
  aad15fc218d034de3131f746e0b763dd8049a40dd676efc87667fcaf4fc72694: { nom: 'PAL Espagne', pays: 'es', plan: 'prevu', vf: 'non', langue: 'espagnol' },
  '23ece29d18724ea28971d52f936964d127148bd2359ff24795da7442b9069bf4': { nom: 'PAL Allemagne', pays: 'de', plan: 'prevu', vf: 'non', langue: 'allemand' },
  acb09332bcafc15e8e21dc15062f1963804a3176fa4db48fea7f6c8afbdff066: { nom: 'PAL Italie', pays: 'it', plan: 'prevu', vf: 'non', langue: 'italien' },
  '23af89d49a713ff948af7b9bc06557b06e94e8629adc40a29513ab6f5cafb33d': { nom: 'Japon', pays: 'jp', plan: 'non', vf: 'non', langue: 'japonais' },
  '47683b515e5461a2e356c45a4417f30fe69c3f6c6ea0d3352829f35f1fb33abe': { nom: 'Corée', pays: 'kr', plan: 'non', vf: 'non', langue: 'coréen' },
  '0cd7b9fa3957de085e298c91faa726116ad0079abaefead82c2f3337ee432e64': { nom: 'Asie (chinois trad.)', pays: 'tw', plan: 'non', vf: 'non', langue: 'chinois' },
  a2dd0156c26603cf32e33b52fa906422bde74e5065da87115d5b747aa5d90ff8: { nom: 'Pologne (fans)', pays: 'pl', plan: 'non', vf: 'non', langue: 'polonais' },
};
const VF_CHIP = { oui: 'VF avec Xbox FR', 'a verifier': 'VF à vérifier', deja: 'déjà en VF', non: '' };

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
const PY_FILES = ['jdlz.py', 'tpk.py', 'huff.py', 'xenos.py', 'dxt.py', 'ps_buttons.py', 'gamelist_media.py'];

const state = { game: null, dest: null, xex: null, xexSha: null, paquet: null };
let INDEX = { paquets: [] };

const ready = (sha) => INDEX.paquets.some((p) => p.xex_sha256 === sha);

async function editionsTable(highlight) {
  const grid = $('editions-grid');
  grid.replaceChildren();
  for (const [sha, e] of Object.entries(EDITIONS)) {
    const card = document.createElement('div');
    card.className = `ed${sha === highlight ? ' mine' : ''}`;
    const port = ready(sha) ? '<span class="chip ready">Prêt</span>'
      : e.plan === 'prevu' ? '<span class="chip soon">Bientôt</span>' : '<span class="chip">Pas prévu</span>';
    const vf = VF_CHIP[e.vf] ? `<span class="chip vf">${VF_CHIP[e.vf]}</span>` : '';
    card.innerHTML = `${flag(e.pays)}<div class="name">${e.nom}${sha === highlight ? ' · <span class="ok">votre ISO</span>' : ''}</div><div class="chips">${port}${vf}</div>`;
    grid.append(card);
  }
}
fetch('paquets/index.json').then((r) => (r.ok ? r.json() : { paquets: [] })).then((i) => { INDEX = i; editionsTable(); })
  .catch(() => editionsTable());
const canWrite = typeof window.showDirectoryPicker === 'function';

// ------------------------------------------------------------------ small helpers

const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (bytes) => hex(await crypto.subtle.digest('SHA-256', bytes));
const size = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(2)} Go` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.round(n / 1e3)} ko`;

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
  const items = [`${flag(e.pays)} NFS Most Wanted ${e.nom}, port natif Batocera : 60 FPS en course en 1280x720 sur Retroid Pocket 5`];
  if (state.vfXbox) items.push('<b>VF complète</b> : textes, 32 des 36 vidéos et toutes les voix en jeu, en français');
  else if (state.dubbed) items.push('<b>VF</b> : le doublage français déjà présent dans votre dossier est gardé');
  else if (e.vf === 'deja') items.push('Jeu en français (votre disque)');
  else {
    items.push(`Textes et voix : ${e.langue}, ou la langue de Batocera si le disque l'a`);
    if (e.vf === 'oui') items.push('<span class="muted">Ajoutez l\'ISO Xbox française pour la VF complète</span>');
  }
  items.push('Icônes PlayStation (par défaut), GameCube ou Xbox 360, au choix dans EmulationStation');
  items.push('Shaders fabriqués à partir de votre disque, images de l\'écran titre pour la fiche du jeu');
  items.push('<b>Black Edition</b> à activer dans les options : BMW M3 GTR de route, Camaro SS, 8 voitures tunées, l\'épreuve 70 du Challenge Series et 3 courses en plus');
  items.push('Options dans EmulationStation, sauvegardes, vibration, Hotkey + Start pour quitter');
  const time = state.vfXbox ? 'quelques minutes, plus la copie du jeu, plus 1 à 3 heures de VF' : 'quelques minutes, plus la copie du jeu (7 Go)';
  out.innerHTML = `<h3>Ce que vous obtenez</h3><ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul><p class="muted small">Durée : ${time}.</p>`;
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
    if (!zz) throw new Error(`NFS/ZZDATA${archive}.BIN manque`);
    const file = await zz.get();
    return new Uint8Array(await file.slice(sector * 2048, sector * 2048 + n).arrayBuffer());
  }
  if (loose) return new Uint8Array(await (await loose.get()).arrayBuffer());
  throw new Error(`${path} introuvable dans NFS/ZDIR.BIN`);
}

async function chooseGame(all) {
  const game = gameFrom(all);
  if (!game) {
    fact('game-facts', 'Pas de <code>default.xex</code> dans ce dossier.', 'bad');
    return;
  }
  for (const need of ['nfs/zdir.bin', 'nfs/zzdata0.bin']) {
    if (!game.byName.has(need)) {
      fact('game-facts', `Il manque <code>${need.toUpperCase()}</code> : est-ce bien le jeu extrait ?`, 'bad');
      return;
    }
  }
  const xex = new Uint8Array(await (await game.byName.get('default.xex').get()).arrayBuffer());
  const xexSha = await sha256(xex);
  const paquet = INDEX.paquets.find((p) => p.xex_sha256 === xexSha);
  editionsTable(xexSha);
  const total = (await Promise.all(game.files.map(async (f) => (await f.get()).size))).reduce((a, b) => a + b, 0);
  fact('game-facts', `${game.files.length} fichiers, ${size(total)}${game.root ? ` (dans <code>${game.root}</code>)` : ''}`);
  const edition = EDITIONS[xexSha];
  fact('game-facts', `Édition : ${edition ? `${flag(edition.pays)} <strong>${edition.nom}</strong>` : '<strong>inconnue</strong>'}`, paquet ? 'ok' : 'bad');
  slot('slot-360', `${edition ? flag(edition.pays) : ''}<strong>${edition ? edition.nom : 'édition inconnue'}</strong> <span class="muted">${state.iso ? state.iso.name : 'dossier'}</span>`, true);
  {  // default.xex alone, to identify a copy or to add an edition to the port
    const li = document.createElement('li');
    li.className = 'muted';
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([xex])), download: 'default.xex', textContent: 'Enregistrer default.xex seul',
    });
    link.style.color = 'inherit';
    li.append(link, ` (empreinte ${xexSha.slice(0, 8)}…, pour un rapport ou une nouvelle édition)`);
    $('game-facts').append(li);
  }
  if (!paquet) {
    state.paquet = null;
    announce();
    fact('game-facts', !edition
      ? '<code>default.xex</code> modifié ou édition inconnue : le port ne peut pas l\'utiliser.'
      : edition.plan === 'prevu'
        ? 'Port pas encore prêt pour cette édition : il faut compiler son <code>default.xex</code> une fois. Voir le tableau ci-dessous.'
        : 'Cette édition n\'est pas prévue pour l\'instant.', 'bad');
    return;
  }
  state.dubbed = game.byName.has('movies/movies_report.txt') || game.byName.has('movies/rapport_films.txt');
  if (state.dubbed) {
    fact('game-facts', 'Doublage français de nfsmw-nx détecté : le jeu sera en VF.', 'ok');
  }
  if (game.byName.has('global/globalmemoryfile.bin')) {
    fact('game-facts', 'Mod détecté (<code>GLOBAL/GLOBALMEMORYFILE.BIN</code>) : il est gardé par les icônes.');
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
    $('run').textContent = 'Fabriquer le zip';
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
  fact('game-facts', `Lecture de <code>${file.name}</code>…`, 'muted');
  try {
    const all = await readXiso(file);
    state.iso = file;
    $('game-facts').replaceChildren();
    fact('game-facts', `ISO : <code>${file.name}</code>`);
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
    if (/\.sh$/i.test(dir.name)) {
      fact('dest-facts', `Choisissez le dossier <code>ports</code> lui-même, pas <code>${dir.name}</code>.`, 'bad');
      return;
    }
    if (dir.name.toLowerCase() !== 'ports') {
      fact('dest-facts', `Le dossier s'appelle <code>${dir.name}</code> : Batocera cherche les ports dans <code>roms/ports</code>.`, 'bad');
    }
    state.dest = dir;
    fact('dest-facts', `Destination : <code>${dir.name}/${PORT}/</code>`, 'ok');
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
  else if (edition && edition.vf === 'oui') fact('vf-facts', 'VF possible : ajoutez l\'ISO de la Xbox d\'origine en français.', 'muted');
}

function vfWorker(message, onFile) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./vf/vf-worker.js', import.meta.url), { type: 'module' });
    let writes = Promise.resolve();
    worker.onmessage = ({ data: m }) => {
      if (m.type === 'progress') progress(m.fraction, m.text);
      else if (m.type === 'log') log(m.text);
      else if (m.type === 'file') writes = writes.then(() => onFile(m.rel, m.data));
      else if (m.type === 'error') { worker.terminate(); reject(new Error(m.message)); }
      else if (m.type === 'result') writes.then(() => { worker.terminate(); resolve(m); }, reject);
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || 'VF : erreur du worker')); };
    worker.postMessage({ ...message, x360: state.iso, xbox: state.vfXbox || message.xbox, pyodide: PYODIDE, ffmpeg: FFMPEG });
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
    fact('vf-facts', 'ISO Xbox gardée : elle sera vérifiée dès que l\'ISO 360 (d\'une édition prise en charge) sera choisie.', 'muted');
    return;
  }
  if (!canWrite) {
    fact('vf-facts', 'La VF a besoin de Chrome ou Edge sur un ordinateur.', 'bad');
    return;
  }
  fact('vf-facts', `Vérification de <code>${file.name}</code> avec l'ISO Xbox 360 (une minute)…`, 'muted');
  try {
    const r = await vfWorker({ type: 'check', xbox: file }, async () => {});
    $('vf-facts').replaceChildren();
    const report = `${r.problem ? `Problème : ${r.problem}\n\n` : ''}${r.diagnostic}\n`;
    const li = document.createElement('li');
    li.append(Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([report], { type: 'text/plain' })), download: 'nfsmw-vf-rapport.txt',
      textContent: 'Enregistrer le rapport',
    }), ' (noms et tailles de fichiers seulement)');
    announce();
    if (r.problem) {
      slot('slot-xbox', `${flag('fr')}<strong>${file.name}</strong> <span class="bad">pas encore pour cette édition</span>`, false);
      fact('vf-facts', 'Ces deux ISO ne sont pas encore prises en charge pour la VF : l\'outil a été mis au point avec la PAL anglaise. Le rapport ci-dessous dit ce qu\'il faut adapter.', 'bad');
    } else {
      state.vfXbox = file;
      slot('slot-xbox', `${flag('fr')}<strong>Xbox, française</strong> <span class="muted">${file.name}</span>`, true);
      announce();
      fact('vf-facts', 'ISO Xbox française reconnue : la VF (textes, vidéos, voix) sera ajoutée après la copie du jeu. Comptez 1 à 3 heures, page ouverte.', 'ok');
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
    fact('game-facts', `<code>${file.name}</code> n'est pas une ISO Xbox ou Xbox 360.`, 'bad');
    return;
  }
  if (names.includes('default.xex')) {
    await chooseIso(file);
    if (state.pendingXbox && state.paquet && !state.vfXbox) await checkXbox(state.pendingXbox);
  } else if (names.includes('default.xbe')) await checkXbox(file);
  else fact('game-facts', `<code>${file.name}</code> : ni default.xex ni default.xbe.`, 'bad');
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

async function runVf() {
  log('VF : début (1 à 3 heures ; gardez la page ouverte)');
  const t0 = Date.now();
  await vfWorker({ type: 'run' }, async (rel, data) => {
    await writeTo(state.dest, `${PORT}/game_root/${rel}`, data);
    log(`VF : ${rel} (${size(data.length)})`);
  });
  log(`VF : terminée en ${Math.round((Date.now() - t0) / 60000)} min`);
}

// ------------------------------------------------------------------ the package

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function openPaquet() {
  const p = state.paquet;
  progress(0.01, 'Téléchargement du port…');
  const blob = await fetchBytes(`paquets/${p.fichier}`);
  if (await sha256(blob) !== p.sha256) throw new Error('le port téléchargé est abîmé : rechargez la page');
  const magic = new TextDecoder().decode(blob.subarray(0, 8));
  if (magic !== 'NFSMWPK1') throw new Error('port illisible');
  const keyBytes = await crypto.subtle.digest('SHA-256', concat(SALT, state.xex));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  let plain;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: blob.subarray(8, 20), additionalData: blob.subarray(0, 8) }, key, blob.subarray(20)));
  } catch {
    throw new Error('ce default.xex n\'ouvre pas le port');
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

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ------------------------------------------------------------------ icons and gamelist pictures (Pyodide)

async function pythonTools(game) {
  progress(0.08, 'Chargement de Python dans le navigateur…');
  const { loadPyodide } = await import(PYODIDE + 'pyodide.mjs');
  const py = await loadPyodide({ indexURL: PYODIDE });
  await py.loadPackage(['numpy', 'pillow'], { messageCallback: () => {} });
  py.FS.mkdirTree('/outils');
  for (const f of [...PY_FILES, 'DejaVuSans-Bold.ttf']) py.FS.writeFile(`/outils/${f}`, await fetchBytes(`outils/${f}`));

  progress(0.12, 'Lecture des textures du jeu…');
  const globalb = await fromArchives(game, 'GLOBAL/GLOBALB.LZC');
  const dyntex = await fromArchives(game, 'GLOBAL/DYNTEX.BIN');
  const frontb = await fromArchives(game, 'FRONTEND/FRONTB.LZC');
  // GLOBALMEMORYFILE.BIN: the one saved by an earlier install (Xbox 360 set), else a mod's loose copy, else the disc's.
  const saved = game.port.get('mods/icones/xbox360/globalmemoryfile.bin');
  const loose = game.byName.get('global/globalmemoryfile.bin');
  const memfile = saved ? new Uint8Array(await (await saved.get()).arrayBuffer())
    : loose ? new Uint8Array(await (await loose.get()).arrayBuffer())
      : await fromArchives(game, 'GLOBAL/GLOBALMEMORYFILE.BIN');
  // With the French dub the pack's copies of the English text are hidden (patch_text.py), in the icon sets' copies too.
  const pack = state.vfXbox ? hideTextCopies(memfile) : memfile;
  for (const [n, b] of Object.entries({ globalb, dyntex, frontb, memfile: pack })) py.FS.writeFile(`/in_${n}`, b);

  progress(0.16, 'Icônes PlayStation, GameCube et Xbox 360…');
  py.globals.set('js_log', (t) => log(t));
  await py.runPythonAsync(`
import os, sys
sys.path.insert(0, '/outils')
os.chdir('/outils')
import ps_buttons, gamelist_media
rd = lambda n: open('/in_' + n, 'rb').read()
out = ps_buttons.icon_sets(rd('globalb'), rd('memfile'), rd('dyntex'), log=lambda *a: js_log(' '.join(map(str, a))))
out.update(gamelist_media.media(rd('frontb')))
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
  progress(0.3, 'Chargement du compilateur de shaders…');
  const S = './shaders/';
  const [{ default: createHlsl }, { default: createDxc }, { default: createPack }, { default: createLzx },
    { readXexImage }, { ContainerScanner }, { buildShaderLibrary }, i18n] = await Promise.all([
    import(S + 'wasm/hlsl.mjs'), import(S + 'wasm/dxc_web.mjs'), import(S + 'wasm/pack.mjs'), import(S + 'wasm/lzx.mjs'),
    import(S + 'lib/xex.js'), import(S + 'lib/containers.js'), import(S + 'lib/shaders.js'), import(S + 'lib/i18n.js')]);
  try { i18n.setLanguage('fr'); } catch { /* the builder's messages stay in English */ }
  const quiet = () => ({ print: () => {}, printErr: () => {} });
  const [hlsl, dxc, pack, lzx] = await Promise.all([createHlsl(quiet()), createDxc(quiet()), createPack(quiet()), createLzx(quiet())]);
  const manifest = JSON.parse(new TextDecoder().decode(await fetchBytes(S + 'release/manifest.json')));
  const shaderCommon = await fetchBytes(S + 'shader_common.h');
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
      progress(0.32 + 0.18 * (read / total), `Recherche des shaders dans ${rel}…`);
    }
  }
  const containers = [...disc.found, ...exe.found];
  const blurSha = build ? build.blur_container_sha256 : 'e80cca037bd4becd8a192daa4583e3a3a9281e06436015746583f30701a296f9';
  let blur = null;
  for (const c of containers) {
    if (await sha256(c.bytes) === blurSha) { blur = c.name.slice(0, -4); break; }
  }
  if (!blur) throw new Error('shader de composition introuvable : la copie du jeu est-elle complète ?');
  log(`shaders : ${containers.length} trouvés, compilation…`);
  let done = 0;
  const library = await buildShaderLibrary(containers, { hlsl, dxc, pack }, shaderCommon, (t) => {
    if (/^Compil/.test(t)) done += 25;
    progress(0.5 + 0.3 * Math.min(1, done / containers.length), 'Compilation des shaders…');
  }, blur);
  const got = await sha256(library);
  const want = LIBRARIES[state.xexSha];
  if (want && got !== want) throw new Error(`bibliothèque de shaders inattendue (${got.slice(0, 12)}…)`);
  log(`shaders : ${size(library.length)}, vérifiés`);
  return library;
}

// ------------------------------------------------------------------ writing

async function dirOf(root, parts) {
  let d = root;
  for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
  return d;
}

async function writeTo(root, path, data, onBytes) {
  const parts = path.split('/');
  const dir = await dirOf(root, parts.slice(0, -1));
  const name = parts[parts.length - 1];
  if (data instanceof Blob) {
    try {  // skip a game file that is already there with the same size
      const old = await (await dir.getFileHandle(name)).getFile();
      if (old.size === data.size) { onBytes?.(data.size); return false; }
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
    Object.assign(out, await openPaquet());
    Object.assign(out, await pythonTools(state.game));
    if (!canWrite) {
      out['nfsmw_shaders.nfsp'] = await shaders(state.game);
      progress(0.85, 'Fabrication du zip…');
      const zip = writeZip(Object.entries(out).map(([p, d]) => [`${PORT}/${p}`, d]));
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(zip), download: 'nfsmw-batocera.zip' });
      a.click();
      log(`zip : ${size(zip.size)}. Décompressez-le dans roms/ports/, puis copiez default.xex, NFS/ et Movies/ dans ${PORT}/game_root/.`);
    } else {
      // The port first: if the shaders fail, the rest is in place and the error says what is missing.
      const entries = Object.entries(out);
      let i = 0;
      for (const [p, d] of entries) {
        await writeTo(state.dest, `${PORT}/${p}`, d);
        progress(0.2 + 0.08 * (++i / entries.length), `Écriture de ${p}…`);
      }
      log(`écrit : ${entries.length} fichiers dans ${PORT}/`);
      state.portWritten = true;
      await writeTo(state.dest, `${PORT}/nfsmw_shaders.nfsp`, await shaders(state.game));
      if ($('copy-game').checked) {
        let copied = 0, written = 0;
        for (const f of state.game.files) {
          const file = await f.get();
          const isNew = await writeTo(state.dest, `${PORT}/game_root/${f.rel}`, file, (n) => {
            copied += n;
            progress(0.82 + 0.18 * (copied / state.total), `Copie du jeu : ${size(copied)} / ${size(state.total)}`);
          });
          if (isNew) written++;
        }
        log(`jeu : ${written} fichiers copiés, ${state.game.files.length - written} déjà présents`);
      } else {
        log(`copiez default.xex, NFS/ et Movies/ dans ${PORT}/game_root/`);
      }
      if (state.vfXbox) await runVf();
    }
    progress(1, 'Terminé.');
    $('s-done').hidden = false;
  } catch (e) {
    console.error(e);
    $('status').className = 'bad';
    $('status').textContent = `Erreur : ${e.message || e}`;
    log(String(e.stack || e));
    if (state.portWritten) {
      log(`Le port est écrit dans ${PORT}/ ; il ne manque que la suite. Relancez une fois le problème réglé : les fichiers déjà copiés sont sautés.`);
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
