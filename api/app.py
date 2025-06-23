import streamlit as st
import requests
import os

# --- App Configuration ---
st.set_page_config(
    page_title="Video Masking App",
    page_icon="🎥",
    layout="centered",
    initial_sidebar_state="auto",
)

# --- UI Elements ---
st.title("Video Masking with Grounded-SAM-2")
st.markdown(
    """
    Upload a video and specify a text prompt to mask objects in the video.
    """
)

# --- File Uploader ---
uploaded_file = st.file_uploader(
    "Choose a video file", type=["mp4", "mov", "avi", "mkv"]
)

# --- Text Input for Prompt ---
prompt = st.text_input("Enter a text prompt for masking (e.g., 'person', 'car')")

API_URL = "http://localhost:8000/mask-video/"
VIDEO_SERVER_URL = "http://localhost:8000/static/"

button = st.button("Process Video")

status = st.empty()
output = st.empty()

if uploaded_file and prompt and button:
    status.info("Processing video... Please wait.")
    output.empty()

    # --- Prepare Request ---
    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "video/mp4")}
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
            output.video(video_url)
        else:
            status.error("Something went wrong. The server did not return a valid file.")

    except requests.exceptions.RequestException as e:
        status.empty()
        st.error(f"An error occurred while communicating with the server: {e}")
    except Exception as e:
        status.empty()
        st.error(f"An unexpected error occurred: {e}")
