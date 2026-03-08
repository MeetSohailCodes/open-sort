const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const crypto = require("crypto");

// Generate a random secure token
const API_TOKEN = crypto.randomBytes(32).toString("hex");

ipcMain.handle("get-api-config", () => ({ token: API_TOKEN, port: 45455 }));

ipcMain.handle("select-dirs", async (event) => {
  try {
    // Get the browser window associated with this event
    const window = BrowserWindow.fromWebContents(event.sender);
    
    const result = await dialog.showOpenDialog(window || {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Directory",
      buttonLabel: "Select"
    });
    
    console.log("Dialog result:", result);
    return result.canceled ? null : result.filePaths[0];
  } catch (error) {
    console.error("Error showing dialog:", error);
    // Fallback dialog without parent window
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
        title: "Select Directory",
        buttonLabel: "Select"
      });
      
      console.log("Fallback dialog result:", result);
      return result.canceled ? null : result.filePaths[0];
    } catch (fallbackError) {
      console.error("Fallback dialog also failed:", fallbackError);
      return null;
    }
  }
});
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let mainWindow;
let pythonProcess;

const API_PORT = 45455;
const IS_DEV = process.env.NODE_ENV === "development";
const IS_WINDOWS = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

function clampZoomFactor(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, numeric));
}

function shouldOpenExternally(url) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("file:") || url.startsWith("about:")) return false;
  if (
    IS_DEV &&
    (url.startsWith("http://localhost:5173") ||
      url.startsWith("http://127.0.0.1:5173"))
  ) {
    return false;
  }
  return url.startsWith("http://") || url.startsWith("https://");
}

function createAppMenu() {
  const template = [
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle("zoom:get", async (event) => {
  try {
    return event?.sender?.getZoomFactor?.() ?? 0.9;
  } catch {
    return 0.9;
  }
});

ipcMain.handle("zoom:set", async (event, factor) => {
  const next = clampZoomFactor(factor);
  try {
    event?.sender?.setZoomFactor?.(next);
  } catch {
    // ignore
  }
  return next;
});

ipcMain.handle("zoom:reset", async (event) => {
  try {
    event?.sender?.setZoomFactor?.(0.9);
  } catch {
    // ignore
  }
  return 0.9;
});

function startPythonBackend() {
  let scriptPath;
  let pythonExecutable;

  if (IS_DEV) {
    // Development
    scriptPath = path.join(__dirname, "backend", "main.py");
    pythonExecutable = path.join(
      __dirname,
      "backend",
      "venv",
      "Scripts",
      "python.exe",
    );

    console.log(`Starting Python (Dev): ${pythonExecutable} ${scriptPath}`);
    pythonProcess = spawn(pythonExecutable, [scriptPath], {
      env: { ...process.env, OpenSort_TOKEN: API_TOKEN },
    });
  } else {
    // Production (Bundled EXE)
    // Try several common locations where electron-builder may place extraResources
    const candidates = [
      path.join(process.resourcesPath, "backend_dist", "main.exe"),
      path.join(process.resourcesPath, "app.asar.unpacked", "backend_dist", "main.exe"),
      path.join(process.resourcesPath, "app", "backend_dist", "main.exe"),
      path.join(__dirname, "backend_dist", "main.exe"),
    ];

    let exePath = null;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          exePath = p;
          break;
        }
      } catch (e) {
        console.log(`Checked path ${p}, not found:`, e.message);
      }
    }

    if (!exePath) {
      const msg = `Python backend not found. Checked: ${candidates.join(", ")}`;
      console.error(msg);
      try {
        const { dialog } = require("electron");
        dialog.showErrorBox(
          "Backend Not Found",
          "The bundled Python backend executable was not found. Please reinstall the app or ensure the installer included the backend executable.",
        );
      } catch (e) {
        // no-op
      }
      return;
    }

    console.log(`Starting Python (Prod): ${exePath}`);
    pythonProcess = spawn(exePath, [], {
      env: { ...process.env, OpenSort_TOKEN: API_TOKEN },
      detached: true,  // Run as detached process
    });
  }

  if (!pythonProcess) return;

  pythonProcess.stdout.on("data", (data) => console.log(`[Python]: ${data}`));
  pythonProcess.stderr.on("data", (data) =>
    console.error(`[Python Err]: ${data}`),
  );

  pythonProcess.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
  });
}

function createWindow() {
  const windowIcon = IS_DEV
    ? path.join(__dirname, "assets", "icon.png")
    : path.join(process.resourcesPath, "app.asar", "assets", "icon.png");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#1f2328",
    transparent: false,
    hasShadow: true,
    icon: windowIcon,
    frame: true,
    ...(IS_MAC
      ? {
          vibrancy: "sidebar",
        }
      : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    autoHideMenuBar: true,
    titleBarStyle: "default",
  });

  // Ensure zoom never gets stuck between runs
  mainWindow.webContents.setZoomFactor(0.9);
  mainWindow.webContents.on("did-finish-load", () => {
    try {
      mainWindow.webContents.setZoomFactor(0.9);
    } catch {
      // ignore
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (shouldOpenExternally(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "frontend/dist/index.html"));
  }
}

app.whenReady().then(() => {
  createAppMenu();
  startPythonBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Kill Python process before quitting
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== "darwin") app.quit();
});
