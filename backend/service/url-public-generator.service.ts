export const getPublicUrl = (
  code: string
): string => {
  const publicUrl = process.env.PUBLIC_URL;

  if (!publicUrl) {
    throw new Error(
      "PUBLIC_URL is not configured"
    );
  }

  return `${publicUrl.replace(/\/$/, "")}/${code}`;
};