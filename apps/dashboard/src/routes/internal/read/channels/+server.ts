import { json } from "@sveltejs/kit";
import { getGeneratedChannelsCatalogData } from "$lib/server/generated-runtime-data";

export const GET = async () => json(await getGeneratedChannelsCatalogData());
