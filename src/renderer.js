import complications from "./complications/index.js";
import { log } from "./logger.js";
import sharp from "sharp";
import path from "path";

let _config;
let frameIndex = 0; 
let backgroundBuffer;
let backgroundMetadata;

const configuredComplications = [];

async function init(config, data, resumeFrame = 0) {
  _config = config;
  frameIndex = resumeFrame;  // start where we left off
  
  // Pre-calculate the base transparent background buffer once
  backgroundMetadata = {
    width: _config.videoWidth,
    height: _config.videoHeight,
    channels: 4
  };

  backgroundBuffer = await sharp({
    create: {
      ...backgroundMetadata,
      background: { r: 255, g: 255, b: 255, alpha: 0.0 },
    },
  })
  .raw()
  .toBuffer();

  const complicationConfigs = config.complications;
  if (!complicationConfigs || complicationConfigs.length === 0) {
    log.error("no complications specified in config file");
    process.exit(1);
  }
  for (let complicationConfig of complicationConfigs) {
    if (typeof complications[complicationConfig.type] === "undefined") {
      log.error(`complication type '${complicationConfig.type}' is not valid`);
      process.exit(1);
    }
    log.info(`initializing complication '${complicationConfig.type}'`);
    const complication = new complications[complicationConfig.type]();
    // Stateful complications need to know where this rendering pass starts so
    // parallel workers (and retried workers) can restore their prior context.
    await complication.init(complicationConfig, data, resumeFrame, config.args?.frame_offset ?? 0);
    configuredComplications.push({ complication, complicationConfig });
  }
}

async function render(dataPoint) {
  const layers = [];

  // Process complications serially to prevent native concurrency issues
  for (const configuredComplication of configuredComplications) {
    const complication = configuredComplication.complication;
    const complicationConfig = configuredComplication.complicationConfig;

    try {
      const result = await complication.render(dataPoint, frameIndex);

      if (result) {
        if (Buffer.isBuffer(result)) {
          layers.push({
            input: result,
            top: Math.round(complicationConfig.y),
            left: Math.round(complicationConfig.x),
          });
        } else if (result.input) {
          layers.push({
            input: result.input,
            top: Math.round((complicationConfig.y || 0) + (result.top || 0)),
            left: Math.round((complicationConfig.x || 0) + (result.left || 0)),
          });
        }
      }
    } catch (err) {
      log.error(`Complication ${complicationConfig.type} failed at frame ${frameIndex}: ${err.message}`);
    }
  }

  const outputFilename = path.join(_config.args.out, `${frameIndex.toString().padStart(6, "0")}.png`);
  
  try {
    // Reuse the pre-calculated raw buffer
    await sharp(backgroundBuffer, { raw: backgroundMetadata })
      .composite(layers)
      .png({ compressionLevel: 1, adaptiveFiltering: false })
      .toFile(outputFilename);
  } catch (err) {
    log.error(`Sharp compositor failed at frame ${frameIndex}: ${err.message}`);
    throw err;
  }

  // Progress tracking for master script
  if (frameIndex % 100 === 0) {
    log.info(`rendered frame ${frameIndex}/${_config.dataLength}`);
  } else {
    process.stdout.write(`rendered frame ${frameIndex}/${_config.dataLength}\n`);
  }
  frameIndex++;
}


const renderer = {
  init,
  render,
};

export default renderer;
