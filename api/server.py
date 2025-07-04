from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import shutil
import os
from pathlib import Path
from api.video_masker import mask_video
from utils.demo_utils import change_video
import gdown
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

@app.post("/mask-video")
async def mask_video_endpoint(file: UploadFile = File(...), prompt: str = Form()):# , url: str = Form(None)):
    prompt = clean_prompt(prompt)
    
    # info = get_video_info(file.filename)
    # if not is_browser_compatible(info):
    #     raise FormatException(status_code=400, detail="Video file encoding not accepted")
    # if url:
    #     if "drive.google.com" in url:
    #         try:
    #             downloaded_path = UPLOAD_DIR / "downloaded_video.mp4"
    #             gdown.download(url, str(downloaded_path), fuzzy=True)
    #             input_path = downloaded_path
    #             file_name = "downloaded_video.mp4"
    #         except Exception as e:
    #             raise HTTPException(status_code=400, detail=f"Failed to download video from Google Drive: {e}")
    #     elif "storage.googleapis.com" in url:
    #         try:
    #             # Assumes public GCS URL
    #             bucket_name = url.split("/")[3]
    #             source_blob_name = "/".join(url.split("/")[4:])
    #             downloaded_path = UPLOAD_DIR / "downloaded_video.mp4"
                
    #             storage_client = storage.Client()
    #             bucket = storage_client.bucket(bucket_name)
    #             blob = bucket.blob(source_blob_name)
    #             blob.download_to_filename(str(downloaded_path))
                
    #             input_path = downloaded_path
    #             file_name = "downloaded_video.mp4"
    #         except Exception as e:
    #             raise HTTPException(status_code=400, detail=f"Failed to download video from GCS: {e}")
    #     else:
    #         raise HTTPException(status_code=400, detail="Unsupported URL type")
    # elif file and file.filename:
    input_path = UPLOAD_DIR / file.filename
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # change_video(str(input_path), clip_frames=300)
    file_name = file.filename
    # else:
    #     raise HTTPException(status_code=400, detail="No file or URL provided")

    # 2. Run masking
    try:
        output_path = OUTPUT_DIR / f"masked_{file_name}"
        code, message = mask_video(str(input_path), prompt, str(output_path))
        print(f"Code: {code}")
        print(f"Message: {message}")
        if code < 0:
            return {
                "status": "Failure",
                "message": f"Code error {code}: {message}"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    base_name = os.path.basename(output_path)
    # 3. Return masked video
    return {
        "status": "Success",
        "output_file": str(base_name)
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # you can stream to disk or to S3, etc.
    try:
        with open(f"/data/uploads/{file.filename}", "wb") as out:
            # read in 1 MB chunks to avoid loading whole file in memory
            while content := await file.read(1024 * 1024):
                out.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return JSONResponse({"filename": file.filename, "size": file.spool_max_size})

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
    import uvicorn
    uvicorn.run("api.server:app", host="127.0.0.1", port=9446, reload=True)# , timeout_keep_alive=2160, keep_alive_timeout=2160)
