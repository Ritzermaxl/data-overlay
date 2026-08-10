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
parser.add_argument("--frame-offset", { type: "int", help: "frame offset", default: 0 });
parser.add_argument("-j", "--jobs", { type: "int", help: "number of parallel jobs (default: CPU count)", default: os.cpus().length });
parser.add_argument("--retries", { type: "int", help: "maximum retries per crashed worker", default: 10 });
parser.add_argument("--retry-delay", { type: "int", help: "delay between worker retries in milliseconds", default: 250 });

const args = parser.parse_args();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runParallel() {
  if (!fs.existsSync(args.in)) { log.error(`Input file '${args.in}' does not exist.`); process.exit(1); }
  if (!fs.existsSync(args.config)) { log.error(`Config file '${args.config}' does not exist.`); process.exit(1); }

  if (!fs.existsSync(args.out)) {
    log.info(`Creating output directory: ${args.out}`);
    fs.mkdirSync(args.out, { recursive: true });
  }

  const data = await loadDataFile(args.in);
  const totalPossibleFrames = data.length + (args.frame_offset < 0 ? Math.abs(args.frame_offset) : 0);
  const startFrame = Math.max(0, args.resume);
  
  let framesToRender = totalPossibleFrames - startFrame;
  if (args.limit > 0 && args.limit < framesToRender) framesToRender = args.limit;
  
  const numJobs = Math.min(args.jobs, framesToRender);
  const chunkSize = Math.floor(framesToRender / numJobs);
  const remainder = framesToRender % numJobs;

  console.log(`\x1b[32mStarting Parallel Render\x1b[0m`);
  console.log(`Total Frames: ${framesToRender}`);
  console.log(`Workers:      ${numJobs}`);
  console.log(`-----------------------------------------`);

  const workerProgress = new Array(numJobs).fill(0);
  const updateProgress = () => {
    const total = workerProgress.reduce((a, b) => a + b, 0);
    const percentage = ((total / framesToRender) * 100).toFixed(1);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`Progress: [${percentage}%] rendered ${total}/${framesToRender} frames across ${numJobs} workers`);
  };

  const workers = [];
  let currentStart = startFrame;

  const runWorker = (workerId, rangeStart, rangeEnd) => new Promise((resolve, reject) => {
    let nextFrame = rangeStart;
    let retries = 0;
    const lastWorkerLogs = [];

    const rememberLog = (line) => {
      if (!line.trim()) return;
      lastWorkerLogs.push(line.trim());
      if (lastWorkerLogs.length > 5) lastWorkerLogs.shift();
    };

    const startAttempt = () => {
      const worker = spawn("node", [
        "src/main.js", "-i", args.in, "-c", args.config, "-o", args.out,
        "--resume", nextFrame.toString(),
        "--limit", (rangeEnd - nextFrame + 1).toString(),
        "--frame-offset", args.frame_offset.toString()
      ], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, LOG_LEVEL: "info" }
      });

      const stdout = readline.createInterface({ input: worker.stdout });
      const stderr = readline.createInterface({ input: worker.stderr });

      stdout.on("line", (line) => {
        rememberLog(line);
        const match = line.match(/rendered frame (\d+)\//);
        if (!match) return;

        const renderedFrame = Number(match[1]);
        if (renderedFrame >= nextFrame && renderedFrame <= rangeEnd) {
          nextFrame = renderedFrame + 1;
          workerProgress[workerId]++;
          updateProgress();
        }
      });

      stderr.on("line", (line) => rememberLog(`ERR: ${line}`));

      worker.on("error", (err) => rememberLog(`ERR: ${err.message}`));
      worker.on("close", async (code, signal) => {
        stdout.close();
        stderr.close();

        if (code === 0 && nextFrame > rangeEnd) {
          resolve();
          return;
        }

        if (retries >= args.retries) {
          const reason = signal ? `signal ${signal}` : `code ${code}`;
          reject(new Error(
            `Worker ${workerId} failed after ${retries} retries (${reason}) at frame ${nextFrame}\n` +
            `Recent logs:\n${lastWorkerLogs.join("\n")}`
          ));
          return;
        }

        retries++;
        process.stdout.write("\n");
        log.warn(
          `Worker ${workerId} crashed; retry ${retries}/${args.retries} ` +
          `will resume at frame ${nextFrame}`
        );
        await sleep(Math.max(0, args.retry_delay));
        startAttempt();
      });
    };

    startAttempt();
  });

  for (let j = 0; j < numJobs; j++) {
    const workerLimit = chunkSize + (j < remainder ? 1 : 0);
    const workerResume = currentStart;
    currentStart += workerLimit;
    if (workerLimit <= 0) continue;

    // Staggered start: wait 500ms between worker spawns to prevent CPU spikes during init
    await sleep(500);

    workers.push(runWorker(j, workerResume, workerResume + workerLimit - 1));
  }

  try {
    await Promise.all(workers);
    process.stdout.write("\n");
    log.info("Parallel rendering complete!");
  } catch (err) {
    process.stdout.write("\n");
    log.error(`Parallel render failed:\n${err.message}`);
    process.exit(1);
  }
}

runParallel().catch(err => {
  log.error(`Execution failed: ${err.message}`);
  process.exit(1);
});
