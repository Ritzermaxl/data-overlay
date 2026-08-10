#!/usr/bin/env python3
"""Create a renderer-ready CSV from a local or Marple-hosted MDF log."""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
import yaml
from asammdf import MDF


TOKEN_KEYS = ("MARPLE_API_TOKEN", "MARPLE_API_KEY", "API_TOKEN", "API_KEY")
CHANNEL_OPTION_SUFFIXES = ("DataChannel", "signal", "steeringAngle")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="data-overlay-prepare",
        description="Fetch an MDF from Marple when needed and prepare its configured channels.",
    )
    parser.add_argument("filename", help="local MDF path or MDF filename in Marple")
    parser.add_argument("-c", "--config", default="config.yml", help="overlay YAML (default: config.yml)")
    parser.add_argument("-s", "--start-time", type=float, default=0.0, help="start in seconds from log start")
    parser.add_argument("-e", "--end-time", type=float, help="end in seconds from log start")
    parser.add_argument("-o", "--output", help="output CSV path (default: <input stem>.csv)")
    parser.add_argument("--no-marple", action="store_true", help="only use a local MDF; do not call Marple")
    parser.add_argument("--keep-mdf", action="store_true", help="keep an MDF downloaded from Marple")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


def log(message: str, *, verbose_only: bool = False) -> None:
    if not verbose_only or ARGS.verbose:
        print(message, file=sys.stderr)


def read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_config(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"config file not found: {path}")
    config = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not config.get("videoFps", 0) > 0:
        raise ValueError("config.videoFps must be greater than zero")
    return config


def configured_channels(config: dict[str, Any]) -> list[str]:
    channels: list[str] = []
    for complication in config.get("complications", []):
        options = complication.get("options", {})
        for key, value in options.items():
            if isinstance(value, str) and key.endswith(CHANNEL_OPTION_SUFFIXES):
                channels.append(value)
        channel_template = options.get("channelTemplate")
        if isinstance(channel_template, str):
            for wheel in ("FL", "FR", "RL", "RR"):
                for channel in range(1, 9):
                    channels.append(
                        channel_template
                        .replace("{wheel}", wheel)
                        .replace("{channel}", str(channel))
                    )
    return list(dict.fromkeys(channels))


def marple_client(config: dict[str, Any]):
    try:
        from marple import DB
    except ImportError as error:
        raise RuntimeError("Marple support requires: pip install marpledata") from error

    dotenv = read_dotenv(Path(".env"))
    token = next(
        (os.environ.get(key) or dotenv.get(key) for key in TOKEN_KEYS if os.environ.get(key) or dotenv.get(key)),
        None,
    )
    if not token:
        raise RuntimeError(f"Marple API key missing; set one of: {', '.join(TOKEN_KEYS)}")
    api_url = os.environ.get("MARPLE_DB_URL") or dotenv.get("MARPLE_DB_URL")
    return DB(api_token=token, api_url=api_url) if api_url else DB(api_token=token)


def find_dataset(db: Any, stream: str, filename: str) -> dict[str, Any] | None:
    datasets = db.get_datasets(stream)
    if isinstance(datasets, dict):
        datasets = datasets.get("datasets", [])
    matches = [item for item in datasets if Path(item.get("path", "")).name == filename]
    if not matches:
        return None
    return max(matches, key=lambda item: item.get("created_at", 0))


def download_original(db: Any, stream: str, dataset: dict[str, Any], destination: Path) -> None:
    """Download through the SDK, with a fallback for its absolute-URL bug in 2.2.1."""
    try:
        db.download_original(stream, str(dataset["id"]), str(destination.parent))
        downloaded = destination.parent / Path(dataset["path"]).name
        if downloaded != destination:
            downloaded.replace(destination)
        return
    except requests.HTTPError as error:
        log(f"SDK downloader failed ({error}); using its Marple backup-link endpoint", verbose_only=True)

    stream_id = dataset.get("datastream_id")
    response = db.get(f"/stream/{stream_id}/dataset/{dataset['id']}/backup")
    response.raise_for_status()
    download_url = response.json()["path"]
    if not str(download_url).startswith(("https://", "http://")):
        download_url = f"{db.api_url}/download/{str(download_url).lstrip('/')}"
    with requests.get(download_url, stream=True, timeout=(30, 300)) as response:
        response.raise_for_status()
        with destination.open("wb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    output.write(chunk)


def resolve_mdf(filename: str, config: dict[str, Any]) -> tuple[Path, tempfile.TemporaryDirectory[str] | None]:
    path = Path(filename).expanduser()
    if ARGS.no_marple:
        if not path.is_file():
            raise FileNotFoundError(f"local MDF not found: {path}")
        return path, None

    settings = config.get("dataPreprocessing", {})
    stream = settings.get("marpleStream", "MDF_Datalogger")

    if path.is_file():
        return path, None

    db = marple_client(config)
    dataset = find_dataset(db, stream, path.name)
    if dataset is None:
        raise FileNotFoundError(f"{path.name} is neither local nor present in Marple stream {stream}")

    if ARGS.keep_mdf:
        target = Path.cwd() / path.name
        temporary = None
    else:
        temporary = tempfile.TemporaryDirectory(prefix="data-overlay-")
        target = Path(temporary.name) / path.name
    log(f"Downloading Marple dataset {dataset['id']} ({path.name}) ...")
    download_original(db, stream, dataset, target)
    return target, temporary


def resolve_sources(mdf: MDF, outputs: list[str], aliases: dict[str, Any]) -> dict[str, str]:
    available = set(mdf.channels_db)
    resolved: dict[str, str] = {}
    missing: list[str] = []
    for output in outputs:
        candidates = [output, *aliases.get(output, [])]
        source = next((candidate for candidate in candidates if candidate in available), None)
        if source:
            resolved[output] = source
        else:
            missing.append(f"{output} (tried: {', '.join(candidates)})")
    if missing:
        raise ValueError("MDF is missing configured channels:\n  " + "\n  ".join(missing))
    return resolved


def prepare_csv(mdf_path: Path, output_path: Path, config: dict[str, Any]) -> int:
    settings = config.get("dataPreprocessing", {})
    outputs = configured_channels(config)
    if not outputs:
        raise ValueError("no data channels were found in config.complications")
    fps = float(config["videoFps"])
    if ARGS.start_time < 0 or (ARGS.end_time is not None and ARGS.end_time <= ARGS.start_time):
        raise ValueError("time range must satisfy 0 <= start-time < end-time")

    with MDF(mdf_path) as mdf:
        sources = resolve_sources(mdf, outputs, settings.get("channelAliases", {}))
        signals = {}
        for output, source in sources.items():
            source_candidates = [source, *settings.get("channelAliases", {}).get(output, [])]
            source_candidates = [name for name in dict.fromkeys(source_candidates) if name in mdf.channels_db]
            selected_candidate = None
            for source_name in source_candidates:
                candidate_signals = []
                for group, index in mdf.channels_db[source_name]:
                    candidate_signals.append((source_name, group, index, mdf.get(source_name, group=group, index=index)))
                best = max(candidate_signals, key=lambda candidate: candidate[3].timestamps.size)
                if best[3].timestamps.size:
                    selected_candidate = best
                    break
            if selected_candidate is None:
                raise ValueError(f"configured channel and its aliases have no samples: {output}")
            source, group, index, signal = selected_candidate
            occurrences = mdf.channels_db[source]
            if len(occurrences) > 1:
                log(
                    f"{source}: using MDF occurrence ({group}, {index}) with the most samples "
                    f"({signal.timestamps.size})",
                    verbose_only=True,
                )
            if source != output:
                log(f"Renaming {source} -> {output}", verbose_only=True)
            signals[output] = signal

    available_stop = max(float(signal.timestamps[-1]) for signal in signals.values() if signal.timestamps.size)
    stop = available_stop if ARGS.end_time is None else min(ARGS.end_time, available_stop)
    if stop <= ARGS.start_time:
        raise ValueError(f"requested start {ARGS.start_time}s is beyond available data ({available_stop}s)")

    # Exact frame timestamps: arange avoids accumulating a rounded 0.016666 step.
    source_raster = np.arange(ARGS.start_time, stop + 0.5 / fps, 1.0 / fps)
    source_raster = source_raster[source_raster <= stop + np.finfo(float).eps * 10]
    frame_time = np.arange(source_raster.size, dtype=float) / fps
    frame = pd.DataFrame({"timestamps": frame_time})
    smoothed = set(settings.get("movingAverageChannels", []))
    window_ms = float(settings.get("movingAverageMs", 100))

    for output, signal in signals.items():
        timestamps = np.asarray(signal.timestamps, dtype=float)
        samples = pd.to_numeric(pd.Series(signal.samples), errors="coerce").to_numpy(dtype=float)
        valid = np.isfinite(timestamps) & np.isfinite(samples)
        timestamps, samples = timestamps[valid], samples[valid]
        if not timestamps.size:
            log(f"WARNING: {output} has no finite samples; filling requested range with 0")
            frame[output] = 0.0
            continue
        if output in smoothed:
            series = pd.Series(samples, index=pd.to_timedelta(timestamps, unit="s"))
            series = series.groupby(level=0).mean().rolling(f"{window_ms}ms", center=True, min_periods=1).mean()
            timestamps = series.index.total_seconds().to_numpy()
            samples = series.to_numpy()
        unique_timestamps, unique_indices = np.unique(timestamps, return_index=True)
        channel_start = float(unique_timestamps[0])
        channel_stop = float(unique_timestamps[-1])
        if channel_start > ARGS.start_time or channel_stop < stop:
            log(
                f"WARNING: {output} is only available from {channel_start:g}s to {channel_stop:g}s; "
                f"filling unavailable parts of requested range {ARGS.start_time:g}s to {stop:g}s with 0"
            )
        frame[output] = np.interp(
            source_raster,
            unique_timestamps,
            samples[unique_indices],
            left=0.0,
            right=0.0,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(output_path, index=False, float_format="%.6f")
    return len(frame)


def main() -> None:
    config = load_config(Path(ARGS.config))
    mdf_path, temporary = resolve_mdf(ARGS.filename, config)
    try:
        output = Path(ARGS.output) if ARGS.output else Path(Path(ARGS.filename).stem + ".csv")
        rows = prepare_csv(mdf_path, output, config)
        log(f"Wrote {rows} frames to {output} at {float(config['videoFps']):g} fps")
    finally:
        if temporary is not None:
            temporary.cleanup()


ARGS = parse_args()
if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, RuntimeError, ValueError, requests.RequestException) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
