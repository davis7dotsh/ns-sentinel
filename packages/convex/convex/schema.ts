import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const generationStatus = v.union(v.literal("working"), v.literal("ready"), v.literal("error"));

export default defineSchema({
  pages: defineTable({
    createdAt: v.number(),
    currentVersionId: v.optional(v.id("pageVersions")),
    latestVersionNumber: v.number(),
    slug: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  pageVersions: defineTable({
    baseVersionId: v.optional(v.id("pageVersions")),
    createdAt: v.number(),
    cssBlobId: v.optional(v.id("_storage")),
    cssPreview: v.optional(v.string()),
    endpointBlobId: v.optional(v.id("_storage")),
    endpointPreview: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    htmlBlobId: v.optional(v.id("_storage")),
    htmlPreview: v.optional(v.string()),
    jsBlobId: v.optional(v.id("_storage")),
    jsPreview: v.optional(v.string()),
    pageId: v.id("pages"),
    prompt: v.string(),
    status: generationStatus,
    title: v.string(),
    triggerRunId: v.optional(v.string()),
    updatedAt: v.number(),
    versionNumber: v.number(),
  })
    .index("by_page_id", ["pageId"])
    .index("by_page_id_and_version_number", ["pageId", "versionNumber"])
    .index("by_status", ["status"]),
});
