import { env } from "$env/dynamic/private";
import { configure, tasks } from "@trigger.dev/sdk/v3";

const getTriggerConfig = () => {
  const accessToken = env.TRIGGER_SECRET_KEY?.trim();

  if (!accessToken) {
    throw new Error(
      "Missing TRIGGER_SECRET_KEY. Add your Trigger.dev secret key to the dashboard environment.",
    );
  }

  const baseURL = env.TRIGGER_API_URL?.trim();

  return {
    accessToken,
    ...(baseURL ? { baseURL } : {}),
  };
};

export const triggerHelloWorldTask = async () => {
  configure(getTriggerConfig());

  return tasks.trigger("hello-world", {
    source: "dashboard",
    launchedAt: new Date().toISOString(),
  });
};
