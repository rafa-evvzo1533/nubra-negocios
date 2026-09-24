import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
await mkdir("public/ocr/core", { recursive: true });
await mkdir("public/ocr/lang", { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/ocr/worker.min.js",
);
for (const file of await readdir("node_modules/tesseract.js-core"))
  if (file.endsWith(".wasm") || file.endsWith(".wasm.js"))
    await copyFile(
      path.join("node_modules/tesseract.js-core", file),
      path.join("public/ocr/core", file),
    );
await copyFile(
  "node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz",
  "public/ocr/lang/spa.traineddata.gz",
);
console.log("OCR assets ready locally.");
