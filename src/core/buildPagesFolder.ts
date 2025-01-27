import glob from "glob";
import fm from "front-matter";
import { marked } from "marked";
import { compile } from "./compile";
import resolvePath from "../utils/resolvePath";
import { StatykContext } from "./types";

export function parseMarkdown(content: string) {
  const stack: string[] = [];

  const frontmatter = fm(content);
  marked.use({
    walkTokens(token) {
      // skip content in mustaches
      if (token.raw.includes("{{")) stack.push("{{");
      if (token.raw.includes("}}")) stack.pop();
      if (stack.length > 0) {
        token.type = "text";
        // @ts-ignore
        token.text = token.raw;
      }
    },
  });
  const html = marked(frontmatter.body);

  return html;
}

async function buildPagesFolder(statykCtx: StatykContext) {
  const pagesFolder = resolvePath(
    statykCtx.BASE_FOLDER,
    statykCtx.PAGES_FOLDER
  );
  const globUrls = glob.sync(`${pagesFolder}/**/*.+(html|md)`);
  for (const url of globUrls) {
    await compile(url, statykCtx);
  }
}

export default buildPagesFolder;
