/* =====================================================================
   KORO FOR THE MAC — the web game in its own window, with its own server.

   It is not a port: it is the same files the website serves (staged into
   ./game by scripts/stage.js) and the same server/index.js, started inside
   the app. So every mission, the block editor, the Arcade, the phone,
   accounts and the teacher panel are exactly what they are in the browser.

   What the app adds:
   - A DATABASE THAT KEEPS. server/memdb.js is the in-memory Postgres the
     dev server uses, saving to a file in the app's data folder after every
     change — accounts, progress, games and texts survive quitting.
   - A SESSION SECRET THAT KEEPS, or everybody would be signed out every
     time the app restarts (auth.js makes a random one otherwise).
   - A WINDOW THAT IS NEVER A BACKGROUND TAB: no timer throttling, the GPU
     blocklist ignored, the frame rate the display allows.
   ===================================================================== */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const GAME = path.join(__dirname, 'game');
const PORT = 47615;
let memdb = null;

function startServer(){
  const data = app.getPath('userData');
  fs.mkdirSync(data, { recursive:true });
  const secretFile = path.join(data, 'session.key');
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'));
  process.env.SESSION_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
  /* THE SAME PORT EVERY LAUNCH: localStorage belongs to an origin, and
     the port is part of the origin, so a random port would forget every
     setting the game keeps in the browser. Only if something else holds
     it does the app take any free port instead. */
  process.env.PORT = String(PORT);
  memdb = require(path.join(GAME, 'server', 'memdb.js'));
  memdb.install({ file: path.join(data, 'koro-data.json') });
  const srv = require(path.join(GAME, 'server', 'index.js'));
  return new Promise((resolve, reject) => {
    srv.server.once('listening', () => resolve(srv.server.address().port));
    srv.server.once('error', e => {
      if (e.code !== 'EADDRINUSE') return reject(e);
      srv.server.once('listening', () => resolve(srv.server.address().port));
      srv.server.listen(0, '127.0.0.1');
    });
    srv.start();
  });
}

async function open(){
  const port = await startServer();
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 600,
    title: 'KORO', backgroundColor: '#070a1a', show: false,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true }
  });
  win.once('ready-to-show', () => win.show());
  // anything that opens a new window (a link out) goes to the real browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(open);
app.on('window-all-closed', () => app.quit());
// the save waits 150ms after a change; quitting inside that must not lose it
app.on('before-quit', () => { if (memdb) memdb.save(); });
