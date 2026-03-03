import { spawn } from "child_process";
import os from "os";
import { ArgumentParser } from "argparse";
import { log } from "./src/logger.js";
import { loadDataFile } from "./src/data-reader.js";
import readline from "readline";
import fs from "fs";

const parser = new ArgumentParser({
  description: "Parallel data to image overlay",
});

parser.add_argument("-i", "--in", { help: "input data file in csv format", required: true });
parser.add_argument("-c", "--config", { help: "config yaml file", required: true });
parser.add_argument("-o", "--out", { help: "output directory", required: true });
parser.add_argument("--resume", { type: "int", help: "resume from frame index", default: 0 });
parser.add_argument("--limit", { type: "int", help: "limit total number of frames to render", default: 0 });
parser.add_argument("-j", "--jobs", { type: "int", help: "number of parallel jobs (default: CPU count)", default: os.cpus().length });

const args = parser.parse_args();

async function runParallel() {
  // Pre-flight checks
  if (!fs.existsSync(args.in)) {
    log.error(`Input file '${args.in}' does not exist.`);
    process.exit(1);
  }
  if (!fs.existsSync(args.config)) {
    log.error(`Config file '${args.config}' does not exist.`);
    process.exit(1);
  }

  // Create output directory once before workers start
  if (!fs.existsSync(args.out)) {
    log.info(`Creating output directory: ${args.out}`);
    fs.mkdirSync(args.out, { recursive: true });
  }

  const data = await loadDataFile(args.in);
  const totalFramesInFile = data.length;
  const startFrame = args.resume;
  
  // Calculate total frames to render based on limit and file length
  let framesToRender = totalFramesInFile - startFrame;
  if (args.limit > 0 && args.limit < framesToRender) {
    framesToRender = args.limit;
  }
  
  const numJobs = Math.min(args.jobs, framesToRender);
  const chunkSize = Math.floor(framesToRender / numJobs);
  const remainder = framesToRender % numJobs;

  console.log(`\x1b[32mStarting Parallel Render\x1b[0m`);
  console.log(`Total Frames: ${framesToRender}`);
  console.log(`Workers:      ${numJobs}`);
  console.log(`-----------------------------------------`);

  let totalRendered = 0;
  const workerProgress = new Array(numJobs).fill(0);

  const updateProgress = () => {
    const total = workerProgress.reduce((a, b) => a + b, 0);
    const percentage = ((total / framesToRender) * 100).toFixed(1);
    
    // Move cursor to start of line and clear it
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`Progress: [${percentage}%] rendered ${total}/${framesToRender} frames across ${numJobs} workers`);
  };

  const workers = [];
  let currentStart = startFrame;

  for (let j = 0; j < numJobs; j++) {
    const workerLimit = chunkSize + (j < remainder ? 1 : 0);
    const workerResume = currentStart;
    currentStart += workerLimit;
    
    if (workerLimit <= 0) continue;

    const worker = spawn("node", [
      "src/main.js",
      "-i", args.in,
      "-c", args.config,
      "-o", args.out,
      "--resume", workerResume.toString(),
      "--limit", workerLimit.toString()
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, LOG_LEVEL: "info" }
    });

    // Parse stdout for progress
    worker.stdout.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.includes("rendered frame")) {
          workerProgress[j]++;
          updateProgress();
        }
      }
    });

    // Capture errors
    worker.stderr.on("data", (data) => {
      process.stdout.write("\n"); // move to next line to not break progress bar
      log.error(`Worker ${j}: ${data.toString().trim()}`);
    });

    workers.push(new Promise((resolve) => {
      worker.on("close", (code) => {
        resolve(code);
      });
    }));
  }

  await Promise.all(workers);
  process.stdout.write("\n");
  log.info("Parallel rendering complete!");
}

runParallel().catch(err => {
  log.error(`Parallel execution failed: ${err.message}`);
  process.exit(1);
});
