/** Extract YouTube video ID from various URL formats */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);

    // youtu.be/VIDEO_ID
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1).split("?")[0] || null;
    }

    // youtube.com/watch?v=VIDEO_ID
    if (
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com"
    ) {
      const v = parsed.searchParams.get("v");
      if (v) return v;

      // youtube.com/embed/VIDEO_ID or youtube.com/shorts/VIDEO_ID
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") return parts[1] ?? null;
    }
  } catch {
    // invalid URL
  }
  return null;
}

export interface VideoMeta {
  title: string;
  thumbnail_url: string;
}

/** Fetch video title and thumbnail via YouTube oEmbed */
export async function fetchVideoMeta(youtubeUrl: string): Promise<VideoMeta> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`;
  const res = await fetch(oEmbedUrl);
  if (!res.ok) throw new Error(`oEmbed fetch failed: ${res.status}`);
  const data = await res.json();
  return {
    title: data.title ?? "Untitled",
    thumbnail_url: data.thumbnail_url ?? "",
  };
}
