import { loadImageBuffer } from "../util.js";
import sharp from "sharp";
import { log } from "../logger.js";

class complication {
  constructor() {
    this._config;
    this.backgroundImageBuffer;
    this.width;
    this.height;
    this.steeringAngle;
  }

  async init(config, data) {
    log.info(`initializing complication 'SteeringWheel'`);
    const backgroundImage = await loadImageBuffer("./assets/steeringwheel.png");
    this.width = config.width;
    this.height = config.height;

    const ORIGINAL_IMAGE_HEIGHT = 256;
    const ORIGINAL_IMAGE_WIDTH = 256;

    const Y_SCALE_FACTOR = this.height / ORIGINAL_IMAGE_HEIGHT;
    const X_SCALE_FACTOR = this.width / ORIGINAL_IMAGE_WIDTH;
    

    this.backgroundImageBuffer = await sharp(backgroundImage)
      .resize(this.width, this.height, { fit: "contain", gravity: "center", background: { r: 255, g: 255, b: 255, alpha: 0.0 } })
      .png()
      .toBuffer();

    this.steeringAngle = config.options.steeringAngle;

    log.info(`complication 'SteeringWheel`);
  }


  async render(dataPoint, frameIndex) {
    let angle = parseFloat(dataPoint[this.steeringAngle]);
    if (isNaN(angle)) {
      log.warn(`data channel '${this.steeringAngle}' not found or invalid in data point index ${frameIndex}`);
      angle = 0; // Default to 0 if the value is not a valid number
    }
  
    // Rotate the image by the given angle. Sharp will automatically adjust the image size to fit the rotated image.
    const rotatedImageBuffer = await sharp(this.backgroundImageBuffer)
      .rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 0.0 } }) // Rotate the image, fill background transparently
      .toBuffer();
  
    // Use the metadata to determine the size of the rotated image for cropping
    const metadata = await sharp(rotatedImageBuffer).metadata();
  
    // Calculate the dimensions to crop to keep the image centered
    const cropWidth = Math.min(this.width, metadata.width);
    const cropHeight = Math.min(this.height, metadata.height);
    const left = (metadata.width - cropWidth) / 2;
    const top = (metadata.height - cropHeight) / 2;
  
    // Crop the rotated image to maintain the original dimensions as closely as possible without resizing
    const finalImageBuffer = await sharp(rotatedImageBuffer)
      .extract({ left: Math.round(left), top: Math.round(top), width: cropWidth, height: cropHeight })
      .toBuffer();
  
    return finalImageBuffer;
  }
  
}

export default complication;