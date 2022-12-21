#!/bin/bash

VIDEO_FILE=$1
echo "Input video is $VIDEO_FILE"

OVERLAY_DIR=$2
echo "Overlay directory is $OVERLAY_DIR"

FRAMERATE=$3
echo "Framerate will be $FRAMERATE fps"

VIDEO_DURATION=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 $VIDEO_FILE)
echo "Video duration is $VIDEO_DURATION"

FRAME_COUNT=$(bc <<< "($VIDEO_DURATION*$FRAMERATE) / 1")
echo "Frame count is $FRAME_COUNT"

sleep 2

ffmpeg -i $VIDEO_FILE -framerate $FRAMERATE \
-itsoffset 0.0 -i ${OVERLAY_DIR}/%06d.png -y \
-filter_complex [0:v]overlay=x=0:y=0:enable="between(t\,0/$FRAMERATE\,$FRAME_COUNT/$FRAMERATE)"[out] \
-map [out] -map 0:a "${VIDEO_FILE}_overlay.mp4" 