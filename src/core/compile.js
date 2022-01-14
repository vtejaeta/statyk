import fs from "fs-extra";
import path from "node:path";
import { Cache } from "memory-cache";
import { parse } from "node-html-parser";

import logger from "../utils/logger";
import copyAssets from "../utils/copyAssets";
import relinkHyperlinks from "./relinkHyperlinks";
import writeToOutput from "../utils/writeToOutput";
import compileTemplate from "../core/compileTemplate";
import injectLiveReloadScript from "../utils/injectLiveReloadScript";

export const coreRuntime = {
  caches: {
    compilation: new Cache(),
    scripts: new Cache(),
  },
  isFirstCompileRun: true,
};

/**
 *
 * @param {import("../utils/getBuildInfo").BuildInfo} buildInfo
 * @param {string} htmlContent
 */
function compile(input, buildInfo, htmlContent) {
  const inputFile = path.resolve(input || buildInfo.INPUT_FILE);

  coreRuntime.caches.compilation.put(inputFile, true);
  const fileName = path.basename(inputFile);
  const filePath = path.relative(buildInfo.BASE_FOLDER, inputFile);

  try {
    const fileContent = htmlContent
      ? htmlContent
      : fs.readFileSync(inputFile, { encoding: "utf-8" });
    const root = parse(fileContent);

    logger.log(`>> Compiling Template ${fileName}`, "magentaBright");
    root.set_content(compileTemplate(root.innerHTML, buildInfo.BASE_FOLDER));

    if (coreRuntime.isFirstCompileRun) {
      copyAssets(buildInfo.BASE_FOLDER, buildInfo.OUTPUT_FOLDER);
    }
    relinkHyperlinks(root, buildInfo);

    injectLiveReloadScript(root);
    writeToOutput(root, filePath, buildInfo);

    // remove script cache
    coreRuntime.caches.scripts.clear();
    logger.log(`DONE - ${fileName}`, "gray");
  } catch (err) {
    // if (err.code == "ENOENT") {
    //   logger.error(`No such file: "${filePath}"`);
    //   process.exit(1);
    // }

    console.log(err);
  }

  coreRuntime.isFirstCompileRun = false;
}

export default compile;