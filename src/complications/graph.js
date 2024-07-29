import sharp from "sharp";
import { log } from "../logger.js";

class ValueGraph {
  constructor() {
    this.width;
    this.height;
    this.dataChannel;
    this.graphDuration = 10; // Duration of the graph in seconds
    this.maxValue;
    this.minValue;
  }

  async init(config, data) {
    log.info(`initializing complication 'value-graph'`);

    this.width = config.width;
    this.height = config.height;
    this.dataChannel = config.options.dataChannel;
    this.maxValue = config.options.maxValue || 1;
    this.minValue = config.options.minValue || 0;

    // Additional initialization based on the data can be added here

    log.info(`complication 'value-graph' initialized`);
  }

  async render(dataPoints, frameIndex) {
    // Calculate the number of data points to display based on the graph duration and data points frequency
    const pointsToDisplay = 10; // This should be calculated based on your data frequency and the duration of the graph

    // Filter the last 'pointsToDisplay' data points
    const recentDataPoints = dataPoints.slice(-pointsToDisplay);

    // Generate graph points
    const graphPoints = recentDataPoints.map((dataPoint, index) => {
      const value = dataPoint[this.dataChannel];
      const normalizedValue = (value - this.minValue) / (this.maxValue - this.minValue);
      return {
        x: Math.round((index / (pointsToDisplay - 1)) * this.width),
        y: this.height - Math.round(normalizedValue * this.height),
      };
    });

    // Create a line graph from the points
    const lineGraph = {
      input: this.createLineGraphImage(graphPoints),
      top: 0,
      left: 0,
    };

    return await sharp({
      create: {
        width: this.width,
        height: this.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.0 },
      },
    })
      .png()
      .composite([lineGraph])
      .toBuffer();
  }

  createLineGraphImage(graphPoints) {
    // This method should create an image buffer representing the line graph
    // For simplicity, this example won't include the actual implementation of drawing the graph
    // You might use a canvas library to draw on a canvas and then convert it to a buffer
    log.info(`Creating line graph image - this method needs to be implemented`);
    return Buffer.alloc(0); // Placeholder
  }
}

export default ValueGraph;