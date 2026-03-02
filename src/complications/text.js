import sharp from "sharp";
import { log } from "../logger.js";
import fs from "fs";
import path from "path";

class complication {
  constructor() {
    this.defaultFontFile = path.join("./assets/DSEG14Classic-Regular.ttf");
    this.defaultFont = "DSEG14 Classic";
    this.defaultFontColor = "white";
    this.defaultFactor = 1;

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
    
    // Simple cache to avoid recreating identical text buffers
    this.cache = new Map();
  }

  async init(config, data) {
    this.width = Math.max(1, config.width);
    this.height = Math.max(1, config.height);
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
    let rawSignal = parseFloat(dataPoint[this.signalDataChannel]);
    if (isNaN(rawSignal)) rawSignal = 0;
    
    // Safety check for extreme values that might crash toFixed()
    if (Math.abs(rawSignal) > 1e15) rawSignal = Math.sign(rawSignal) * 1e15;
    
    const signal = rawSignal * this.factor;
    const sign = Math.sign(signal);

    const absSignal = Math.abs(signal);
    
    // Safety check for digits
    const digits = Math.max(0, Math.min(20, this.digits || 0));
    const fixedSignal = absSignal.toFixed(digits);
    let textStr = `${fixedSignal}`;
    if (this.padding && this.paddingChar) {
      textStr = textStr.padStart(this.padding, this.paddingChar);
    }
    if (sign >= 0) {
      textStr = `+${textStr}`;
    } else {
      textStr = `-${textStr}`;
    }
    if (this.prefix) textStr = `${this.prefix}${textStr}`;
    if (this.suffix) textStr = `${textStr}${this.suffix}`;

    // Safety: limit maximum text length to prevent Pango crashes
    if (textStr.length > 50) {
        textStr = textStr.substring(0, 50);
    }

    // Cache lookup
    if (this.cache.has(textStr)) {
      return this.cache.get(textStr);
    }

    const pangoText = `<span foreground="${this.fontColor}">${textStr}</span>`;

    try {
      const buffer = await sharp({
        text: {
          text: pangoText,
          height: this.height,
          width: this.width,
          rgba: true,
          font: this.font,
          fontfile: this.fontFile,
        },
      })
      .png()
      .toBuffer();
      
      // Limit cache size
      if (this.cache.size < 1000) {
        this.cache.set(textStr, buffer);
      }
      
      return buffer;
    } catch (err) {
      log.error(`Text rendering failed for "${textStr}": ${err.message}`);
      // Return empty 1x1 transparent buffer as fallback
      return await sharp({
        create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      }).png().toBuffer();
    }
  }
}

export default complication;
