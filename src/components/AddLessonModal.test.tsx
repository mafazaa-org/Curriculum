import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddLessonModal } from "./AddLessonModal";
import * as youtubeUtils from "../utils/youtube";
import "@testing-library/jest-dom";

// Mock the youtube fetch utility
vi.mock("../utils/youtube", async (importOriginal) => {
  const actual = await importOriginal<typeof youtubeUtils>();
  return {
    ...actual,
    fetchVideoMeta: vi.fn(),
  };
});

describe("AddLessonModal", () => {
  const defaultProps = {
    onAdd: vi.fn(),
    onClose: vi.fn(),
    defaultMonth: 1,
    nextOrder: 1,
    months: [1, 2, 3],
  };

  test("renders correctly", () => {
    render(<AddLessonModal {...defaultProps} />);
    expect(screen.getByText("أضف درسًا جديدًا")).toBeInTheDocument();
  });

  test("calls onAdd with single lesson when video is under 120 minutes", async () => {
    const fetchMock = vi.mocked(youtubeUtils.fetchVideoMeta);
    fetchMock.mockResolvedValueOnce({
      title: "Short Video",
      thumbnail_url: "thumb",
      durationSeconds: 1800, // 30 mins
    });

    const onAddMock = vi.fn();
    render(<AddLessonModal {...defaultProps} onAdd={onAddMock} />);

    const urlInput = screen.getByPlaceholderText("https://youtube.com/watch?v=...");
    fireEvent.change(urlInput, { target: { value: "https://youtube.com/watch?v=short" } });

    const submitBtn = screen.getByText("إضافة الدرس");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onAddMock).toHaveBeenCalledTimes(1);
    });

    const added = onAddMock.mock.calls[0][0];
    expect(Array.isArray(added)).toBe(false);
    expect(added).toMatchObject({
      youtubeUrl: "https://youtube.com/watch?v=short",
      title: "Short Video",
      month: 1,
      order: 1,
    });
  });

  test("splits lesson into two parts when video is 120 minutes or longer", async () => {
    const fetchMock = vi.mocked(youtubeUtils.fetchVideoMeta);
    fetchMock.mockResolvedValueOnce({
      title: "Long Video",
      thumbnail_url: "thumb",
      durationSeconds: 7200, // 120 mins
    });

    const onAddMock = vi.fn();
    render(<AddLessonModal {...defaultProps} onAdd={onAddMock} />);

    const urlInput = screen.getByPlaceholderText("https://youtube.com/watch?v=...");
    fireEvent.change(urlInput, { target: { value: "https://youtube.com/watch?v=long" } });

    const submitBtn = screen.getByText("إضافة الدرس");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onAddMock).toHaveBeenCalledTimes(1);
    });

    const added = onAddMock.mock.calls[0][0];
    expect(Array.isArray(added)).toBe(true);
    expect(added).toHaveLength(2);

    expect(added[0]).toMatchObject({
      youtubeUrl: "https://youtube.com/watch?v=long",
      title: "Long Video",
      partNumber: 1,
      partTitle: "الجزء الأول",
      startSecond: 0,
      endSecond: 3600,
      month: 1,
      order: 1,
    });

    expect(added[1]).toMatchObject({
      youtubeUrl: "https://youtube.com/watch?v=long",
      title: "Long Video",
      partNumber: 2,
      partTitle: "الجزء الثاني",
      startSecond: 3600,
      endSecond: 7200,
      month: 1,
      order: 2,
    });
  });

  test("sets exact part titles when splitting a long video regardless of input", async () => {
    const fetchMock = vi.mocked(youtubeUtils.fetchVideoMeta);
    fetchMock.mockResolvedValueOnce({
      title: "Long Video with custom title",
      thumbnail_url: "thumb",
      durationSeconds: 7200,
    });

    const onAddMock = vi.fn();
    render(<AddLessonModal {...defaultProps} onAdd={onAddMock} />);

    const urlInput = screen.getByPlaceholderText("https://youtube.com/watch?v=...");
    fireEvent.change(urlInput, { target: { value: "https://youtube.com/watch?v=long" } });

    const titleInput = screen.getByPlaceholderText("مثال: الجزء الأول");
    fireEvent.change(titleInput, { target: { value: "باب الصلاة" } });

    const submitBtn = screen.getByText("إضافة الدرس");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onAddMock).toHaveBeenCalledTimes(1);
    });

    const added = onAddMock.mock.calls[0][0];
    expect(added[0].partTitle).toBe("الجزء الأول");
    expect(added[1].partTitle).toBe("الجزء الثاني");
  });
});
