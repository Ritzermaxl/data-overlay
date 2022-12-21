import sharp from "sharp";
import { log } from "../logger.js";

class complication {
  constructor() {
    this._config;
    this.width;
    this.height;
    this.r;
    this.g;
    this.b;
    this.a;
  }

  async init(config, data) {
    log.info(`initializing complication 'rectangle'`);

    this.width = config.width;
    this.height = config.height;
    this.r = config.options.background.r;
    this.g = config.options.background.g;
    this.b = config.options.background.b;
    this.a = config.options.background.a;
  }

  async render(dataPoint, frameIndex) {
    return await sharp({
      create: {
        width: this.width,
        height: this.height,
        channels: 4,
        background: {
          r: this.r,
          g: this.g,
          b: this.b,
          alpha: this.a,
        },
      },
    })
      .png()
      .toBuffer();
  }
}

export default complication;
