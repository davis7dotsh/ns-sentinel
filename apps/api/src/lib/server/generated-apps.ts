import { error } from "@sveltejs/kit";

type GeneratedAppSnapshot = {
  readonly eventType: string;
  readonly iframeUrl: string;
  readonly prompt: string;
  readonly revision: number;
  readonly runId: string;
  readonly slug: string;
  readonly status: "working" | "error" | "failed" | "ready";
  readonly statusLabel: string;
  readonly title: string;
};

type GeneratedPageBundle = {
  readonly app: {
    readonly slug: string;
  };
  readonly page: {
    readonly css: string;
    readonly endpointSlug: string;
    readonly html: string;
    readonly js: string;
    readonly title: string;
  };
  readonly version: {
    readonly id: string;
  };
};

const migrationError = () =>
  error(
    503,
    "Generated page flows are being migrated from Postgres to Convex. This route is temporarily disabled until the Convex-backed flow lands.",
  );

export const createGeneratedAppRun = async (
  _prompt: string,
): Promise<GeneratedAppSnapshot> => {
  throw migrationError();
};

export const createGeneratedAppEditRun = async (_input: {
  readonly prompt: string;
  readonly slug: string;
}): Promise<GeneratedAppSnapshot> => {
  throw migrationError();
};

export const getGeneratedAppSnapshot = async (_input: {
  readonly runId?: string | null;
  readonly slug: string;
}): Promise<GeneratedAppSnapshot | null> => {
  throw migrationError();
};

export const getGeneratedPageBundle = async (_input: {
  readonly runId?: string | null;
  readonly slug: string;
}): Promise<GeneratedPageBundle | null> => {
  throw migrationError();
};

export const runGeneratedEndpoint = async (_input: {
  readonly endpointSlug: string;
  readonly runId?: string | null;
  readonly searchParams: URLSearchParams;
  readonly slug: string;
}): Promise<unknown> => {
  throw migrationError();
};

export const getGeneratedAppSnapshotByRunId = async (
  _runId: string,
): Promise<GeneratedAppSnapshot | null> => {
  throw migrationError();
};
