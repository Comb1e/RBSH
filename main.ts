import { createProvider } from "./providers/llm.js";
import { runGenerator, runHarness } from "@/agent/index.js";
import { dataPreprocess, readFilesFromList } from "@/utils/index.js";
import { readFilesFromRecord } from "@/utils/index.js";
import { runPlanner } from "@/agent/index.js";

import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function input(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      resolve(answer);
    });
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const USER_PROMPT = { prompts: ["user_prompt.md"] };
const INPUT_RAW_DIR = "./input_raw";
const OUTPUT_SCHEMAS_DIR = "./output_schemas";

async function main() {
  const args = process.argv.slice(2);

  // 1. Create provider
  const provider = createProvider();
  console.log("[INFO] LLM provider created.");

  const schemasPath = await dataPreprocess(INPUT_RAW_DIR, OUTPUT_SCHEMAS_DIR);
  const inputSchemas = await readFilesFromList(schemasPath);
  console.log("[INFO] Input schemas prepared.");

  let workType: string = args[0];
  let planPath: string = "";
  switch (workType) {
    case "plan": {
      console.log("[INFO] Starting plan...");
      let firstPlan: boolean = true;
      while (true) {
        const command = await input("> ");

        if (command === "q") {
          console.log("[INFO] RBSH exiting...");
          break;
        } else if (command === "e") {
          console.log("[INFO] Switching to execution mode...");
          workType = "excute";
          break;
        }

        let userPrompt: string = "";

        switch (command) {
          case "r": {
            console.log("[INFO] Reading user prompt from record...");
            const userPromptArray = await readFilesFromRecord(USER_PROMPT);
            userPrompt = userPromptArray.join("\n");
            break;
          }
          default:
            userPrompt = command;
            break;
        }
        if (firstPlan) {
          console.log("[INFO] User prompt received.", userPrompt);
          console.log("[INFO] Starting planner...");
          firstPlan = false;
          planPath = await runPlanner(
            provider,
            userPrompt,
            JSON.stringify(inputSchemas)
          );
        } else {
          console.log("[INFO] Starting planner with new user prompt...");
        }
      }

      rl.close();
      break;
    }
    case "excute": {
      console.log("[INFO] Starting agent harness...");
      if (planPath === "") {
      } else {
        const plans: string[] = await readFilesFromList([planPath]);
        const plan: string = plans[0];
        runHarness(provider, plan, inputSchemas);
      }
      break;
    }
    case "generate": {
      console.log("[INFO] Starting generation...");
      //runGenerator(provider, "Generate a SQL query to find the top 5 customers by revenue.", JSON.stringify(inputSchemas));
      break;
    }
    default: {
      break;
    }
  }
}

main();
//npx tsx main.ts plan
//npx tsx main.ts excute
