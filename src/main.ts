import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
} from 'electron';
import started from 'electron-squirrel-startup';
import { randomUUID } from 'node:crypto';
import {
  capitalTotals,
  checkout,
  closeDb,
  createCapital,
  createProduct,
  deleteCapital,
  deleteProduct,
  exportCapital,
  exportProducts,
  exportSales,
  getProduct,
  getSale,
  getSettings,
  importCsv,
  listCapital,
  listExports,
  listProducts,
  listSales,
  openDb,
  removeExport,
  setOwnerPassword,
  setSettings,
  stats,
  updateProduct,
  updateSale,
  voidSale,
} from './db.ts';
import { copyImage, ensureDirs, imagePath, removeImage } from './files.ts';
import type { DateRange, ProductInput, Settings } from './core/types.ts';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'posimg',
    privileges: {
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

if (started) {
  app.quit();
}

function wrap<T>(fn: () => T): { ok: true; data: T } | { ok: false; error: string } {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

function registerIpc(): void {
  ipcMain.handle('products:list', (_event, query) => wrap(() => listProducts(query)));
  ipcMain.handle('products:create', (_event, input: ProductInput) =>
    wrap(() => createProduct(input)),
  );
  ipcMain.handle('products:update', (_event, id: string, input: ProductInput) =>
    wrap(() => updateProduct(id, input)),
  );
  ipcMain.handle('products:remove', (_event, id: string) =>
    wrap(() => {
      const product = getProduct(id);
      deleteProduct(id);
      if (product?.image) removeImage(product.image);
    }),
  );
  ipcMain.handle('sales:list', (_event, range?: DateRange) => wrap(() => listSales(range)));
  ipcMain.handle('sales:get', (_event, id: string) => wrap(() => getSale(id)));
  ipcMain.handle('sales:checkout', (_event, input) => wrap(() => checkout(input)));
  ipcMain.handle('sales:void', (_event, password: string, id: string) =>
    wrap(() => voidSale(password, id)),
  );
  ipcMain.handle('sales:update', (_event, password: string, id: string, input) =>
    wrap(() => updateSale(password, id, input)),
  );
  ipcMain.handle('capital:list', (_event, query) => wrap(() => listCapital(query)));
  ipcMain.handle('capital:create', (_event, input) => wrap(() => createCapital(input)));
  ipcMain.handle('capital:remove', (_event, id: string) => wrap(() => deleteCapital(id)));
  ipcMain.handle('capital:totals', (_event, range?: DateRange) =>
    wrap(() => capitalTotals(range)),
  );
  ipcMain.handle('stats:summary', (_event, range: DateRange) => wrap(() => stats(range)));
  ipcMain.handle('settings:get', () => wrap(() => getSettings()));
  ipcMain.handle('settings:set', (_event, patch: Partial<Settings>) =>
    wrap(() => setSettings(patch)),
  );
  ipcMain.handle('settings:setPassword', (_event, current: string, next: string) =>
    wrap(() => setOwnerPassword(current, next)),
  );
  ipcMain.handle('files:pickImage', async () => {
    const picked = await dialog.showOpenDialog({
      title: 'Choose image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
    });
    if (picked.canceled || !picked.filePaths[0]) return { ok: true, data: null };
    return wrap(() => copyImage(picked.filePaths[0], randomUUID()));
  });
  ipcMain.handle('files:pickFolder', async () => {
    const picked = await dialog.showOpenDialog({
      title: 'CSV folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (picked.canceled || !picked.filePaths[0]) return { ok: true, data: null };
    return wrap(() => setSettings({ csvDir: picked.filePaths[0] }).csvDir);
  });
  ipcMain.handle('files:listCsv', () => wrap(() => listExports()));
  ipcMain.handle('files:exportProducts', () => wrap(() => exportProducts()));
  ipcMain.handle('files:exportSales', (_event, range?: DateRange) =>
    wrap(() => exportSales(range)),
  );
  ipcMain.handle('files:exportCapital', (_event, range?: { from?: string; to?: string }) =>
    wrap(() => exportCapital(range)),
  );
  ipcMain.handle('files:importCsv', (_event, name: string) => wrap(() => importCsv(name)));
  ipcMain.handle('files:deleteCsv', (_event, name: string) => wrap(() => removeExport(name)));
}

app.whenReady().then(() => {
  openDb();
  ensureDirs(getSettings().csvDir);
  protocol.handle('posimg', (request) => {
    const filename = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''));
    return net.fetch(pathToFileURL(imagePath(filename)).toString());
  });
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; img-src 'self' posimg: data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
          ],
        },
      });
    });
  }
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDb();
});
