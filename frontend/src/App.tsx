  import { useState, useEffect, useRef, useCallback } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import {
    Button,
    Input,
    Checkbox,
    CircularProgress,
    Chip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Progress,
    Tooltip,
  } from "@heroui/react";
  import {
    FolderOpen,
    FileImage,
    FileVideo,
    Music,
    FileText,
    Package,
    Layers,
    MonitorPlay,
    Settings,
    ArrowLeft,
    ArrowRight,
    AlertTriangle,
    Shield,
    Info,
    RotateCcw,
    ZoomIn,
    ZoomOut,
    Zap,
    Archive,
    Github,
    Linkedin,
  } from "lucide-react";
import ConfigPanel, { ExtensionsByCategory } from "./components/ConfigPanel";
import RenameOptions, { RenameStrategy, RenameLabelPosition, RenameDatePosition } from "./components/RenameOptions";
import { Typography } from "./components/Typography";
import { app } from "./config/index.config";
  // API URL
  const API_URL = "http://127.0.0.1:45455";
  const WS_URL = "ws://127.0.0.1:45455/ws";

  interface Stats {
    processed: number;
    total: number;
    photos: number;
    videos: number;
    audio: number;
    archives: number;
    documents: number;
    other: number;
    errors: number;
  }

  type Step = "setup" | "types" | "rename" | "confirm" | "processing" | "done";
  type OrganizeMode = "category" | "year" | "month";

  const STORAGE_KEY = "archivist_config_v1";

  const EXTENSION_OPTIONS: ExtensionsByCategory = {
    Photos: [".jpg", ".jpeg", ".png", ".heic", ".webp", ".gif", ".bmp", ".tiff", ".tif", ".raw", ".dng"],
    Videos: [".mp4", ".mov", ".avi", ".3gp", ".mkv", ".wmv", ".m4v", ".mpg", ".mpeg", ".flv", ".webm"],
    Audio: [".mp3", ".m4a", ".wav", ".aac", ".ogg", ".flac", ".amr", ".wma", ".opus"],
    Archives: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".iso"],
    Documents: [".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".xlsx", ".xls", ".ppt", ".pptx", ".json", ".xml", ".html", ".htm", ".apk", ".exe", ".msi", ".ai", ".psd"],
  };

  const DEFAULT_IGNORED_DIRS = [
    "node_modules",
    "windows",
    "System Volume Information",
    "$RECYCLE.BIN",
    "__pycache__",
    ".git",
    ".venv",
    "venv",
    "dist",
    "build",
  ];

  const ORGANIZE_OPTIONS: Array<{
    value: OrganizeMode;
    label: string;
    description: string;
    example: string;
  }> = [
    {
      value: "category",
      label: "Category Only",
      description: "Group files by category only.",
      example: "Photos/file.jpg",
    },
    {
      value: "year",
      label: "Yearly",
      description: "Group by category and year.",
      example: "Photos/2026/file.jpg",
    },
    {
      value: "month",
      label: "Monthly",
      description: "Group by category, year, and month.",
      example: "Photos/2026/01-January/file.jpg",
    },
  ];

  const pageVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  const NAV_STEPS = [
    { key: "setup", label: "Setup", icon: FolderOpen },
    { key: "types", label: "File Types", icon: Settings },
    { key: "rename", label: "Rename Files", icon: RotateCcw },
    { key: "confirm", label: "Review", icon: Shield },
  ] as const;

  export default function App() {
    const [step, setStep] = useState<Step>("setup");
    const [sourcePath, setSourcePath] = useState("");
    const [destPath, setDestPath] = useState("");
    const [organizeMode, setOrganizeMode] = useState<OrganizeMode>("year");
    const [isConnected, setIsConnected] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState("Waiting to start...");
    const [stats, setStats] = useState<Stats | null>(null);
    const [finalStats, setFinalStats] = useState<Stats | null>(null);
    const [selectedExtensions, setSelectedExtensions] = useState<ExtensionsByCategory>(EXTENSION_OPTIONS);
    const [ignoredDirs, setIgnoredDirs] = useState<string[]>(DEFAULT_IGNORED_DIRS);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isSameFolder, setIsSameFolder] = useState(false);
    const [renameEnabled, setRenameEnabled] = useState(false);
    const [renameStrategy, setRenameStrategy] = useState<RenameStrategy>("datetime_original");
    const [renameLabel, setRenameLabel] = useState("");
    const [renameLabelPosition, setRenameLabelPosition] = useState<RenameLabelPosition>("prefix");
    const [renameDatePosition, setRenameDatePosition] = useState<RenameDatePosition>("prefix");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [zoomFactor, setZoomFactor] = useState(1);
    const currentYear = new Date().getFullYear();

    const ws = useRef<WebSocket | null>(null);
    const completionAudioRef = useRef<HTMLAudioElement | null>(null);

    const initCompletionAudio = useCallback(() => {
      if (completionAudioRef.current) return;

      try {
        const audio = new Audio("/assets/sounds/complete.wav");
        audio.preload = "auto";
        audio.volume = 0.85;
        completionAudioRef.current = audio;
      } catch {
        completionAudioRef.current = null;
      }
    }, []);

    const primeCompletionAudio = useCallback(() => {
      const audio = completionAudioRef.current;
      if (!audio) return;

      try {
        const originalVolume = audio.volume;
        audio.volume = 0;
        const p = audio.play();
        Promise.resolve(p)
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = originalVolume;
          })
          .catch(() => {
            audio.volume = originalVolume;
          });
      } catch {
        // ignore
      }
    }, []);

    const playCompletionSound = useCallback(async () => {
      const audio = completionAudioRef.current;
      if (!audio) return;

      try {
        audio.currentTime = 0;
        await audio.play();
      } catch {
        // Autoplay may be blocked in some environments; ignore silently.
      }
    }, []);

    const getIpcRenderer = () => {
      try {
        // @ts-ignore
        return window.require?.("electron")?.ipcRenderer ?? null;
      } catch {
        return null;
      }
    };

    const refreshZoom = useCallback(async () => {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) return;

      try {
        const current = await ipcRenderer.invoke("zoom:get");
        if (typeof current === "number" && Number.isFinite(current)) {
          setZoomFactor(current);
        }
      } catch {
        // ignore
      }
    }, []);

    const changeZoom = useCallback(
      async (delta: number) => {
        const ipcRenderer = getIpcRenderer();
        if (!ipcRenderer) return;

        try {
          const current = await ipcRenderer.invoke("zoom:get");
          const base = typeof current === "number" && Number.isFinite(current) ? current : zoomFactor;
          const next = Math.round((base + delta) * 100) / 100;
          const applied = await ipcRenderer.invoke("zoom:set", next);
          if (typeof applied === "number" && Number.isFinite(applied)) {
            setZoomFactor(applied);
          }
        } catch {
          // ignore
        }
      },
      [zoomFactor]
    );

    const resetZoom = useCallback(async () => {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) return;

      try {
        const applied = await ipcRenderer.invoke("zoom:reset");
        if (typeof applied === "number" && Number.isFinite(applied)) {
          setZoomFactor(applied);
        }
      } catch {
        // ignore
      }
    }, []);

    // Health Check
    useEffect(() => {
      checkHealth();
      const interval = setInterval(checkHealth, 2000);
      return () => clearInterval(interval);
    }, []);

    // Preload notification sound
    useEffect(() => {
      initCompletionAudio();
    }, [initCompletionAudio]);

    // Load current zoom from Electron (if running in Electron)
    useEffect(() => {
      refreshZoom();
    }, [refreshZoom]);

    // Load persisted configuration
    useEffect(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.selectedExtensions) {
          setSelectedExtensions((prev) => ({
            ...prev,
            ...parsed.selectedExtensions,
          }));
        }
        if (Array.isArray(parsed?.ignoredDirs)) {
          setIgnoredDirs(parsed.ignoredDirs);
        }
        if (parsed?.organizeMode === "category" || parsed?.organizeMode === "year" || parsed?.organizeMode === "month") {
          setOrganizeMode(parsed.organizeMode);
        }
        if (typeof parsed?.renameEnabled === "boolean") {
          setRenameEnabled(parsed.renameEnabled);
        }
        if (
          parsed?.renameStrategy === "date_original" ||
          parsed?.renameStrategy === "datetime_original" ||
          parsed?.renameStrategy === "label_date"
        ) {
          setRenameStrategy(parsed.renameStrategy);
        }
        if (typeof parsed?.renameLabel === "string") {
          setRenameLabel(parsed.renameLabel);
        }
        if (parsed?.renameLabelPosition === "prefix" || parsed?.renameLabelPosition === "suffix") {
          setRenameLabelPosition(parsed.renameLabelPosition);
        }
        if (parsed?.renameDatePosition === "prefix" || parsed?.renameDatePosition === "suffix" || parsed?.renameDatePosition === "none") {
          setRenameDatePosition(parsed.renameDatePosition);
        }
      } catch {
        // Ignore corrupted storage
      }
    }, []);

    // Persist configuration
    useEffect(() => {
      const payload = {
        selectedExtensions,
        ignoredDirs,
        organizeMode,
        renameEnabled,
        renameStrategy,
        renameLabel,
        renameLabelPosition,
        renameDatePosition,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage errors
      }
    }, [selectedExtensions, ignoredDirs, organizeMode, renameEnabled, renameStrategy, renameLabel, renameLabelPosition, renameDatePosition]);

    // Check if source and dest are the same
    useEffect(() => {
      if (sourcePath && destPath) {
        const normalizedSource = sourcePath.toLowerCase().replace(/\\/g, "/").replace(/\/$/, "");
        const normalizedDest = destPath.toLowerCase().replace(/\\/g, "/").replace(/\/$/, "");
        setIsSameFolder(normalizedSource === normalizedDest);
      } else {
        setIsSameFolder(false);
      }
    }, [sourcePath, destPath]);

    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (res.ok) setIsConnected(true);
        else setIsConnected(false);
      } catch {
        setIsConnected(false);
      }
    };

    const handleBrowse = async (target: "source" | "dest") => {
      try {
        // @ts-ignore
        const { ipcRenderer } = window.require("electron");
        const path = await ipcRenderer.invoke("select-dirs");
        if (path) {
          if (target === "source") setSourcePath(path);
          else setDestPath(path);
        }
      } catch (err) {
        console.error("Electron IPC failed", err);
      }
    };

    const startOrganization = useCallback(() => {
      if (!sourcePath || !destPath) return;

      initCompletionAudio();
      primeCompletionAudio();

      setStep("processing");
      setProgress(0);
      setCurrentFile("Initializing...");
      setStats(null);
      setFinalStats(null);
      setErrorMessage(null);
      ws.current = new WebSocket(WS_URL);

      const connectTimeout = setTimeout(() => {
        if (ws.current && ws.current.readyState !== WebSocket.OPEN) {
          setErrorMessage("Backend WebSocket connection timed out. Please restart the backend.");
          setCurrentFile("Connection failed");
          ws.current?.close();
        }
      }, 5000);

      ws.current.onopen = () => {
        setCurrentFile("Connected. Sending request...");
        ws.current?.send(
          JSON.stringify({
            command: "start",
            source: sourcePath,
            dest: destPath,
            by_month: organizeMode === "month",
            config: {
              organize_mode: organizeMode,
              extensions_by_category: selectedExtensions,
              ignore_dirs: ignoredDirs,
              rename: {
                enabled: renameEnabled,
                strategy: renameStrategy,
                label: renameLabel,
                label_position: renameLabelPosition,
                date_position: renameDatePosition,
              },
            },
          })
        );
        clearTimeout(connectTimeout);
      };

      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "progress") {
          setProgress(msg.data.progress);
          setCurrentFile(msg.data.file);
          setStats(msg.data.stats);
        } else if (msg.type === "status") {
          setCurrentFile(msg.msg || "Working...");
        } else if (msg.type === "complete") {
          setStats(msg.stats);
          setFinalStats(msg.stats);
          setProgress(100);
          setCurrentFile("Completed");
          setStep("done");
          void playCompletionSound();
          ws.current?.close();
        } else if (msg.type === "error") {
          setErrorMessage(msg.error || "Unexpected backend error.");
          setCurrentFile("Stopped due to error");
        } else if (msg.error) {
          console.error("Backend error:", msg.error);
          setErrorMessage(msg.error);
          setCurrentFile("Stopped due to error");
        }
      };

      ws.current.onerror = () => {
        console.error("WebSocket error");
        setErrorMessage("WebSocket error. Please retry.");
        setCurrentFile("Connection error");
      };

      ws.current.onclose = () => {
        if (!finalStats && !errorMessage && step === "processing") {
          setErrorMessage("Connection closed. Check backend logs and try again.");
          setCurrentFile("Stopped due to error");
        }
      };
    }, [sourcePath, destPath, organizeMode, selectedExtensions, ignoredDirs, renameEnabled, renameStrategy, renameLabel, renameLabelPosition, renameDatePosition, finalStats, errorMessage, step, initCompletionAudio, primeCompletionAudio, playCompletionSound]);

    const handleCancelProcess = () => {
      ws.current?.close();
      setShowCancelModal(false);
      resetToSetup();
    };

    const resetToSetup = () => {
      setStep("setup");
      setProgress(0);
      setCurrentFile("Waiting to start...");
      setStats(null);
      setFinalStats(null);
    };

    const displayStats = finalStats ?? stats;

    const handleAddIgnoreDir = (value: string) => {
      const cleaned = value.trim();
      if (!cleaned) return;
      if (ignoredDirs.some((dir) => dir.toLowerCase() === cleaned.toLowerCase())) return;
      setIgnoredDirs((prev) => [...prev, cleaned]);
    };

    const handleRemoveIgnoreDir = (value: string) => {
      setIgnoredDirs((prev) => prev.filter((dir) => dir !== value));
    };

    const getSelectedExtCount = () => {
      return Object.values(selectedExtensions).flat().length;
    };

    const currentStepIndex = NAV_STEPS.findIndex((item) => item.key === step);
    const configCardClass = "bg-slate-700/30 rounded-2xl border border-slate-600/30 p-8 min-h-[520px]";

    const canProceed = sourcePath && destPath && isConnected;
    const organizeLabel =
      organizeMode === "month"
        ? "Monthly"
        : organizeMode === "category"
          ? "Category Only"
          : "Yearly";

    return (
      <div className="min-h-screen bg-slate-800">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 app-drag">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
             
            <div className="flex items-center gap-3 app-no-drag">
             <img src="/assets/icons/icon.png" alt="Archivist" className="w-full h-10 object-contain" />
             <Typography as="h1" variant="h1" className="text-xl font-bold text-slate-100 select-none">Archivist</Typography>
            </div>
            </div>

            <div className="flex items-center gap-2 app-no-drag">
              <Tooltip
                content={
                  <Typography as="span" variant="body-sm">
                    Zoom Out ({Math.round(zoomFactor * 100)}%)
                  </Typography>
                }
              >
                <Button 
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={() => changeZoom(-0.1)}
                  className="bg-slate-700/50 border border-slate-600/30 text-slate-200"
                  aria-label="Zoom Out"
                >
                  <ZoomOut size={16} />
                </Button>
              </Tooltip>

              <Tooltip
                content={
                  <Typography as="span" variant="body-sm">
                    Reset Zoom ({Math.round(zoomFactor * 100)}%)
                  </Typography>
                }
              >
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={resetZoom}
                  className="bg-slate-700/50 border border-slate-600/30 text-slate-200"
                  aria-label="Reset Zoom"
                >
                  <RotateCcw size={16} />
                </Button>
              </Tooltip>

              <Tooltip
                content={
                  <Typography as="span" variant="body-sm">
                    Zoom In ({Math.round(zoomFactor * 100)}%)
                  </Typography>
                }
              >
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={() => changeZoom(0.1)}
                  className="bg-slate-700/50 border border-slate-600/30 text-slate-200"
                  aria-label="Zoom In"
                >
                  <ZoomIn size={16} />
                </Button>
              </Tooltip>

              <Chip
                startContent={
                  <div
                    className={`w-2 h-2 rounded-full mx-1 ${
                      isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                    }`}
                  />
                }
                variant="flat"
                className="bg-slate-700/50 border border-slate-600/30"
                classNames={{
                  content: `font-medium text-xs ${isConnected ? "text-slate-200" : "text-rose-300"}`,
                }}
              >
                <Typography as="span" variant="label" className="font-medium">
                  {isConnected ? "Online" : "Offline"}
                </Typography>
              </Chip>
            </div>
          </div>
        </header>

        {/* Step Indicator */}
        {step !== "processing" && step !== "done" && (
          <div className="fixed top-16 left-0 right-0 z-40 bg-slate-800/60 backdrop-blur-sm border-b border-slate-700/30">
            <div className="max-w-6xl mx-auto px-6 py-4">
              <div className="flex items-center justify-center gap-2">
                {NAV_STEPS.map((s, i) => {
                  const isActive = step === s.key;
                  const isPast = currentStepIndex > i;
                  const Icon = s.icon;

                  return (
                    <div key={s.key} className="flex items-center">
                      <div
                        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                          isActive
                            ? "bg-slate-600 text-slate-50"
                            : isPast
                              ? "bg-slate-700/50 text-slate-300"
                              : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        <Icon size={14} />
                      <Typography as="span" variant="body-sm" className="text-xs font-medium">
                        {s.label}
                      </Typography>
                      </div>
                      {i < NAV_STEPS.length - 1 && (
                        <div
                          className={`w-8 h-0.5 mx-1 ${isPast || isActive ? "bg-slate-500" : "bg-slate-700"}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="pt-32 pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              {/* STEP 1: Setup - Directory Selection */}
              {step === "setup" && (
                <motion.div
                  key="setup"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                <div className="text-center mb-10">
                  <Typography as="h2" variant="h2" className="text-3xl text-slate-50 mb-3">
                    Select Directories
                  </Typography>
                  <Typography as="p" variant="body" className="text-slate-400 max-w-md mx-auto">
                    Choose your source folder containing media files and the destination for organized output.
                  </Typography>
                </div>

                  <div className="bg-slate-700/30 rounded-2xl border border-slate-600/30 p-8 space-y-8">
                    <Input
                      label="SOURCE FOLDER"
                      labelPlacement="outside"
                      placeholder="Click browse to select source folder..."
                      value={sourcePath}
                      isReadOnly
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      startContent={<FolderOpen className="text-slate-400" size={20} />}
                    endContent={
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => handleBrowse("source")}
                        className="bg-slate-600 text-slate-100 font-medium min-w-[90px]"
                      >
                        <Typography as="span" variant="label" className="font-medium text-slate-100">
                          Browse
                        </Typography>
                      </Button>
                    }
                      classNames={{
                        label: "text-xs font-bold text-slate-400 tracking-wider pb-2",
                        input: "text-slate-100 font-medium",
                        inputWrapper:
                          "bg-slate-800/50 border-slate-600/50 hover:border-slate-500 group-data-[focus=true]:border-slate-400 h-14",
                      }}
                    />

                    <Input
                      label="DESTINATION FOLDER"
                      labelPlacement="outside"
                      placeholder="Click browse to select destination folder..."
                      value={destPath}
                      isReadOnly
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      startContent={<Archive className="text-slate-400" size={20} />}
                    endContent={
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => handleBrowse("dest")}
                        className="bg-slate-600 text-slate-100 font-medium min-w-[90px]"
                      >
                        <Typography as="span" variant="label" className="font-medium text-slate-100">
                          Browse
                        </Typography>
                      </Button>
                    }
                      classNames={{
                        label: "text-xs font-bold text-slate-400 tracking-wider pb-2",
                        input: "text-slate-100 font-medium",
                        inputWrapper:
                          "bg-slate-800/50 border-slate-600/50 hover:border-slate-500 group-data-[focus=true]:border-slate-400 h-14",
                      }}
                    />

                    {/* Same folder warning */}
                    {isSameFolder && (
                      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
                      <div>
                        <Typography as="p" variant="body-sm" className="text-sm font-medium text-amber-300">
                          In-Place Organization
                        </Typography>
                        <Typography as="p" variant="body-sm" className="text-xs text-amber-400/80 mt-1">
                          Source and destination are the same. Files will be reorganized within this folder.
                        </Typography>
                      </div>
                      </div>
                    )}

                    {/* Organization Strategy */}
                    <div className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                      <Typography as="p" variant="caption" className="text-slate-400 font-bold tracking-wider">
                        Organization Type
                      </Typography>
                      <Tooltip
                        content={
                          <Typography as="span" variant="body-sm">
                            Choose how files are structured inside the destination
                          </Typography>
                        }
                      >
                        <Info size={14} className="text-slate-500" />
                      </Tooltip>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {ORGANIZE_OPTIONS.map((option) => {
                          const isActive = organizeMode === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setOrganizeMode(option.value)}
                              className={`text-left border rounded-xl p-4 transition-all ${
                                isActive
                                  ? "bg-slate-600/30 border-slate-500/60"
                                  : "border-slate-600/30 hover:border-slate-500/50 hover:bg-slate-700/20"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                              <Typography
                                as="p"
                                variant="body"
                                className={`text-sm font-semibold ${isActive ? "text-slate-100" : "text-slate-300"}`}
                              >
                                {option.label}
                              </Typography>
                                <Checkbox
                                  isSelected={isActive}
                                  color="default"
                                  classNames={{
                                    wrapper:
                                      "before:border-slate-500 group-data-[selected=true]:before:border-slate-400",
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                />
                              </div>
                            <Typography as="p" variant="body-sm" className="text-xs text-slate-400 mt-2">
                              {option.description}
                            </Typography>
                            <Typography as="p" variant="mono" className="text-[10px] text-slate-500 mt-2">
                              {option.example}
                            </Typography>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                  <Button
                    size="lg"
                    radius="lg"
                    isDisabled={!canProceed}
                    onPress={() => setStep("types")}
                    className="bg-slate-100 text-slate-800 font-semibold px-8 hover:bg-white"
                    endContent={<ArrowRight size={18} />}
                  >
                    <Typography as="span" variant="body" className="text-sm">
                      Continue to File Types
                    </Typography>
                  </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: File Types */}
              {step === "types" && (
                <motion.div
                  key="types"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                <div className="text-center mb-10">
                  <Typography as="h2" variant="h2" className="text-3xl text-slate-50 mb-3">
                    File Types to Organize
                  </Typography>
                  <Typography as="p" variant="body" className="text-slate-400 max-w-md mx-auto">
                    Select which file types to organize and folders to skip during scanning.
                  </Typography>
                </div>

                  <div className={configCardClass}>
                    <ConfigPanel
                      extensionsByCategory={EXTENSION_OPTIONS}
                      selectedExtensions={selectedExtensions}
                      onChangeSelected={setSelectedExtensions}
                      ignoredDirs={ignoredDirs}
                      onAddIgnoreDir={handleAddIgnoreDir}
                      onRemoveIgnoreDir={handleRemoveIgnoreDir}
                    />
                  </div>

                  <div className="flex justify-between">
                  <Button
                    size="lg"
                    radius="lg"
                    variant="flat"
                    onPress={() => setStep("setup")}
                    className="bg-slate-700/50 text-slate-200 font-medium px-6"
                    startContent={<ArrowLeft size={18} />}
                  >
                    <Typography as="span" variant="body" className="text-sm">
                      Back
                    </Typography>
                  </Button>
                  <Button
                    size="lg"
                    radius="lg"
                    onPress={() => setStep("rename")}
                    className="bg-slate-100 text-slate-800 font-semibold px-8 hover:bg-white"
                    endContent={<ArrowRight size={18} />}
                  >
                    <Typography as="span" variant="body" className="text-sm">
                      Continue to Renaming
                    </Typography>
                  </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Renaming */}
              {step === "rename" && (
                <motion.div
                  key="rename"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                <div className="text-center mb-10">
                  <Typography as="h2" variant="h2" className="text-3xl text-slate-50 mb-3">
                    Rename Files
                  </Typography>
                  <Typography as="p" variant="body" className="text-slate-400 max-w-md mx-auto">
                    Configure how files should be renamed using metadata dates and custom labels.
                  </Typography>
                </div>

                  <div className={configCardClass}>
                    <RenameOptions
                      enabled={renameEnabled}
                      strategy={renameStrategy}
                      label={renameLabel}
                      labelPosition={renameLabelPosition}
                      datePosition={renameDatePosition}
                      onToggleEnabled={setRenameEnabled}
                      onChangeStrategy={setRenameStrategy}
                      onChangeLabel={setRenameLabel}
                      onChangeLabelPosition={setRenameLabelPosition}
                      onChangeDatePosition={setRenameDatePosition}
                    />
                  </div>

                  <div className="flex justify-between">
                  <Button
                    size="lg"
                    radius="lg"
                    variant="flat"
                    onPress={() => setStep("types")}
                    className="bg-slate-700/50 text-slate-200 font-medium px-6"
                    startContent={<ArrowLeft size={18} />}
                  >
                    <Typography as="span" variant="body" className="text-sm">
                      Back
                    </Typography>
                  </Button>
                  <Button
                    size="lg"
                    radius="lg"
                    onPress={() => setStep("confirm")}
                    className="bg-slate-100 text-slate-800 font-semibold px-8 hover:bg-white"
                    endContent={<ArrowRight size={18} />}
                  >
                    <Typography as="span" variant="body" className="text-sm">
                      Review Settings
                    </Typography>
                  </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: Confirmation - Review & Start */}
              {step === "confirm" && (
                <motion.div
                  key="confirm"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                <div className="text-center mb-10">
                  <Typography as="h2" variant="h2" className="text-3xl text-slate-50 mb-3">
                    Review & Confirm
                  </Typography>
                  <Typography as="p" variant="body" className="text-slate-400 max-w-md mx-auto">
                    Please review your settings before starting the organization process.
                  </Typography>
                </div>

                  <div className="bg-slate-700/30 rounded-2xl border border-slate-600/30 p-8 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-600/30">
                        <div className="flex items-center gap-3 mb-3">
                          <FolderOpen size={18} className="text-slate-400" />
                          <Typography as="span" variant="caption" className="text-slate-400 tracking-wider font-bold">
                            Source
                          </Typography>
                        </div>
                        <Typography as="p" variant="mono" className="text-sm text-slate-200 break-all">
                          {sourcePath}
                        </Typography>
                      </div>

                      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-600/30">
                        <div className="flex items-center gap-3 mb-3">
                          <Archive size={18} className="text-slate-400" />
                          <Typography as="span" variant="caption" className="text-slate-400 tracking-wider font-bold">
                            Destination
                          </Typography>
                        </div>
                        <Typography as="p" variant="mono" className="text-sm text-slate-200 break-all">
                          {destPath}
                        </Typography>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-600/30 text-center">
                        <Zap size={24} className="text-slate-400 mx-auto mb-2" />
                        <Typography as="p" variant="h4" className="text-2xl text-slate-100">
                          {getSelectedExtCount()}
                        </Typography>
                        <Typography as="p" variant="caption" className="text-slate-400 tracking-wider mt-1">
                          File Types
                        </Typography>
                      </div>

                      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-600/30 text-center">
                        <Shield size={24} className="text-slate-400 mx-auto mb-2" />
                        <Typography as="p" variant="h4" className="text-2xl text-slate-100">
                          {ignoredDirs.length}
                        </Typography>
                        <Typography as="p" variant="caption" className="text-slate-400 tracking-wider mt-1">
                          Ignored Folders
                        </Typography>
                      </div>

                      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-600/30 text-center">
                        <Layers size={24} className="text-slate-400 mx-auto mb-2" />
                        <Typography as="p" variant="h4" className="text-2xl text-slate-100">
                          {organizeLabel}
                        </Typography>
                        <Typography as="p" variant="caption" className="text-slate-400 tracking-wider mt-1">
                          Organization
                        </Typography>
                      </div>

                      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-600/30 text-center">
                        <RotateCcw size={24} className="text-slate-400 mx-auto mb-2" />
                        <Typography as="p" variant="h4" className="text-2xl text-slate-100">
                          {renameEnabled ? "On" : "Off"}
                        </Typography>
                        <Typography as="p" variant="caption" className="text-slate-400 tracking-wider mt-1">
                          Renaming
                        </Typography>
                      </div>
                    </div>

                    {/* Safety Notice */}
                    <div className="flex items-start gap-3 p-4 bg-slate-500/50 border border-slate-700 rounded-xl">
                      <Info className="text-slate-100 flex-shrink-0 mt-0.5" size={18} />
                      <div>
                        <Typography as="p" variant="label" className="text-sm text-slate-50">
                          Safety Information
                        </Typography>
                        <Typography as="p" variant="body-sm" className="text-xs text-slate-100/80 mt-1">
                          Files will be <strong>moved</strong> (not copied) to the destination. Duplicate filenames will
                          be automatically renamed. Empty source folders will be cleaned up after processing. Metadata
                          renaming runs only when enabled.
                        </Typography>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                  <Button
                    size="lg"
                    radius="lg"
                    variant="flat"
                    onPress={() => setStep("rename")}
                    className="bg-slate-700/50 text-slate-200 font-medium px-6"
                    startContent={<ArrowLeft size={18} />}
                  >
                    <Typography as="span" variant="body" className="text-sm">
                      Back
                    </Typography>
                  </Button>
                  <Button
                    size="lg"
                    radius="lg"
                    onPress={startOrganization}
                    className="bg-slate-50 text-slate-900 font-semibold px-10 hover:bg-slate-100/70"
                    startContent={<MonitorPlay size={18} />}
                  >
                    <Typography as="span" variant="body" className="text-sm">
                      Start Organization
                    </Typography>
                  </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: Processing */}
              {step === "processing" && (
                <motion.div
                  key="processing"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center min-h-[500px]"
                >
                  <div className="text-center mb-10">
                    <Typography as="h2" variant="h2" className="text-3xl text-slate-50 mb-3">
                      Processing Files
                    </Typography>
                    <Typography as="p" variant="body" className="text-slate-400">
                      Please wait while your files are being organized...
                    </Typography>
                  </div>

                  <div className="relative mb-10">
                    <CircularProgress
                      size="lg"
                      value={progress}
                      showValueLabel
                      classNames={{
                        svg: "w-48 h-48",
                        indicator: "stroke-emerald-400",
                        track: "stroke-slate-700",
                        value: "text-3xl font-bold text-slate-100",
                      }}
                      formatOptions={{ style: "percent" }}
                    />
                  </div>

                  <div className="w-full max-w-md space-y-4">
                    {errorMessage && (
                      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
                        <Typography as="p" variant="body-sm" className="text-rose-200 text-xs">
                          {errorMessage}
                        </Typography>
                      </div>
                    )}
                    <Progress
                      value={progress}
                      classNames={{
                        track: "bg-slate-700",
                        indicator: "bg-gradient-to-r from-emerald-500 to-emerald-400",
                      }}
                    />

                    <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-600/50 rounded-lg">
                          <FileText size={14} className="text-slate-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Typography as="p" variant="caption" className="text-slate-400 tracking-wider mb-1">
                            Current File
                          </Typography>
                          <Typography as="p" variant="mono" className="text-sm text-slate-200 truncate">
                            {currentFile}
                          </Typography>
                        </div>
                      </div>
                    </div>

                    {/* Live Stats */}
                    {stats && (
                      <div className="grid grid-cols-4 gap-2">
                        <MiniStat icon={<FileImage size={12} />} value={stats.photos} label="Photos" />
                        <MiniStat icon={<FileVideo size={12} />} value={stats.videos} label="Videos" />
                        <MiniStat icon={<Music size={12} />} value={stats.audio} label="Audio" />
                        <MiniStat icon={<Package size={12} />} value={stats.archives} label="Archives" />
                      </div>
                    )}

                    <Button
                      variant="flat"
                      onPress={() => setShowCancelModal(true)}
                      className="w-full bg-slate-700/50 text-slate-300 mt-4"
                    >
                      <Typography as="span" variant="body" className="text-sm text-slate-300">
                        Cancel Operation
                      </Typography>
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 6: Done */}
              {step === "done" && (
                <motion.div
                  key="done"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center min-h-[500px]"
                >
                

                  <Typography as="h2" variant="h2" className="text-3xl text-slate-50 mb-3">
                    Organization Complete 🎉
                  </Typography>
                  <Typography as="p" variant="body" className="text-slate-400 mb-10 text-center max-w-md">
                    Your files have been successfully organized into the destination folder.
                  </Typography>

                  {displayStats && (
                    <div className="bg-slate-700/30 rounded-2xl border border-slate-600/30 p-8 w-full max-w-lg mb-8">
                      <Typography
                        as="h3"
                        variant="caption"
                        className="text-slate-400 tracking-wider mb-4 text-center font-bold"
                      >
                        Final Results
                      </Typography>
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard icon={<FileImage size={18} />} label="Photos" value={displayStats.photos} />
                        <StatCard icon={<FileVideo size={18} />} label="Videos" value={displayStats.videos} />
                        <StatCard icon={<Music size={18} />} label="Audio" value={displayStats.audio} />
                        <StatCard icon={<Package size={18} />} label="Archives" value={displayStats.archives} />
                        <StatCard icon={<FileText size={18} />} label="Documents" value={displayStats.documents} />
                        <StatCard
                          icon={<AlertTriangle size={18} />}
                          label="Errors"
                          value={displayStats.errors}
                          isError={displayStats.errors > 0}
                        />
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-600/30 text-center">
                        <Typography as="p" variant="h2" className="text-3xl text-slate-100">
                          {displayStats.processed}
                        </Typography>
                        <Typography as="p" variant="caption" className="text-slate-400 tracking-wider mt-1">
                          Total Files Processed
                        </Typography>
                      </div>
                    </div>
                  )}

                  <Button
                    size="lg"
                    radius="lg"
                    onPress={resetToSetup}
                    className="bg-slate-100 text-slate-800 font-semibold px-10 hover:bg-white"
                    startContent={<RotateCcw size={18} />}
                  >
                    <Typography as="span" variant="body" className="text-sm">
                      Start New Session
                    </Typography>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Cancel Modal */}
      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} backdrop="blur">
        <ModalContent className="bg-slate-800 border border-slate-700">
          <ModalHeader className="text-slate-100">
            <Typography as="h4" variant="h4" className="text-slate-100">
              Cancel Operation?
            </Typography>
          </ModalHeader>
          <ModalBody>
            <Typography as="p" variant="body" className="text-slate-300">
              Are you sure you want to cancel the current operation? Files that have already been moved will remain in
              their new location.
            </Typography>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setShowCancelModal(false)} className="bg-slate-700 text-slate-200">
              <Typography as="span" variant="label" className="text-slate-200">
                Continue Processing
              </Typography>
            </Button>
            <Button color="danger" onPress={handleCancelProcess}>
              <Typography as="span" variant="label">
                Cancel Operation
              </Typography>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 bg-slate-800/80 backdrop-blur-sm border-t border-slate-700/30">
          <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Typography as="span" variant="body-sm" className="text-[10px] text-slate-500">
                Copyright (c) {currentYear} {app.author}
              </Typography>
              <Typography as="span" variant="body-sm" className="hidden sm:inline text-[10px] text-slate-500">
                |
              </Typography>
              <a
                href={app.links.license}
                target="_blank"
                rel="noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Typography as="span" variant="body-sm" className="text-[10px]">
                  {app.license} License
                </Typography>
              </a>
              <Typography as="span" variant="body-sm" className="hidden sm:inline text-[10px] text-slate-500">
                |
              </Typography>
              <a
                href={app.links.repository}
                target="_blank"
                rel="noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Typography as="span" variant="body-sm" className="text-[10px]">
                  Repository
                </Typography>
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Typography as="span" variant="caption" className="text-[10px] text-slate-500 tracking-widest">
                {app.name} v{app.version}
              </Typography>
              <Typography as="span" variant="body-sm" className="text-[10px] text-slate-500">
                Local Processing Only
              </Typography>
              <a
                href={app.links.repository}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Github size={14} />
              </a>
              <a
                href={app.links.linkedin}
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Linkedin size={14} />
              </a>
            </div>
          </div>
        </footer>

      </div>
    );
  }

  function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
    return (
      <div className="bg-slate-700/30 rounded-lg p-2 text-center border border-slate-600/20">
        <div className="text-slate-400 flex justify-center mb-1">{icon}</div>
        <Typography as="p" variant="label" className="text-sm text-slate-200">
          {value}
        </Typography>
        <Typography as="p" variant="caption" className="text-[8px] text-slate-500">
          {label}
        </Typography>
      </div>
    );
  }

  function StatCard({
    icon,
    label,
    value,
    isError = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    isError?: boolean;
  }) {
  return (
    <div
      className={`rounded-xl p-4 border flex items-center gap-3 ${
        isError && value > 0
          ? "bg-rose-500/10 border-rose-500/30"
          : "bg-slate-800/50 border-slate-600/30"
      }`}
    >
      <div className={isError && value > 0 ? "text-rose-400" : "text-slate-400"}>{icon}</div>
      <div>
        <Typography
          as="p"
          variant="h4"
          className={`text-xl ${isError && value > 0 ? "text-rose-300" : "text-slate-100"}`}
        >
          {value.toLocaleString()}
        </Typography>
        <Typography as="p" variant="caption" className="text-[9px] text-slate-400 tracking-wider">
          {label}
        </Typography>
      </div>
    </div>
  );
}
