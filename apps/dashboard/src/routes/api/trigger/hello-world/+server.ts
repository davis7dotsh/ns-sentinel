import { json } from "@sveltejs/kit";

import { triggerHelloWorldTask } from "$lib/server/trigger";

export const POST = async () => {
  try {
    const run = await triggerHelloWorldTask();

    return json({
      ok: true,
      runId: run.id,
    });
  } catch (cause) {
    console.error(cause);

    const message =
      cause instanceof Error
        ? cause.message
        : "Failed to trigger the hello-world task.";

    return json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
};
