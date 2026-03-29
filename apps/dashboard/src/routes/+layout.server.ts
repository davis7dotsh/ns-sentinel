import { env } from "$env/dynamic/private";

export const load = () => {
  const convexUrl = env.CONVEX_URL?.trim();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL.");
  }

  return {
    convexUrl,
  };
};
