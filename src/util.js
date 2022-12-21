import sharp from "sharp";
import { log } from "./logger.js";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { Validator } from "jsonschema";

export async function loadImageBuffer(path) {
  if (!fs.existsSync(path)) {
    log.error(`image file '${path}' does not exist`);
    process.exit(1);
  }
  return await sharp(path).toBuffer();
}

export async function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    log.error(`config file '${configPath}' does not exist`);
    process.exit(1);
  }

  const validator = new Validator();
  const schema = JSON.parse(fs.readFileSync("config.schema.json", "utf8"));
  const data = yaml.load(fs.readFileSync(configPath, "utf8"));
  const validationResults = validator.validate(data, schema, {
    allowUnknownAttributes: false,
  });
  if (!validationResults.valid) {
    log.error(`config file '${configPath}' is invalid`);
    for (let error of validationResults.errors) {
      log.error(`  ${error}`);
    }
    process.exit(1);
  }
  return data;
}

export async function createOutputDirectory(outputDirectory) {
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
  }
}
