#!/usr/bin/env python3
"""Convert a numbered PNG image sequence into an MP4 video using FFmpeg."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert images named 000000.png, 000001.png, ... to MP4."
    )
    parser.add_argument(
        "input_dir",
        nargs="?",
        type=Path,
        default=Path("FSAANeu"),
        help="directory containing the PNG sequence (default: FSAANeu)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("FSAANeu.mp4"),
        help="output video path (default: FSAANeu.mp4)",
    )
    parser.add_argument(
        "--fps", type=float, default=60, help="video frame rate (default: 60)"
    )
    parser.add_argument(
        "--overwrite", action="store_true", help="overwrite the output if it exists"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if shutil.which("ffmpeg") is None:
        print("Error: ffmpeg was not found in PATH.", file=sys.stderr)
        return 1
    if not args.input_dir.is_dir():
        print(f"Error: input directory not found: {args.input_dir}", file=sys.stderr)
        return 1
    if args.fps <= 0:
        print("Error: --fps must be greater than zero.", file=sys.stderr)
        return 1
    if not (args.input_dir / "000000.png").is_file():
        print(
            f"Error: expected the sequence to start at {args.input_dir / '000000.png'}",
            file=sys.stderr,
        )
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg",
        "-y" if args.overwrite else "-n",
        "-framerate",
        str(args.fps),
        "-start_number",
        "0",
        "-i",
        str(args.input_dir / "%06d.png"),
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(args.output),
    ]

    print("Running:", subprocess.list2cmdline(command))
    try:
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as error:
        return error.returncode

    print(f"Created {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
