# Data Overlay - Roadmap & Future Ideas

This document tracks planned features and "cool ideas" to take the Formula Student telemetry overlay to the next level.

## 🚀 Feature Ideas

| Feature | Description | Status | Priority |
| :--- | :--- | :--- | :--- |
| **GPS Track Map** | A 2D track outline generated from GPS coordinates with a real-time "moving dot" indicator. | ✅ Done | High |
| **G-G Diagram** | A friction circle diagram showing acceleration/braking vs. cornering with a fading trail. | ⏳ Planned | Medium |
| **Integrated FFmpeg** | Automatically trigger the video merge after the parallel render finishes. | ⏳ Planned | High |
| **Lap Timer & Delta** | Show current lap time and a +/- delta bar compared to the session's fastest lap. | ⏳ Planned | Medium |
| **Tire Heatmaps** | Visual tire icons that change color based on IR temperature sensors. | ⏳ Planned | Low |
| **Live Preview** | A mode to instantly preview a single frame while editing `config.yml`. | ⏳ Planned | Medium |
| **Suspension Travel** | Vertical bars showing shock potentiometer (shock pot) movement per wheel. | ⏳ Planned | Low |
| **Dynamic Scaling** | Auto-scale graph axes based on session min/max values. | ⏳ Planned | Medium |

---

## 🛠 Implementation Notes

### 1. GPS Track Map
- Requires scanning `Gyro_Movella_GPS_Longitude` and `Latitude` during `init`.
- Needs to handle coordinate projection (mapping lat/long to XY pixels).
- Should allow static background (the track) and dynamic foreground (the car).

### 2. G-G Diagram
- Use `Gyro_Movella_Acc_X` and `Acc_Y`.
- Implement a "tail" using a history buffer (similar to the current acceleration trail but persistent on a scatter plot).

### 3. Integrated FFmpeg
- Add an `--ffmpeg` flag to `parallel-render.js`.
- Use `fluent-ffmpeg` or a simple `spawn` call to run the final encoding step once all worker promises resolve.

### 4. Live Preview
- Could be a simple CLI flag `--preview` that renders exactly 1 frame and opens it in the default system viewer.
