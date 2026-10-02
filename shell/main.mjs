import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { AdvisorySession } from "./session.mjs";
const documentPath = fileURLToPath(
  new URL("../dist/index.html", import.meta.url),
);
let window;
const session = new AdvisorySession(
  (frame) => {
    if (window && !window.isDestroyed())
      window.webContents.send("advisory:frame", frame);
  },
  async (title) => {
    const filename =
      title
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, " ")
        .slice(0, 100)
        .trim() || "超级参谋团";
    const result = await dialog.showSaveDialog(window, {
      title: "导出会议报告",
      defaultPath: `${filename} 会议报告.docx`,
      filters: [{ name: "Word 文档", extensions: ["docx"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    return result.canceled ? null : result.filePath;
  },
);
const methods = new Set([
  "login",
  "logout",
  "profile",
  "configure",
  "market",
  "importExpert",
  "list",
  "get",
  "report",
  "exportReport",
  "create",
  "control",
  "history",
  "watch",
  "send",
]);
app.whenReady().then(async () => {
  window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1050,
    minHeight: 700,
    title: "半人马AI-超级参谋团",
    backgroundColor: "#fffcf6",
    webPreferences: {
      preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  ipcMain.handle("advisory:call", async (event, { method, args = [] }) => {
    if (
      event.sender.id !== window.webContents.id ||
      event.senderFrame !== window.webContents.mainFrame ||
      !methods.has(method)
    )
      return { ok: false, error: "无法执行这个操作。" };
    try {
      return { ok: true, data: await session[method](...args) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  await window.loadFile(documentPath);
});
app.on("window-all-closed", () => {
  void session.logout();
  app.quit();
});
