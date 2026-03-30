import type { IndexRangeBuilder } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import {
  privateAction,
  privateMutation,
  privateQuery,
} from "./private/helpers";

const generationStatus = v.union(
  v.literal("working"),
  v.literal("ready"),
  v.literal("error"),
);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);

const getInitialTitle = (prompt: string) => {
  const trimmed = prompt.trim();

  return trimmed.length === 0 ? "Generated Page" : trimmed.slice(0, 96);
};

const bySlug =
  (slug: string) =>
  (query: IndexRangeBuilder<Doc<"pages">, ["slug", "_creationTime"]>) =>
    query.eq("slug", slug);

const byPageId =
  (pageId: Id<"pages">) =>
  (
    query: IndexRangeBuilder<Doc<"pageVersions">, ["pageId", "_creationTime"]>,
  ) =>
    query.eq("pageId", pageId);

export const getPageView = query({
  args: {
    slug: v.string(),
    versionId: v.optional(v.id("pageVersions")),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("pages")
      .withIndex("by_slug", bySlug(args.slug))
      .unique();

    if (!page) {
      return null;
    }

    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page_id", byPageId(page._id))
      .collect();

    const sortedVersions = [...versions].sort(
      (left, right) => right.versionNumber - left.versionNumber,
    );
    const selectedVersion =
      (args.versionId
        ? sortedVersions.find((version) => version._id === args.versionId)
        : undefined) ??
      sortedVersions.find((version) => version._id === page.currentVersionId) ??
      sortedVersions[0] ??
      null;

    if (!selectedVersion) {
      return null;
    }

    return {
      page: {
        currentVersionId: page.currentVersionId ?? null,
        id: page._id,
        slug: page.slug,
        title: page.title,
      },
      selectedVersion: {
        createdAt: selectedVersion.createdAt,
        errorMessage: selectedVersion.errorMessage ?? null,
        id: selectedVersion._id,
        prompt: selectedVersion.prompt,
        status: selectedVersion.status,
        title: selectedVersion.title,
        versionNumber: selectedVersion.versionNumber,
      },
      versions: sortedVersions.map((version) => ({
        createdAt: version.createdAt,
        errorMessage: version.errorMessage ?? null,
        id: version._id,
        status: version.status,
        title: version.title,
        versionNumber: version.versionNumber,
      })),
    };
  },
});

export const listPages = query({
  args: {},
  handler: async (ctx) => {
    const pages = await ctx.db.query("pages").collect();

    const sorted = [...pages].sort((a, b) => b.updatedAt - a.updatedAt);

    const results = await Promise.all(
      sorted.map(async (page) => {
        const currentVersion = page.currentVersionId
          ? await ctx.db.get(page.currentVersionId)
          : null;

        return {
          id: page._id,
          slug: page.slug,
          title: page.title,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          latestVersionNumber: page.latestVersionNumber,
          currentVersionStatus: currentVersion?.status ?? null,
        };
      }),
    );

    return results;
  },
});

export const getRuntimePage = privateQuery({
  args: {
    slug: v.string(),
    versionId: v.optional(v.id("pageVersions")),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("pages")
      .withIndex("by_slug", bySlug(args.slug))
      .unique();

    if (!page) {
      return null;
    }

    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page_id", byPageId(page._id))
      .collect();

    const sortedVersions = [...versions].sort(
      (left, right) => right.versionNumber - left.versionNumber,
    );
    const selectedVersion =
      (args.versionId
        ? sortedVersions.find((version) => version._id === args.versionId)
        : undefined) ??
      sortedVersions.find((version) => version._id === page.currentVersionId) ??
      sortedVersions[0] ??
      null;

    if (!selectedVersion) {
      return null;
    }

    const [htmlUrl, cssUrl, jsUrl, endpointUrl] = await Promise.all([
      selectedVersion.htmlBlobId
        ? ctx.storage.getUrl(selectedVersion.htmlBlobId)
        : Promise.resolve(null),
      selectedVersion.cssBlobId
        ? ctx.storage.getUrl(selectedVersion.cssBlobId)
        : Promise.resolve(null),
      selectedVersion.jsBlobId
        ? ctx.storage.getUrl(selectedVersion.jsBlobId)
        : Promise.resolve(null),
      selectedVersion.endpointBlobId
        ? ctx.storage.getUrl(selectedVersion.endpointBlobId)
        : Promise.resolve(null),
    ]);

    return {
      page: {
        id: page._id,
        slug: page.slug,
        title: page.title,
      },
      version: {
        ...selectedVersion,
        cssUrl,
        endpointUrl,
        htmlUrl,
        jsUrl,
      },
    };
  },
});

export const getGenerationContext = privateQuery({
  args: {
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);

    if (!version) {
      throw new Error("Version not found.");
    }

    const page = await ctx.db.get(version.pageId);

    if (!page) {
      throw new Error("Page not found.");
    }

    const baseVersion = version.baseVersionId
      ? await ctx.db.get(version.baseVersionId)
      : null;

    return {
      page: {
        id: page._id,
        slug: page.slug,
        title: page.title,
      },
      version,
      baseVersion:
        baseVersion === null
          ? null
          : {
              css: baseVersion.cssPreview ?? null,
              endpoint: baseVersion.endpointPreview ?? null,
              html: baseVersion.htmlPreview ?? null,
              id: baseVersion._id,
              js: baseVersion.jsPreview ?? null,
              prompt: baseVersion.prompt,
              title: baseVersion.title,
              versionNumber: baseVersion.versionNumber,
            },
    };
  },
});

export const createPage = privateMutation({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedPrompt = args.prompt.trim();

    if (trimmedPrompt.length === 0) {
      throw new Error("A prompt is required.");
    }

    const baseSlug = slugify(trimmedPrompt) || "generated-page";
    let slug = baseSlug;
    let suffix = 2;

    while (
      await ctx.db.query("pages").withIndex("by_slug", bySlug(slug)).unique()
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const now = Date.now();
    const title = getInitialTitle(trimmedPrompt);
    const pageId = await ctx.db.insert("pages", {
      createdAt: now,
      latestVersionNumber: 1,
      slug,
      title,
      updatedAt: now,
    });

    const versionId = await ctx.db.insert("pageVersions", {
      createdAt: now,
      pageId,
      prompt: trimmedPrompt,
      status: "working",
      title,
      updatedAt: now,
      versionNumber: 1,
    });

    await ctx.db.patch(pageId, {
      currentVersionId: versionId,
      updatedAt: now,
    });

    return {
      pageId,
      slug,
      versionId,
    };
  },
});

export const deletePage = privateMutation({
  args: {
    pageId: v.id("pages"),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);

    if (!page) {
      throw new Error("Page not found.");
    }

    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page_id", byPageId(page._id))
      .collect();

    const blobIds: Id<"_storage">[] = [];

    for (const version of versions) {
      if (version.htmlBlobId) blobIds.push(version.htmlBlobId);
      if (version.cssBlobId) blobIds.push(version.cssBlobId);
      if (version.jsBlobId) blobIds.push(version.jsBlobId);
      if (version.endpointBlobId) blobIds.push(version.endpointBlobId);
    }

    for (const blobId of blobIds) {
      await ctx.storage.delete(blobId);
    }

    for (const version of versions) {
      await ctx.db.delete(version._id);
    }
    await ctx.db.delete(page._id);
  },
});

export const createEditVersion = privateMutation({
  args: {
    baseVersionId: v.id("pageVersions"),
    pageId: v.id("pages"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);

    if (!page) {
      throw new Error("Page not found.");
    }

    const baseVersion = await ctx.db.get(args.baseVersionId);

    if (!baseVersion || baseVersion.pageId !== page._id) {
      throw new Error("Base version not found.");
    }

    const trimmedPrompt = args.prompt.trim();

    if (trimmedPrompt.length === 0) {
      throw new Error("An edit prompt is required.");
    }

    const title = getInitialTitle(trimmedPrompt);
    const now = Date.now();
    const versionId = await ctx.db.insert("pageVersions", {
      baseVersionId: baseVersion._id,
      createdAt: now,
      pageId: page._id,
      prompt: trimmedPrompt,
      status: "working",
      title,
      updatedAt: now,
      versionNumber: page.latestVersionNumber + 1,
    });

    await ctx.db.patch(page._id, {
      currentVersionId: versionId,
      latestVersionNumber: page.latestVersionNumber + 1,
      updatedAt: now,
    });

    return {
      pageId: page._id,
      slug: page.slug,
      versionId,
    };
  },
});

export const retryVersion = privateMutation({
  args: {
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);

    if (!version) {
      throw new Error("Version not found.");
    }

    await ctx.db.patch(version._id, {
      errorMessage: undefined,
      status: "working",
      updatedAt: Date.now(),
    });

    return {
      pageId: version.pageId,
      versionId: version._id,
    };
  },
});

export const attachTriggerRun = privateMutation({
  args: {
    triggerRunId: v.string(),
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.versionId, {
      triggerRunId: args.triggerRunId,
      updatedAt: Date.now(),
    });
  },
});

export const markVersionWorking = privateMutation({
  args: {
    triggerRunId: v.optional(v.string()),
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.versionId, {
      errorMessage: undefined,
      status: "working",
      triggerRunId: args.triggerRunId,
      updatedAt: Date.now(),
    });
  },
});

export const markVersionError = privateMutation({
  args: {
    errorMessage: v.string(),
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.versionId, {
      errorMessage: args.errorMessage,
      status: "error",
      updatedAt: Date.now(),
    });
  },
});

export const storeVersionArtifacts = privateAction({
  args: {
    css: v.string(),
    endpoint: v.string(),
    html: v.string(),
    js: v.string(),
    title: v.string(),
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, args) => {
    const [htmlBlobId, cssBlobId, jsBlobId, endpointBlobId] = await Promise.all(
      [
        ctx.storage.store(
          new Blob([args.html], { type: "text/html;charset=utf-8" }),
        ),
        ctx.storage.store(
          new Blob([args.css], { type: "text/css;charset=utf-8" }),
        ),
        ctx.storage.store(
          new Blob([args.js], { type: "text/javascript;charset=utf-8" }),
        ),
        ctx.storage.store(
          new Blob([args.endpoint], { type: "text/javascript;charset=utf-8" }),
        ),
      ],
    );

    await ctx.runMutation(internal.pages.finishVersionInternal, {
      cssBlobId,
      cssPreview: args.css,
      endpointBlobId,
      endpointPreview: args.endpoint,
      htmlBlobId,
      htmlPreview: args.html,
      jsBlobId,
      jsPreview: args.js,
      title: args.title,
      versionId: args.versionId,
    });
  },
});

export const finishVersionInternal = internalMutation({
  args: {
    cssBlobId: v.id("_storage"),
    cssPreview: v.string(),
    endpointBlobId: v.id("_storage"),
    endpointPreview: v.string(),
    htmlBlobId: v.id("_storage"),
    htmlPreview: v.string(),
    jsBlobId: v.id("_storage"),
    jsPreview: v.string(),
    title: v.string(),
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);

    if (!version) {
      throw new Error("Version not found.");
    }

    const now = Date.now();

    await ctx.db.patch(version._id, {
      cssBlobId: args.cssBlobId,
      cssPreview: args.cssPreview,
      endpointBlobId: args.endpointBlobId,
      endpointPreview: args.endpointPreview,
      errorMessage: undefined,
      htmlBlobId: args.htmlBlobId,
      htmlPreview: args.htmlPreview,
      jsBlobId: args.jsBlobId,
      jsPreview: args.jsPreview,
      status: "ready",
      title: args.title,
      updatedAt: now,
    });

    await ctx.db.patch(version.pageId, {
      title: args.title,
      updatedAt: now,
    });
  },
});
