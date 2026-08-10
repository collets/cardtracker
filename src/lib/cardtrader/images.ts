const CARDTRADER_IMAGE_HOSTS = new Set([
  "cardtrader.com",
  "www.cardtrader.com",
]);

const PREVIEW_PREFIX = "preview_";

export function getCardTraderOriginalImageUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);

    if (!CARDTRADER_IMAGE_HOSTS.has(url.hostname)) {
      return imageUrl;
    }

    const pathParts = url.pathname.split("/");
    const filename = pathParts.at(-1);

    if (!filename?.startsWith(PREVIEW_PREFIX)) {
      return imageUrl;
    }

    pathParts[pathParts.length - 1] = filename.slice(PREVIEW_PREFIX.length);
    url.pathname = pathParts.join("/");

    return url.toString();
  } catch {
    return imageUrl;
  }
}
