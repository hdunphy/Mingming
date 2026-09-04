// Ticket 26 spike: boot Mingming's existing vite dist/ inside Electron, unmodified except for
// vite's `base`. Nothing here is production code — it exists to produce the numbers in
// research/26-wrapper.md.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const t0 = Date.now();
let win;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.on('did-finish-load', async () => {
    const cold = Date.now() - t0;
    const rootHtml = await win.webContents.executeJavaScript(
      "document.getElementById('root') ? document.getElementById('root').innerHTML.length : -1"
    );
    const metrics = app.getAppMetrics().reduce((acc, m) => acc + (m.memory?.workingSetSize || 0), 0);
    console.log(JSON.stringify({
      coldStartMs: cold,
      rootInnerHtmlChars: rootHtml,
      totalWorkingSetKB: metrics,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    }));
    app.quit();
  });
});
