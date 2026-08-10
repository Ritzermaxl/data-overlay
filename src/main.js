import process from "process";
process.env.UV_THREADPOOL_SIZE = "1";

import { loadDataFile } from "./data-reader.js";
import { ArgumentParser } from "argparse";
import { log } from "./logger.js";
import { loadConfig, createOutputDirectory } from "./util.js";
import renderer from "./renderer.js";
import sharp from "sharp";

// Enforce strict single-threaded operation and disable unstable optimizations
sharp.concurrency(1);
sharp.cache(0);
sharp.cache(false);
sharp.simd(false);

const parser = new ArgumentParser({
  description: "data to image overlay",
});

parser.add_argument("-i", "--in", { help: "input data file in csv format" });
parser.add_argument("-c", "--config", { help: "config yaml file" });
parser.add_argument("-o", "--out", { help: "output directory" });
parser.add_argument("--frame-offset", { type: "int", help: "frame offset", default: 0 });
parser.add_argument("--resume", { type: "int", help: "resume from frame index", default: 0 });
parser.add_argument("--limit", { type: "int", help: "limit number of frames to render", default: 0 });


const args = parser.parse_args();

async function main() {
  const config = await loadConfig(args.config);
  const data = await loadDataFile(args.in);

  config.dataLength = data.length;
  config.args = args;

  await createOutputDirectory(args.out);

  log.info(`initializing renderer (resume: ${args.resume}, limit: ${args.limit}, offset: ${args.frame_offset})`);
  await renderer.init(config, data, args.resume);
  log.info(`renderer initialized`);

  log.info(`starting rendering`);

  // We use a robust loop that handles offset and resume correctly
  // Total frames to render is based on the data length plus any positive offset
  const totalPossibleFrames = data.length + (args.frame_offset < 0 ? Math.abs(args.frame_offset) : 0);

  let framesRenderedInThisPass = 0;

  for (let i = args.resume; i < totalPossibleFrames; i++) {
    // Check limit
    if (args.limit > 0 && framesRenderedInThisPass >= args.limit) {
      log.info(`reached worker limit of ${args.limit}, stopping`);
      break;
    }

    // Determine which data point to use based on the offset
    // frameIndex 'i' is the output filename index (000001.png)
    // dataIndex is the row in the CSV
    const dataIndex = i - args.frame_offset;

    try {
      const dataPoint = (dataIndex >= 0 && dataIndex < data.length) ? data[dataIndex] : {};
      await renderer.render(dataPoint);
      framesRenderedInThisPass++;
    } catch (err) {
      log.error(`failed rendering frame ${i}: ${err.message}`);
      process.exit(1);
    }
  }

  log.info(`rendering pass done`);
}


(async () => {
  try {
    await main();
  } catch (err) {
    log.error(`Fatal error: ${err.message}`);
    process.exit(1);
  }
})();
