export const getExpirationDate = (): Date => {
  const expirationDays = Number(
    process.env.EXPIRATION_DAYS
  );

  if (
    !Number.isFinite(expirationDays) ||
    expirationDays <= 0
  ) {
    throw new Error(
      "EXPIRATION_DAYS is not configured correctly"
    );
  }

  return new Date(
    Date.now() +
      expirationDays *
        24 *
        60 *
        60 *
        1000
  );
};