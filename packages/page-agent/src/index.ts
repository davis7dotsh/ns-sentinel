import {
  agentLoop,
  type AgentMessage,
  type AgentTool,
} from "@mariozechner/pi-agent-core";
import {
  Type,
  getModels,
  getProviders,
  type KnownProvider,
  type Message,
  type Model,
} from "@mariozechner/pi-ai";
import { GeneratedPageArtifactsSchema } from "@ns-sentinel/runtime-core";

const SYSTEM_PROMPT = `
You generate production-ready read-only dashboard pages.

Return JSON only. No markdown fences. No explanation.

The JSON must match this exact shape:
{
  "title": "short page title",
  "html": "body markup only",
  "css": "plain CSS",
  "js": "plain browser JavaScript",
  "endpoint": "the body of an async function that receives ctx"
}

Rules:
- Build an intentional, polished dashboard UI.
- Match the host dashboard visual language:
  - warm ivory / stone backgrounds
  - soft slate text
  - subtle warm shadows
  - restrained emerald or amber accents when needed
  - avoid neon purple, cyberpunk gradients, and default dark-mode aesthetics unless the user explicitly asks for them
  - prefer a light theme that feels native to a calm editorial dashboard
- Do not include <html>, <head>, <body>, <style>, or <script> tags in html.
- The js must fetch from window.__GENERATED_APP__.endpointUrl using GET by default.
- The js must render/update the DOM defined by html.
- No external scripts, fonts, eval, Function, dynamic import, or off-origin network calls.
- The endpoint must return JSON-serializable data only.
- The endpoint can use:
  - ctx.fetchJson(path)
  - ctx.searchParams
- Allowed fetchJson paths:
  - /internal/read/channels
  - /internal/read/channels/latest/overview
- Generate the whole version in one shot.
`.trim();

const PREVIOUS_VERSION_TOOL_SCHEMA = Type.Object({});

const KNOWN_PROVIDERS = new Set<string>(getProviders());

const isKnownProvider = (value: string): value is KnownProvider =>
  KNOWN_PROVIDERS.has(value);

const resolveModel = (args: { modelId: string; provider: string }) => {
  if (!isKnownProvider(args.provider)) {
    return undefined;
  }

  return getModels(args.provider).find((model) => model.id === args.modelId) as
    | Model<any>
    | undefined;
};

const extractTextContent = (content: Message["content"]) => {
  if (typeof content === "string") {
    return content;
  }

  return content
    .flatMap((part) =>
      typeof part === "object" &&
      part !== null &&
      "text" in part &&
      typeof part.text === "string"
        ? [part.text]
        : [],
    )
    .join("\n\n");
};

const extractAssistantText = (messages: readonly AgentMessage[]) =>
  [...messages]
    .reverse()
    .find((message): message is Message => message.role === "assistant")
    ?.content
    ? extractTextContent(
        [...messages]
          .reverse()
          .find((message): message is Message => message.role === "assistant")!
          .content,
      )
    : "";

const stripCodeFences = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\n?/u, "")
    .replace(/\n?```$/u, "")
    .trim();
};

export const generatePageArtifacts = async (input: {
  readonly latestOverviewSample: unknown;
  readonly prompt: string;
  readonly selectedVersion: {
    readonly css: string | null;
    readonly endpoint: string | null;
    readonly html: string | null;
    readonly js: string | null;
    readonly prompt: string;
    readonly title: string;
    readonly versionNumber: number;
  } | null;
  readonly slug: string;
  readonly channelsSample: unknown;
  readonly versionId: string;
}) => {
  const model = resolveModel({
    modelId: "gpt-5.4-mini",
    provider: "openai",
  });

  if (!model) {
    throw new Error('Unable to resolve the "openai/gpt-5.4-mini" model.');
  }

  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const selectedVersion = input.selectedVersion;
  const tools: AgentTool[] =
    selectedVersion === null
      ? []
      : [
          {
            description: "Read the currently selected version being edited.",
            execute: async () => ({
              content: [
                {
                  text: JSON.stringify(
                    {
                      css: selectedVersion.css,
                      endpoint: selectedVersion.endpoint,
                      html: selectedVersion.html,
                      js: selectedVersion.js,
                      prompt: selectedVersion.prompt,
                      title: selectedVersion.title,
                      versionNumber: selectedVersion.versionNumber,
                    },
                    null,
                    2,
                  ),
                  type: "text",
                },
              ],
              details: {
                versionNumber: selectedVersion.versionNumber,
              },
            }),
            label: "Read Selected Version",
            name: "read_selected_version",
            parameters: PREVIOUS_VERSION_TOOL_SCHEMA,
          },
        ];

  const messages: AgentMessage[] = [
    {
      content: [
        "User request:",
        input.prompt.trim(),
        "",
        `Page slug: ${input.slug}`,
        `Version id: ${input.versionId}`,
        "",
        "Sample response for /internal/read/channels:",
        JSON.stringify(input.channelsSample, null, 2),
        "",
        "Sample response for /internal/read/channels/latest/overview:",
        JSON.stringify(input.latestOverviewSample, null, 2),
        input.selectedVersion
          ? ""
          : "\nThis is the first version for this page. Do not assume any prior implementation.",
        input.selectedVersion
          ? "\nUse the read_selected_version tool if you need the exact version being edited."
          : "",
      ]
        .filter((part) => part.length > 0)
        .join("\n"),
      role: "user",
      timestamp: Date.now(),
    },
  ];

  const finalMessages = await agentLoop(
    messages,
    {
      messages: [],
      systemPrompt: SYSTEM_PROMPT,
      tools,
    },
    {
      convertToLlm: (agentMessages) =>
        agentMessages.filter(
          (message): message is Message =>
            message.role === "user" ||
            message.role === "assistant" ||
            message.role === "toolResult",
        ),
      getApiKey: () => openAiApiKey,
      model,
      sessionId: input.versionId,
    },
  ).result();

  const rawResponse = stripCodeFences(extractAssistantText(finalMessages));
  const parsed = GeneratedPageArtifactsSchema.safeParse(
    JSON.parse(rawResponse),
  );

  if (!parsed.success) {
    throw new Error("The page agent returned an invalid artifact payload.");
  }

  return parsed.data;
};
