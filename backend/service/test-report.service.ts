import { TestReport, type ITestReport } from "../models/test-report.models.js";

export interface TestReportInput {
  runId: string;
  label: string;
  startedAt: Date;
  finishedAt: Date;
  durationSeconds: number;
  status: "completed" | "failed";
  environment: Record<string, unknown>;
  config: Record<string, unknown>;
  dataset: Record<string, unknown>;
  phases: Record<string, unknown>;
  latency: Record<string, unknown>;
  collisions: Record<string, unknown>;
  failures: Record<string, unknown>;
  redirects: Record<string, unknown>;
  storage: Record<string, unknown>;
  failSafes: Record<string, unknown>;
  security: Record<string, unknown>;
  telemetry: Record<string, unknown>;
  artifacts: Record<string, unknown>;
  notes: string[];
}

/** Persist one immutable run record (the harness writes the document). */
export const saveTestReport = async (
  report: TestReportInput
): Promise<ITestReport> => TestReport.create(report);

/** Latest run, read by the sysadmin Benchmark report section. */
export const getLatestTestReport = async () =>
  TestReport.findOne({}).sort({ startedAt: -1 }).lean();
