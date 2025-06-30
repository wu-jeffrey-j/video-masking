import streamlit as st
import requests
import os
import cv2
from PIL import Image
import tempfile

from google.cloud import storage

# # --- CONFIGURE these for your bucket
# GCS_BUCKET_NAME = "video-masking"
# GCS_DESTINATION_PATH = "uploads/"   # folder inside the bucket

# @st.cache_resource
# def get_gcs_client():
#     # Instantiates the GCS client using your credentials
#     return storage.Client()

# def upload_to_gcs(file_obj, destination_blob_path):
#     """Uploads an open file-like object to GCS."""
#     client = get_gcs_client()
#     bucket = client.bucket(GCS_BUCKET_NAME)
#     blob = bucket.blob(destination_blob_path)
#     # upload_from_file will stream in chunks, avoiding a full-file read:
#     blob.upload_from_file(file_obj, rewind=True)
#     return blob.public_url      # or blob.generate_signed_url(...)

favicon = Image.open("./api/favicon.png")

# --- App Configuration ---
st.set_page_config(
    page_title="Video Masking App",
    page_icon=favicon,
    layout="centered",
    initial_sidebar_state="auto",
)

# --- UI Elements ---
# col1, col2 = st.columns([1, 5])

video_paths = [
    "api/samples/dog.mp4",
    "api/samples/cups.mp4",
    "api/samples/coffee.mp4",
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
    "Choose a video file", type=["mp4", "mov", "avi", "mkv"]
)

# if uploaded_file is not None:
#     # Create a safe temp path
#     dest = os.path.join(tempfile.gettempdir(), uploaded_file.name)
#     with open(dest, "wb") as f:
#         # read/write in 2 MB chunks
#         for chunk in uploaded_file.iter_chunks(2_000_000):
#             f.write(chunk)
#     CHUNK_SIZE = 2_000_000
#     # while chunk := await uploaded_file.read(CHUNK_SIZE):
#     st.success(f"Saved to {dest}")

if uploaded_file:
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

API_URL = "http://localhost:9446/mask-video"
VIDEO_SERVER_URL = "http://masking.orbifold.ai/videos/"

button = st.button("Process Video")

status = st.empty()
output = st.empty()

if st.session_state.selected_video:
    uploaded_file = st.session_state.selected_video

if not uploaded_file and not prompt and button:
    status.error("Missing file and prompt.")
if uploaded_file and not prompt and button:
    status.error("Missing prompt. Enter a prompt.")
elif not uploaded_file and prompt and button:
    status.error("Missing file. Upload a file.")
elif uploaded_file and prompt and button:
    status.info("Processing video... Please wait. Estimated wait time is around 1 to 3 minutes.")
    output.empty()

    if isinstance(uploaded_file, str):
        # Sample video selected
        cap = cv2.VideoCapture(uploaded_file)
        with open(uploaded_file, "rb") as f:
            video_bytes = f.read()
        file_name = os.path.basename(uploaded_file)
        files = {"file": (file_name, video_bytes, "video/mp4")}
    else:
        # Uploaded file
        cap = cv2.VideoCapture(uploaded_file.name)
        files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "video/mp4")}

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    duration = total_frames / fps if fps > 0 else 0
    cap.release()
    if duration >= 30.0:
        status.error("Video is too long. Try choosing a smaller video.")
    else:
        data = {"prompt": prompt}

        try:
            # --- Send Request to FastAPI ---
            response = requests.post(API_URL, files=files, data=data)
            response.raise_for_status()  # Raise an exception for bad status codes

            # --- Handle Response ---
            result = response.json()
            output_filename = os.path.basename(result.get("output_file"))
            # print(output_filename)
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
