export const toGeneratedSnapshotResponse = <
  T extends {
    readonly iframeUrl: string;
  },
>(
  snapshot: T,
  requestUrl: URL,
) => ({
  ...snapshot,
  iframeUrl: new URL(snapshot.iframeUrl, requestUrl.origin).toString(),
});
