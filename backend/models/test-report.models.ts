import mongoose, { Schema, type Document } from "mongoose";

/**
 * One document per §21 load-test run. The nested sections mirror the report
 * schema in docs/testing/PLAN.md §21.7; `Mixed` keeps the collection flexible while the
 * top-level fields stay queryable.
 */
export interface ITestReport extends Document {
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

const mixedSection = {
  type: Schema.Types.Mixed,
  default: {},
} as const;

const testReportSchema = new Schema<ITestReport>(
  {
    runId: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true },
    startedAt: { type: Date, required: true, index: true },
    finishedAt: { type: Date, required: true },
    durationSeconds: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ["completed", "failed"],
    },
    environment: mixedSection,
    config: mixedSection,
    dataset: mixedSection,
    phases: mixedSection,
    latency: mixedSection,
    collisions: mixedSection,
    failures: mixedSection,
    redirects: mixedSection,
    storage: mixedSection,
    failSafes: mixedSection,
    security: mixedSection,
    telemetry: mixedSection,
    artifacts: mixedSection,
    notes: { type: [String], default: [] },
  },
  {
    collection: "test_reports",
    versionKey: false,
  }
);

export const TestReport: mongoose.Model<ITestReport> =
  (mongoose.models.TestReport as mongoose.Model<ITestReport>) ??
  mongoose.model<ITestReport>("TestReport", testReportSchema);
