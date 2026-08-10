import sharp from "sharp";
import { log } from "../logger.js";

class YawRateBar {
  async init(config) {
    this.width = config.width;
    this.height = config.height;
    this.signal = config.options.signal;
    this.factor = config.options.factor ?? 1;
    this.maxYawRate = config.options.maxYawRate ?? 90;
    this.negativeColor = config.options.negativeColor ?? "#3b82f6";
    this.positiveColor = config.options.positiveColor ?? "#ef4444";

    log.info(`complication 'yaw-rate-bar' initialized for signal '${this.signal}'`);
  }

  async render(dataPoint) {
    const rawValue = Number.parseFloat(dataPoint[this.signal]);
    const value = (Number.isFinite(rawValue) ? rawValue : 0) * this.factor;
    const normalized = Math.max(-1, Math.min(1, value / this.maxYawRate));
    const center = this.width / 2;
    const barX = normalized < 0 ? center + normalized * center : center;
    const barWidth = Math.abs(normalized) * center;
    const color = normalized < 0 ? this.negativeColor : this.positiveColor;

    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${this.width}" height="${this.height}" rx="4" fill="#111827" fill-opacity="0.65"/>
        <rect x="${barX}" y="0" width="${barWidth}" height="${this.height}" rx="3" fill="${color}" fill-opacity="0.9"/>
        <line x1="${center}" y1="0" x2="${center}" y2="${this.height}" stroke="white" stroke-width="2"/>
      </svg>`;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}

export default YawRateBar;
