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

    this.frontAxleYOffset = 0;
    this.leftWheelStart = 0;
    this.rightWheelStart = 0;
    this.wheelWidth = 0;

    this.TORQUE_PIXEL_FACTOR_THROTTLE;
    this.TORQUE_PIXEL_FACTOR_BRAKE;
    this.maxTorqueBarHeight;

    this.greenBarBuffer;
    this.redBarBuffer;
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
    this.maxThrottle = config.options.maxThrottle || 1;
    this.maxBrake = config.options.maxBrake || 1;

    const ORIGINAL_MAX_TORUQE_BAR_HEIGHT = 200;
    this.maxTorqueBarHeight = Math.round(Y_SCALE_FACTOR * ORIGINAL_MAX_TORUQE_BAR_HEIGHT);
    this.TORQUE_PIXEL_FACTOR_THROTTLE = (1 / this.maxThrottle) * Y_SCALE_FACTOR * ORIGINAL_MAX_TORUQE_BAR_HEIGHT;
    this.TORQUE_PIXEL_FACTOR_BRAKE = (1 / this.maxBrake) * Y_SCALE_FACTOR * ORIGINAL_MAX_TORUQE_BAR_HEIGHT;

    this.greenBarBuffer = await sharp({
      create: {
        width: Math.max(1, this.wheelWidth),
        height: Math.max(1, this.maxTorqueBarHeight),
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 0.75 },
      },
    }).png().toBuffer();

    this.redBarBuffer = await sharp({
      create: {
        width: Math.max(1, this.wheelWidth),
        height: Math.max(1, this.maxTorqueBarHeight),
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.75 },
      },
    }).png().toBuffer();

    log.info(`complication 'throttle-and-brake' initialized`);
  }

  async render(dataPoint, frameIndex) {
    const pedalLayer = async (pedal) => {
      let dataChannel, xOffset, PixelFactor, barBuffer;
      if (pedal === "throttle") {
        dataChannel = this.throttleDataChannel; xOffset = this.rightWheelStart; PixelFactor = this.TORQUE_PIXEL_FACTOR_THROTTLE; barBuffer = this.greenBarBuffer;
      } else {
        dataChannel = this.brakeDataChannel; xOffset = this.leftWheelStart; PixelFactor = this.TORQUE_PIXEL_FACTOR_BRAKE; barBuffer = this.redBarBuffer;
      }
      
      let val = parseFloat(dataPoint[dataChannel]) || 0;
      let h = Math.abs(Math.round(val * PixelFactor));
      const barHeight = Math.max(1, Math.min(this.maxTorqueBarHeight, h));
      let top = (val >= 0) ? (this.frontAxleYOffset - barHeight) : this.frontAxleYOffset;

      const extracted = await sharp(barBuffer).extract({ left: 0, top: 0, width: Math.max(1, this.wheelWidth), height: barHeight }).toBuffer();

      return {
        input: extracted,
        top: Math.round(top),
        left: Math.round(xOffset),
      };
    };

    const layers = await Promise.all([pedalLayer("throttle"), pedalLayer("brake")]);
    return await sharp({
      create: { width: this.width, height: this.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
    }).composite(layers).png().toBuffer();
  }
}

export default complication;
