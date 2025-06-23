from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import shutil
import os
from pathlib import Path
from api.video_masker import mask_video

import subprocess

app = FastAPI(title="Video Masking API")

# temp storage
UPLOAD_DIR = Path("api/uploads")
OUTPUT_DIR = Path("api/outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

def clean_prompt(prompt: str):
    clean = prompt.lower()
    if not clean.endswith('.'):
        clean += '.'
    return clean

@app.get("/")
def ping():
    return {"message": "Pinged"}

@app.post("/mask-video/")
async def mask_video_endpoint(file: UploadFile = File(...), prompt: str = Form()):
    prompt = clean_prompt(prompt)
    # 1. Save upload
    input_path = UPLOAD_DIR / file.filename
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # 2. Run masking
    try:
        output_path = OUTPUT_DIR / f"masked_{file.filename}"
        mask_video(str(input_path), prompt, str(output_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    base_name = os.path.basename(output_path)
    # 3. Return masked video
    return {"output_file": str(base_name)}

# @app.get("/videos/{filename}", response_class=FileResponse)
# async def get_video(filename: str):
#     """
#     Download a processed video by filename.
#     """
#     file_path = OUTPUT_DIR / filename
#     if not file_path.exists():
#         # 404 if the file doesn’t exist
#         raise HTTPException(status_code=404, detail="File not found")
#     # Tell FastAPI to stream the file with the right MIME type
#     return FileResponse(
#         path=str(file_path),
#         media_type="video/mp4",
#         filename=filename,
#     )

app.mount("/static", StaticFiles(directory=str(OUTPUT_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=False)
