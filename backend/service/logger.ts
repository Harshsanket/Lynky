export const logError = (
  label: string,
  error: any,
  context?: Record<string, unknown>
) => {
  const timestamp = new Date().toISOString();

  console.error("\n");
  console.error("============================================================");
  console.error(`❌ ${label}`);
  console.error("============================================================");

  console.error(`Timestamp : ${timestamp}`);

  if (context) {
    console.error("\nContext:");
    console.error(
      JSON.stringify(context, null, 2)
    );
  }

  console.error("\nError Details:");

  console.error({
    name: error?.name,
    message: error?.message,
    code: error?.code,
    codeName: error?.codeName,
    errno: error?.errno,
    syscall: error?.syscall,
    hostname: error?.hostname,
    reason: error?.reason,
    cause: error?.cause,
  });

  if (error?.stack) {
    console.error("\nStack Trace:");
    console.error(error.stack);
  }

  console.error(
    "============================================================"
  );
  console.error("\n");
};