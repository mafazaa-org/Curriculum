import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddPlaylistsModal } from "./AddPlaylistsModal";
import * as youtubeUtils from "../utils/youtube";
import "@testing-library/jest-dom";

// Mock the youtube fetch utility
vi.mock("../utils/youtube", async (importOriginal) => {
  const actual = await importOriginal<typeof youtubeUtils>();
  return {
    ...actual,
    fetchPlaylistItems: vi.fn(),
  };
});

const mockPlaylists = [
  [
    { youtubeUrl: "url1", title: "Vid A1", thumbnail_url: "thumb" },
    { youtubeUrl: "url2", title: "Vid A2", thumbnail_url: "thumb" },
  ],
  [
    { youtubeUrl: "url3", title: "Vid B1", thumbnail_url: "thumb" },
  ],
];

describe("AddPlaylistsModal", () => {
  const defaultProps = {
    onAdd: vi.fn(),
    onClose: vi.fn(),
    defaultMonth: 1,
    months: [1, 2, 3],
    existingLessons: [],
  };

  test("renders step 1 with empty input fields", () => {
    render(<AddPlaylistsModal {...defaultProps} />);
    expect(screen.getByText("إضافة قوائم تشغيل")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("https://youtube.com/playlist?list=...")).toHaveLength(2);
  });

  test("adds a playlist input row on button click", () => {
    render(<AddPlaylistsModal {...defaultProps} />);
    const addBtn = screen.getByText("+ إضافة قائمة تشغيل");
    fireEvent.click(addBtn);
    expect(screen.getAllByPlaceholderText("https://youtube.com/playlist?list=...")).toHaveLength(3);
  });

  test("fetches playlists and transitions to step 2 on valid input", async () => {
    const fetchMock = vi.mocked(youtubeUtils.fetchPlaylistItems);
    fetchMock.mockResolvedValueOnce(mockPlaylists[0]);
    fetchMock.mockResolvedValueOnce(mockPlaylists[1]);

    render(<AddPlaylistsModal {...defaultProps} />);
    const inputs = screen.getAllByPlaceholderText("https://youtube.com/playlist?list=...");
    fireEvent.change(inputs[0], { target: { value: "https://www.youtube.com/playlist?list=PLA" } });
    fireEvent.change(inputs[1], { target: { value: "https://www.youtube.com/playlist?list=PLB" } });

    const nextBtn = screen.getByText("التالي ←");
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText("ترتيب قوائم التشغيل")).toBeInTheDocument();
    });

    expect(screen.getByText("مرتبة 1")).toBeInTheDocument();
    expect(screen.getByText("مرتبة 2")).toBeInTheDocument();
  });

  test("performs correct distribution across months on confirm", async () => {
    const fetchMock = vi.mocked(youtubeUtils.fetchPlaylistItems);
    // Setup mock values for 2 playlists
    fetchMock.mockResolvedValueOnce([
      { youtubeUrl: "urlA1", title: "Vid A1", thumbnail_url: "thumb" },
      { youtubeUrl: "urlA2", title: "Vid A2", thumbnail_url: "thumb" },
      { youtubeUrl: "urlA3", title: "Vid A3", thumbnail_url: "thumb" },
    ]);
    fetchMock.mockResolvedValueOnce([
      { youtubeUrl: "urlB1", title: "Vid B1", thumbnail_url: "thumb" },
      { youtubeUrl: "urlB2", title: "Vid B2", thumbnail_url: "thumb" },
    ]);

    const onAddMock = vi.fn();
    // Simulate that Month 1 already has 19 lessons.
    // The distributed placement should put the first lesson of Slot 1 (Vid A1) in Month 1 (making it 20).
    // Then Month 1 becomes full (reaches 20 lessons limit), so all remaining lessons should overflow to Month 2.
    const existingLessons = Array.from({ length: 19 }, (_, i) => ({
      id: `existing-${i}`,
      youtubeUrl: `existing-url-${i}`,
      title: `Existing ${i}`,
      thumbnail_url: "thumb",
      month: 1,
      order: i + 1,
    }));

    render(
      <AddPlaylistsModal
        {...defaultProps}
        months={[1]}
        onAdd={onAddMock}
        existingLessons={existingLessons}
      />
    );

    // Step 1: Input URLs & go next
    const inputs = screen.getAllByPlaceholderText("https://youtube.com/playlist?list=...");
    fireEvent.change(inputs[0], { target: { value: "https://www.youtube.com/playlist?list=PLA" } });
    fireEvent.change(inputs[1], { target: { value: "https://www.youtube.com/playlist?list=PLB" } });
    fireEvent.click(screen.getByText("التالي ←"));

    await waitFor(() => {
      expect(screen.getByText("ترتيب قوائم التشغيل")).toBeInTheDocument();
    });

    // Check interleaving:
    // Slot 1 (A): [A1, A2, A3]
    // Slot 2 (B): [B1, B2]
    // Slot 2 is shortest (length 2). Stop when any slot ends -> 2 rounds of interleaving.
    // Round 0: A1, B1
    // Round 1: A2, B2
    // Total interleaved items = 4: [A1, B1, A2, B2]
    // Distribution starting at Month 1 (which has 19 items):
    // A1 goes to Month 1 (becomes 20th item)
    // Month 1 is now full.
    // B1 goes to Month 2 (order 1)
    // A2 goes to Month 2 (order 2)
    // B2 goes to Month 2 (order 3)

    // Find the add lessons button (should be "إضافة 4 درس")
    const confirmBtn = screen.getByText("إضافة 4 درس");
    fireEvent.click(confirmBtn);

    expect(onAddMock).toHaveBeenCalledTimes(1);
    const addedLessons = onAddMock.mock.calls[0][0];
    expect(addedLessons).toHaveLength(4);

    expect(addedLessons[0]).toMatchObject({ title: "Vid A1", month: 1, order: 20 });
    expect(addedLessons[1]).toMatchObject({ title: "Vid B1", month: 2, order: 1 });
    expect(addedLessons[2]).toMatchObject({ title: "Vid A2", month: 2, order: 2 });
    expect(addedLessons[3]).toMatchObject({ title: "Vid B2", month: 2, order: 3 });
  });

  test("counts side-by-side lesson groups as one lesson slot when determining capacity", async () => {
    const fetchMock = vi.mocked(youtubeUtils.fetchPlaylistItems);
    fetchMock.mockResolvedValueOnce([
      { youtubeUrl: "urlA1", title: "Vid A1", thumbnail_url: "thumb" },
      { youtubeUrl: "urlA2", title: "Vid A2", thumbnail_url: "thumb" },
    ]);
    fetchMock.mockResolvedValueOnce([
      { youtubeUrl: "urlB1", title: "Vid B1", thumbnail_url: "thumb" },
    ]);

    const onAddMock = vi.fn();
    // Simulate that Month 1 has 38 lessons, but they share orders 1-19 (2 lessons per order row).
    // Thus Month 1 unique orders = 19 (which is < 20). It has 1 slot left.
    const existingLessons: any[] = [];
    for (let o = 1; o <= 19; o++) {
      existingLessons.push({ id: `ex-a-${o}`, youtubeUrl: `u-${o}-a`, title: `Ex ${o} A`, month: 1, order: o });
      existingLessons.push({ id: `ex-b-${o}`, youtubeUrl: `u-${o}-b`, title: `Ex ${o} B`, month: 1, order: o });
    }

    render(
      <AddPlaylistsModal
        {...defaultProps}
        months={[1]}
        onAdd={onAddMock}
        existingLessons={existingLessons}
      />
    );

    // Step 1: Input URLs & go next
    const inputs = screen.getAllByPlaceholderText("https://youtube.com/playlist?list=...");
    fireEvent.change(inputs[0], { target: { value: "https://www.youtube.com/playlist?list=PLA" } });
    fireEvent.change(inputs[1], { target: { value: "https://www.youtube.com/playlist?list=PLB" } });
    fireEvent.click(screen.getByText("التالي ←"));

    await waitFor(() => {
      expect(screen.getByText("ترتيب قوائم التشغيل")).toBeInTheDocument();
    });

    // Stop when any slot ends (Slot 2 has 1 item, so 1 round -> Vid A1, Vid B1)
    const confirmBtn = screen.getByText("إضافة 2 درس");
    fireEvent.click(confirmBtn);

    expect(onAddMock).toHaveBeenCalledTimes(1);
    const added = onAddMock.mock.calls[0][0];
    expect(added).toHaveLength(2);

    // Vid A1 should fill Month 1's last slot (order 20)
    expect(added[0]).toMatchObject({ title: "Vid A1", month: 1, order: 20 });
    // Vid B1 should go to Month 2 (order 1)
    expect(added[1]).toMatchObject({ title: "Vid B1", month: 2, order: 1 });
  });
});

