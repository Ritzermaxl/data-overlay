import { loadImageBuffer } from "../util.js";
import sharp from "sharp";
import { log } from "../logger.js";
import path from "path";

class complication {
  constructor() {
    this.gForceBackgroundBuffer;
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
    
    this.blurredIndicatorBuffers = [];
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

    this.indicatorSize = config.options.indicatorSize || 50;

    const ORIGINAL_BACKGROUND_IMAGE_SIZE = 950;
    const ORIGINAL_1_G_PIXEL_COUNT = 150;
    this.gForcePixelCount = ORIGINAL_1_G_PIXEL_COUNT * (this.width / ORIGINAL_BACKGROUND_IMAGE_SIZE);

    const backgroundImageBuffer = await loadImageBuffer("./assets/g-force-bg.png");
    const indicatorImageBuffer = await loadImageBuffer("./assets/g-force-indicator.png");

    this.gForceBackgroundBuffer = await sharp(backgroundImageBuffer).resize(this.width, this.height).toBuffer();

    const baseIndicator = await sharp(indicatorImageBuffer).resize(this.indicatorSize, this.indicatorSize).toBuffer();
    this.blurredIndicatorBuffers = [];
    for (let i = 0; i < this.indicatorBufferSize; i++) {
      let s = sharp(baseIndicator);
      if (i > 0) s = s.blur(Math.max(0.3, i * this.indicatorBufferFalloff));
      this.blurredIndicatorBuffers.push(await s.toBuffer());
    }

    log.info(`complication 'acceleration' initialized`);
  }

  async render(dataPoint, frameIndex) {
    let xAcc = (parseFloat(dataPoint[this.xAccelerationDataChannel]) || 0) * this.xAccelerationFactor;
    let yAcc = (parseFloat(dataPoint[this.yAccelerationDataChannel]) || 0) * this.yAccelerationFactor;

    const indicatorX = Math.max(0, Math.min(this.width - this.indicatorSize, Math.round(this.width / 2 - this.indicatorSize / 2 - yAcc * this.gForcePixelCount)));
    const indicatorY = Math.max(0, Math.min(this.height - this.indicatorSize, Math.round(this.height / 2 - this.indicatorSize / 2 + xAcc * this.gForcePixelCount)));

    this.indicatorBuffer[this.indicatorBufferIndex % this.indicatorBufferSize] = { indicatorX, indicatorY };

    let indicators = [];
    for (let i = 0; i < this.indicatorBuffer.length; i++) {
      const pos = this.indicatorBuffer[(this.indicatorBufferIndex + i) % this.indicatorBuffer.length];
      indicators.push({
        input: this.blurredIndicatorBuffers[i] || this.blurredIndicatorBuffers[0],
        left: pos.indicatorX,
        top: pos.indicatorY,
      });
    }
    this.indicatorBufferIndex = (this.indicatorBufferIndex + 1) % this.indicatorBufferSize;

    return await sharp({
      create: { width: this.width, height: this.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
    })
    .composite([{ input: this.gForceBackgroundBuffer }, ...indicators])
    .png()
    .toBuffer();
  }
}

export default complication;
