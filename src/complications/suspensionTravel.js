import sharp from "sharp";
import { log } from "../logger.js";

const WHEELS = ["FL", "FR", "RL", "RR"];

class SuspensionTravel {
  async init(config) {
    this.width = config.width;
    this.height = config.height;
    this.maxTravel = config.options.maxTravel ?? 30;
    this.channels = Object.fromEntries(WHEELS.map((wheel) => [
      wheel,
      config.options[`${wheel.toLowerCase()}TravelDataChannel`],
    ]));
    log.info(`complication 'suspension-travel' initialized`);
  }

  async render(dataPoint) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const barWidth = Math.max(18, Math.round(this.width * 0.085));
    const barHeight = Math.round(this.height * 0.3);
    const left = Math.round(this.width * 0.12);
    const right = this.width - left - barWidth;
    const front = Math.round(this.height * 0.1);
    const rear = this.height - front - barHeight;
    const positions = {
      FL: [left, front], FR: [right, front],
      RL: [left, rear], RR: [right, rear],
    };

    const bars = WHEELS.map((wheel) => {
      const parsed = Number.parseFloat(dataPoint[this.channels[wheel]]);
      const value = Number.isFinite(parsed) ? parsed : 0;
      const normalized = Math.max(-1, Math.min(1, value / this.maxTravel));
      const [x, y] = positions[wheel];
      const zeroY = y + barHeight / 2;
      const fillHeight = Math.abs(normalized) * barHeight / 2;
      const fillY = normalized >= 0 ? zeroY - fillHeight : zeroY;
      const color = normalized >= 0 ? "#f97316" : "#38bdf8";
      const labelY = wheel.startsWith("F") ? y - 7 : y + barHeight + 17;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5"
          fill="#111827" fill-opacity="0.72" stroke="white" stroke-opacity="0.5"/>
        <rect x="${x}" y="${fillY}" width="${barWidth}" height="${fillHeight}"
          rx="3" fill="${color}" fill-opacity="0.95"/>
        <line x1="${x - 3}" y1="${zeroY}" x2="${x + barWidth + 3}" y2="${zeroY}"
          stroke="white" stroke-width="2"/>
        <text x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle"
          fill="white" font-family="sans-serif" font-size="13">${wheel} ${value.toFixed(1)}</text>`;
    }).join("");

    const bodyWidth = Math.round(this.width * 0.28);
    const bodyHeight = Math.round(this.height * 0.64);
    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <path d="M ${centerX} ${centerY - bodyHeight / 2}
          C ${centerX + bodyWidth / 2} ${centerY - bodyHeight * 0.35},
            ${centerX + bodyWidth / 2} ${centerY + bodyHeight * 0.35},
            ${centerX} ${centerY + bodyHeight / 2}
          C ${centerX - bodyWidth / 2} ${centerY + bodyHeight * 0.35},
            ${centerX - bodyWidth / 2} ${centerY - bodyHeight * 0.35},
            ${centerX} ${centerY - bodyHeight / 2} Z"
          fill="#111827" fill-opacity="0.55" stroke="white" stroke-opacity="0.55" stroke-width="2"/>
        <path d="M ${centerX - 8} ${centerY - bodyHeight / 2 + 15} L ${centerX} ${centerY - bodyHeight / 2 + 5}
          L ${centerX + 8} ${centerY - bodyHeight / 2 + 15}" fill="none" stroke="white" stroke-width="2"/>
        ${bars}
        <text x="${centerX}" y="${this.height - 5}" text-anchor="middle"
          fill="white" fill-opacity="0.8" font-family="sans-serif" font-size="12">wheel travel [mm]</text>
      </svg>`;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}

export default SuspensionTravel;
