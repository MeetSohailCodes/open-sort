import os
import asyncio
from pathlib import Path
from organizer import MediaOrganizer

# Create dummy structure
params = {
    "src": "test_src",
    "dest": "test_dest",
}

def setup_test_files():
    os.makedirs("test_src/subfolder/nested", exist_ok=True)
    os.makedirs("test_dest", exist_ok=True)
    
    with open("test_src/file1.txt", "w") as f: f.write("test")
    with open("test_src/subfolder/file2.jpg", "w") as f: f.write("test")
    with open("test_src/subfolder/nested/file3.mp4", "w") as f: f.write("test")

def clean_test_files():
    import shutil
    if os.path.exists("test_src"): shutil.rmtree("test_src")
    if os.path.exists("test_dest"): shutil.rmtree("test_dest")

async def run_test():
    print("--- Starting Test ---")
    setup_test_files()
    
    src = os.path.abspath("test_src")
    dest = os.path.abspath("test_dest")
    
    print(f"Test Source: {src}")
    print(f"Test Dest: {dest}")
    
    org = MediaOrganizer(src, dest, organize_by_month=True)
    files = await org.scan_files()
    
    print(f"Files Found: {len(files)}")
    for f in files:
        print(f" - {f}")
        
    print("--- Cleaning up ---")
    clean_test_files()

if __name__ == "__main__":
    asyncio.run(run_test())
