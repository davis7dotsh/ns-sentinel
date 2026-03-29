export const getRequiredConvexPrivateBridgeKey = (
  value = process.env.CONVEX_PRIVATE_BRIDGE_KEY,
) => {
  if (!value) {
    throw new Error("Missing CONVEX_PRIVATE_BRIDGE_KEY.");
  }

  return value;
};
