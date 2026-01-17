from pathlib import Path
from datetime import datetime

def get_log_path() -> Path:
    return Path(__file__).resolve().parent / "backend_debug.log"


def log_line(message: str) -> None:
    try:
        path = get_log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(f"{datetime.now().isoformat()} | {message}\n")
    except Exception:
        pass
