#!/bin/bash

INPUT="FSAA25_EnduranceRounded.csv"
CONFIG="config.yml"
OUTPUT="FSAAEndu"

# Set initial frame offset
INITIAL_OFFSET=75000

# This is the base command
BASE_COMMAND="pnpm run render -i $INPUT -c $CONFIG -o $OUTPUT"

# Loop indefinitely
while true; do
    # Find the last rendered frame index in the output directory
    LAST_FRAME=$(find "$OUTPUT" -maxdepth 1 -type f -name '*.png' -printf '%f\n' 2>/dev/null | sort | tail -n 1)
    echo $LAST_FRAME

    if [ -n "$LAST_FRAME" ]; then
        # Extract frame number from filename like 000123.png → 123
        FRAME_INDEX=$(basename "$LAST_FRAME" .png | sed 's/^0*//')
        # Default to initial offset if parsing failed
        if [ -z "$FRAME_INDEX" ]; then
            FRAME_INDEX=$INITIAL_OFFSET
        fi
        RESUME_ARG="--resume $((FRAME_INDEX + 1))"
        echo "Resuming from frame $((FRAME_INDEX + 1))"
    else
        RESUME_ARG="--resume $INITIAL_OFFSET"
        echo "Starting from frame $INITIAL_OFFSET"
    fi

    # Run the command with resume argument
    $BASE_COMMAND $RESUME_ARG

    # Check the exit code of the last command
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 136 ]; then
        echo "Command failed with exit code 136 (Floating point exception). Restarting in 5 seconds..."
        sleep 1
    elif [ $EXIT_CODE -ne 0 ]; then
        echo "Command failed with a different exit code ($EXIT_CODE). Exiting."
        sleep 1
        #exit $EXIT_CODE
    else
        echo "Command completed successfully."
        break
    fi
done
