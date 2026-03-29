import { getGeneratedAppSnapshotByRunId } from "$lib/server/generated-apps";
import { toGeneratedSnapshotResponse } from "$lib/server/generated-snapshot-response";

const encoder = new TextEncoder();

export const GET = ({ params, url }) => {
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

      const pushSnapshot = async () => {
        if (isClosed) {
          return;
        }

        const snapshot = await getGeneratedAppSnapshotByRunId(params.runId);

        if (!snapshot) {
          close();
          return;
        }

        if (snapshot.eventType === lastEventType) {
          if (snapshot.status === "failed") {
            close();
          }

          return;
        }

        lastEventType = snapshot.eventType;

        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(
                toGeneratedSnapshotResponse(snapshot, url),
              )}\n\n`,
            ),
          );
        } catch {
          close();
          return;
        }

        if (snapshot.status === "ready" || snapshot.status === "failed") {
          close();
        }
      };

      void pushSnapshot();
      interval = setInterval(() => {
        void pushSnapshot();
      }, 400);
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
