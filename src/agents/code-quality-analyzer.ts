
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { CODE_QUALITY_ANALYZER_PROMPT } from "../prompts/code-quality-analyzer.prompt";

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    "Analyzes source code for security vulnerabilities, performance problems, bugs, maintainability issues, and coding best-practice violations.",

  prompt: CODE_QUALITY_ANALYZER_PROMPT,

  tools: [
    "Read",
    "Grep",
    "Glob",
    "Skill"
  ],

  model: "inherit"
};

