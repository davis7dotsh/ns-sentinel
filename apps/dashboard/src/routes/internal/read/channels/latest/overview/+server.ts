import { json } from "@sveltejs/kit";
import { getLatestGeneratedChannelOverviewData } from "$lib/server/generated-runtime-data";

export const GET = async () => json(await getLatestGeneratedChannelOverviewData());
