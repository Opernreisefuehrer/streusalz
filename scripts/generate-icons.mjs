import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const source = await readFile(resolve("public", "snowflake.svg"), "utf8");
const sizes = [512, 180, 16, 32, 48, 64];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const images = await page.evaluate(async ({ source, sizes }) => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Cannot render the snowflake icon."));
      image.src = `data:image/svg+xml;base64,${btoa(source)}`;
    });
    return sizes.map(size => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Cannot create the icon canvas.");
      if (size === 180) { context.fillStyle = "#fff"; context.fillRect(0, 0, size, size); }
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL("image/png").split(",")[1];
    });
  }, { source, sizes });
  const buffers = images.map(image => Buffer.from(image, "base64"));
  const frames = buffers.slice(2);
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = sizes[index + 2];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  await Promise.all([
    writeFile(resolve("src", "app", "icon.png"), buffers[0]),
    writeFile(resolve("src", "app", "apple-icon.png"), buffers[1]),
    writeFile(resolve("src", "app", "favicon.ico"), Buffer.concat([header, ...frames])),
  ]);
  console.log("Generated snowflake-only PNG, Apple and multi-size ICO icons.");
} finally {
  await browser.close();
}
