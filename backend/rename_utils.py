import re
from datetime import datetime
from pathlib import Path

ALLOWED_RENAME_STRATEGIES = {"date_original", "datetime_original", "label_date"}
ALLOWED_LABEL_POSITIONS = {"prefix", "suffix"}
ALLOWED_DATE_POSITIONS = {"prefix", "suffix", "none"}
INVALID_FILENAME_RE = re.compile(r"[<>:\"/\\|?*\x00-\x1F]")


def normalize_rename_strategy(strategy: str | None) -> str:
    if strategy in ALLOWED_RENAME_STRATEGIES:
        return strategy
    return "datetime_original"


def normalize_label_position(position: str | None) -> str:
    if position in ALLOWED_LABEL_POSITIONS:
        return position
    return "prefix"


def normalize_date_position(position: str | None) -> str:
    if position in ALLOWED_DATE_POSITIONS:
        return position
    return "prefix"


def sanitize_filename(value: str) -> str:
    cleaned = INVALID_FILENAME_RE.sub("_", value).strip().strip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or "file"


def format_prefix(dt: datetime, strategy: str) -> str:
    if strategy in {"date_original", "label_date"}:
        return dt.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d_%H%M%S")


def build_renamed_filename(
    original_path: Path,
    dt: datetime,
    strategy: str,
    label: str | None = None,
    label_position: str | None = None,
    date_position: str | None = None,
) -> str:
    strategy = normalize_rename_strategy(strategy)

    if strategy == "label_date":
        cleaned_label = sanitize_filename(label or "") if label else ""
        cleaned_label = cleaned_label.strip("_")
        date_str = format_prefix(dt, strategy)
        name_parts = [p for p in [cleaned_label, date_str] if p]
        name_core = sanitize_filename("_".join(name_parts))
        suffix = original_path.suffix
        max_core_len = max(40, 240 - len(suffix))
        if len(name_core) > max_core_len:
            name_core = name_core[:max_core_len].rstrip(" ._")
        return f"{name_core}{suffix}"

    label_position = normalize_label_position(label_position)
    date_position = normalize_date_position(date_position)

    stem = original_path.stem
    date_str = format_prefix(dt, strategy) if date_position != "none" else None
    cleaned_label = sanitize_filename(label or "") if label else ""
    cleaned_label = cleaned_label.strip("_")

    prefix_parts = []
    suffix_parts = []

    if date_str and date_position == "prefix":
        prefix_parts.append(date_str)
    if cleaned_label and label_position == "prefix":
        prefix_parts.append(cleaned_label)

    if cleaned_label and label_position == "suffix":
        suffix_parts.append(cleaned_label)
    if date_str and date_position == "suffix":
        suffix_parts.append(date_str)

    name_parts = [p for p in prefix_parts + [stem] + suffix_parts if p]
    name_core = sanitize_filename("_".join(name_parts))
    suffix = original_path.suffix
    max_core_len = max(40, 240 - len(suffix))
    if len(name_core) > max_core_len:
        name_core = name_core[:max_core_len].rstrip(" ._")
    return f"{name_core}{suffix}"
