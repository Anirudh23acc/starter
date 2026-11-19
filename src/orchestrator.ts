import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Options } from "@anthropic-ai/claude-agent-sdk";

import {
  ReviewReportSchema,
  ReviewReportJSONSchema,
  type ReviewReport
} from "./types/report-types";

import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from "./agents";

import { ORCHESTRATOR_PROMPT } from "./prompts";
import { mcpServersConfig } from "./config/mcp.config";
import {
  logReviewStart,
  logReviewComplete,
  logReviewError
} from "./utils/logger";

export interface OrchestratorOptions {
  model?: string;
  projectRoot?: string;
}

export class CodeReviewOrchestrator {
  private model: string;
  private projectRoot: string;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model || process.env.ANTHROPIC_MODEL || "";
    this.projectRoot =
      options.projectRoot ||
      process.env.PROJECT_ROOT ||
      process.cwd();

    if (!this.model) {
      throw new Error("ANTHROPIC_MODEL is not configured");
    }
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();

    logReviewStart(owner, repo, prNumber);

    try {
      const prompt = `
${ORCHESTRATOR_PROMPT}

## Pull Request To Review

Repository owner: ${owner}
Repository name: ${repo}
Pull request number: ${prNumber}

## Required Execution Instructions

1. Use the GitHub MCP tools to retrieve the pull request details,
   changed files, diffs, and relevant source code.
2. Identify every relevant changed source file.
3. Delegate the analysis to all three registered agents:
   - code-quality-analyzer
   - test-coverage-analyzer
   - refactoring-suggester
4. Use the Task tool to invoke the three agents independently.
5. Run the three agent tasks in parallel where possible.
6. Give each agent the PR context and the relevant changed file information.
7. Collect their results and combine them into the required report.
8. Calculate the summary using the collected findings.
9. Include the PR owner, repository, and number exactly as supplied.
10. Return a complete report matching the required JSON schema.

Do not fabricate findings or results. If an agent fails, handle the
failure gracefully and do not invent its analysis.
`;

      const options: Options = {
        cwd: this.projectRoot,
        model: this.model,

        tools: ["Task"],

        allowedTools: [
          "Task",
          "StructuredOutput",
          "mcp__github__get_pull_request",
          "mcp__github__get_pull_request_files",
          "mcp__github__get_file_contents",
          "mcp__github__get_pull_request_status",
          "mcp__github__get_pull_request_comments",
          "mcp__github__get_pull_request_reviews"
        ],

        permissionMode: "dontAsk",

        agents: {
          "code-quality-analyzer": codeQualityAnalyzer,
          "test-coverage-analyzer": testCoverageAnalyzer,
          "refactoring-suggester": refactoringSuggester
        },

        mcpServers: mcpServersConfig,

        outputFormat: {
          type: "json_schema",
          schema: ReviewReportJSONSchema
        }
      };

      const response = query({
        prompt,
        options
      });

      let reviewReport: ReviewReport | undefined;

     
      for await (const message of response) {

        // 1. SDK initialization
        if (message.type === "system" && message.subtype === "init") {
          console.log("\n[SDK] Claude Agent SDK initialized");
          console.log("[SDK] Session ID:", message.session_id);
          console.log("[SDK] Available tools:", message.tools);
          console.log("[SDK] MCP servers:", message.mcp_servers);
        }

        // 2. Claude assistant messages
        if (message.type === "assistant") {
          console.log("\n[CLAUDE] Assistant message received");

          for (const block of message.message.content) {
            if (block.type === "text") {
              console.log("[CLAUDE]", block.text.slice(0, 500));
            }

            if (block.type === "tool_use") {
              console.log(
                `[TOOL] Invoking: ${block.name}`
              );

              // Log the input without exposing full source code or secrets
              if (block.name === "Task") {
                console.log("[AGENT] Subagent invocation requested");
              }
            }
          }
        }

        // 3. Tool responses
        if (message.type === "user") {
          console.log("[TOOL] Tool response received");
          console.dir(message.message.content, {
            depth: 6,
            colors: true
          });
        }

        // 4. Final result
        if (message.type === "result") {
          console.log("\n[SDK] Final result received");
          console.log("[SDK] Status:", message.subtype);
          console.log("[SDK] Duration:", message.duration_ms, "ms");
          console.log("[SDK] Turns:", message.num_turns);

          if (message.subtype !== "success") {
            throw new Error(
              `Claude review failed: ${message.subtype} - ${message.errors.join(", ")}`
            );
          }

          const validation = ReviewReportSchema.safeParse(
            message.structured_output
          );

          if (!validation.success) {
            console.error(
              "[VALIDATION] Structured output validation failed:",
              validation.error.flatten()
            );

            throw new Error(
              `Invalid review report: ${validation.error.message}`
            );
          }

          console.log("[VALIDATION] ReviewReport schema validated");

          reviewReport = validation.data;
        }
      }


      if (!reviewReport) {
        throw new Error("Claude did not return a structured review report");
      }

      // Ensure metadata reflects this execution.
      reviewReport.metadata.duration = Date.now() - startTime;

      logReviewComplete(
        owner,
        repo,
        prNumber,
        reviewReport.summary.overallScore,
        reviewReport.metadata.duration
      );

      return reviewReport;

    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      logReviewError(owner, repo, prNumber, normalizedError);

      throw normalizedError;
    }
  }
}