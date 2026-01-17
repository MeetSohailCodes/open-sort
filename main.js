const { app, BrowserWindow, ipcMain, dialog } = require("electron");

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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#020617",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    titleBarStyle: "hidden", // Custom Title Bar look
    titleBarOverlay: {
      color: "#0f172a",
      symbolColor: "#ffffff",
    },
  });

  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "frontend/dist/index.html"));
  }
}

app.whenReady().then(() => {
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
