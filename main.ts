import { createProvider } from "./providers/llm";
import { runHarness } from "@/agent";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const provider = createProvider();
runHarness(provider, "写一份主成分分析的 python 代码");
