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

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string;

/** Fetch video title and thumbnail via YouTube Data API v3 */
export async function fetchVideoMeta(youtubeUrl: string): Promise<VideoMeta> {
  const videoId = getYouTubeVideoId(youtubeUrl);
  if (!videoId) throw new Error(`Could not extract video ID from: ${youtubeUrl}`);

  if (!API_KEY) throw new Error("YouTube API key is not configured (VITE_YOUTUBE_API_KEY)");

  const apiUrl =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(API_KEY)}`;

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`YouTube API request failed: ${res.status}`);

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error(`Video not found: ${videoId}`);

  const snippet = item.snippet;
  const thumbnail =
    snippet.thumbnails?.high?.url ??
    snippet.thumbnails?.medium?.url ??
    snippet.thumbnails?.default?.url ??
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return {
    title: snippet.title ?? "Untitled",
    thumbnail_url: thumbnail,
  };
}

