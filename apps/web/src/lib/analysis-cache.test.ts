import { describe, expect, it } from "vitest";
import { COACH_PROMPT_VERSION } from "@chess-review/analysis";
import type { GameAnalysisV1 } from "@chess-review/shared";
import { withoutStaleCoach } from "./analysis-cache";

function cachedAnalysis(movePromptVersion: string, summaryPromptVersion: string): GameAnalysisV1 {
  return {
    moves: [{ coach: { source: { promptVersion: movePromptVersion } } }],
    coachSummary: { source: { promptVersion: summaryPromptVersion } },
  } as unknown as GameAnalysisV1;
}

describe("coach cache invalidation", () => {
  it("retains current coach enrichments", () => {
    const cached = cachedAnalysis(COACH_PROMPT_VERSION, COACH_PROMPT_VERSION);

    const result = withoutStaleCoach(cached);

    expect(result.moves[0]?.coach).toBeDefined();
    expect(result.coachSummary).toBeDefined();
  });

  it("drops stale coach text without dropping the objective record", () => {
    const cached = cachedAnalysis("coach-v0", "coach-v0");

    const result = withoutStaleCoach(cached);

    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]?.coach).toBeUndefined();
    expect(result.coachSummary).toBeUndefined();
  });
});
