import * as path from "node:path";
import { readFilesFromRecord, getAllFiles, getFile } from "./get_params.js";
import { __dirname } from "@/config/env.js";
import { TASK_TYPES } from "@/taskTypes/index.js";

const SKILLS_DIR = path.join(__dirname, "skills");

async function loadSkillDir(dirName: string): Promise<string[]> {
  const dirPath = path.join(SKILLS_DIR, dirName);
  try {
    const allFiles = await getAllFiles(dirPath);
    const mdFiles = allFiles
      .filter((f) => f.endsWith(".md"))
      .sort();
    const contents = await Promise.all(mdFiles.map((f) => getFile(f)));
    return contents.filter((c) => c.length > 0);
  } catch {
    console.warn(`[WARN] Could not load skill directory: ${dirName}`);
    return [];
  }
}

export async function resolveSkills(
  baseFiles: string[],
  taskType?: string | null
): Promise<string[]> {
  const contents = await readFilesFromRecord({ skills: baseFiles });

  if (taskType) {
    const taskTypeDef = TASK_TYPES.find((t) => t.slug === taskType);
    if (taskTypeDef) {
      for (const dir of taskTypeDef.skillDirs) {
        const extraContent = await loadSkillDir(dir);
        contents.push(...extraContent);
      }
      console.log(`[INFO] Loaded skills for task type: ${taskType}`);
    }
  }

  return contents;
}
