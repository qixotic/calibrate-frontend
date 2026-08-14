import { apiGet } from "./api";

/**
 * One evaluator's verdict on one trace. `output_type` decides which of
 * `passed` / `score` carries the verdict: binary evaluators set `passed`,
 * rating evaluators set `score` against `scale_min`..`scale_max`.
 */
export type TraceEvaluationResult = {
  run_uuid: string;
  evaluator_uuid: string;
  evaluator_name: string;
  output_type: "binary" | "rating";
  passed: boolean | null;
  score: number | null;
  scale_min: number | null;
  scale_max: number | null;
  reasoning: string | null;
  created_at: string;
};

export type TraceEvaluations = {
  trace_uuid: string;
  results: TraceEvaluationResult[];
};

/** Fetch every evaluator verdict recorded against one trace. */
export async function fetchTraceEvaluations(
  accessToken: string,
  traceUuid: string,
): Promise<TraceEvaluations> {
  return apiGet<TraceEvaluations>(
    `/traces/${traceUuid}/evaluations`,
    accessToken,
  );
}

/**
 * The verdict as one short phrase. Rating evaluators are always shown against
 * their scale, since a bare number says nothing about what counts as good.
 */
export function formatVerdict(result: TraceEvaluationResult): string {
  if (result.output_type === "rating") {
    if (result.score == null) return "No score";
    if (result.scale_max == null) return String(result.score);
    return `${result.score} out of ${result.scale_max}`;
  }
  if (result.passed == null) return "No score";
  return result.passed ? "Pass" : "Fail";
}
