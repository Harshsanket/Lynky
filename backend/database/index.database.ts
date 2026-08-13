import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is not defined. Set it in your environment before starting the server."
  );
}

if (
  !MONGODB_URI.startsWith("mongodb://") &&
  !MONGODB_URI.startsWith("mongodb+srv://")
) {
  throw new Error(
    `MONGODB_URI is invalid. Expected a 'mongodb://' or 'mongodb+srv://' URI but received a value starting with '${MONGODB_URI.slice(0, 12)}'.`
  );
}

/* -------------------------------------------------------------------------- */
/*                            Fail-fast connection                            */
/* -------------------------------------------------------------------------- */

const CONNECTION_OPTIONS = {
  // Do NOT buffer operations while disconnected. Without this, Mongoose
  // silently queues queries and throws after bufferTimeoutMS (10s) instead
  // of failing immediately with a clear error.
  bufferCommands: false,
  // Abort the initial handshake quickly so cold starts fail fast.
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  // Keep the pool small for serverless runtimes.
  maxPoolSize: 10,
  connectTimeoutMS: 10000,
} satisfies mongoose.ConnectOptions;

// Fail fast when buffering is accidentally left on for a query.
mongoose.set("bufferTimeoutMS", 5000);

const connectionStateToString = (state: number): string => {
  switch (state) {
    case 0:
      return "disconnected";
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return `unknown(${state})`;
  }
};

/* -------------------------------------------------------------------------- */
/*                                Global cache                                */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                          Connection event listeners                        */
/* -------------------------------------------------------------------------- */

let eventsRegistered = false;

const registerConnectionEvents = () => {
  if (eventsRegistered) {
    return;
  }

  eventsRegistered = true;

  // Reset the cached promise/connection whenever the underlying socket drops
  // so the next connectDatabase() call reconnects instead of reusing a
  // stale connection (the root cause of the "buffering timed out" errors).
  mongoose.connection.on("disconnected", () => {
    cached.promise = null;
    cached.conn = null;
  });

  mongoose.connection.on("error", (error) => {
    cached.promise = null;
    cached.conn = null;

    console.error("MongoDB connection error:", error);
  });

  mongoose.connection.on("reconnected", () => {
    cached.conn = mongoose;
  });
};

/* -------------------------------------------------------------------------- */
/*                              connectDatabase                               */
/* -------------------------------------------------------------------------- */

export const connectDatabase = async (): Promise<typeof mongoose> => {
  const readyState = mongoose.connection.readyState;

  // 1 = connected
  if (readyState === 1) {
    cached.conn = mongoose;

    return cached.conn;
  }

  // 2 = connecting; wait on the in-flight handshake
  if (readyState === 2) {
    if (cached.promise) {
      return cached.promise;
    }

    await mongoose.connection.asPromise();

    cached.conn = mongoose;

    return cached.conn;
  }

  // 0 = disconnected, 3 = disconnecting -> (re)connect
  if (!cached.promise) {
    registerConnectionEvents();

    cached.promise = mongoose.connect(
      MONGODB_URI,
      CONNECTION_OPTIONS
    );

    cached.promise.catch(() => {
      cached.promise = null;
    });
  }

  try {
    await cached.promise;

    cached.conn = mongoose;
    cached.promise = null;

    console.log(
      `MongoDB connected: ${cached.conn.connection.host}`
    );

    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;

    console.error(
      "MongoDB connection failed:",
      error
    );

    throw error;
  }
};

/* -------------------------------------------------------------------------- */
/*                                Connection state                            */
/* -------------------------------------------------------------------------- */

export const getDatabaseStatus = () => {
  return {
    connected:
      mongoose.connection.readyState === 1,
    state: connectionStateToString(
      mongoose.connection.readyState
    ),
  };
};
