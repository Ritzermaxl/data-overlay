import { loadImageBuffer } from "../util.js";
import sharp from "sharp";
import { log } from "../logger.js";
import path from "path";

class complication {
  constructor() {
    this.gForceBackgroundBuffer;
    this.gForceIndicatorBuffer;
    this.indicatorSize;
    this.width;
    this.height;
    this.gForcePixelCount;
    this.xAccelerationDataChannel;
    this.yAccelerationDataChannel;
    this.xAccelerationFactor;
    this.yAccelerationFactor;
    this._config;

    this.indicatorBuffer = [];
    this.indicatorBufferSize = 10;
    this.indicatorBufferIndex = 0;
    this.indicatorBufferFalloff = 0.9;
  }

  async init(config, data) {
    this._config = config;
    this.width = config.width;
    this.height = config.height;
    if (config.width !== config.height) {
      log.error(`width and height must be equal for g-force complication`);
      process.exit(1);
    }
    this.xAccelerationDataChannel = config.options.xAccelerationDataChannel;
    this.yAccelerationDataChannel = config.options.yAccelerationDataChannel;
    this.xAccelerationFactor = config.options.xAccelerationFactor || 1.0;
    this.yAccelerationFactor = config.options.yAccelerationFactor || 1.0;
    this.indicatorBufferSize = config.options.indicatorBufferSize || 1;
    this.indicatorBufferFalloff = config.options.indicatorBufferFalloff || 1.0;
    if (typeof this.xAccelerationDataChannel === "undefined" || typeof this.yAccelerationDataChannel === "undefined") {
      log.error(
        `xAccelerationDataChannel and yAccelerationDataChannel must be specified for g-force complication. Define under complication options in config file.`
      );
      process.exit(1);
    }

    this.indicatorSize = config.options.indicatorSize || 50;

    const ORIGINAL_BACKGROUND_IMAGE_SIZE = 950; // 950px X 950px
    const ORIGINAL_1_G_PIXEL_COUNT = 150; // 1g circle diameter is 300px => 150px radius = 1g
    this.gForcePixelCount = ORIGINAL_1_G_PIXEL_COUNT * (this.width / ORIGINAL_BACKGROUND_IMAGE_SIZE);

    const backgroundImageBuffer = await loadImageBuffer("./assets/g-force-bg.png");
    const indicatorImageBuffer = await loadImageBuffer("./assets/g-force-indicator.png");
    log.info(`initializing complication 'acceleration'`);
    log.debug(`complication size: ${this.width}x${this.height}`);
    this.gForceBackgroundBuffer = await sharp(backgroundImageBuffer).resize(this.width, this.height).toBuffer();
    log.debug(`indicator size: ${this.indicatorSize}x${this.indicatorSize}`);
    this.gForceIndicatorBuffer = await sharp(indicatorImageBuffer).resize(this.indicatorSize, this.indicatorSize).toBuffer();
    log.info(`complication 'acceleration' initialized`);
  }

  async render(dataPoint, frameIndex) {
    let xAcceleration = dataPoint[this.xAccelerationDataChannel];
    let yAcceleration = dataPoint[this.yAccelerationDataChannel];
    if (!xAcceleration) {
      log.warn(`data point at frame ${frameIndex} misses xAcceleration data`);
      xAcceleration = 0;
    }
    if (!yAcceleration) {
      log.warn(`data point at frame index ${frameIndex} misses yAcceleration data`);
      yAcceleration = 0;
    }

    xAcceleration = parseFloat(xAcceleration) * this.xAccelerationFactor;
    yAcceleration = parseFloat(yAcceleration) * this.yAccelerationFactor;

    const indicatorXPosition = Math.round(this.width / 2 - this.indicatorSize / 2 - yAcceleration * this.gForcePixelCount);
    const indicatorYPosition = Math.round(this.height / 2 - this.indicatorSize / 2 + xAcceleration * this.gForcePixelCount);

    this.indicatorBuffer[this.indicatorBufferIndex % this.indicatorBufferSize] = { indicatorXPosition, indicatorYPosition };

    let indicators = [];
    for (let i = 0; i < this.indicatorBuffer.length; i++) {
      const indicator = this.indicatorBuffer[(this.indicatorBufferIndex + i) % this.indicatorBuffer.length];
      let indicatorImageBuffer = this.gForceIndicatorBuffer;
      if (i !== 0) {
        indicatorImageBuffer = await sharp(this.gForceIndicatorBuffer)
          .blur(i * this.indicatorBufferFalloff)
          .toBuffer();
      }
      indicators.push({
        input: indicatorImageBuffer,
        left: indicator.indicatorXPosition,
        top: indicator.indicatorYPosition,
      });
    }
    this.indicatorBufferIndex = (this.indicatorBufferIndex + 1) % this.indicatorBufferSize;

    return await sharp({
      create: {
        width: this.width,
        height: this.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.0 },
      },
    })
      .png()
      .composite([
        {
          input: this.gForceBackgroundBuffer,
        },
        ...indicators,
      ])
      .toBuffer();
  }
}

export default complication;
