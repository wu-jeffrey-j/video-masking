import os
import sys
import shutil
import json
import logging
import argparse
from collections import defaultdict

from detection import load_models, process_image, visualize_results
import h264frame as extractor

# Thresholds for ratio filtering
RATIO_THRESHOLD = 0.15
MIN_RATIO = 0.0


def extract_file_name(path: str) -> str:
    """
    Extract the file name from a given path.
    """
    return path.split(os.sep)[-1]


def process_folder(
    frame_dir: str,
    output_folder: str,
    yolo_model,
    sam_predictor,
):
    """
    Process all images in a given person folder:
      - Run detection and segmentation
      - Save visualized results
      - Collect ratio metrics

    Returns a list of dicts mapping .insv paths to ratios.
    """

    ratios_list = []
    for filename in os.listdir(frame_dir):
        input_path = os.path.join(frame_dir, filename)
        person_boxes, combined_mask, ratio = process_image(
            input_path, yolo_model, sam_predictor
        )
        insv_path = extract_file_name(filename)

        if person_boxes is not None:
            visualize_results(
                input_path, person_boxes, combined_mask, ratio, dst_dir=output_folder
            )
            ratios_list.append({insv_path: ratio})
        else:
            # Copy images without detected persons
            dst_path = os.path.join(output_folder, f"no_person_{filename}")
            shutil.copy(input_path, dst_path)
            ratios_list.append({insv_path: -1})

    return ratios_list


def main(download_dir: str, video_subdir: str, frame_subdir: str, output_subdir: str):
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
    )
    # extract the frames from the video files
    logging.info("Extracting frames from video files...")
    video_dir = os.path.join(download_dir, video_subdir)
    logging.info(f"Video directory: {video_dir}")
    frame_dir = os.path.join(download_dir, frame_subdir)
    output_dir = os.path.join(download_dir, output_subdir)
    os.makedirs(video_dir, exist_ok=True)
    os.makedirs(frame_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    for item in os.listdir(video_dir):
        logging.info("HERE")
        if item.endswith(".insv"):
            video_path = os.path.join(video_dir, item)
            logging.info(f"Processing video: {video_path}")
            extractor.solveMp4(video_path, frame_dir)

    # Load detection & segmentation models
    yolo_model, sam_predictor = load_models()

    global_ratios = {}

    ratios_list = process_folder(
        frame_dir,
        output_dir,
        yolo_model,
        sam_predictor,
    )
    for item in ratios_list:
        for insv_file, ratio in item.items():
            if MIN_RATIO < ratio < RATIO_THRESHOLD:
                global_ratios[insv_file] = ratio

    with open(
        os.path.join(output_dir, "img_detect_ratios.json"), "w", encoding="utf-8"
    ) as f:
        json.dump(global_ratios, f, indent=4, ensure_ascii=False)

    logging.info("Processing complete. Outputs saved to img_detect/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Process H264 frames for person detection and segmentation."
    )
    parser.add_argument(
        "--download-dir", default="data", help="Base directory for downloaded data"
    )
    parser.add_argument(
        "--video-subdir", default="video", help="Directory containing video files"
    )
    parser.add_argument(
        "--frame-subdir", default="h264frame", help="Subdirectory for extracted frames"
    )
    parser.add_argument(
        "--output-subdir", default="img_detect", help="Subdirectory for output images"
    )

    args = parser.parse_args()
    main(args.download_dir, args.video_subdir, args.frame_subdir, args.output_subdir)
