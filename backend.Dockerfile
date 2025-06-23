FROM pytorch/pytorch:2.7.1-cuda12.8-cudnn8-devel

# Arguments to build Docker Image using CUDA
ARG USE_CUDA=0
ARG TORCH_ARCH="7.0;7.5;8.0;8.6"

ENV AM_I_DOCKER=True
ENV BUILD_WITH_CUDA="${USE_CUDA}"
ENV TORCH_CUDA_ARCH_LIST="${TORCH_ARCH}"
ENV CUDA_HOME=/usr/local/cuda-12.8/
# Ensure CUDA is correctly set up
ENV PATH=/usr/local/cuda-12.8/bin:${PATH}
ENV LD_LIBRARY_PATH=/usr/local/cuda-12.8/lib64:${LD_LIBRARY_PATH}

# Install required packages and specific gcc/g++
RUN apt-get update && apt-get install --no-install-recommends wget ffmpeg=7:* \
    libsm6=2:* libxext6=2:* git=1:* nano vim=2:* ninja-build gcc-14 g++-14 -y \
    && apt-get clean && apt-get autoremove && rm -rf /var/lib/apt/lists/*

ENV CC=gcc-14
ENV CXX=g++-14

RUN mkdir -p /home/appuser/video-masking
COPY . /home/appuser/video-masking

WORKDIR /home/appuser/video-masking

# Install essential Python packages
RUN python -m pip install --upgrade pip "setuptools>=62.3.0,<75.9" wheel numpy \
    opencv-python transformers supervision pycocotools addict yapf timm fastapi \
    

# Install segment_anything package in editable mode
RUN python -m pip install -e .

# Install grounding dino 
RUN python -m pip install --no-build-isolation -e grounding_dino
