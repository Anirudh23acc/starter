
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { TEST_COVERAGE_ANALYZER_PROMPT } from "../prompts/test-coverage-analyzer.prompt";

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    "Analyzes source code and existing tests to identify untested functions, missing branches, edge cases, weak assertions, and test coverage gaps.",

  prompt: TEST_COVERAGE_ANALYZER_PROMPT,

  tools: [
    "Read",
    "Grep",
    "Glob",
    "Skill"
  ],

  model: "inherit"
};

