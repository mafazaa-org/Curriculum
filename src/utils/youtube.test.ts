import { describe, test, expect } from "vitest";
import {
  getYouTubePlaylistId,
  buildSlotStream,
  interleaveSlots,
} from "./youtube";
import type { SlotConfig } from "./youtube";

describe("youtube utilities", () => {
  describe("getYouTubePlaylistId", () => {
    test("should extract list parameter from youtube.com urls", () => {
      const url = "https://www.youtube.com/playlist?list=PL6n9fhu94yhXjG1w2klgqr2R9yH9gIX1I";
      expect(getYouTubePlaylistId(url)).toBe("PL6n9fhu94yhXjG1w2klgqr2R9yH9gIX1I");
    });

    test("should extract from mobile youtube urls", () => {
      const url = "https://m.youtube.com/playlist?list=PL6n9fhu94yhXjG1w2klgqr2R9yH9gIX1I";
      expect(getYouTubePlaylistId(url)).toBe("PL6n9fhu94yhXjG1w2klgqr2R9yH9gIX1I");
    });

    test("should extract from embed/videoseries urls", () => {
      const url = "https://www.youtube.com/embed/videoseries?list=PL6n9fhu94yhXjG1w2klgqr2R9yH9gIX1I";
      expect(getYouTubePlaylistId(url)).toBe("PL6n9fhu94yhXjG1w2klgqr2R9yH9gIX1I");
    });

    test("should return null for invalid urls or urls without list param", () => {
      expect(getYouTubePlaylistId("invalid-url")).toBeNull();
      expect(getYouTubePlaylistId("https://www.youtube.com/watch?v=123")).toBeNull();
    });
  });

  describe("buildSlotStream", () => {
    const playlists = [
      ["V1", "V2", "V3", "V4"],
      ["W1", "W2"],
    ];

    test("should combine playlists sequentially with default offsets", () => {
      const slot: SlotConfig = {
        playlists: [
          { playlistIndex: 0, startFrom: 1 },
          { playlistIndex: 1, startFrom: 1 },
        ],
      };
      const result = buildSlotStream(playlists, slot);
      expect(result).toEqual(["V1", "V2", "V3", "V4", "W1", "W2"]);
    });

    test("should skip items based on startFrom offset", () => {
      const slot: SlotConfig = {
        playlists: [
          { playlistIndex: 0, startFrom: 3 }, // starts from V3 (skips V1, V2)
          { playlistIndex: 1, startFrom: 2 }, // starts from W2 (skips W1)
        ],
      };
      const result = buildSlotStream(playlists, slot);
      expect(result).toEqual(["V3", "V4", "W2"]);
    });
  });

  describe("interleaveSlots", () => {
    const playlists = [
      ["A1", "A2", "A3", "A4"],
      ["B1", "B2", "B3"],
      ["C1", "C2"],
    ];

    test("should return empty array if no slots", () => {
      expect(interleaveSlots(playlists, [])).toEqual([]);
    });

    test("should interleave slots round-robin and stop when any slot is exhausted", () => {
      // Slot 1: Playlist 0 (A1, A2, A3, A4) -> length 4
      // Slot 2: Playlist 1 (B1, B2, B3)     -> length 3
      // Slot 3: Playlist 2 (C1, C2)         -> length 2
      // Shortest slot is Slot 3 (length 2).
      // So round-robin should stop after 2 rounds.
      // Expected result: [A1, B1, C1, A2, B2, C2]
      const slots: SlotConfig[] = [
        { playlists: [{ playlistIndex: 0, startFrom: 1 }] },
        { playlists: [{ playlistIndex: 1, startFrom: 1 }] },
        { playlists: [{ playlistIndex: 2, startFrom: 1 }] },
      ];

      const result = interleaveSlots(playlists, slots);
      expect(result).toEqual(["A1", "B1", "C1", "A2", "B2", "C2"]);
    });

    test("should handle sequential slots correctly", () => {
      // Slot 1: Playlist 0 (A1, A2, A3, A4) -> length 4
      // Slot 2: Playlist 1 + 2 (B1, B2, B3, C1, C2) -> length 5
      // Shortest slot is Slot 1 (length 4).
      // Expected result: 4 rounds:
      // Round 0: A1, B1
      // Round 1: A2, B2
      // Round 2: A3, B3
      // Round 3: A4, C1
      const slots: SlotConfig[] = [
        { playlists: [{ playlistIndex: 0, startFrom: 1 }] },
        {
          playlists: [
            { playlistIndex: 1, startFrom: 1 },
            { playlistIndex: 2, startFrom: 1 },
          ],
        },
      ];

      const result = interleaveSlots(playlists, slots);
      expect(result).toEqual(["A1", "B1", "A2", "B2", "A3", "B3", "A4", "C1"]);
    });
  });
});
