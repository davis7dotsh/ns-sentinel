import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/u, "");

export const getGeneratedApiOrigin = () => {
  const value = env.GENERATED_API_ORIGIN?.trim();

  if (!value) {
    throw new Error(
      "Missing GENERATED_API_ORIGIN. Point it at the runtime app origin.",
    );
  }

  return trimTrailingSlash(value);
};

export const createGeneratedApiUrl = (
  path: string,
  searchParams?: URLSearchParams,
) => {
  const url = new URL(path, `${getGeneratedApiOrigin()}/`);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url;
};

export const copyGeneratedApiHeaders = (headers: Headers) => {
  const nextHeaders = new Headers();

  for (const key of ["cache-control", "connection", "content-type"] as const) {
    const value = headers.get(key);

    if (value) {
      nextHeaders.set(key, value);
    }
  }

  return nextHeaders;
};

export const fetchGeneratedApi = async (
  path: string,
  init?: RequestInit,
  searchParams?: URLSearchParams,
) => {
  const candidates = [
    createGeneratedApiUrl(path, searchParams),
    new URL(path, "http://127.0.0.1:3003/"),
  ].filter(
    (value, index, list) =>
      list.findIndex((entry) => entry.toString() === value.toString()) ===
      index,
  );

  let lastCause: unknown;

  for (const candidate of candidates) {
    try {
      return await fetch(candidate, init);
    } catch (cause) {
      lastCause = cause;
    }
  }

  console.error(lastCause);
  throw error(502, "Failed to reach the generated runtime service.");
};
