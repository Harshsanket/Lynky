import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global.mongooseCache ?? {
    conn: null,
    promise: null,
  };

global.mongooseCache = cached;

export const connectDatabase = async () => {
  // Already connected
  if (cached.conn) {
    return cached.conn;
  }

  // Connection is already being established
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI);
  }

  try {
    cached.conn = await cached.promise;

    console.log(
      `MongoDB connected: ${cached.conn.connection.host}`
    );

    return cached.conn;
  } catch (error) {
    cached.promise = null;

    console.error("MongoDB connection failed:", error);

    throw error;
  }
};