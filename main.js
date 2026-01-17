const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");

ipcMain.handle("select-dirs", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});
const path = require("path");
const { spawn } = require("child_process");

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
    return event?.sender?.getZoomFactor?.() ?? 1;
  } catch {
    return 1;
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
    event?.sender?.setZoomFactor?.(1);
  } catch {
    // ignore
  }
  return 1;
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
    pythonProcess = spawn(pythonExecutable, [scriptPath]);
  } else {
    // Production (Bundled EXE)
    // We will assume the python executable is packaged alongside the app
    // This part requires specific pyinstaller config later
    const exePath = path.join(
      process.resourcesPath,
      "backend_dist",
      "main.exe",
    );
    console.log(`Starting Python (Prod): ${exePath}`);
    pythonProcess = spawn(exePath);
  }

  pythonProcess.stdout.on("data", (data) => console.log(`[Python]: ${data}`));
  pythonProcess.stderr.on("data", (data) =>
    console.error(`[Python Err]: ${data}`),
  );

  pythonProcess.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
  });
}

function createWindow() {
  const windowIcon = path.join(__dirname, "assets", "icon.png");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#00000000",
    transparent: true,
    hasShadow: true,
    icon: windowIcon,
    ...(IS_MAC
      ? {
          vibrancy: "sidebar",
        }
      : {}),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    titleBarStyle: "hidden", // Custom Title Bar look
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#ffffff",
    },
  });

  // Ensure zoom never gets stuck between runs
  mainWindow.webContents.setZoomFactor(1);
  mainWindow.webContents.on("did-finish-load", () => {
    try {
      mainWindow.webContents.setZoomFactor(1);
    } catch {
      // ignore
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
