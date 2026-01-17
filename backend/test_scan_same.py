import os
import asyncio
from pathlib import Path
from organizer import MediaOrganizer
import shutil

def setup():
    if os.path.exists("test_single"): shutil.rmtree("test_single")
    os.makedirs("test_single/sub", exist_ok=True)
    with open("test_single/pic.jpg", "w") as f: f.write("x")
    with open("test_single/sub/vid.mp4", "w") as f: f.write("x")

async def run_test():
    setup()
    p = os.path.abspath("test_single")
    print(f"Testing Source == Dest: {p}")
    
    # Source and Dest are the SAME
    org = MediaOrganizer(p, p, False)
    files = await org.scan_files()
    
    print(f"Files Found: {len(files)}")
    for f in files: print(f"FOUND: {f.name}")
    
    # cleanup
    # shutil.rmtree("test_single")

if __name__ == "__main__":
    asyncio.run(run_test())
