import os
import shutil
import re
import asyncio
from pathlib import Path
from datetime import datetime
from PIL import Image
from rename_utils import (
    build_renamed_filename,
    normalize_rename_strategy,
    normalize_label_position,
    normalize_date_position,
)
from log_utils import log_line

# Optimized File Categories
EXTENSIONS = {
    'Photos': {'.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.raw', '.dng'},
    'Videos': {'.mp4', '.mov', '.avi', '.3gp', '.mkv', '.wmv', '.m4v', '.mpg', '.mpeg', '.flv', '.webm'},
    'Audio':  {'.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac', '.amr', '.wma', '.opus'},
    'Archives': {'.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.iso'},
    'Documents': {'.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xlsx', '.xls', '.ppt', '.pptx', '.json', '.xml', '.html', '.htm', '.apk', '.exe', '.msi', '.ai', '.psd'}
}

DEFAULT_IGNORED_DIRS = {
    "node_modules",
    "windows",
    "system volume information",
    "recycler",
    "$recycle.bin",
    "__pycache__",
    ".git",
    ".venv",
    "venv",
    "dist",
    "build",
}

def normalize_extensions_map(extensions_map):
    if not extensions_map:
        return {k: set(v) for k, v in EXTENSIONS.items()}
    normalized = {}
    for cat, exts in extensions_map.items():
        cleaned = set()
        for ext in exts or []:
            if not ext:
                continue
            ext = ext.strip().lower()
            if not ext:
                continue
            if not ext.startswith("."):
                ext = f".{ext}"
            cleaned.add(ext)
        normalized[cat] = cleaned
    return normalized

def normalize_extensions_list(exts):
    cleaned = set()
    for ext in exts or []:
        if not ext:
            continue
        ext = ext.strip().lower()
        if not ext:
            continue
        if not ext.startswith("."):
            ext = f".{ext}"
        cleaned.add(ext)
    return cleaned

class MediaOrganizer:
    def __init__(
        self,
        source_dir: str,
        dest_dir: str,
        organize_by_month: bool = False,
        organize_mode: str | None = None,
        extensions_by_category: dict | None = None,
        ignored_dirs: list | None = None,
        ignored_extensions: list | None = None,
        rename_enabled: bool = False,
        rename_strategy: str | None = None,
        rename_label: str | None = None,
        rename_label_position: str | None = None,
        rename_date_position: str | None = None,
    ):
        self.source_dir = Path(source_dir)
        self.dest_dir = Path(dest_dir)
        self.organize_mode = organize_mode or ("month" if organize_by_month else "year")
        self.organize_by_month = self.organize_mode == "month"
        self.stop_event = False
        self.extensions_by_category = normalize_extensions_map(extensions_by_category)
        self.allowed_extensions = set().union(*self.extensions_by_category.values()) if self.extensions_by_category else set()
        self.ignored_dirs = {d.strip().lower() for d in (ignored_dirs or DEFAULT_IGNORED_DIRS) if d and d.strip()}
        self.ignored_extensions = normalize_extensions_list(ignored_extensions)
        self.rename_enabled = bool(rename_enabled)
        self.rename_strategy = normalize_rename_strategy(rename_strategy)
        self.rename_label = rename_label or ""
        self.rename_label_position = normalize_label_position(rename_label_position)
        self.rename_date_position = normalize_date_position(rename_date_position)
        
        log_line("--- NEW RUN ---")
        log_line(f"Source: {self.source_dir}")
        log_line(f"Dest: {self.dest_dir}")
        log_line(f"Mode: {self.organize_mode}")

        # Stats
        self.stats = {
            'processed': 0, 'total': 0, 'errors': 0,
            'photos': 0, 'videos': 0, 'audio': 0, 'archives': 0, 'documents': 0, 'other': 0
        }

    def get_category(self, ext: str) -> str:
        ext = ext.lower()
        for cat, exts in self.extensions_by_category.items():
            if ext in exts:
                return cat
        return 'Other'

    def get_date(self, file_path: Path):
        # 1. Metadata (EXIF)
        try:
            if file_path.suffix.lower() in EXTENSIONS['Photos']:
                img = Image.open(file_path)
                exif = img._getexif()
                if exif:
                    for tag in [36867, 306]:
                        if tag in exif:
                            return datetime.strptime(exif[tag], "%Y:%m:%d %H:%M:%S"), "Metadata"
        except: pass
        
        # 2. Filename (YYYYMMDD)
        match = re.search(r'(20[0-2]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])', file_path.name)
        if match:
             return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3))), "Filename"
             
        # 3. System Date
        return datetime.fromtimestamp(os.path.getmtime(file_path)), "System"

    async def scan_files(self):
        """Scans source directory and returns total count"""
        files = []
        # Use absolute paths but don't force resolve() if it causes issues on some Windows setups
        source_path = self.source_dir.absolute()
        dest_path = self.dest_dir.absolute()
        
        log_line(f"SCAN START: {source_path}")

        try:
            common_path = os.path.commonpath([str(source_path), str(dest_path)])
        except Exception:
            common_path = ""
        dest_inside_source = common_path == str(source_path)
        source_inside_dest = common_path == str(dest_path)
        output_dirs = {c.lower() for c in self.extensions_by_category.keys()} | {"other"}
        log_line(f"PATH RELATION: dest_inside_source={dest_inside_source}, source_inside_dest={source_inside_dest}")

        for root, dirs, filenames in os.walk(str(source_path)):
            current_path = Path(root).absolute()
            log_line(f"Visit: {current_path}")

            # Skip ignored directories
            dirs[:] = [d for d in dirs if d.lower() not in self.ignored_dirs]

            # If organizing in-place, avoid scanning output category folders
            if source_path == dest_path and self.organize_mode != "category":
                dirs[:] = [d for d in dirs if d.lower() not in output_dirs]

            # Prune destination directory when it is inside source
            if dest_inside_source and dest_path != source_path:
                dirs[:] = [d for d in dirs if (current_path / d).absolute() != dest_path]

            # Check for recursions/destinations
            if dest_inside_source and dest_path != source_path:
                try:
                    if dest_path == current_path or dest_path in current_path.parents:
                        log_line(f"Skip Dest: {current_path}")
                        continue
                except Exception as e:
                    log_line(f"Check Error: {e}")

            for f in filenames:
                if f.startswith('.') or f == 'Thumbs.db':
                    continue

                file_path = Path(root) / f
                ext = file_path.suffix.lower()
                if ext in self.ignored_extensions:
                    continue
                if self.allowed_extensions and ext not in self.allowed_extensions:
                    continue

                files.append(file_path)

        log_line(f"SCAN END: Found {len(files)}")
                
        self.stats['total'] = len(files)
        return files

    def cleanup_empty_dirs(self):
        """Removes empty directories in source to clean up"""
        print("DEBUG: Cleaning up empty directories...")
        # Walk bottom-up
        for root, dirs, files in os.walk(self.source_dir, topdown=False):
            for d in dirs:
                try:
                    p = Path(root) / d
                    # Only delete if empty
                    if not any(p.iterdir()):
                        p.rmdir()
                except: pass

    async def run(self, progress_callback=None):
        files = await self.scan_files()
        
        if not self.dest_dir.exists():
            self.dest_dir.mkdir(parents=True)

        for file_path in files:
            if self.stop_event: break
            
            
            try:
                cat = self.get_category(file_path.suffix)
                date_obj, method = self.get_date(file_path)
                
                if self.stats['processed'] == 0:
                     print(f"DEBUG: Processing first file: {file_path.name}")
                     print(f"DEBUG: Config - By Month: {self.organize_by_month}")
                     print(f"DEBUG: Detected Category: {cat}, Date: {date_obj}")
                
                # Category Stats
                if cat.lower() in self.stats: self.stats[cat.lower()] += 1
                else: self.stats['other'] += 1

                # Layout: Dest / Category / [Year] / [Month] / Filename
                if self.organize_mode == "category":
                    target_path = self.dest_dir / cat
                else:
                    target_path = self.dest_dir / cat / str(date_obj.year)
                    if self.organize_mode == "month":
                        target_path = target_path / date_obj.strftime("%m-%B")
                
                if not target_path.exists(): target_path.mkdir(parents=True)

                # Move/Copy
                if self.organize_mode == "category" and self.source_dir == self.dest_dir:
                    if file_path.parent.resolve() == target_path.resolve():
                        continue
                dest_name = file_path.name
                if self.rename_enabled:
                    dest_name = build_renamed_filename(
                        file_path,
                        date_obj,
                        self.rename_strategy,
                        label=self.rename_label,
                        label_position=self.rename_label_position,
                        date_position=self.rename_date_position,
                    )
                dest_file = target_path / dest_name
                dest_stem = Path(dest_name).stem
                counter = 1
                while dest_file.exists():
                    dest_file = target_path / f"{dest_stem}_{counter}{file_path.suffix}"
                    counter += 1
                
                shutil.move(str(file_path), str(dest_file))
                
                self.stats['processed'] += 1
                
                if progress_callback:
                    await progress_callback({
                        "file": file_path.name,
                        "progress": (self.stats['processed'] / self.stats['total']) * 100,
                        "stats": self.stats
                    })
                    
                # Yield control to allow async updates
                await asyncio.sleep(0.001)

            except Exception as e:
                self.stats['errors'] += 1
                print(f"Error: {e}")
                
        self.cleanup_empty_dirs()
        return self.stats
