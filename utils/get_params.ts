import { readFile } from "fs/promises";
import path from "path";

export async function getFile(targetPath: string): Promise<string> {
  let file: Promise<string> = Promise.resolve("");
  try {
    const filePath = path.resolve(__dirname, targetPath);
    file = readFile(filePath, "utf-8");
  } catch (error) {
    console.error("[ERROR] Read file error", (error as Error).message);
    console.error("[ERROR] Target path:", targetPath);
  }
  return file;
}
