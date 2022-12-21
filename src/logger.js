import pkg from "winston";
const { format } = pkg;
import { createLogger, transports } from "winston";
import "dotenv/config";

// winston log levels
const AVAILABLE_LOG_LEVELS = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
];
const DEFAULT_LOG_LEVEL = "info";
export const LOG_LEVEL = parseLogLevel(process.env["LOG_LEVEL"]);
console.log(`using log level '${LOG_LEVEL}'`);

const LOG_FORMAT = format.combine(
  format.colorize(),
  format.timestamp(),
  format.align(),
  format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

function failStartup() {
  console.error("Failed to start. See reason above. Exiting.");
  process.exit(1);
}

function parseLogLevel(level) {
  if (level) {
    if (AVAILABLE_LOG_LEVELS.includes(level)) {
      return level;
    } else {
      console.warn(`Unknown log level '${level}'`);
      failStartup();
      throw new Error("Unknown log level");
    }
  } else {
    return DEFAULT_LOG_LEVEL;
  }
}

export const log = createLogger({
  level: LOG_LEVEL,
  format: LOG_FORMAT,
  transports: [new transports.Console()],
});
