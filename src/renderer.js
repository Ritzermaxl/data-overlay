import complications from "./complications/index.js";
import { log } from "./logger.js";
import sharp from "sharp";
import path from "path";

let backgroundBuffer;
let _config;
let frameIndex = 0; 

const configuredComplications = [];

async function init(config, data) {
  _config = config;
  const complicationConfigs = config.complications;
  if (complications.length == 0) {
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
  const layerPromises = configuredComplications.map(async (configuredComplication) => {
    const complication = configuredComplication.complication;
    const complicationConfig = configuredComplication.complicationConfig;
    const layer = await complication.render(dataPoint, frameIndex);
    return {
      input: layer,
      top: complicationConfig.y,
      left: complicationConfig.x,
    };
  });

  // Wait for all the layer rendering promises to resolve
  const layers = await Promise.all(layerPromises);

  const outputFilename = path.join(_config.args.out, `${frameIndex.toString().padStart(6, "0")}.png`);
  await sharp({
    create: {
      width: _config.videoWidth,
      height: _config.videoHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.0 },
    },
  })
  .composite(layers)
  .toFile(outputFilename);

  log.info(`rendered frame ${frameIndex}/${_config.dataLength}`);
  frameIndex++;
}


const renderer = {
  init,
  render,
};

export default renderer;
