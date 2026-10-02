const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("advisory", {
  call: async (method, ...args) => {
    const result = await ipcRenderer.invoke("advisory:call", { method, args });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
  onFrame: (callback) => {
    const listener = (_event, frame) => callback(frame);
    ipcRenderer.on("advisory:frame", listener);
    return () => ipcRenderer.removeListener("advisory:frame", listener);
  },
});
