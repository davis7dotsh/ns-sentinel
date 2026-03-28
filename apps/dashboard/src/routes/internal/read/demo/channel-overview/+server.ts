import { json } from "@sveltejs/kit";
import { getGeneratedDemoData } from "$lib/server/generated-demo-data";

export const GET = async () => json(await getGeneratedDemoData());
