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

/** Extract YouTube playlist ID from various URL formats */
export function getYouTubePlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostnames = ["www.youtube.com", "youtube.com", "m.youtube.com"];

    if (hostnames.includes(parsed.hostname) || parsed.hostname === "youtu.be") {
      const list = parsed.searchParams.get("list");
      if (list) return list;

      // youtube.com/playlist?list=PLxxxxxx
      if (parsed.pathname === "/playlist") {
        return parsed.searchParams.get("list");
      }

      // embed/videoseries?list=PLxxxxxx
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" && parts[1] === "videoseries") {
        return parsed.searchParams.get("list");
      }
    }
  } catch {
    // invalid URL
  }
  return null;
}

export interface PlaylistItem {
  youtubeUrl: string;
  title: string;
  thumbnail_url: string;
}

/** Fetch all videos from a YouTube playlist via Data API v3 */
export async function fetchPlaylistItems(playlistUrl: string): Promise<PlaylistItem[]> {
  const playlistId = getYouTubePlaylistId(playlistUrl);
  if (!playlistId) throw new Error(`Could not extract playlist ID from: ${playlistUrl}`);
  if (!API_KEY) throw new Error("YouTube API key is not configured (VITE_YOUTUBE_API_KEY)");

  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: "50",
      key: API_KEY,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`
    );
    if (!res.ok) throw new Error(`YouTube API request failed: ${res.status}`);

    const data = await res.json();

    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      // Skip deleted/private videos
      if (snippet.title === "Deleted video" || snippet.title === "Private video") continue;

      const videoId = snippet.resourceId?.videoId;
      if (!videoId) continue;

      const thumbnail =
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        snippet.thumbnails?.default?.url ??
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      items.push({
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: snippet.title ?? "Untitled",
        thumbnail_url: thumbnail,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

/** Configuration for a single playlist within a slot */
export interface PlaylistInSlot {
  playlistIndex: number;
  startFrom: number; // 1-indexed
}

/** A slot groups one or more sequential playlists for round-robin */
export interface SlotConfig {
  playlists: PlaylistInSlot[];
}

/**
 * Build the effective item stream for a slot by concatenating its playlists
 * (each trimmed by startFrom offset) in order.
 */
export function buildSlotStream<T>(
  allPlaylists: T[][],
  slot: SlotConfig
): T[] {
  const stream: T[] = [];
  for (const p of slot.playlists) {
    const playlist = allPlaylists[p.playlistIndex] ?? [];
    const offset = Math.max(0, p.startFrom - 1);
    stream.push(...playlist.slice(offset));
  }
  return stream;
}

/**
 * Interleave slots round-robin.
 * Stops entirely when ANY slot's stream is exhausted (no partial rounds).
 */
export function interleaveSlots<T>(
  allPlaylists: T[][],
  slots: SlotConfig[]
): T[] {
  if (slots.length === 0) return [];

  const streams = slots.map((slot) => buildSlotStream(allPlaylists, slot));
  const minLen = Math.min(...streams.map((s) => s.length));
  const result: T[] = [];

  for (let i = 0; i < minLen; i++) {
    for (const stream of streams) {
      result.push(stream[i]);
    }
  }

  return result;
}
