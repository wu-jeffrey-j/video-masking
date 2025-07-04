# README

## Installation

1. **Create and activate** a Conda environment:

   ```bash
   conda create -n package python=3.11 -y
   conda activate package
   ```

2. **Install** Python dependencies (ensure your file is named `requirements.txt`):

   ```bash
   pip install -r requirements.txt
   ```

3. **Install SAM2** in editable mode:

   ```bash
   git clone https://github.com/facebookresearch/sam2.git
   cd sam2
   pip install -e .
   ```
---

## Usage

Run the main script, specifying the download directory and its subfolders:

```bash
python main.py \
  --download-dir DOWNLOAD_DIR \
  --video-subdir VIDEO_SUBDIR \
  --frame-subdir FRAME_SUBDIR \
  --output-subdir OUTPUT_SUBDIR
```

* `--download-dir`   (default: `download`)   Base directory holding all data.
* `--video-subdir`   (default: `video`)      Subfolder under `download-dir` where raw videos are stored.
* `--frame-subdir`   (default: `h264frame`)  Subfolder under `download-dir` where extracted frames will be placed.
* `--output-subdir`  (default: `img_detect`) Subfolder under `download-dir` where detection masks and JSON results will be saved.

### Workflow Summary

1. **Discover videos** in `DOWNLOAD_DIR/VIDEO_SUBDIR/`.
2. **Extract two frames** per video (first and middle) into `DOWNLOAD_DIR/FRAME_SUBDIR/`.
3. **Run detection & segmentation** on each frame:

   * Detect person bounding boxes (YOLO)
   * Generate segmentation masks (SAM)
   * Compute person-area ratio
4. **Save outputs** to `DOWNLOAD_DIR/OUTPUT_SUBDIR/`:

   * Masked images
   * `results.json` mapping each frame filename to its person-area ratio

---
