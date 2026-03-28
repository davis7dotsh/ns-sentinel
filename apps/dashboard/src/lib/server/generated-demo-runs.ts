import { randomUUID } from "node:crypto";

const phaseDurations = [
  {
    eventType: "queued",
    label: "Planning the generated page",
    status: "queued",
    untilMs: 900,
  },
  {
    eventType: "generating-ui",
    label: "Generating iframe UI",
    status: "generating",
    untilMs: 2400,
  },
  {
    eventType: "generating-endpoint",
    label: "Generating read-only endpoint",
    status: "generating",
    untilMs: 4200,
  },
  {
    eventType: "ready",
    label: "Preview is ready",
    status: "ready",
    untilMs: Number.POSITIVE_INFINITY,
  },
] as const;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);

const toTitle = (prompt: string) => {
  const trimmed = prompt.trim();

  if (trimmed.length === 0) {
    return "Generated Channel Brief";
  }

  return trimmed.slice(0, 72);
};

const runs = new Map<
  string,
  {
    readonly id: string;
    readonly slug: string;
    readonly prompt: string;
    readonly title: string;
    readonly revision: number;
    readonly createdAt: number;
  }
>();

const latestRunIdBySlug = new Map<string, string>();
const revisionBySlug = new Map<string, number>();

const getPhase = (elapsedMs: number) =>
  phaseDurations.find((phase) => elapsedMs < phase.untilMs) ??
  phaseDurations.at(-1)!;

export const createGeneratedDemoRun = (input: {
  readonly prompt: string;
  readonly slug?: string;
}) => {
  const prompt = input.prompt.trim();

  if (prompt.length === 0) {
    throw new Error("A prompt is required.");
  }

  const slug = (input.slug ?? slugify(prompt)) || "generated-channel-brief";
  const revision = (revisionBySlug.get(slug) ?? 0) + 1;
  const run = {
    id: randomUUID(),
    slug,
    prompt,
    title: toTitle(prompt),
    revision,
    createdAt: Date.now(),
  };

  runs.set(run.id, run);
  latestRunIdBySlug.set(slug, run.id);
  revisionBySlug.set(slug, revision);

  return getGeneratedDemoSnapshot(run.id);
};

export const getGeneratedDemoRun = (runId: string) => runs.get(runId) ?? null;

export const getLatestGeneratedDemoRunForSlug = (slug: string) => {
  const runId = latestRunIdBySlug.get(slug);

  return runId ? getGeneratedDemoRun(runId) : null;
};

export const getGeneratedDemoSnapshot = (runId: string) => {
  const run = getGeneratedDemoRun(runId);

  if (!run) {
    return null;
  }

  const elapsedMs = Date.now() - run.createdAt;
  const phase = getPhase(elapsedMs);

  return {
    eventType: phase.eventType,
    iframeUrl: `/sandbox/${run.slug}?run=${run.id}`,
    prompt: run.prompt,
    revision: run.revision,
    runId: run.id,
    slug: run.slug,
    status: phase.status,
    statusLabel: phase.label,
    title: run.title,
  };
};
