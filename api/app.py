import streamlit as st
import requests
import os
import cv2
from PIL import Image
from pathlib import Path
import tempfile
import streamlit.components.v1 as components
import gdown
from google.cloud import storage
import subprocess
import json

import sys
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(parent_dir)

from utils.demo_utils import change_video# , is_av1_encoded

# --- CONFIGURE these for your bucket
GCS_BUCKET_NAME = "video-masking"
GCS_DESTINATION_PATH = "uploads/"   # folder inside the bucket

# @st.cache_resource
# def get_gcs_client():
#     # Instantiates the GCS client using your credentials
#     return storage.Client()

def upload_to_gcs(file_obj, destination_blob_path):
    """Uploads an open file-like object to GCS."""
    client = storage.Client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(destination_blob_path)
    # upload_from_file will stream in chunks, avoiding a full-file read:
    blob.upload_from_file(file_obj, rewind=True)
    # return blob.public_url      # or blob.generate_signed_url(...)

def download_blob_to_stream(bucket_name, source_blob_name, file_obj):
    """Downloads a blob to a stream or other file-like object."""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(source_blob_name)
    blob.download_to_filename(file_obj)
    # return file_obj

favicon = Image.open("./api/favicon.png")

# --- App Configuration ---
st.set_page_config(
    page_title="Video Masking App",
    page_icon=favicon,
    layout="centered",
    initial_sidebar_state="auto",
)

video_paths = [
    "api/samples/comedy.mp4",
    "api/samples/dog.mp4",
    "api/samples/cups.mp4",
    # "api/samples/coffee.mp4",
    "api/samples/default_juggle.mp4"
]

logo = Image.open("./api/orbifold_logo.png")

st.logo(logo)
st.title("Video Masking")

st.markdown(
    """
    Upload a video and specify a text prompt to mask objects in the video.
    """
)

# --- File Uploader ---
uploaded_file = st.file_uploader(
    "Choose a video file.", type=["mp4", "mov", "avi", "mkv"]
)

# if uploaded_file and is_av1_encoded(uploaded_file.getvalue()):
#     file_type_error = st.error("Video with av1 encoding detected. Please use a video with h.264 encoding.")
#     exit(1)

# if uploaded_file:
#     upload_to_gcs(uploaded_file, uploaded_file.name)

# upload_widget = """
# <div style="margin: 1em 0;">
#   <input type="file" id="fileInput" style="display:block; margin-bottom:8px;" />
#   <button onclick="uploadFile()" style="padding:8px 16px;">Upload to API</button>
#   <pre id="status" style="margin-top:8px; color: #444;"></pre>
# </div>

# <script>
# async function uploadFile() {
#   const file = document.getElementById('fileInput').files[0];
#   if (!file) {
#     document.getElementById('status').textContent = "No file selected.";
#     return;
#   }
#   const statusEl = document.getElementById('status');
#   statusEl.textContent = `Uploading "${file.name}"…`;

#   // build the multipart form
#   const form = new FormData();
#   form.append("file", file);

#   try {
#     const resp = await fetch("/api/upload", {
#       method: "POST",
#       body: form,
#     });
#     if (!resp.ok) throw new Error(`Status ${resp.status}`);
#     const data = await resp.json();
#     statusEl.textContent = `✅ Uploaded: ${data.filename} (${data.size} bytes)`;
#   } catch (err) {
#     statusEl.textContent = `❌ Upload failed: ${err}`;
#   }
# }
# </script>
# """

# components.html(upload_widget, height=200, scrolling=False)

# --- URL Input for Google Drive or GCS ---
# gdrive_url = st.text_input("Or, upload to the public GCS bucket. Bucket name: video-masking. Folder: uploads/. Enter the file name here.")

gdrive_url = None

if uploaded_file or gdrive_url:
    st.session_state.selected_video = None

if "selected_video" not in st.session_state:
    st.session_state.selected_video = None

def select_video(path):
    st.session_state.selected_video = path

selected_video = None

col1, col2 = st.columns(2)
with col1:
    st.video(video_paths[0])
    cols1 = st.columns(10)
    if cols1[4].button(f"A", key=f"select_0"):
        selected_video = video_paths[0]
        select_video(video_paths[0])
with col2:
    st.video(video_paths[1])
    cols2 = st.columns(10)
    if cols2[4].button(f"B", key=f"select_1"):
        selected_video = video_paths[1]
        select_video(video_paths[1])
col3, col4 = st.columns(2)
with col3:
    st.video(video_paths[2])
    cols3 = st.columns(10)
    if cols3[4].button(f"C", key=f"select_2"):
        selected_video = video_paths[2]
        select_video(video_paths[2])
with col4:
    st.video(video_paths[3])
    cols4 = st.columns(10)
    if cols4[4].button(f"D", key=f"select_3"):
        selected_video = video_paths[3]
        select_video(video_paths[3])
# ⼝
if selected_video and st.session_state.selected_video == selected_video and not uploaded_file:
    base_name = os.path.basename(selected_video)
    st.markdown(f"Selected: {base_name}")

# --- Text Input for Prompt ---
prompt = st.text_input("Enter a text prompt for masking (e.g., 'person', 'car')")

API_URL = "http://localhost:9445/mask-video"
VIDEO_SERVER_URL = "http://masking.orbifold.ai/videos/"

button = st.button("Process Video")

status = st.empty()
output = st.empty()

if st.session_state.selected_video:
    uploaded_file = st.session_state.selected_video

if not uploaded_file and not gdrive_url and not prompt and button:
    status.error("Missing file/URL and prompt.")
elif (uploaded_file or gdrive_url) and not prompt and button:
    status.error("Missing prompt. Enter a prompt.")
elif not (uploaded_file or gdrive_url) and prompt and button:
    status.error("Missing file/URL. Upload a file or enter a URL.")
elif (uploaded_file or gdrive_url) and prompt and button:
    status.info("Processing video... Please wait. Estimated wait time is around 1 to 5 minutes, depending on length and fps.")
    output.empty()

    data = {"prompt": prompt}
    file_name = ""
    if gdrive_url:
        # os.makedirs("FIRST")
        file_name = gdrive_url
        download_blob_to_stream("video-masking", "uploads/" + gdrive_url, "api/uploads/" + gdrive_url)
        # data["url"] = gdrive_url
        # files = {"file": (None, b"")}  # Dummy file to force multipart
        with open("api/uploads/" + gdrive_url, "rb") as f:
            video_bytes = f.read()
        files = {"file": (gdrive_url, video_bytes, "video/mp4")}
    elif isinstance(uploaded_file, str):
        # Sample video selected
        with open(uploaded_file, "rb") as f:
            video_bytes = f.read()
        file_name = os.path.basename(uploaded_file)
        files = {"file": (file_name, video_bytes, "video/mp4")}
    else:
        # Uploaded file
        file_name = uploaded_file.name
        files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "video/mp4")}
    try:
        # --- Send Request to FastAPI ---
        response = requests.post(API_URL, files=files, data=data)
        response.raise_for_status()  # Raise an exception for bad status codes

        # --- Handle Response ---
        result = response.json()
        print(result.get("status"))
        if result.get("status") == "Failure":
            message = result.get("message")
            status.info(f"Something went wrong: {message}")
        else:
            output_filename = os.path.basename(result.get("output_file"))
            print(output_filename)
            status.empty()
            if output_filename:
                # --- Display Masked Video ---
                status.success("Video processed successfully!")
                video_url = f"{VIDEO_SERVER_URL}{output_filename}"
                print(video_url)
                output.video(video_url)
            else:
                status.error("Something went wrong. The server did not return a valid file.")

    except requests.exceptions.RequestException as e:
        status.error(f"An error occurred while communicating with the server: {e}")
    except Exception as e:
        status.error(f"An unexpected error occurred: {e}")
