#!/bin/bash

VIDEO_FILE=$1
echo "Input video is $VIDEO_FILE"

rm -f "${VIDEO_FILE}_cut.mp4"
rm -f "${VIDEO_FILE}_rotated.mp4"
rm -f "${VIDEO_FILE}_overlay.mp4"

OVERLAY_DIR=$2
echo "Overlay directory is $OVERLAY_DIR"
ls -l "$OVERLAY_DIR"


FRAMERATE=$3
echo "Framerate will be $FRAMERATE fps"

CUT_VIDEO_START=$4
CUT_VIDEO_END=$5

VIDEO_DURATION=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 $VIDEO_FILE)
echo "Video duration is $VIDEO_DURATION"

FRAME_COUNT=$(bc <<< "($VIDEO_DURATION*$FRAMERATE) / 1")
echo "Frame count is $FRAME_COUNT"
echo "Start cutting..."
sleep 2


ffmpeg -ss $CUT_VIDEO_START -to $CUT_VIDEO_END -i $VIDEO_FILE -c copy "${VIDEO_FILE}_cut.mp4" 
echo "Done with cutting."
echo "Start rotation and zoom"
sleep 2

ffmpeg -i "${VIDEO_FILE}_cut.mp4" -framerate $FRAMERATE \
-itsoffset 0.0 -frames:v $FRAME_COUNT -i ${OVERLAY_DIR}/%06d.png -y \
-itsoffset 0.0 -i ${OVERLAY_DIR}/%06d.png -y \
-filter_complex "[0:v][1:v]overlay=x=0:y=0" -frames:v $FRAME_COUNT \
-map 0:a "${VIDEO_FILE}_overlay.mp4"  
echo "Done overlaying data. Script finished."
