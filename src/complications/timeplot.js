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

    let maxDataThrottle = 0;
    let maxDataBrake = 0;
    for (const dataPoint of data) {
      const throttle = parseFloat(dataPoint[this.throttleDataChannel]) || 0;
      const brake = parseFloat(dataPoint[this.brakeDataChannel]) || 0;

      if (throttle > maxDataThrottle) {
        maxDataThrottle = throttle;
      }
      if (brake > maxDataBrake) {
        maxDataBrake = brake;
      }
    }

    if (config.options.maxThrottle) {
      log.debug(`max throttle: ${this.maxThrottle} | max data throttle: ${maxDataThrottle}`);
      if (maxDataThrottle > this.maxThrottle) {
        log.warn(`max throttle in data (${maxDataThrottle}) is greater than configured max throttle (${this.maxThrottle})`);
      }
    } else {
      log.info(`setting max throttle to 1, since no max throttle configured`);
    }

    if (config.options.maxBrake) {
      log.debug(`max brake: ${this.maxBrake} | max data brake: ${maxDataBrake}`);
      if (maxDataBrake > this.maxBrake) {
        log.warn(`max brake in data (${maxDataBrake}) is greater than configured max brake (${this.maxBrake})`);
      }
    } else {
      log.info(`setting max brake to 1, since no max brake configured`);
    }

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
      let yValue = (p.throttle / this.maxThrottle);
      if (isNaN(yValue) || !isFinite(yValue)) yValue = 0;
      const y = Math.round(this.height - yValue * this.height);
      return { x, y };
    }).filter(p => !isNaN(p.x) && isFinite(p.x) && !isNaN(p.y) && isFinite(p.y));

    const brakePoints = this.history.map(p => {
      const x = Math.round(((p.time - tenSecondsAgo) / this.maxHistorySeconds) * this.width);
      let yValue = (p.brake / this.maxBrake);
      if (isNaN(yValue) || !isFinite(yValue)) yValue = 0;
      const y = Math.round(this.height - yValue * this.height);
      return { x, y };
    }).filter(p => !isNaN(p.x) && isFinite(p.x) && !isNaN(p.y) && isFinite(p.y));

    let throttleSvgPath = "";
    if (throttlePoints.length > 0) {
        throttleSvgPath = `M ${throttlePoints.map(p => `${p.x},${p.y}`).join(' L ')}`;
    }
    
    let brakeSvgPath = "";
    if (brakePoints.length > 0) {
        brakeSvgPath = `M ${brakePoints.map(p => `${p.x},${p.y}`).join(' L ')}`;
    }

    const svg = `
      <svg width="${this.width}" height="${this.height}">
        ${throttleSvgPath ? `<path d="${throttleSvgPath}" fill="none" stroke="green" stroke-width="2"/>` : ""}
        ${brakeSvgPath ? `<path d="${brakeSvgPath}" fill="none" stroke="red" stroke-width="2"/>` : ""}
      </svg>
    `;

    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }
}

export default complication;