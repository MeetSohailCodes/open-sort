<div align="center">
  <img src="assets/icon.png" alt="Archivist Logo" width="120" />

  <h1>Archivist</h1>

  <p>
    <strong>A local-first media organizer that sorts photos, videos, audio, archives, and documents into a clean folder structure.</strong>
    <br />
    Runs with a React + Electron UI and a FastAPI backend, keeping all processing securely on your machine.
  </p>

  <p>
    <!-- Badges -->
    <a href="https://github.com/MeetSohailCodes/Archivist/releases"><img src="https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white" alt="Platform: Windows" /></a>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white" alt="Python 3.9+" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License: MIT" /></a>
  </p>

  <p>
    <a href="#download">Download</a> •
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>

<br />

## Why Archivist?

Bringing order to your digital chaos with a privacy-first approach.

- 🔒 **Local-First Processing**: No uploads, everything stays on your machine.
- 📂 **Smart Organization**: Automatically categorizes files by type, year, and month.
- ⚡ **Modern Stack**: Built with React, Electron, and a robust FastAPI backend.
- 🏷️ **Metadata Power**: Uses file creation dates and metadata for accurate sorting.

---

## Download

<div align="center">
<a href="https://github.com/MeetSohailCodes/Archivist/releases/tag/v1.0" style="display: inline-flex; align-items: center; text-decoration: none; height:40px; background-color: #0078D4; color: white; padding: 0 16px; border-radius: 6px;">
  <img src="assets/icon.png" alt="Download for Windows" width="24" height="24" style="margin-right: 8px; filter: brightness(0) invert(1);">
  <span style="font-size: 1em;"><b>Download for Windows</b></span>
</a>
</div>

---

## Screenshots

**App Overview**
![App Screenshot](docs/screenshots/preview.png)

**Sample Workflow**

| Step | Screenshot |
|------|:----------|
| 1    | ![Initial](docs/screenshots/image.png)           |
|      | ⏬                                           |
| 2    | ![Step 2](docs/screenshots/image1.png)         |
|      | ⏬                                           |
| 3    | ![Step 3](docs/screenshots/image2.png)         |
|      | ⏬                                           |
| 4    | ![Step 4](docs/screenshots/image3.png)         |
|      | ⏬                                           |
| 5    | ![Step 5](docs/screenshots/image4.png)         |
|      | ⏬                                           |
| 6    | ![Step 6](docs/screenshots/image5.png)         |


## Features
- Organize by category, year, or month
- Optional metadata-based renaming with label and date strategies
- File type filters and ignored folder controls
- Live progress updates and basic stats
- Local-only processing (no uploads)

## Tech Stack
- Frontend: React, Vite, Tailwind CSS, HeroUI, Framer Motion
- Backend: FastAPI, Uvicorn, Pillow
- Desktop shell: Electron

## Quick Start (Dev)
1) Install root dependencies:
   - `npm install`
2) Install frontend dependencies:
   - `cd frontend && npm install`
3) Install backend dependencies:
   - `python -m venv backend/venv`
   - `backend/venv/Scripts/pip install -r backend/requirements.txt`
4) Start the backend:
   - `python backend/main.py`
5) Start the frontend:
   - `cd frontend && npm run dev`

Optional: run the Electron shell (expects the backend to be running):
- `npm run dev`

## Build
- Frontend build: `npm run build:frontend`
- Backend build (Windows): `npm run build:backend`
- Full package: `npm run dist`

## Configuration
Update product metadata and links in:
- `frontend/src/config/index.config.ts`

## Screenshot Notes
The screenshot is a placeholder. Replace `docs/screenshots/app-preview.svg` with your real screenshot while keeping the same filename, or update the README image path.

## Contributing
See `CONTRIBUTING.md`.

## Security
See `SECURITY.md`.

## License
MIT. See `LICENSE`.
