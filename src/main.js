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


const args = parser.parse_args();
log.debug(`input file: ${args.in}`);
log.debug(`config file: ${args.config}`);
log.debug(`output directory: ${args.out}`);

async function main() {
  const config = await loadConfig(args.config);
  let data = await loadDataFile(args.in);

  // Apply frame offset if positive
  if (args.frame_offset > 0) {
    data = data.slice(args.frame_offset);
  }

  config.dataLength = data.length;
  config.args = args;
  log.debug(`printing config file\n${JSON.stringify(config, null, 2)}`);

  await createOutputDirectory(args.out);
  log.info(`initializing renderer`);
  await renderer.init(config, data, args.resume);   // pass resume frame index
  log.info(`renderer initialized`);

  log.info(`starting rendering`);

  // "pre-roll" empty frames if negative offset
  if (args.frame_offset < 0) {
    for (let i = 0; i < Math.abs(args.frame_offset); i++) {
      await renderer.render({});
    }
  }

  // Now actually render, skipping until resume index
  for (let [i, dataPoint] of data.entries()) {
    if (i < args.resume) continue;
    try {
      await renderer.render(dataPoint);
    } catch (err) {
      log.error(`failed rendering frame ${i}: ${err.message}`);
      // optionally continue instead of crashing:
      // continue;
      process.exit(1);
    }
  }

  log.info(`rendering done`);
}


(async () => {
  await main();
})();
