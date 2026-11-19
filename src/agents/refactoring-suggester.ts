
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { REFACTORING_SUGGESTER_PROMPT } from "../prompts/refactoring-suggester.prompt";

export const refactoringSuggester: AgentDefinition = {
  description:
    "Identifies code refactoring opportunities including function extraction, better naming, modernization, simplification, and design pattern improvements.",

  prompt: REFACTORING_SUGGESTER_PROMPT,

  tools: [
    "Read",
    "Grep",
    "Glob",
    "Skill"
  ],

  model: "inherit"
};

