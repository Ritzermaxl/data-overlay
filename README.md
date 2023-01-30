# data overlay

## Intention

This tool allows the user to overlay a video clip with data visualizations of matching measurement data. It originated out of the **Mission World Record** project conducted by the GreenTeam Uni Stuttgart but may also be applicable for any other kind of (motor)sport.  
It is fully configurable which allows the user to add as many visualizations as required.  
An example video can be found [here][yt_data_overlay]

## Workflow

In order to generate a data overlay video, three things are required:

1. A source video the overlay should be applied to
2. A CSV with measurement data matching the source video
3. A configuration file laying out the arrangement of visualization elements (called **complications**) and their respective mapping to a data channel present in the CSV file

The tool will load the CSV and - for each data point contained - render the configured arrangement of complications into a single `*.png` file. The image sequence will the be used by `ffmpeg` to create an overlay in order to render out the final video.

### On the subject of videos

The video used as source can by almost any format since `ffmpeg` is being used as transcoding tool doing the final overlay. Please consult the [`ffmpeg` documentation][ffmpeg_docs] for further information

### On the subject of measurement data

The measurement data has to be provided as CSV file, resampled to a fixed sample rate matching the desired frame rate of the final video. This is required so that each data point contained in the CSV file can be rendered into one frame containing the overlay graphics.

### On the subject of configuration files

The configuration file enables the user to configure the desired layout of complications as well as their mapping to a specific data channel. It is defined in `*.yml` format and follows a well-defined structure. Different options are available per complication to enable for further customization. Complications are rendered with respect to the order of their occurrence in the configuration file with the first complication being on the "lowest" layer and the last complication being rendered "on top" .
The basic layout of the configuration file is as follows:

```yml
---
# source and destination video width in pixels
videoWidth: 1920
# source and destination video height in pixels
videoHeight: 1080
# destination video frame rate in frames per second (fps)
videoFps: 24
# list of configured complications
# for more information on complication configuration please see below
complications:
  - type: <name of complication type>
    x: <x position in pixels relative to the left edge of the frame>
    y: <y position in pixels relative to the top edge of the frame>
    width: <width of the complication in pixels>
    height: <height of the complication in pixels>
    options: {} # complication-specific options
```

### On the subject of complications

#### rectangle

The `rectangle` complication is not a real complication in the classical sence. It mereley allows the user to draw a filled rectangle with defined color to serve as a unified, semi-transparent (if configured) background for other complications. The configuration allows for the following values:

```yml
complications:
  - type: rectangle
    x: 0
    y: 0
    width: 1920
    height: 400
    options:
      # background color of the rectangle as RBGA values ranging from 0.0 to 1.0
      # for a (alpha), 0 is fully transparent and 1 is fully opaque
      background:
        r: 0.0
        g: 0.0
        b: 0.0
        a: 0.75
```

#### acceleration

The `acceleration` complication draws a circular visualization of x and y acceleration. The maximal displayable acceleration in either direction is 3g. The data channels for x and y acceleration respectively have to be mapped and the final values are expected to be in g. If the measurement data CSV provides the acceleration in a different format, the `xAccelerationFactor` and `yAccelerationFactor` may be used to scale the measurement data.  
Example:  
Assuming the measurement data CSV file provides its values in `m/s^2`, the factor to be applied is `0.10193` (`1 / 9.81`, assuming `1g` is `9.81 m/s^2`)
| option | description | required | default value |
| --------------------------------------- | --------------------------------------------------- | -------- | ------------- |
| xAccelerationDataChannel | data channel for x acceleration value | true | - |
| yAccelerationDataChannel | data channel for y acceleration value | true | - |
| xAccelerationFactor | scaling factor for x acceleration value | true | - |
| yAccelerationFactor | scaling factor for y acceleration value | true | - |
| indicatorSize | size of the moving indicator | true | - |
| indicatorBufferSize | number of displayed predecessor frames for the trail of the moving indicator | true | - |
| indicatorBufferFalloff | faintness of displayed predecessor frames for the trail of the moving indicator | true | - |

```yml
complications:
  - type: acceleration
    width: 300
    height: 300
    x: 50
    y: 50
    options:
      xAccelerationDataChannel: <xAccelerationDataChannel>
      yAccelerationDataChannel: <yAccelerationDataChannel>
      xAccelerationFactor: 0.10193
      yAccelerationFactor: 0.10193
      indicatorSize: 15
      indicatorBufferSize: 10
      indicatorBufferFalloff: 0.8
```

#### text

The `text` complication renders static or dynamic text to the given position. The text can be configured to be static or dynamic. If the text is configured to be dynamic, the data channel to be used for the text value has to be provided. The text can be configured to have a pre- and/or suffix that is statically displayed (e.g. for units).  
In addition to that, a padding can be configured, so that unused digits will be padded with a defined padding character. This is useful if the text is expected to have a fixed length.
Also, a scaling factor can be applied to the numeric channel data before rendering it as text to scale it similar to the `xAccelerationFactor` and `yAccelerationFactor` of the `acceleration` complication.

| option      | description                                                | required | default value |
| ----------- | ---------------------------------------------------------- | -------- | ------------- |
| signal      | data channel for dynamic text value                        | false    | -             |
| factor      | scaling factor for dynamic text value                      | false    | 1.0           |
| digits      | number of digits to be displayed                           | false    | -             |
| padding     | maximum number of digits to be shown (diff will be padded) | false    | -             |
| paddingChar | character to be used for padding                           | false    | -             |
| prefix      | prefix to be displayed before the text value               | false    | ''            |
| suffix      | suffix to be displayed after the text value                | false    | ''            |
| color       | color of the text                                          | false    | white         |

```yml
complications:
  - type: text
    width: 700
    height: 50
    x: 735
    y: 275
    options:
      signal: <signal>
      factor: -0.001
      digits: 0
      padding: 3
      paddingChar: "0"
      suffix: " kW"
      color: white
```

#### torqueVectoring

The `torqueVectoring` complication visualizes applied torques to the powertrain of a 4WD vehicle. These torques are read from `flTorqueDataChannel`, `frTorqueDataChannel`, `rlTorqueDataChannel` and `rrTorqueDataChannel`. The maximum absolute value to be expected can be configured with `maxTorque`.  

| option | description | required | default value |
| --------------------------------------- | --------------------------------------------------- | -------- | ------------- |
| flTorqueDataChannel | data channel for front left torque value | true | - |
| frTorqueDataChannel | data channel for front right torque value | true | - |
| rlTorqueDataChannel | data channel for rear left torque value | true | - |
| rrTorqueDataChannel | data channel for rear right torque value | true | - |
| maxTorque | expected maximum absolute value of torque values | true | - |

```yml
complications:
  - type: torqueVectoring
    width: 300
    height: 375
    x: 1620
    y: 15
    options:
      flTorqueDataChannel: <signal>
      frTorqueDataChannel: <signal>
      rlTorqueDataChannel: <signal>
      rrTorqueDataChannel: <signal>
      maxTorque: 450
```

## Installation

### Prerequisites

- To run the tool locally, NodeJS version 16 or higher is required. Please consult the [NodeJS website][nodejs] for further information.
- `pnpm` is recommended to install all dependencies. `npm` and `yarn` will do as well, just be warned, that no `package-lock.json` or `yarn.lock` is provided.
- ffmpeg is required to be installed on the system. Please consult the [ffmpeg documentation][ffmpeg_docs] for further information.

### Installation

To install all dependencies for the tool, run

```
pnpm install
```

## Usage

CLI Options:
| option | description | default value | required |
| -------------- | ------------------------- | ------------------------- | -------- |
| `-i`, `--in` | input data file in csv format | - | true |
| `-c`, `--config` | config yaml file | - | true |
| `-o`, `--out` | output directory | - | true |
| `--frame-offset` | frame offset | 0 | false |

```
pnpm run render -i <csv file> -c <config file> -o <output directory> [--frame-offset <frame offset>]
```

## Example


Preprocess measurement input data from .mf4 to .csv  

```
python3 ./data-preprocessing/main.py <measurement_filename>.mf4 -v -c <channel_name_1> <channel_name_2> <channel_name_n> -s <some_start_time> -e <some_end_time> -r <target_fps> -o <output_filename>
```

Create overlay frames depending on configuration file

```
pnpm run render -i <output_filename>.csv -c config.yml -o <overlay_frame_folder_name>
```

Transform, cut and overlay video (input parameters still to be added)

```
./ffmpeg-overlay.sh <video_filename>.mp4 <overlay_frame_folder_name> <target_fps> <video_start_time_in_00:00:00_format> <video_end_time_in_00:00:00_format>
```

[yt_data_overlay]: https://youtu.be/o0-gsb4kFGo
[ffmpeg_docs]: https://ffmpeg.org/documentation.html
[nodejs]: https://nodejs.org/en/
