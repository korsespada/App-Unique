export const VKCLOUD_HOST = "hb.ru-msk.vkcloud-storage.ru";
export const VKCLOUD_ORIG_BUCKET = "yeezy-app";
export const VKCLOUD_THUMBS_BUCKET = "yeezy-app-thumbs";

export function getThumbUrl(url: string, thumb = "400x500") {
  const raw = String(url || "").trim();
  if (!raw) return raw;

  try {
    const u = new URL(raw);

    if (
      u.hostname === VKCLOUD_HOST &&
      (u.pathname.startsWith(`/${VKCLOUD_ORIG_BUCKET}/`) ||
        u.pathname.startsWith(`/${VKCLOUD_THUMBS_BUCKET}/`))
    ) {
      const fromOrig = u.pathname.startsWith(`/${VKCLOUD_ORIG_BUCKET}/`);
      const rest = fromOrig
        ? u.pathname.slice(`/${VKCLOUD_ORIG_BUCKET}/`.length)
        : (() => {
            const parts = u.pathname.slice(`/${VKCLOUD_THUMBS_BUCKET}/`.length).split("/").filter(Boolean);
            // Если уже содержит размер в пути, удаляем его
            if (parts.length >= 1 && /^\d+x\d+$/.test(parts[0])) {
              return parts.slice(1).join("/");
            }
            return parts.join("/");
          })();

      // Формируем новый путь к thumb с правильной структурой
      u.pathname = `/${VKCLOUD_THUMBS_BUCKET}/${thumb}/${rest}`;
      u.search = "";
      return u.toString();
    }

    if (!u.searchParams.has("thumb") && u.pathname.includes("/api/files/")) {
      u.searchParams.set("thumb", thumb);
    }

    if (u.searchParams.has("w")) {
      u.searchParams.set("w", "600");
    }

    return u.toString();
  } catch {
    return raw;
  }
}

export function getDetailImageUrl(url: string) {
  const raw = String(url || "").trim();
  if (!raw) return raw;

  try {
    const u = new URL(raw);
    if (
      u.hostname === VKCLOUD_HOST
      && u.pathname.startsWith(`/${VKCLOUD_ORIG_BUCKET}/`)
    ) {
      return u.toString();
    }
  } catch {
    // ignore
  }

  return getThumbUrl(raw, "1000x1250");
}
