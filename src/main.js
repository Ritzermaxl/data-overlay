import { loadDataFile } from "./data-reader.js";
import { ArgumentParser } from "argparse";
import { log } from "./logger.js";
import { loadConfig, createOutputDirectory } from "./util.js";
import renderer from "./renderer.js";

const parser = new ArgumentParser({
  description: "data to image overlay",
});

parser.add_argument("-i", "--in", { help: "input data file in csv format" });
parser.add_argument("-c", "--config", { help: "config yaml file" });
parser.add_argument("-o", "--out", { help: "output directory" });
parser.add_argument("--frame-offset", { type: "int", help: "frame offset", default: 0 });

const args = parser.parse_args();
log.debug(`input file: ${args.in}`);
log.debug(`config file: ${args.config}`);
log.debug(`output directory: ${args.out}`);

async function main() {
  const config = await loadConfig(args.config);
  let data = await loadDataFile(args.in);
  config.dataLength = data.length - args.frame_offset;
  config.args = args;
  log.debug(`printig config file\n${JSON.stringify(config, null, 2)}`);

  await createOutputDirectory(args.out);
  log.info(`initializing renderer`);
  await renderer.init(config, data);
  log.info(`renderer initialized`);

  log.info(`starting rendering`);
  if (args.frame_offset < 0) {
    for (let i = 0; i < Math.abs(args.frame_offset); i++) {
      await renderer.render({});
    }
  }
  if (args.frame_offset > 0) {
    data = data.slice(args.frame_offset);
  }
  for (let dataPoint of data) {
    await renderer.render(dataPoint);
  }
  log.info(`rendering done`);
}

(async () => {
  await main();
})();
