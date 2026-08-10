import sharp from "sharp";
import { log } from "../logger.js";

const WHEELS = ["FL", "FR", "RL", "RR"];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function interpolateColor(stops, value) {
  const clamped = Math.max(stops[0][0], Math.min(stops.at(-1)[0], value));
  const upperIndex = stops.findIndex(([position]) => position >= clamped);
  if (upperIndex <= 0) return stops[0][1];

  const [lowPosition, lowColor] = stops[upperIndex - 1];
  const [highPosition, highColor] = stops[upperIndex];
  const amount = (clamped - lowPosition) / (highPosition - lowPosition);
  const rgb = lowColor.map((channel, index) =>
    Math.round(channel + (highColor[index] - channel) * amount),
  );
  return `rgb(${rgb.join(",")})`;
}

class TyreTemperature {
  async init(config) {
    this.width = config.width;
    this.height = config.height;
    this.minTemperature = config.options.minTemperature ?? 20;
    this.maxTemperature = config.options.maxTemperature ?? 80;
    this.channelTemplate = config.options.channelTemplate ?? "Wheel_TireTemp_{wheel}_Ch{channel}";
    this.channels = Object.fromEntries(WHEELS.map((wheel) => [
      wheel,
      Array.from({ length: 8 }, (_, index) => this.channelTemplate
        .replace("{wheel}", wheel)
        .replace("{channel}", index + 1)),
    ]));

    // Temperatures are normalized over 20-80 C. Green deliberately spans
    // the desired 55-65 C operating window.
    this.colorStops = [
      [0, [37, 99, 235]],
      [0.42, [34, 211, 238]],
      [0.57, [250, 204, 21]],
      [0.63, [34, 197, 94]],
      [0.70, [22, 163, 74]],
      [0.77, [249, 115, 22]],
      [1, [220, 38, 38]],
    ];

    log.info(`complication 'tyre-temperature' initialized`);
  }

  temperatureColor(temperature) {
    const normalized = (temperature - this.minTemperature) /
      (this.maxTemperature - this.minTemperature);
    return interpolateColor(this.colorStops, normalized);
  }

  tyreGradient(wheel, dataPoint) {
    const values = this.channels[wheel].map((channel) => {
      const value = Number.parseFloat(dataPoint[channel]);
      return Number.isFinite(value) ? value : this.minTemperature;
    });
    // Channel 1 is on the chassis side: right edge for left tyres and left
    // edge for right tyres.
    if (wheel.endsWith("L")) values.reverse();

    return values.map((temperature, index) => {
      const offset = (index / (values.length - 1)) * 100;
      return `<stop offset="${offset}%" stop-color="${this.temperatureColor(temperature)}"/>`;
    }).join("");
  }

  async render(dataPoint) {
    const tyreWidth = Math.max(20, Math.round(this.width * 0.2));
    const tyreHeight = Math.max(40, Math.round(this.height * 0.34));
    const left = Math.round(this.width * 0.08);
    const right = this.width - left - tyreWidth;
    const front = Math.round(this.height * 0.12);
    const rear = this.height - front - tyreHeight;
    const positions = {
      FL: [left, front], FR: [right, front],
      RL: [left, rear], RR: [right, rear],
    };
    const tyreData = WHEELS.map((wheel) => {
      const [x, y] = positions[wheel];
      return {
        gradient: `<linearGradient id="gradient-${wheel}" x1="0" y1="0" x2="1" y2="0">
          ${this.tyreGradient(wheel, dataPoint)}
        </linearGradient>`,
        shape: `<rect x="${x}" y="${y}" width="${tyreWidth}" height="${tyreHeight}"
          rx="${Math.round(tyreWidth * 0.22)}" fill="url(#gradient-${wheel})"
          stroke="white" stroke-opacity="0.75" stroke-width="2"/>
        <text x="${x + tyreWidth / 2}" y="${y - 6}" text-anchor="middle"
          fill="white" font-family="sans-serif" font-size="14">${escapeXml(wheel)}</text>`,
      };
    });

    const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>${tyreData.map(({ gradient }) => gradient).join("")}</defs>
        ${tyreData.map(({ shape }) => shape).join("")}
      </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}

export default TyreTemperature;
