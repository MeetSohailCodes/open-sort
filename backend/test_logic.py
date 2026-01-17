import asyncio
import shutil
import os
from organizer import MediaOrganizer

async def test():
    # Setup test env
    source = "test_source"
    dest = "test_dest"
    if os.path.exists(source): shutil.rmtree(source)
    if os.path.exists(dest): shutil.rmtree(dest)
    
    os.makedirs(source)
    
    # Create fake files
    with open(f"{source}/photo_20250101.jpg", "w") as f: f.write("test")
    with open(f"{source}/video_20241231.mp4", "w") as f: f.write("test")
    
    print("Running Organizer...")
    organizer = MediaOrganizer(source, dest, organize_by_month=True)
    stats = await organizer.run()
    
    print("Stats:", stats)
    
    # Verify
    if os.path.exists(f"{dest}/Photos/2025/01-January/photo_20250101.jpg"):
        print("✅ Photo Moved Correctly")
    else:
        print("❌ Photo Move Failed")

    if os.path.exists(f"{dest}/Videos/2024/12-December/video_20241231.mp4"):
        print("✅ Video Moved Correctly")
    else:
        print("❌ Video Move Failed")

    # Cleanup
    # shutil.rmtree(source)
    # shutil.rmtree(dest)

if __name__ == "__main__":
    asyncio.run(test())
