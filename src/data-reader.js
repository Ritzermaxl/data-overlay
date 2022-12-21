import csv from "csv-parser";
import { existsSync, createReadStream } from "fs";

import { log } from "./logger.js";

export function loadDataFile(path) {
  return new Promise((resolve, reject) => {
    log.info(`loading data file '${path}'`);
    if (!existsSync(path)) {
      log.error(`file '${path}' does not exist`);
      process.exit(1);
      return;
    }
    const results = [];
    createReadStream(path)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        log.info(`loaded ${results.length} rows`);
        resolve(results);
      });
  });
}
