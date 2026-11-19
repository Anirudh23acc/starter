
import * as dotenv from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { CodeReviewOrchestrator } from "./orchestrator";
import { ReportGenerator } from "./utils/report-generator";

import { logger } from "./utils/logger";

dotenv.config();

async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // Validate command-line arguments
  if (!owner || !repo || !prStr) {
    console.error(
      "Usage: npm run dev -- <owner> <repo> <pr-number>"
    );
    process.exit(1);
  }

  const prNumber = Number(prStr);

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.error("Error: PR number must be a positive integer.");
    process.exit(1);
  }

  // Validate authentication
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

  const hasAwsCredentials =
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  if (hasAwsCredentials) {
    if (!process.env.AWS_REGION) {
      console.error("Error: AWS_REGION is required for Bedrock.");
      process.exit(1);
    }

    console.log("🔐 Using AWS Bedrock authentication");
  } else if (hasAnthropicKey) {
    console.log("🔐 Using Anthropic API authentication");
  } else {
    console.error(
      "Authentication missing. Configure either:\n" +
      "1. ANTHROPIC_API_KEY\n" +
      "OR\n" +
      "2. AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION"
    );
    process.exit(1);
  }

  // Validate model
  const model = process.env.ANTHROPIC_MODEL;

  if (!model) {
    console.error("Error: ANTHROPIC_MODEL is required.");
    process.exit(1);
  }

  try {
    console.log(`Starting review: ${owner}/${repo} PR #${prNumber}`);

    const orchestrator = new CodeReviewOrchestrator({
      model,
      projectRoot: process.env.PROJECT_ROOT || process.cwd()
    });

    const report = await orchestrator.reviewPullRequest(
      owner,
      repo,
      prNumber
    );

    // Generate reports
    const reportGenerator = new ReportGenerator();

    const reportsDirectory = path.resolve("reports");

    await mkdir(reportsDirectory, { recursive: true });

    const filePrefix = `${owner}-${repo}-pr-${prNumber}`;

    await Promise.all([
      writeFile(
        path.join(reportsDirectory, `${filePrefix}.md`),
        reportGenerator.generateMarkdownReport(report)
      ),
      writeFile(
        path.join(reportsDirectory, `${filePrefix}.html`),
        reportGenerator.generateHTMLReport(report)
      ),
      writeFile(
        path.join(reportsDirectory, `${filePrefix}.json`),
        reportGenerator.generateJSONReport(report)
      )
    ]);

    console.log("\n✅ Code review completed!");
    console.log(`Overall score: ${report.summary.overallScore}/100`);
    console.log(`Files reviewed: ${report.summary.totalFiles}`);
    console.log(`Reports saved in: ${reportsDirectory}`);

  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    logger.error("Application failed", { error: message });
    console.error("Error:", message);
    process.exitCode = 1;
  }
}

main();
