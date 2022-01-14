import fs from "fs-extra";
import path from "node:path";
import cache from "memory-cache";
import glob from "glob";
import fm from "front-matter";
import { parse } from "node-html-parser";
import { cosmiconfigSync } from "cosmiconfig";
import { marked } from "marked";

import compileTemplate from "../core/compileTemplate";
import copyAssets from "../utils/copyAssets";
import logger from "../utils/logger";
import resolvePath from "../utils/resolvePath";
import injectLiveReloadScript from "../utils/injectLiveReloadScript";
import writeToOutput from "../utils/writeToOutput";

import { scriptCache } from "../core/instanceComponentScript";

const explorer = cosmiconfigSync("deadsimple");
const { config } = explorer.load(".deadsimplerc");

const INPUT_FILE = path.resolve(config.input);
const BASE_FOLDER = path.dirname(config.input);
const PAGES_FOLDER = config.pagesFolder || "pages";
const OUTPUT_FOLDER = config.out || "dist";
const STATIC_FOLDER = config.staticFolder || "static";

export const buildConfig = {
  INPUT_FILE,
  BASE_FOLDER,
  PAGES_FOLDER,
  OUTPUT_FOLDER,
  STATIC_FOLDER,
};

fs.emptyDirSync(buildConfig.OUTPUT_FOLDER);
export const PAGES_REGEX = new RegExp(`^\\b${buildConfig.PAGES_FOLDER}\\b`);

function relinkHyperlinks(root, baseFolder) {
  try {
    // Relink & parse hyperlinked files
    const hyperlinks = root.querySelectorAll('a[href!="#"]');
    hyperlinks.forEach((hyperlink) => {
      const rawUrl = hyperlink.getAttribute("href");
      const assetUrl = resolvePath(baseFolder, rawUrl);
      if (rawUrl.startsWith("http")) return;

      const href = `/${rawUrl.replace(PAGES_REGEX, "").replace("/", "")}`;
      hyperlink.setAttribute("href", href);

      // Fix css newline classes
      // (only related to tailwind classes where classes are newline separated)
      if (hyperlink.attributes.class) {
        hyperlink.setAttribute(
          "class",
          hyperlink.attributes.class.replace(/\s+/gim, " ")
        );
      }

      if (!cache.get(assetUrl)) {
        // compile(assetUrl);
      }
    });
  } catch (err) {
    console.log(err);
  }
}

function compile(inputFile = buildConfig.INPUT_FILE, htmlContent) {
  cache.put(inputFile, true);
  const fileName = path.basename(inputFile);
  const filePath = path.relative(buildConfig.BASE_FOLDER, inputFile);

  try {
    const fileContent = fs.readFileSync(inputFile, { encoding: "utf-8" });
    const root = parse(htmlContent ? htmlContent : fileContent);

    logger.log(`\nCompiling Template ${fileName}`, "magentaBright");
    root.set_content(compileTemplate(root.innerHTML, buildConfig.BASE_FOLDER));

    copyAssets(buildConfig.BASE_FOLDER, buildConfig.OUTPUT_FOLDER);
    relinkHyperlinks(root, buildConfig.BASE_FOLDER);

    injectLiveReloadScript(root);
    writeToOutput(root, filePath);

    // remove script cache
    Object.keys(scriptCache).forEach((key) => {
      delete scriptCache[key];
    });
    logger.log(`DONE - ${fileName}`, "green");
  } catch (err) {
    // if (err.code == "ENOENT") {
    //   logger.error(`No such file: "${filePath}"`);
    //   process.exit(1);
    // }

    console.log(err);
  }
}

function buildPagesFolder() {
  const pagesFolder = resolvePath(
    buildConfig.BASE_FOLDER,
    buildConfig.PAGES_FOLDER
  );
  const globUrls = glob.sync(`${pagesFolder}/**/*.html`);
  const globMd = glob.sync(`${pagesFolder}/**/*.md`);

  globUrls.forEach((url) => {
    compile(url);
  });

  globMd.forEach((url) => {
    let stack = [];
    let markdown = fs.readFileSync(url, { encoding: "utf-8" });
    const frontmatter = fm(markdown);
    marked.use({
      walkTokens(token) {
        // skip content in mustaches
        if (token.raw.includes("{{")) stack.push("{{");
        if (token.raw.includes("}}")) stack.pop()
        if (stack.length > 0) {
          token.type = 'text'
          token.text = token.raw
        }
      },
    });
    const html = marked(frontmatter.body);
    compile(url, html);
  });
}

compile(INPUT_FILE);
buildPagesFolder();

export default compile;

// const contentIncludes = root.querySelectorAll("[data-include-content]");

// contentIncludes.forEach((include) => {
//   const url = include.getAttribute("data-include-content");
//   const globUrls = glob.sync(resolvePath(buildConfig.OUTPUT_FOLDER, url));

//   globUrls.forEach((globUrl) => {
//     let markdown = fs.readFileSync(globUrl, { encoding: "utf-8" });
//     const frontmatter = fm(markdown);
//     markdown = markdown.replace(/^---$.*^---$/ms, "");

//     const html = marked.parse(frontmatter.body);
//     const title = kebabCase(frontmatter.attributes.title);
//     const file = `./dist/${fileName.replace(".html", "")}/${title}.html`;
//     root
//       .querySelector("head")
//       .setAttribute("data-prop-title", frontmatter.attributes.title);
//     include.innerHTML = html;
//     root.innerHTML = compileTemplate(root.innerHTML, buildConfig.OUTPUT_FOLDER);

//     fs.ensureDirSync(path.dirname(file));
//     fs.writeFileSync(file, root.toString());
//   });
// });

// if (contentIncludes.length === 0) {
//   fs.writeFileSync(`./dist/${fileName}`, root.toString());
// }