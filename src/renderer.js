import complications from "./complications/index.js";
import { log } from "./logger.js";
import sharp from "sharp";
import path from "path";

let backgroundBuffer;
let _config;
let frameIndex = 0; 

const configuredComplications = [];

async function init(config, data, resumeFrame = 0) {
  _config = config;
  frameIndex = resumeFrame;  // start where we left off
  
  // Pre-calculate the base transparent background buffer
  backgroundBuffer = await sharp({
    create: {
      width: _config.videoWidth,
      height: _config.videoHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.0 },
    },
  })
  .png()
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
    await complication.init(complicationConfig, data);
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
      // log.debug(`Rendering complication ${complicationConfig.type} at frame ${frameIndex}`);
      const layer = await complication.render(dataPoint, frameIndex);
      
      // Ensure we don't pass null layers or invalid objects
      if (layer) {
        layers.push({
          input: layer,
          top: Math.round(complicationConfig.y),
          left: Math.round(complicationConfig.x),
        });
      }
    } catch (err) {
      log.error(`Complication ${complicationConfig.type} failed at frame ${frameIndex}: ${err.message}`);
    }
  }

  const outputFilename = path.join(_config.args.out, `${frameIndex.toString().padStart(6, "0")}.png`);
  
  try {
    // log.debug(`Compositing frame ${frameIndex}`);
    await sharp(backgroundBuffer)
      .composite(layers)
      .toFile(outputFilename);
  } catch (err) {
    log.error(`Sharp compositor failed at frame ${frameIndex}: ${err.message}`);
    // Atomic fallback: skip this frame but don't crash
    return;
  }

  log.info(`rendered frame ${frameIndex}/${_config.dataLength}`);
  frameIndex++;
}


const renderer = {
  init,
  render,
};

export default renderer;
