import fs from "fs";
import * as yaml from "js-yaml";
import { Validator } from "jsonschema";
import sharp from "sharp";
import path from "path";

async function main() {
  const pwd = process.env.PWD;
  const fontFle = path.join(pwd, "assets", "DSEG14Classic-Regular.ttf");
  await sharp({
    create: {
      width: 500,
      height: 500,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.25 },
    },
  })
    .png()
    .composite([
      {
        input: {
          text: {
            text: "100.4 km/h",
            height: 100,
            width: 400,
            rgba: true,
            font: "DSEG14 Classic",
            fontfile: fontFle,
          },
        },
      },
    ])
    .toFile("out.png");
}

(async () => {
  await main();
})();
