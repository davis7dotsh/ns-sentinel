import { getGeneratedDemoSnapshot } from "$lib/server/generated-demo-runs";

const encoder = new TextEncoder();

const toSseMessage = (
  snapshot: NonNullable<ReturnType<typeof getGeneratedDemoSnapshot>>,
) => encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`);

export const GET = ({ params }) => {
  let lastEventType: string | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let isClosed = false;

  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        stop();
        controller.close();
      };

      const pushSnapshot = () => {
        if (isClosed) {
          return;
        }

        const snapshot = getGeneratedDemoSnapshot(params.runId);

        if (!snapshot) {
          close();
          return;
        }

        if (snapshot.eventType === lastEventType) {
          return;
        }

        lastEventType = snapshot.eventType;

        try {
          controller.enqueue(toSseMessage(snapshot));
        } catch {
          close();
          return;
        }

        if (snapshot.status === "ready") {
          close();
        }
      };

      pushSnapshot();
      interval = setInterval(pushSnapshot, 400);
    },
    cancel() {
      isClosed = true;
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
};
