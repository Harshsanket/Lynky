import { TestReport, type ITestReport } from "../models/test-report.models.js";

export type TestReportInput = Omit<
  ITestReport,
  keyof Document | "_id"
>;

/** Persist one immutable run record (the harness writes the document). */
export const saveTestReport = async (
  report: TestReportInput
): Promise<ITestReport> => TestReport.create(report);

/** Latest run, read by the sysadmin Benchmark report section. */
export const getLatestTestReport = async () =>
  TestReport.findOne({}).sort({ startedAt: -1 }).lean();
