#!/bin/bash

# Configuration
INPUT_DIR="test_output"
OUTPUT_FILE="test_video.mp4"
FRAMERATE=60

# Check if input directory exists
if [ ! -d "$INPUT_DIR" ]; then
    echo "Error: Directory '$INPUT_DIR' not found."
    exit 1
fi

# Join images into a video
# Using libx264 and yuv420p for broad compatibility
ffmpeg -y -framerate "$FRAMERATE" -i "$INPUT_DIR/%06d.png" -c:v libx264 -pix_fmt yuv420p "$OUTPUT_FILE"

echo "Video successfully created: $OUTPUT_FILE"
