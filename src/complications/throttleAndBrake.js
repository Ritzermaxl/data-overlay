import { loadImageBuffer } from "../util.js";
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

    this.rearAxleYOffset = 0;
    this.frontAxleYOffset = 0;
    this.leftWheelStart = 0;
    this.rightWheelStart = 0;
    this.wheelWidth = 0;

    this.TORQUE_PIXEL_FACTOR_THROTTLE;
    this.TORQUE_PIXEL_FACTOR_BRAKE;
    this.maxTorqueBarHeight;
  }

  async init(config, data) {
    log.info(`initializing complication 'throttle-and-brake'`);

    this.width = config.width;
    this.height = config.height;

    const ORIGINAL_IMAGE_HEIGHT = 250;
    const ORIGINAL_IMAGE_WIDTH = 250;
    const ORIGINAL_FRONT_AXLE_Y_OFFSET = 125;
    const ORIGINAL_WHEEL_WIDTH = 75;
    const ORIGINAL_LEFT_WHEEL_START = 25;
    const ORIGINAL_RIGHT_WHEEL_START = 150;

    const Y_SCALE_FACTOR = this.height / ORIGINAL_IMAGE_HEIGHT;
    const X_SCALE_FACTOR = this.width / ORIGINAL_IMAGE_WIDTH;
    this.frontAxleYOffset = Math.round(Y_SCALE_FACTOR * ORIGINAL_FRONT_AXLE_Y_OFFSET);
    this.wheelWidth = Math.round(X_SCALE_FACTOR * ORIGINAL_WHEEL_WIDTH);
    this.leftWheelStart = Math.round(X_SCALE_FACTOR * ORIGINAL_LEFT_WHEEL_START);
    this.rightWheelStart = Math.round(X_SCALE_FACTOR * ORIGINAL_RIGHT_WHEEL_START);

  


    this.throttleDataChannel = config.options.throttleDataChannel;
    this.brakeDataChannel = config.options.brakeDataChannel;

    this.maxThrottle = config.options.maxThrottle;
    this.maxBrake = config.options.maxBrake;
    let maxDataThrottlePedal = 0;
    let maxDataBrakePedal = 0;
    for (const dataPoint of data) {
      const pedalThrottle = dataPoint[this.throttleDataChannel];
      const pedalBrake = dataPoint[this.brakeDataChannel];

      if (pedalThrottle > maxDataThrottlePedal) {
        maxDataThrottlePedal = pedalThrottle;
      }
      if (pedalBrake > maxDataBrakePedal) {
        maxDataBrakePedal = pedalBrake;
      }
    }
    
    if (this.maxThrottle) {
      log.debug(`max throttle: ${this.maxThrottle} | max data throttle: ${maxDataThrottlePedal}`);
      if (maxDataThrottlePedal > this.maxThrottle) {
        log.warn(`max throttle in data (${maxDataThrottlePedal}) is greater than configured max throttle (${this.maxThrottle})`);
      }
    } else {
      this.maxThrottle = 1;
      log.info(`setting max throttle to 1, since no max throttle configured`);
    }

    if (this.maxBrake) {
      log.debug(`max brake: ${this.maxBrake} | max data brake: ${maxDataBrakePedal}`);
      if (maxDataBrakePedal > this.maxBrake) {
        log.warn(`max brake in data (${maxDataBrakePedal}) is greater than configured max brake (${this.maxBrake})`);
      }
    } else {
      this.maxBrake = 1;
      log.info(`setting max brake to 1, since no max brake configured`);
    }

    const ORIGINAL_MAX_TORUQE_BAR_HEIGHT = 200;
    this.maxTorqueBarHeight = Math.round(Y_SCALE_FACTOR * ORIGINAL_MAX_TORUQE_BAR_HEIGHT);
    this.TORQUE_PIXEL_FACTOR_THROTTLE = (1 / this.maxThrottle) * Y_SCALE_FACTOR * ORIGINAL_MAX_TORUQE_BAR_HEIGHT;
    this.TORQUE_PIXEL_FACTOR_BRAKE = (1 / this.maxBrake) * Y_SCALE_FACTOR * ORIGINAL_MAX_TORUQE_BAR_HEIGHT;

    log.info(`complication 'throttle-and-brake' initialized`);
  }

  async render(dataPoint, frameIndex) {
    const pedalLayer = (pedal) => {
      let dataChannel = "";
      let xOffset = 0;
      let yOffset = 0;
      let PixelFactor = 0;
      let torqueBarBackground = { r: 255, g: 0, b: 0, alpha: 0.75 };
      switch (pedal) {
        case "throttle":
          dataChannel = this.throttleDataChannel;
          xOffset = this.rightWheelStart;
          yOffset = this.frontAxleYOffset;
          torqueBarBackground = { r: 0, g: 255, b: 0, alpha: 0.75 };
          PixelFactor = this.TORQUE_PIXEL_FACTOR_THROTTLE;
          break;
        case "brake":
          dataChannel = this.brakeDataChannel;
          xOffset = this.leftWheelStart;
          yOffset = this.frontAxleYOffset;
          torqueBarBackground = { r: 255, g: 0, b: 0, alpha: 0.75 };
          PixelFactor = this.TORQUE_PIXEL_FACTOR_BRAKE;
          break;
      }
      let pedalData = dataPoint[dataChannel];
      if (!pedalData) {
        log.warn(`data channel '${dataChannel}' not found in data point index ${frameIndex}`);
        pedalData = 0;
      }
      
      const torqueBarHeight = Math.min(this.maxTorqueBarHeight, Math.max(1, Math.abs(Math.round(pedalData * PixelFactor))));
      const torqueBarYPosition = yOffset - Math.round(Math.min(this.maxTorqueBarHeight, Math.max(0, Math.round(pedalData * PixelFactor))));
      

      return {
        input: {
          create: {
            width: this.wheelWidth,
            height: torqueBarHeight,
            channels: 4,
            background: torqueBarBackground,
          },
        },
        top: torqueBarYPosition,
        left: xOffset,
      };
    };

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
        pedalLayer("throttle"),
        pedalLayer("brake"),
      ])
      .toBuffer();
  }
}

export default complication;
