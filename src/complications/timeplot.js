import sharp from "sharp";
import { log } from "../logger.js";

class complication {
  constructor() {
    this._config;
    this.width;
    this.height;
    this.throttleDataChannel;
    this.brakeDataChannel;
    this.maxThrottle;
    this.maxBrake;

    this.history = [];
    this.maxHistorySeconds = 10;
    this.timeDataChannel = "timestamps";
  }

  async init(config, data) {
    log.info(`initializing complication 'timeplot'`);
    this.width = config.width;
    this.height = config.height;
    this.timeDataChannel = config.options.timeDataChannel || "timestamps";
    this.throttleDataChannel = config.options.throttleDataChannel;
    this.brakeDataChannel = config.options.brakeDataChannel;
    this.maxThrottle = config.options.maxThrottle || 1;
    this.maxBrake = config.options.maxBrake || 1;
    log.info(`complication 'timeplot' initialized`);
  }

  async render(dataPoint, frameIndex) {
    const currentTime = parseFloat(dataPoint[this.timeDataChannel]) || 0;
    const throttleValue = parseFloat(dataPoint[this.throttleDataChannel]) || 0;
    const brakeValue = parseFloat(dataPoint[this.brakeDataChannel]) || 0;

    this.history.push({ time: currentTime, throttle: throttleValue, brake: brakeValue });
    const tenSecondsAgo = currentTime - this.maxHistorySeconds;
    this.history = this.history.filter(p => p.time >= tenSecondsAgo);

    const throttlePoints = this.history.map(p => {
      const x = Math.round(((p.time - tenSecondsAgo) / this.maxHistorySeconds) * this.width);
      let yVal = p.throttle / this.maxThrottle;
      const y = Math.round(this.height - (isNaN(yVal) ? 0 : yVal) * this.height);
      return { x, y };
    }).filter(p => !isNaN(p.x) && isFinite(p.x));

    const brakePoints = this.history.map(p => {
      const x = Math.round(((p.time - tenSecondsAgo) / this.maxHistorySeconds) * this.width);
      let yVal = p.brake / this.maxBrake;
      const y = Math.round(this.height - (isNaN(yVal) ? 0 : yVal) * this.height);
      return { x, y };
    }).filter(p => !isNaN(p.x) && isFinite(p.x));

    let throttleSvgPath = throttlePoints.length > 0 ? `M ${throttlePoints.map(p => `${p.x},${p.y}`).join(' L ')}` : "";
    let brakeSvgPath = brakePoints.length > 0 ? `M ${brakePoints.map(p => `${p.x},${p.y}`).join(' L ')}` : "";

    const svg = `
      <svg width="${this.width}" height="${this.height}">
        ${throttleSvgPath ? `<path d="${throttleSvgPath}" fill="none" stroke="green" stroke-width="2"/>` : ""}
        ${brakeSvgPath ? `<path d="${brakeSvgPath}" fill="none" stroke="red" stroke-width="2"/>` : ""}
      </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
  }
}

export default complication;
