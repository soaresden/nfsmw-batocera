// Page language. ?lang=fr|en wins and is remembered; otherwise the remembered choice, else the browser's language
// (French for fr-*, English for everything else). The static texts carry data-i18n keys, translated below; the
// script's messages use L(french, english).
const STORE = 'nfsmw-lang';
function pick() {
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked === 'fr' || asked === 'en') {
    try { localStorage.setItem(STORE, asked); } catch { /* private window */ }
    return asked;
  }
  try {
    const saved = localStorage.getItem(STORE);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch { /* private window */ }
  return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export const LANG = pick();
export const L = (fr, en) => (LANG === 'en' ? en : fr);

const EN = {
  "tag": "Native port · Batocera ARM64 · Retroid Pocket 5",
  "sub": "Xbox 360, recompiled for Batocera",
  "lead": "Drop your Xbox 360 ISO: the page recognises the edition and prepares the whole game folder, ready to copy to the console. Everything happens in your browser, no game file is sent anywhere.",
  "get0": "<b>60 FPS</b><span>in races, 1280x720 on the Retroid Pocket 5</span>",
  "get1": "<b>French dub</b><span>text, movies and voices, with the French Xbox ISO</span>",
  "get2": "<b>Your buttons</b><span>PlayStation, GameCube or Xbox 360 icons</span>",
  "get3": "<b>Ready to play</b><span>options in EmulationStation, saves, rumble</span>",
  "arch-k": "For:",
  "arch-both": "both (one folder for the Retroid and the PC)",
  "arch-arm": "an ARM handheld (Retroid Pocket, Odin…)",
  "arch-pc": "a PC (x86_64)",
  "arch-win": "Windows / RetroBat",
  "get4": "<b>Black Edition</b><span>road M3 GTR, Camaro SS, 8 tuned cars, 4 events, its title screen</span>",
  "callout": "<b>Want the game in French?</b> The French Xbox 360 edition is rare and expensive, but you do not need it: with <b>your European 360 ISO (PAL English) + the French ISO of the original Xbox</b>, you get <b>the European 360 version patched into French</b>: text, 31 of the 36 movies (the trailer behind \"Press Start\" stays in English) and all the police radio voices. The page does the patching itself, it just takes longer (1 to 3 hours).",
  "browser-h": "Browser",
  "browser-p": "To write straight to the SD card or the network share, and for the French dub, open this page with <strong>Chrome</strong> or <strong>Edge</strong> on a computer. Here the page makes a zip and you copy the game files yourself (you then need the folder extracted from the ISO).",
  "h1x": "Your game",
  "drop-big": "Drop your ISOs here",
  "drop-p": "The Xbox 360 ISO and, for the French dub, the French ISO of the original Xbox. Both at once is fine: the page tells which is which. An already extracted folder works too, or an installed <code>NFS Most Wanted.sh</code>: to add the other machine or update, without doing anything again.",
  "b-iso": "Choose the 360 ISO",
  "b-xbox": "French Xbox ISO (dub)",
  "b-dir": "Extracted or installed folder",
  "none": "none",
  "k-xbox": "Original Xbox, French (optional)",
  "ed-sum": "Recognised editions",
  "ed-note": "“Soon”: the port of an edition is compiled once from its <code>default.xex</code>. If you have one of these editions, open an issue on <a href=\"https://github.com/soaresden/nfsmw-batocera/issues\">the project page</a> (without the file: it is the game).",
  "h2x": "Where to install",
  "dest-p": "Any folder: the page creates <code>NFS Most Wanted.sh</code> in it. The simplest is Batocera's <code>roms/ports</code> folder (SD card plugged into the PC, or the network share <code>\\\\BATOCERA\\share\\roms\\ports</code>); otherwise copy the folder there afterwards. An existing <code>NFS Most Wanted.sh</code> folder can also be chosen directly.",
  "b-dest": "Choose the destination folder",
  "copy": "Also copy the game (extracted from the ISO) into <code>game_root/</code>, about 7 GB; files already there and identical are skipped.",
  "h3x": "Prepare",
  "run-p": "The page decrypts the port with your <code>default.xex</code>, builds the shaders, the three icon styles and the EmulationStation pictures, writes the <code>NFS Most Wanted.sh</code> folder, copies the game, then makes the French dub if you asked for it.",
  "b-run": "Prepare everything",
  "done-h": "Done",
  "done-p": "On the console: restart EmulationStation (or the console), then start <strong>NFS Most Wanted</strong> in <strong>Ports</strong>. The options are in <strong>Advanced game options → NFS MOST WANTED</strong>. <strong>Hotkey + Start</strong> quits the game, <strong>Hotkey + L1</strong> takes a screenshot.",
  "done-win": "On Windows: with RetroBat, restart EmulationStation and start <strong>NFS Most Wanted</strong> in the <strong>Windows</strong> system. Without RetroBat: run <code>NFS Most Wanted.sh\\bin\\x86_64-windows\\NFS Most Wanted.bat</code>. On the keyboard: arrows to drive, Shift nitro, Space handbrake, Esc pause; a controller works too.",
  "done-p2": "For feedback: send <code>nfsmw-stdout.log</code> and <code>data/logs/</code> from the game folder.",
  "footer": "Source code and explanations: <a href=\"https://github.com/soaresden/nfsmw-batocera\">nfsmw-batocera</a> (GPL-3.0), from nfsmw-nx and NFSMW Android Evolved. Black Edition: tuhana's patch (xenia-canary/game-patches), used by Epix Digital Studio. French dub: nfsmw-nx french-dub tool. The port is encrypted: only the edition's own <code>default.xex</code> opens it. Need for Speed is a trademark of Electronic Arts; this project is not affiliated with or endorsed by EA."
};

document.documentElement.lang = LANG;
if (LANG === 'en') {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const text = EN[el.dataset.i18n];
    if (text !== undefined) el.innerHTML = text;
  }
  document.title = 'NFSMW for Batocera';
  document.querySelector('meta[name=description]')?.setAttribute('content',
    'Prepares NFS Most Wanted (Xbox 360, recompiled) for Batocera from your own copy of the game, in the browser.');
}
// The switch keeps the other query parameters (test overrides such as ?pyodide=).
for (const a of document.querySelectorAll('.lang a')) {
  const q = new URLSearchParams(location.search);
  q.set('lang', a.dataset.lang);
  a.href = `?${q}`;
  a.classList.toggle('on', a.dataset.lang === LANG);
}
