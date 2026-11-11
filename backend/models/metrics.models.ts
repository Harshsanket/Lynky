import mongoose, { Schema, type Document } from "mongoose";

/**
 * Aggregated metrics. Raw per-request data never reaches MongoDB: Redis keeps
 * a minute bucket and the request path flushes it into these rollups.
 */
export interface IMetricRollup extends Document {
  route: string;
  windowStart: Date;
  requests: number;
  success: number;
  failed: number;
  status4xx: number;
  status5xx: number;
  status429: number;
  cacheHit: number;
  cacheMiss: number;
  redisHit: number;
  redisMiss: number;
  mongoCalls: number;
  redisCalls: number;
  latencySum: number;
  latencyCount: number;
  minMs: number;
  maxMs: number;
  errorCount: number;
  botBlocks: number;
  authFailures: number;
  /**
   * Sparse by design: written only when short-code generation exhausts its
   * attempts, and read by the sysadmin dashboard aggregate.
   */
  shortCodeExhausted: number;
  eventLoopLagP99Ms?: number;
  eventLoopLagMaxMs?: number;
  rssMb?: number;
  heapUsedMb?: number;
  expireAt?: Date;
}

const metricFields = {
  route: { type: String, required: true },
  windowStart: { type: Date, required: true },
  requests: { type: Number, default: 0, min: 0 },
  success: { type: Number, default: 0, min: 0 },
  failed: { type: Number, default: 0, min: 0 },
  status4xx: { type: Number, default: 0, min: 0 },
  status5xx: { type: Number, default: 0, min: 0 },
  status429: { type: Number, default: 0, min: 0 },
  cacheHit: { type: Number, default: 0, min: 0 },
  cacheMiss: { type: Number, default: 0, min: 0 },
  redisHit: { type: Number, default: 0, min: 0 },
  redisMiss: { type: Number, default: 0, min: 0 },
  mongoCalls: { type: Number, default: 0, min: 0 },
  redisCalls: { type: Number, default: 0, min: 0 },
  latencySum: { type: Number, default: 0, min: 0 },
  latencyCount: { type: Number, default: 0, min: 0 },
  minMs: { type: Number, default: 0, min: 0 },
  maxMs: { type: Number, default: 0, min: 0 },
  errorCount: { type: Number, default: 0, min: 0 },
  botBlocks: { type: Number, default: 0, min: 0 },
  authFailures: { type: Number, default: 0, min: 0 },
  shortCodeExhausted: { type: Number, default: 0, min: 0 },
  eventLoopLagP99Ms: { type: Number, default: 0, min: 0 },
  eventLoopLagMaxMs: { type: Number, default: 0, min: 0 },
  rssMb: { type: Number, default: 0, min: 0 },
  heapUsedMb: { type: Number, default: 0, min: 0 },
} as const;

const metricOptions = {
  timestamps: true,
  versionKey: false,
} as const;

const minuteSchema = new Schema<IMetricRollup>(
  {
    ...metricFields,
    expireAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  metricOptions
);

minuteSchema.index({ windowStart: 1, route: 1 }, { unique: true });

const hourSchema = new Schema<IMetricRollup>(
  {
    ...metricFields,
    expireAt: {
      type: Date,
      index: { expires: 0 },
    },
  },
  metricOptions
);

hourSchema.index({ windowStart: 1, route: 1 }, { unique: true });

const dailySchema = new Schema<IMetricRollup>(
  metricFields,
  metricOptions
);

dailySchema.index({ windowStart: 1, route: 1 }, { unique: true });

const monthlySchema = new Schema<IMetricRollup>(
  metricFields,
  metricOptions
);

monthlySchema.index({ windowStart: 1, route: 1 }, { unique: true });

export const MetricsMinute: mongoose.Model<IMetricRollup> =
  (mongoose.models.MetricsMinute as mongoose.Model<IMetricRollup>) ??
  mongoose.model<IMetricRollup>("MetricsMinute", minuteSchema);
export const MetricsHour: mongoose.Model<IMetricRollup> =
  (mongoose.models.MetricsHour as mongoose.Model<IMetricRollup>) ??
  mongoose.model<IMetricRollup>("MetricsHour", hourSchema);
export const MetricsDaily: mongoose.Model<IMetricRollup> =
  (mongoose.models.MetricsDaily as mongoose.Model<IMetricRollup>) ??
  mongoose.model<IMetricRollup>("MetricsDaily", dailySchema);
export const MetricsMonthly: mongoose.Model<IMetricRollup> =
  (mongoose.models.MetricsMonthly as mongoose.Model<IMetricRollup>) ??
  mongoose.model<IMetricRollup>("MetricsMonthly", monthlySchema);

export interface IErrorLog extends Document {
  at: Date;
  route: string;
  status: number;
  errorCode: string | null;
  requestId: string | null;
  message: string;
  expireAt: Date;
}

const errorLogSchema = new Schema<IErrorLog>(
  {
    at: { type: Date, required: true },
    route: { type: String, required: true },
    status: { type: Number, required: true },
    errorCode: { type: String, default: null },
    requestId: { type: String, default: null },
    message: { type: String, required: true },
    expireAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true, versionKey: false }
);

export const ErrorLog: mongoose.Model<IErrorLog> =
  (mongoose.models.ErrorLog as mongoose.Model<IErrorLog>) ??
  mongoose.model<IErrorLog>("ErrorLog", errorLogSchema);
