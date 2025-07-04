# /home/io/workspace_yyh/video_process/download/h264frame

import os
import torch
import cv2
import numpy as np
from ultralytics import YOLO
import matplotlib.pyplot as plt
from hydra import initialize, compose
import torch
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor
import shutil


YOLO_MODEL_PATH = "yolo11l.pt"
SAM_CHECKPOINT_PATH = (
    "./checkpoints/sam2.1_hiera_base_plus.pt"
)
SAM_MODEL_CFG_PATH = os.environ.get("SAM_MODEL_CFG_PATH", "configs/sam2.1/sam2.1_hiera_b+.yaml")
IMAGE_SIZE = 640


def load_models(device="cuda"):
    yolo_model = YOLO(YOLO_MODEL_PATH)
    predictor = SAM2ImagePredictor(build_sam2(SAM_MODEL_CFG_PATH, SAM_CHECKPOINT_PATH))
    return yolo_model, predictor


def process_image(image_path, yolo_model, sam_predictor):
    image = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    image_rgb_resized = cv2.resize(image_rgb, (IMAGE_SIZE, IMAGE_SIZE))
    results = yolo_model(image_rgb_resized, verbose=False, conf=0.2)

    person_boxes = []
    for result in results:
        boxes = result.boxes
        for box in boxes:
            if box.cls == 0:
                person_boxes.append(box.xyxy[0].cpu().numpy())

    if not person_boxes:
        print("No person detected in the image!")
        return None, None, None

    with torch.inference_mode(), torch.autocast("cuda", dtype=torch.bfloat16):
        sam_predictor.set_image(image_rgb_resized)

        masks = []
        max_area = 0
        box = None
        setted = False
        # find box with largest area
        for box_ in person_boxes:
            area = (box_[2] - box_[0]) * (box_[3] - box_[1])
            if area > max_area and area / (IMAGE_SIZE * IMAGE_SIZE) < 0.8:
                max_area = area
                box = box_
                setted = True
        if not setted:
            return None, None, None

        point_coords = np.array([[(box[0] + box[2]) / 2, (box[3] + box[1]) / 2 + 10]])
        masks_np, _, _ = sam_predictor.predict(
            box=box,
            point_coords=point_coords,
            point_labels=np.array([1]),
            multimask_output=False,
        )
        mask_bool = (masks_np[0] > 0).astype(bool)  # bool
        masks.append(mask_bool)

        combined_mask = np.zeros_like(masks[0], dtype=bool)
        for mask in masks:
            combined_mask = np.logical_or(combined_mask, mask)

        total_pixels = combined_mask.shape[0] * combined_mask.shape[1]
        person_pixels = np.sum(combined_mask)
        ratio = person_pixels / total_pixels

    return person_boxes, combined_mask, ratio



def visualize_results(image_path, boxes, mask, ratio, dst_dir="./img_detect"):
    image = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_rgb_resized = cv2.resize(image_rgb, (640, 640))

    plt.figure(figsize=(10, 5))

    plt.subplot(1, 2, 1)
    plt.imshow(image_rgb_resized)
    plt.title("Original Image")
    plt.axis("off")

    plt.subplot(1, 2, 2)
    plt.imshow(image_rgb_resized)
    plt.imshow(mask, alpha=0.5)

    for box in boxes:
        plt.plot([box[0], box[2]], [box[1], box[1]], color="red", linewidth=2)
        plt.plot([box[2], box[2]], [box[1], box[3]], color="red", linewidth=2)
        plt.plot([box[2], box[0]], [box[3], box[3]], color="red", linewidth=2)
        plt.plot([box[0], box[0]], [box[1], box[3]], color="red", linewidth=2)

    plt.title(f"Segmentation (Person ratio: {ratio:.2%})")
    plt.axis("off")

    # save in another folder
    plt.savefig(os.path.join(dst_dir, image_path.split("/")[-1]))
    plt.close()
