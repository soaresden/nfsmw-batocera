// French dub worker: Pyodide runs page/vf/vf_page.py (the french-dub tools), ffmpeg.wasm and vgmstream (WASI) stand
// in for the programs it starts. Everything is synchronous inside this worker, so Python calls them directly.
// Messages in: {type: 'check' | 'run', x360: File, xbox: File, pyodide: URL, ffmpeg: URL}
// Messages out: progress {fraction, text}, log {text}, file {rel, data} (game_root/<rel>), result {...}, error.
import { WASI, File as WasiFile, OpenFile, ConsoleStdout, PreopenDirectory } from '../vendor/browser_wasi_shim/index.js';

const PY = ['vf_page.py', 'zzdata.py', 'xdvdfs.py', 'patch_text.py', 'patch_movies.py', 'patch_speech.py',
  'alignment.py', 'asf.py', 'ea_movie_audio.py', 'ea_stream.py', 'ea_xa.py', 'speech_idx.py'];
let py = null;
let core = null;
let vgm = null;
const coreLogs = [];
const post = (m, transfer) => self.postMessage(m, transfer || []);

async function loadPython(pyodideURL) {
  if (py) return;
  post({ type: 'progress', fraction: 0, text: self.vf_lang === 'en' ? 'French dub: loading Python…' : 'VF : chargement de Python…' });
  const { loadPyodide } = await import(pyodideURL + 'pyodide.mjs');
  py = await loadPyodide({ indexURL: pyodideURL, stdout: (text) => post({ type: 'log', text }), stderr: (text) => post({ type: 'log', text }) });
  await py.loadPackage(['numpy'], { messageCallback: () => {} });
  py.FS.mkdirTree('/vf');
  for (const f of PY) {
    const src = f === 'vf_page.py' ? `./${f}` : `../outils/french-dub/${f}`;
    const r = await fetch(new URL(src, import.meta.url));
    if (!r.ok) throw new Error(`${f} : ${r.status}`);
    py.FS.writeFile(`/vf/${f}`, new Uint8Array(await r.arrayBuffer()));
  }
  py.runPython("import sys; sys.path.insert(0, '/vf')");
}

async function loadTools(ffmpegURL) {
  if (!core) {
    post({ type: 'progress', fraction: 0, text: self.vf_lang === 'en' ? 'French dub: loading ffmpeg…' : 'VF : chargement de ffmpeg…' });
    const { default: createFFmpegCore } = await import(ffmpegURL + 'ffmpeg-core.js');
    const hash = btoa(JSON.stringify({ wasmURL: ffmpegURL + 'ffmpeg-core.wasm' }));
    core = await createFFmpegCore({ mainScriptUrlOrBlob: `${ffmpegURL}ffmpeg-core.js#${hash}` });
    core.setLogger(({ type, message }) => coreLogs.push([type, message]));
  }
  if (!vgm) vgm = await WebAssembly.compileStreaming(fetch(new URL('./vgmstream-cli.wasm', import.meta.url)));
}

function mountDiscs(x360, xbox) {
  py.FS.mkdirTree('/iso');
  try { py.FS.unmount('/iso'); } catch { /* first time */ }
  py.FS.mount(py.FS.filesystems.WORKERFS, { blobs: [{ name: 'x360.iso', data: x360 }, { name: 'xbox.iso', data: xbox }] }, '/iso');
}

// ---------------------------------------------------------------- the programs

const isFile = (fs, p) => { try { return fs.isFile(fs.stat(p).mode); } catch { return false; } };
const dirname = (p) => p.slice(0, p.lastIndexOf('/')) || '/';

function ffmpeg(program, args, input, cwd) {
  const abs = (p) => (p.startsWith('/') ? p : `${cwd.replace(/\/$/, '')}/${p}`);
  const cfs = core.FS;
  const temp = [];
  const put = (p, data) => { cfs.mkdirTree(dirname(p)); cfs.writeFile(p, data); temp.push(p); };
  args = args.map((a) => a.replace('resampler=soxr', 'resampler=swr'));  // no soxr in ffmpeg.wasm
  // the log level stays from one call to the next in ffmpeg.wasm: each call gets its own (info by default)
  if (!args.includes('-v') && !args.includes('-loglevel')) args = ['-v', 'info', ...args];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === 'pipe:0') {
      put('/__in', input);
      args[i] = '/__in';
    } else if (args[i - 1] === '-i' || (i === args.length - 1 && program === 'ffprobe')) {
      const p = abs(args[i]);
      if (isFile(py.FS, p)) put(p, py.FS.readFile(p));
      args[i] = p;
    }
  }
  let output = null;
  let toStdout = false;
  if (program === 'ffmpeg') {
    const last = args.length - 1;
    if (['-', 'pipe:', 'pipe:1'].includes(args[last])) {
      args[last] = '/__out';
      toStdout = true;
    } else {
      args[last] = abs(args[last]);
      cfs.mkdirTree(dirname(args[last]));
    }
    output = args[last];
  }
  coreLogs.length = 0;
  const r = program === 'ffmpeg' ? core.exec(...args) : core.ffprobe(...args);
  let returncode = typeof r === 'number' ? r : (core.ret || 0);
  // ffmpeg.wasm's ffprobe always ends with -1, even when it printed its answer
  if (program === 'ffprobe' && returncode === -1 && coreLogs.some(([t]) => t === 'stdout')) returncode = 0;
  core.reset();
  let stdout = new Uint8Array(0);
  if (toStdout && isFile(cfs, output)) stdout = cfs.readFile(output);
  else if (program === 'ffprobe') stdout = new TextEncoder().encode(coreLogs.filter(([t]) => t === 'stdout').map(([, m]) => m).join('\n'));
  if (output && !toStdout && isFile(cfs, output)) {
    py.FS.mkdirTree(dirname(output));
    py.FS.writeFile(output, cfs.readFile(output));
  }
  for (const p of [...temp, output]) if (p && isFile(cfs, p)) cfs.unlink(p);
  const stderr = coreLogs.filter(([t]) => t !== 'stdout' || program === 'ffmpeg').map(([, m]) => m).join('\n');
  return { returncode, stdout, stderr };
}

function vgmstream(args, cwd) {
  const name = args[args.length - 1];
  const path = name.startsWith('/') ? name : `${cwd.replace(/\/$/, '')}/${name}`;
  const base = path.slice(path.lastIndexOf('/') + 1);
  const out = new WasiFile(new Uint8Array(0));
  const errors = [];
  const fds = [new OpenFile(new WasiFile(new Uint8Array(0))), new OpenFile(out),
    ConsoleStdout.lineBuffered((m) => errors.push(m)),
    new PreopenDirectory('.', new Map([[base, new WasiFile(py.FS.readFile(path), { readonly: true })]]))];
  const wasi = new WASI(['vgmstream-cli', ...args.slice(0, -1), base], [], fds);
  const instance = new WebAssembly.Instance(vgm, { wasi_snapshot_preview1: wasi.wasiImport });
  let returncode;
  try {
    returncode = wasi.start(instance);
  } catch (e) {
    returncode = 1;
    errors.push(String(e));
  }
  return { returncode, stdout: out.data, stderr: errors.join('\n') };
}

self.vf_run = (cmd, input, cwd) => {
  const [program, ...args] = Array.from(cmd);
  const data = input ? new Uint8Array(input) : null;
  if (program === 'vgmstream-cli') return vgmstream(args, cwd);
  if (program === 'ffmpeg' || program === 'ffprobe') return ffmpeg(program, args, data, cwd);
  throw new Error(`programme inconnu : ${program}`);
};
self.vf_flush = (path, rel) => {
  const data = py.FS.readFile(path);
  py.FS.unlink(path);
  post({ type: 'file', rel, data }, [data.buffer]);
};
self.vf_progress = (fraction, text) => post({ type: 'progress', fraction, text });

// ---------------------------------------------------------------- messages

self.onmessage = async ({ data: m }) => {
  try {
    self.vf_lang = m.lang || 'fr';
    await loadPython(m.pyodide);
    mountDiscs(m.x360, m.xbox);
    const vf = py.pyimport('vf_page');
    if (m.type === 'check') {
      post({ type: 'result', problem: vf.check(), diagnostic: vf.diagnostic() });
    } else if (m.type === 'run') {
      await loadTools(m.ffmpeg);
      vf.run_all();
      post({ type: 'result', done: true });
    }
  } catch (e) {
    post({ type: 'error', message: String(e && e.message ? e.message : e) });
  }
};
