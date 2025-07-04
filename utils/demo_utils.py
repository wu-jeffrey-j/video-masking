import subprocess
import json
import os

def get_video_info(filepath):
    """
    Runs ffprobe and returns parsed stream info.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        filepath
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return json.loads(result.stdout)

def is_browser_compatible(info):
    has_h264 = False
    has_aac = False
    for s in info["streams"]:
        if s["codec_type"] == "video" and s["codec_name"] == "h264":
            has_h264 = True
        if s["codec_type"] == "audio" and s["codec_name"] == "aac":
            has_aac = True
    return has_h264 and has_aac

def is_av1(info):
    av1 = False
    for s in info["streams"]:
        if s["codec_type"] == "video" and s["codec_name"] == "h264":
            av1 = True
    return av1

def is_av1_encoded(video_bytes):
    try:
        # Use ffmpeg to get video information
        process = subprocess.Popen(
            [
                'ffmpeg',
                '-f', 'mp4',
                '-i', 'pipe:',
                '-map', '0:v:0',
                '-c:v', 'copy',
                '-f', 'null', '-'
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        stdout, stderr = process.communicate(input=video_bytes)

        # Check if AV1 is in the output
        return "codec=av1" in str(stderr, 'utf-8').lower(), None

    except FileNotFoundError:
        return False, "ffmpeg command not found. Please install ffmpeg."
    except Exception as e:
        return False, str(e)

def change_video(input_file: str, clip_secs: int = None, clip_frames: int = None, force: bool = False):
    if not force:
        info = get_video_info(input_file)
        if is_browser_compatible(info):
            print("Browser compatible")
            return
        else:
            print("Needs to be converted to h.264. Re-encoding...")
    
    if clip_secs is not None and clip_frames is not None:
        print("Too many arguments error.")
        return

    temp_path = input_file + ".tmp.mp4"
    cmd = ["ffmpeg", "-i", input_file,
           "-c:v", "libx264",
        #    "-profile:v", "baseline",
        #    "-level", "3.0",
           "-preset", "fast",
           "-c:a", "aac"]
           # "-movflags", "+faststart"]

    if clip_secs is not None:
        cmd += ["-t", str(clip_secs)]

    if clip_frames is not None:
        cmd += ["-frames:v", str(clip_frames)]
        
    cmd.append(temp_path)
    subprocess.run(cmd, check=True)
    os.replace(temp_path, input_file)

if __name__ == "__main__":
    change_video("../api/uploads/dance1.mp4", 30)