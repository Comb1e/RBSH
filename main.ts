import { createProvider } from "./providers/llm";
import { runHarness } from "@/agent";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const provider = createProvider();
runHarness(provider, "你可以做什么");
