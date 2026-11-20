
import { describe, it, expect } from "vitest";

import { ReviewReportSchema } from "../src/types/report-types";
import {
  withRetry,
  withTimeout,
} from "../src/utils/error-handler";

describe("ReviewReportSchema", () => {
  const validReport = {
    pullRequest: {
      owner: "octocat",
      repo: "Hello-World",
      number: 1,
    },
    fileReviews: [],
    summary: {
      totalFiles: 0,
      overallScore: 95,
      criticalIssues: 0,
      highPriorityTests: 0,
      refactoringOpportunities: 0,
    },
    recommendations: [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      duration: 1,
      agentVersions: {},
    },
  };

  it("should accept a valid ReviewReport", () => {
    const result = ReviewReportSchema.safeParse(validReport);

    expect(result.success).toBe(true);
  });

  it("should reject an invalid overallScore type", () => {
    const invalidReport = {
      ...validReport,
      summary: {
        ...validReport.summary,
        overallScore: "invalid",
      },
    };

    const result = ReviewReportSchema.safeParse(invalidReport);

    expect(result.success).toBe(false);
  });

  it("should reject a missing pullRequest number", () => {
    const invalidReport = {
      ...validReport,
      pullRequest: {
        owner: "octocat",
        repo: "Hello-World",
      },
    };

    const result = ReviewReportSchema.safeParse(invalidReport);

    expect(result.success).toBe(false);
  });
});

describe("withRetry", () => {
  it("should retry transient failures and eventually succeed", async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts++;

        if (attempts < 2) {
          throw new Error("Temporary failure");
        }

        return "success";
      },
      2,
      1
    );

    expect(result).toBe("success");
    expect(attempts).toBe(2);
  });

  it("should throw after exhausting all retries", async () => {
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("Persistent failure");
        },
        2,
        1
      )
    ).rejects.toThrow();

    // Initial attempt + 2 retries
    expect(attempts).toBe(3);
  });
});

describe("withTimeout", () => {
  it("should resolve when the operation completes before timeout", async () => {
    const result = await withTimeout(
      async () => "completed",
      1000
    );

    expect(result).toBe("completed");
  });

  it("should reject when the operation exceeds the timeout", async () => {
    await expect(
      withTimeout(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve("completed"), 100);
          }),
        10
      )
    ).rejects.toThrow();
  });
});

describe("CodeReviewOrchestrator Integration", () => {
  // Requires valid API credentials; skipped during normal CI testing.
  it.skip("should review a real small PR", async () => {
    // Manually test with valid API credentials.
  });
});
