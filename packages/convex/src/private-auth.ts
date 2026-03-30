export const getRequiredConvexPrivateApiKey = (value = process.env.CONVEX_PRIVATE_API_KEY) => {
  if (!value) {
    throw new Error("Missing CONVEX_PRIVATE_API_KEY.");
  }

  return value;
};
