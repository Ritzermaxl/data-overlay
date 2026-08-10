import sharp from "sharp";
import { log } from "../logger.js";

class complication {
  constructor() {
    this.width;
    this.height;
    this.latDataChannel;
    this.lonDataChannel;

    this.minLat = Infinity;
    this.maxLat = -Infinity;
    this.minLon = Infinity;
    this.maxLon = -Infinity;

    this.trackBuffer;
    this.carIndicatorSize = 12;
    this.carColor = "#ff3333";
    this.trackColor = "#ffffff";
    this.trackWidth = 2;
  }

  smoothPoints(points, windowSize = 10) {
    const smoothed = [];
    for (let i = 0; i < points.length; i++) {
      let sumX = 0, sumY = 0, count = 0;
      for (let j = -windowSize; j <= windowSize; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < points.length) {
          sumX += points[idx].x;
          sumY += points[idx].y;
          count++;
        }
      }
      smoothed.push({ x: sumX / count, y: sumY / count });
    }
    return smoothed;
  }

  simplifyPath(points, tolerance = 0.8) {
    if (points.length <= 2) return points;
    let maxDist = 0, index = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.getSqSegDist(points[i], points[0], points[points.length - 1]);
      if (dist > maxDist) { index = i; maxDist = dist; }
    }
    if (maxDist > tolerance * tolerance) {
      const res1 = this.simplifyPath(points.slice(0, index + 1), tolerance);
      const res2 = this.simplifyPath(points.slice(index), tolerance);
      return res1.slice(0, res1.length - 1).concat(res2);
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  getSqSegDist(p, p1, p2) {
    let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
    if (dx !== 0 || dy !== 0) {
      let t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = p2.x; y = p2.y; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p.x - x; dy = p.y - y;
    return dx * dx + dy * dy;
  }

  async init(config, data) {
    log.info(`initializing polished complication 'trackmap'`);
    this.width = config.width;
    this.height = config.height;
    this.latDataChannel = config.options.latDataChannel || "Gyro_Movella_GPS_Latitude";
    this.lonDataChannel = config.options.lonDataChannel || "Gyro_Movella_GPS_Longitude";
    this.carIndicatorSize = config.options.carIndicatorSize || 12;
    this.carColor = config.options.carColor || "#ff3333";
    this.trackColor = config.options.trackColor || "#ffffff";
    this.trackWidth = config.options.trackWidth || 2;

    const rawPoints = [];
    for (const dataPoint of data) {
      const lat = parseFloat(dataPoint[this.latDataChannel]);
      const lon = parseFloat(dataPoint[this.lonDataChannel]);
      if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        if (lat < this.minLat) this.minLat = lat;
        if (lat > this.maxLat) this.maxLat = lat;
        if (lon < this.minLon) this.minLon = lon;
        if (lon > this.maxLon) this.maxLon = lon;
        rawPoints.push({ lat, lon });
      }
    }

    if (rawPoints.length === 0) {
      log.error("No valid GPS data found for trackmap");
      process.exit(1);
    }

    const latRange = this.maxLat - this.minLat;
    const lonRange = this.maxLon - this.minLon;
    const avgLat = (this.minLat + this.maxLat) / 2;
    const avgLon = (this.minLon + this.maxLon) / 2;
    const lonScaleFactor = Math.cos(avgLat * (Math.PI / 180));

    // Safety: check for division by zero
    let scale = 1.0;
    if (latRange > 0 || lonRange > 0) {
        scale = Math.min(
            (this.width * 0.85) / Math.max(0.000001, lonRange * lonScaleFactor),
            (this.height * 0.85) / Math.max(0.000001, latRange)
        );
    }

    let projectedPoints = rawPoints.map(p => ({
      x: (this.width / 2) + (p.lon - avgLon) * lonScaleFactor * scale,
      y: (this.height / 2) - (p.lat - avgLat) * scale
    })).filter(p => isFinite(p.x) && isFinite(p.y));

    const simplified = this.simplifyPath(this.smoothPoints(projectedPoints, 10), 0.8);
    const svgPath = simplified.length > 0 ? `M ${simplified.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}` : "";

    const svg = `
      <svg width="${this.width}" height="${this.height}">
        ${svgPath ? `<path d="${svgPath}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="${this.trackWidth + 6}" stroke-linejoin="round" stroke-linecap="round" />
        <path d="${svgPath}" fill="none" stroke="${this.trackColor}" stroke-width="${this.trackWidth}" stroke-linejoin="round" stroke-linecap="round" />` : ""}
      </svg>
    `;

    this.trackBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    log.info(`trackmap initialized (${simplified.length} points)`);
  }

  async render(dataPoint, frameIndex) {
    const lat = parseFloat(dataPoint[this.latDataChannel]);
    const lon = parseFloat(dataPoint[this.lonDataChannel]);

    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0 || !isFinite(lat) || !isFinite(lon)) {
      return this.trackBuffer;
    }

    const avgLat = (this.minLat + this.maxLat) / 2;
    const avgLon = (this.minLon + this.maxLon) / 2;
    const lonScaleFactor = Math.cos(avgLat * (Math.PI / 180));
    const latRange = this.maxLat - this.minLat;
    const lonRange = this.maxLon - this.minLon;

    const scale = (latRange > 0 || lonRange > 0) ? Math.min(
      (this.width * 0.85) / Math.max(0.000001, lonRange * lonScaleFactor),
      (this.height * 0.85) / Math.max(0.000001, latRange)
    ) : 1.0;

    const x = (this.width / 2) + (lon - avgLon) * lonScaleFactor * scale;
    const y = (this.height / 2) - (lat - avgLat) * scale;

    if (!isFinite(x) || !isFinite(y)) return this.trackBuffer;

    const carSvg = `<svg width="${this.width}" height="${this.height}"><circle cx="${x}" cy="${y}" r="${this.carIndicatorSize / 2 + 2}" fill="rgba(0,0,0,0.5)" /><circle cx="${x}" cy="${y}" r="${this.carIndicatorSize / 2}" fill="${this.carColor}" stroke="white" stroke-width="1.5" /></svg>`;

    return await sharp(this.trackBuffer)
      .composite([{ input: Buffer.from(carSvg) }])
      .png()
      .toBuffer();
  }
}

export default complication;
