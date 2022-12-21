import sharp from "sharp";
import { log } from "../logger.js";
import fs from "fs";
import path from "path";

class complication {
  constructor() {
    this.defaultFontFile = path.join(process.env.PWD, "assets/DSEG14Classic-Regular.ttf");
    this.defaultFont = "DSEG14 Classic";
    this.defaultFontColor = "white";
    this.defaultFactor = 1;

    this._config;
    this.width;
    this.height;
    this.signalDataChannel;
    this.digits;
    this.factor;
    this.padding;
    this.paddingChar;
    this.prefix;
    this.suffix;
    this.fontColor;
    this.fontFile;
    this.font;
  }

  async init(config, data) {
    this.width = config.width;
    this.height = config.height;
    this.signalDataChannel = config.options.signal;

    log.info(`initializing complication 'text' for signal '${this.signalDataChannel}'`);
    this.digits = config.options.digits;
    this.prefix = config.options.prefix;
    this.suffix = config.options.suffix;
    this.fontColor = config.options.fontColor || this.defaultFontColor;
    this.padding = config.options.padding;
    this.paddingChar = config.options.paddingChar;
    this.factor = config.options.factor || this.defaultFactor;

    this.fontFile = config.options.fontFile || this.defaultFontFile;
    this.font = config.options.font || this.defaultFont;

    if (!fs.existsSync(this.fontFile)) {
      log.error(`font file '${this.fontFile}' does not exist`);
      process.exit(1);
    }
  }

  async render(dataPoint, frameIndex) {
    const signal = parseFloat(dataPoint[this.signalDataChannel]) * this.factor;
    const sign = Math.sign(dataPoint[this.signalDataChannel] * this.factor);
    const absSignal = Math.abs(signal);
    const fixedSignal = absSignal.toFixed(this.digits);
    let text = `${fixedSignal}`;
    if (this.padding && this.paddingChar) {
      text = text.padStart(this.padding, this.paddingChar);
    }
    if (sign >= 0) {
      text = `+${text}`;
    } else {
      text = `-${text}`;
    }
    if (this.prefix) text = `${this.prefix}${text}`;
    if (this.suffix) text = `${text}${this.suffix}`;
    text = `<span foreground="${this.fontColor}">${text}</span>`;

    return await sharp({
      text: {
        text,
        height: this.height,
        width: this.width,
        rgba: true,
        font: this.font,
        fontfile: this.fontFile,
      },
    })
      .png()
      .toBuffer();
  }
}

export default complication;
