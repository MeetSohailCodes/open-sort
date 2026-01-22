from fastapi import FastAPI, WebSocket, HTTPException, status
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import asyncio
import os
from organizer import MediaOrganizer
from log_utils import log_line

app = FastAPI()

# Allow local frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OrganizeRequest(BaseModel):
    sourcepath: str
    destpath: str
    organize_by_month: bool = False

# Global Status
current_task = None

@app.get("/health")
def health():
    return {"status": "ok", "message": "Organizer Engine Ready"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print("WebSocket: Connection attempt")
    log_line("WebSocket: Connection attempt")
    
    # Auth Check
    token = websocket.query_params.get("token")
    expected_token = os.environ.get("ARCHIVIST_TOKEN")
    
    if expected_token and token != expected_token:
        print(f"Auth Failed. Expected {expected_token[:5]}..., Got {token[:5]}...")
        log_line("WS ERROR: Authentication Failed")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    print("WebSocket: Connection accepted")
    log_line("WebSocket: Connection accepted")
    await websocket.send_json({"type": "status", "msg": "Connected to backend"})
    global current_task
    try:
        while True:
            print("WebSocket: Waiting for message...")
            data = await websocket.receive_json()
            print(f"WebSocket: Received data: {data}")
            log_line(f"WebSocket: Received data: {data}")
            command = data.get("command")
            
            if command == "start":
                source = data.get("source")
                dest = data.get("dest")
                by_month = data.get("by_month", False)
                config = data.get("config") or {}
                organize_mode = config.get("organize_mode")
                extensions_by_category = config.get("extensions_by_category")
                ignore_dirs = config.get("ignore_dirs")
                ignore_extensions = config.get("ignore_extensions")
                rename_config = config.get("rename") or {}
                rename_enabled = rename_config.get("enabled", False)
                rename_strategy = rename_config.get("strategy")
                rename_label = rename_config.get("label")
                rename_label_position = rename_config.get("label_position")
                rename_date_position = rename_config.get("date_position")
                
                if not source or not dest:
                    print("Error: Missing source or dest")
                    await websocket.send_json({"error": "Missing path"})
                    log_line("WS ERROR: Missing source or dest")
                    continue

                log_line(f"WS RECEIVED: Source='{source}', Dest='{dest}', Month={by_month}")
                log_line(f"WS CONFIG: mode={organize_mode}, rename_enabled={rename_enabled}, rename_strategy={rename_strategy}")

                if not os.path.isdir(source):
                    await websocket.send_json({"error": "Invalid Source Directory"})
                    log_line("WS ERROR: Invalid Source Directory")
                    continue
                    
                organizer = MediaOrganizer(
                    source,
                    dest,
                    by_month,
                    organize_mode=organize_mode,
                    extensions_by_category=extensions_by_category,
                    ignored_dirs=ignore_dirs,
                    ignored_extensions=ignore_extensions,
                    rename_enabled=rename_enabled,
                    rename_strategy=rename_strategy,
                    rename_label=rename_label,
                    rename_label_position=rename_label_position,
                    rename_date_position=rename_date_position,
                )
                
                # Callback to send progress back to UI
                async def progress_handler(info):
                    await websocket.send_json({
                        "type": "progress",
                        "data": info
                    })
                
                await websocket.send_json({"type": "status", "msg": "Scanning files..."})
                log_line("STATUS: Scanning files...")
                try:
                    stats = await organizer.run(progress_callback=progress_handler)
                    await websocket.send_json({"type": "complete", "stats": stats})
                    log_line("STATUS: Complete")
                except Exception as e:
                    await websocket.send_json({"type": "error", "error": str(e)})
                    log_line(f"ERROR: {e}")
                    await websocket.close()

    except Exception as e:
        print(f"WebSocket Error: {e}")

if __name__ == "__main__":
    import sys
    import logging
    
    # Configure basic logging for frozen apps (PyInstaller)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)] if sys.stdout else []
    )
    
    # Check if running as frozen exe (PyInstaller)
    is_frozen = getattr(sys, 'frozen', False)
    
    if is_frozen:
        # Production: disable uvicorn's logging config to avoid isatty error
        uvicorn.run(
            app,  # Pass app object directly, not string
            host="127.0.0.1",
            port=45455,
            log_config=None,  # Disable uvicorn's default logging
            reload=False
        )
    else:
        # Development: use normal config with reload
        uvicorn.run("main:app", host="127.0.0.1", port=45455, reload=True)
