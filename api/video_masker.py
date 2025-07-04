import os
import shutil
import cv2
import torch
import numpy as np
import supervision as sv
from PIL import Image
from sam2.build_sam import build_sam2_video_predictor, build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection 
from utils.track_utils import sample_points_from_masks
from utils.video_utils import create_video_from_images
from datetime import datetime
import subprocess
from utils.demo_utils import change_video, get_video_info

"""
Step 1: Environment settings and model initialization
"""
# use bfloat16 for the entire notebook
torch.autocast(device_type="cuda", dtype=torch.bfloat16).__enter__()

if torch.cuda.get_device_properties(0).major >= 8:
    # turn on tfloat32 for Ampere GPUs (https://pytorch.org/docs/stable/notes/cuda.html#tensorfloat-32-tf32-on-ampere-devices)
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

# init sam image predictor and video predictor model
sam2_checkpoint = "./checkpoints/sam2.1_hiera_large.pt"
model_cfg = "configs/sam2.1/sam2.1_hiera_l.yaml"

video_predictor = build_sam2_video_predictor(model_cfg, sam2_checkpoint)
sam2_image_model = build_sam2(model_cfg, sam2_checkpoint)
image_predictor = SAM2ImagePredictor(sam2_image_model)

# init grounding dino model from huggingface
model_id = "IDEA-Research/grounding-dino-tiny"
device = "cuda" if torch.cuda.is_available() else "cpu"
processor = AutoProcessor.from_pretrained(model_id)
grounding_model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id).to(device)

def save_frames(input_video_path: str, video_dir: str):
    vidcap = cv2.VideoCapture(input_video_path)
    fps = vidcap.get(cv2.CAP_PROP_FPS)
    max_frames = fps * 10
    success, image = vidcap.read()
    count = 1
    while success and count <= max_frames:
        cv2.imwrite(os.path.join(video_dir, f"{count:05d}.jpg"), image)
        success, image = vidcap.read()
        count += 1
    vidcap.release()

def save_frames2(input_video_path: str, video_dir: str, info):
    stream = info["streams"][0]
    fps_str = stream["r_frame_rate"]
    fps = eval(fps_str) if fps_str != "0/0" else 30
    width = stream["width"]
    height = stream["height"]
    max_frames = int(fps * 30)

    ffmpeg_cmd = [
        "ffmpeg",
        "-i", input_video_path,
        "-f", "image2pipe",
        "-pix_fmt", "rgb24",
        "-vcodec", "rawvideo",
        "-"
    ]

    process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE, bufsize=10**8)

    frame_size = width * height * 3
    count = 1

    while count <= max_frames:
        raw_frame = process.stdout.read(frame_size)
        if not raw_frame:
            break

        # Convert bytes to numpy array
        frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((height, width, 3))

        # Save as JPEG
        img = Image.fromarray(frame)
        img.save(os.path.join(video_dir, f"{count:05d}.jpg"), "JPEG")

        count += 1

    process.stdout.close()
    process.wait()


def mask_video(input_video_path: str, prompt: str, output_video_path: str):
    change_video(input_video_path, clip_frames=300)
    current_time = datetime.now().time()
    video_dir = f"api/input/{current_time}"
    os.makedirs(video_dir)
    
    save_frames(input_video_path, video_dir)
    # info = get_video_info(input_video_path)
    # save_frames2(input_video_path, video_dir, info)

    # scan all the JPEG frame names in this directory
    frame_names = [
        p for p in os.listdir(video_dir)
        if os.path.splitext(p)[-1] in [".jpg", ".jpeg", ".JPG", ".JPEG"]
    ]
    frame_names.sort(key=lambda p: int(os.path.splitext(p)[0]))
    # init video predictor state
    try:
        inference_state = video_predictor.init_state(video_path=video_dir)
    except RuntimeError as e:
        print("CUDA ran out of memory. Check logs: sudo journatlctl -u video-masking -n 20")
        return -1, "CUDA ran out of memory."
    ann_frame_idx = 0  # the frame index we interact with
    ann_obj_id = 1  # give a unique id to each object we interact with (it can be any integers)

    """
    Step 2: Prompt Grounding DINO and SAM image predictor to get the box and mask for specific frame
    """

    # prompt grounding dino to get the box coordinates on specific frame
    img_path = os.path.join(video_dir, frame_names[ann_frame_idx])
    image = Image.open(img_path)

    # run Grounding DINO on the image
    inputs = processor(images=image, text=prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = grounding_model(**inputs)

    results = processor.post_process_grounded_object_detection(
        outputs,
        inputs.input_ids,
        box_threshold=0.25,
        text_threshold=0.3,
        target_sizes=[image.size[::-1]]
    )
    # prompt SAM image predictor to get the mask for the object
    image_predictor.set_image(np.array(image.convert("RGB")))

    # process the detection results
    input_boxes = results[0]["boxes"].cpu().numpy()
    OBJECTS = results[0]["labels"]

    if input_boxes.size == 0:
        print(f"Nothing detected for {prompt}")
        return -1, "Nothing detected"

    # prompt SAM 2 image predictor to get the mask for the object
    masks, scores, logits = image_predictor.predict(
        point_coords=None,
        point_labels=None,
        box=input_boxes,
        multimask_output=False,
    )

    # convert the mask shape to (n, H, W)
    if masks.ndim == 3:
        masks = masks[None]
        scores = scores[None]
        logits = logits[None]
    elif masks.ndim == 4:
        masks = masks.squeeze(1)

    """
    Step 3: Register each object's positive points to video predictor with seperate add_new_points call
    """

    PROMPT_TYPE_FOR_VIDEO = "box" # or "point"

    assert PROMPT_TYPE_FOR_VIDEO in ["point", "box", "mask"], "SAM 2 video predictor only support point/box/mask prompt"

    # If you are using point prompts, we uniformly sample positive points based on the mask
    if PROMPT_TYPE_FOR_VIDEO == "point":
        # sample the positive points from mask for each objects
        all_sample_points = sample_points_from_masks(masks=masks, num_points=10)

        for object_id, (label, points) in enumerate(zip(OBJECTS, all_sample_points), start=1):
            labels = np.ones((points.shape[0]), dtype=np.int32)
            _, out_obj_ids, out_mask_logits = video_predictor.add_new_points_or_box(
                inference_state=inference_state,
                frame_idx=ann_frame_idx,
                obj_id=object_id,
                points=points,
                labels=labels,
            )
    # Using box prompt
    elif PROMPT_TYPE_FOR_VIDEO == "box":
        for object_id, (label, box) in enumerate(zip(OBJECTS, input_boxes), start=1):
            _, out_obj_ids, out_mask_logits = video_predictor.add_new_points_or_box(
                inference_state=inference_state,
                frame_idx=ann_frame_idx,
                obj_id=object_id,
                box=box,
            )
    # Using mask prompt is a more straightforward way
    elif PROMPT_TYPE_FOR_VIDEO == "mask":
        # print(masks)
        for object_id, (label, mask) in enumerate(zip(OBJECTS, masks), start=1):
            labels = np.ones((1), dtype=np.int32)
            _, out_obj_ids, out_mask_logits = video_predictor.add_new_mask(
                inference_state=inference_state,
                frame_idx=ann_frame_idx,
                obj_id=object_id,
                mask=mask
            )
    else:
        raise NotImplementedError("SAM 2 video predictor only support point/box/mask prompts")

    """
    Step 4: Propagate the video predictor to get the segmentation results for each frame
    """
    video_segments = {}  # video_segments contains the per-frame segmentation results
    for out_frame_idx, out_obj_ids, out_mask_logits in video_predictor.propagate_in_video(inference_state):
        video_segments[out_frame_idx] = {
            out_obj_id: (out_mask_logits[i] > 0.0).cpu().numpy()
            for i, out_obj_id in enumerate(out_obj_ids)
        }
    
    """
    Step 5: Visualize the segment results across the video and save them
    """
    save_dir = f"./api/tracking_results/{current_time}"
    os.makedirs(save_dir)

    ID_TO_OBJECTS = {i: obj for i, obj in enumerate(OBJECTS, start=1)}
    for frame_idx, segments in video_segments.items():
        img = cv2.imread(os.path.join(video_dir, frame_names[frame_idx]))
        
        object_ids = list(segments.keys())
        masks = list(segments.values())
        masks = np.concatenate(masks, axis=0)
        
        detections = sv.Detections(
            xyxy=sv.mask_to_xyxy(masks),  # (n, 4)
            mask=masks, # (n, h, w)
            class_id=np.array(object_ids, dtype=np.int32),
        )
        # box_annotator = sv.BoxAnnotator()
        # annotated_frame = box_annotator.annotate(scene=img.copy(), detections=detections)
        # label_annotator = sv.LabelAnnotator()
        # annotated_frame = label_annotator.annotate(annotated_frame, detections=detections, labels=[ID_TO_OBJECTS[i] for i in object_ids])
        color = sv.Color(117, 216, 230)
        mask_annotator = sv.MaskAnnotator(color=color)
        annotated_frame = mask_annotator.annotate(scene=img.copy(), detections=detections)
        cv2.imwrite(os.path.join(save_dir, f"annotated_frame_{frame_idx:05d}.jpg"), annotated_frame)
    
    """
    Step 6: Convert the annotated frames to video
    """
    create_video_from_images(save_dir, output_video_path)
    change_video(output_video_path, force=True)

    shutil.rmtree(video_dir)
    shutil.rmtree(save_dir)

    print("Masking complete.")
    return 0, "Masking complete"

if __name__ == "__main__":
    mask_video("./api/uploads/dance4.mp4", "person.", "./api/dance3.mp4")