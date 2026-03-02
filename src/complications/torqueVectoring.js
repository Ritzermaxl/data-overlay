import { loadImageBuffer } from "../util.js";
import sharp from "sharp";
import { log } from "../logger.js";

class complication {
  constructor() {
    this._config;
    this.backgroundImageBuffer;
    this.width;
    this.height;
    this.flTorqueDataChannel;
    this.frTorqueDataChannel;
    this.rlTorqueDataChannel;
    this.rrTorqueDataChannel;
    this.maxTorque;

    this.rearAxleYOffset = 0;
    this.frontAxleYOffset = 0;
    this.leftWheelStart = 0;
    this.rightWheelStart = 0;
    this.wheelWidth = 0;

    this.TORQUE_PIXEL_FACTOR;
    this.maxTorqueBarHeight;
  }

  async init(config, data) {
    log.info(`initializing complication 'torque-vectoring'`);
    const backgroundImage = await loadImageBuffer("./assets/torque-vectoring.png");
    this.width = config.width;
    this.height = config.height;

    const ORIGINAL_IMAGE_HEIGHT = 750;
    const ORIGINAL_IMAGE_WIDTH = 600;
    const ORIGINAL_FRONT_AXLE_Y_OFFSET = 202;
    const ORIGINAL_REAR_AXLE_Y_OFFSET = 548;
    const ORIGINAL_WHEEL_WIDTH = 80;
    const ORIGINAL_LEFT_WHEEL_START = 10;
    const ORIGINAL_RIGHT_WHEEL_START = 510;

    const Y_SCALE_FACTOR = this.height / ORIGINAL_IMAGE_HEIGHT;
    const X_SCALE_FACTOR = this.width / ORIGINAL_IMAGE_WIDTH;
    this.rearAxleYOffset = Math.round(Y_SCALE_FACTOR * ORIGINAL_REAR_AXLE_Y_OFFSET);
    this.frontAxleYOffset = Math.round(Y_SCALE_FACTOR * ORIGINAL_FRONT_AXLE_Y_OFFSET);
    this.wheelWidth = Math.round(X_SCALE_FACTOR * ORIGINAL_WHEEL_WIDTH);
    this.leftWheelStart = Math.round(X_SCALE_FACTOR * ORIGINAL_LEFT_WHEEL_START);
    this.rightWheelStart = Math.round(X_SCALE_FACTOR * ORIGINAL_RIGHT_WHEEL_START);

    this.backgroundImageBuffer = await sharp(backgroundImage)
      .resize(this.width, this.height, { fit: "contain", gravity: "center", background: { r: 255, g: 255, b: 255, alpha: 0.0 } })
      .png()
      .toBuffer();

    this.flTorqueDataChannel = config.options.flTorqueDataChannel;
    this.frTorqueDataChannel = config.options.frTorqueDataChannel;
    this.rlTorqueDataChannel = config.options.rlTorqueDataChannel;
    this.rrTorqueDataChannel = config.options.rrTorqueDataChannel;

    this.maxTorque = config.options.maxTorque;
    let maxDataTorque = 0;
    for (const dataPoint of data) {
      const torqueFl = Math.abs(dataPoint[this.flTorqueDataChannel]);
      const torqueFr = Math.abs(dataPoint[this.frTorqueDataChannel]);
      const torqueRl = Math.abs(dataPoint[this.rlTorqueDataChannel]);
      const torqueRr = Math.abs(dataPoint[this.rrTorqueDataChannel]);

      const maxTorque = Math.max(torqueFl, torqueFr, torqueRl, torqueRr);
      if (maxTorque > maxDataTorque) {
        maxDataTorque = maxTorque;
      }
    }
    if (this.maxTorque) {
      log.debug(`max torque: ${this.maxTorque} | max data torque: ${maxDataTorque}`);
      if (maxDataTorque > this.maxTorque) {
        log.warn(`max absolute torque in data (${maxDataTorque}) is greater than configured max torque (${this.maxTorque})`);
      }
    } else {
      this.maxTorque = Math.ceil(maxDataTorque);
      log.info(`setting max torque to ${this.maxTorque} based on data`);
    }

    const ORIGINAL_MAX_TORUQE_BAR_HEIGHT = 200;
    this.maxTorqueBarHeight = Math.round(Y_SCALE_FACTOR * ORIGINAL_MAX_TORUQE_BAR_HEIGHT);
    this.TORQUE_PIXEL_FACTOR = (1 / this.maxTorque) * Y_SCALE_FACTOR * ORIGINAL_MAX_TORUQE_BAR_HEIGHT;

    // Pre-create bar buffers
    this.greenBarBuffer = await sharp({
      create: {
        width: Math.max(1, this.wheelWidth),
        height: Math.max(1, this.maxTorqueBarHeight),
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 0.75 },
      },
    })
    .png()
    .toBuffer();

    this.redBarBuffer = await sharp({
      create: {
        width: Math.max(1, this.wheelWidth),
        height: Math.max(1, this.maxTorqueBarHeight),
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.75 },
      },
    })
    .png()
    .toBuffer();

    log.info(`complication 'torque-vectoring' initialized`);
  }

  async render(dataPoint, frameIndex) {
    const torqueLayer = async (wheel) => {
      let dataChannel = "";
      let xOffset = 0;
      let yOffset = 0;
      switch (wheel) {
        case "fl":
          dataChannel = this.flTorqueDataChannel;
          xOffset = this.leftWheelStart;
          yOffset = this.frontAxleYOffset;
          break;
        case "fr":
          dataChannel = this.frTorqueDataChannel;
          xOffset = this.rightWheelStart;
          yOffset = this.frontAxleYOffset;
          break;
        case "rl":
          dataChannel = this.rlTorqueDataChannel;
          xOffset = this.leftWheelStart;
          yOffset = this.rearAxleYOffset;
          break;
        case "rr":
          dataChannel = this.rrTorqueDataChannel;
          xOffset = this.rightWheelStart;
          yOffset = this.rearAxleYOffset;
          break;
      }
      let torque = dataPoint[dataChannel];
      if (typeof torque === "undefined" || torque === null) {
        log.warn(`data channel '${dataChannel}' not found in data point index ${frameIndex}`);
        torque = 0;
      }
      torque = parseFloat(torque);
      if (isNaN(torque)) torque = 0;

      let rawHeight = Math.abs(Math.round(torque * this.TORQUE_PIXEL_FACTOR));
      if (isNaN(rawHeight) || !isFinite(rawHeight)) rawHeight = 0;
      const torqueBarHeight = Math.max(1, Math.min(this.maxTorqueBarHeight, rawHeight));

      let rawYPos = Math.round(torque * this.TORQUE_PIXEL_FACTOR);
      if (isNaN(rawYPos) || !isFinite(rawYPos)) rawYPos = 0;
      
      // Calculate top position and clamp it
      let top = yOffset - Math.min(this.maxTorqueBarHeight, Math.max(0, rawYPos));
      top = Math.max(0, Math.min(this.height - torqueBarHeight, top));
      
      const left = Math.max(0, Math.min(this.width - this.wheelWidth, xOffset));

      const barBuffer = torque > 0 ? this.greenBarBuffer : this.redBarBuffer;
      const resizedBar = await sharp(barBuffer)
        .extract({ left: 0, top: 0, width: Math.max(1, this.wheelWidth), height: torqueBarHeight })
        .toBuffer();

      return {
        input: resizedBar,
        top: Math.round(top),
        left: Math.round(left),
      };
    };

    const layerPromises = [
        torqueLayer("fl"),
        torqueLayer("fr"),
        torqueLayer("rl"),
        torqueLayer("rr"),
    ];
    const layers = await Promise.all(layerPromises);

    // console.log(Math.max(1, Math.abs(Math.round(dataPoint[flTorqueDataChannel] * TORQUE_PIXEL_FACTOR))));
    return await sharp(this.backgroundImageBuffer)
      .composite(layers)
      .toBuffer();
  }
}

export default complication;
