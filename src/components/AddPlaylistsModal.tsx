import { useState } from "react";
import type { Lesson } from "../types";
import {
  fetchPlaylistItems,
  interleaveSlots,
  getYouTubePlaylistId,
} from "../utils/youtube";
import type { PlaylistItem, SlotConfig } from "../utils/youtube";
import { getArabicOrdinal } from "../utils/arabic";
import "./AddPlaylistsModal.css";

interface Props {
  onAdd: (lessons: Lesson[]) => void;
  onClose: () => void;
  defaultMonth: number;
  months: number[];
  existingLessons: Lesson[];
}

interface PlaylistRow {
  id: string;
  url: string;
}

interface FetchedPlaylist {
  url: string;
  title: string;
  items: PlaylistItem[];
}

/** A playlist assigned to a slot, with its start offset */
interface SlotPlaylist {
  playlistIndex: number;
  startFrom: number; // 1-indexed
}

/** A named slot containing sequential playlists */
interface Slot {
  id: string;
  playlists: SlotPlaylist[];
}

type Step = "urls" | "order";

function generateId(): string {
  return crypto.randomUUID();
}

export function AddPlaylistsModal({
  onAdd,
  onClose,
  defaultMonth,
  months,
  existingLessons,
}: Props) {
  const [step, setStep] = useState<Step>("urls");
  const [rows, setRows] = useState<PlaylistRow[]>([
    { id: generateId(), url: "" },
    { id: generateId(), url: "" },
  ]);
  const [loading, setLoading] = useState(false);

  // Automatically calculate target start month:
  // "added after the last lesson in the last month made, and complete the max number for this month, then take place in the next months and so on, and if the last month is complete, start with the next to it"
  const lastMonthMade = months.length > 0 ? Math.max(...months) : 1;
  const lastMonthUniqueOrders = new Set(
    existingLessons.filter((l) => l.month === lastMonthMade).map((l) => l.order)
  ).size;
  const startMonth = lastMonthUniqueOrders >= 20 ? lastMonthMade + 1 : lastMonthMade;


  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [fetchedPlaylists, setFetchedPlaylists] = useState<FetchedPlaylist[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dragPlaylist, setDragPlaylist] = useState<{
    playlistIndex: number;
    sourceSlotId: string | null;
  } | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const [dragSlotIdx, setDragSlotIdx] = useState<number | null>(null);
  const [dragOverSlotIdx, setDragOverSlotIdx] = useState<number | null>(null);

  // ── Step 1 handlers ──
  const handleAddRow = () => {
    setRows((prev) => [...prev, { id: generateId(), url: "" }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const handleUrlChange = (id: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, url: value } : r)));
  };

  const validRows = rows.filter(
    (r) => r.url.trim() && getYouTubePlaylistId(r.url.trim())
  );

  const handleFetchPlaylists = async () => {
    if (validRows.length === 0) {
      setError("أدخل رابط قائمة تشغيل واحد على الأقل.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results: FetchedPlaylist[] = [];

      for (const row of validRows) {
        const items = await fetchPlaylistItems(row.url.trim());
        if (items.length === 0) {
          setError(`قائمة التشغيل فارغة أو خاصة: ${row.url.trim()}`);
          setLoading(false);
          return;
        }
        results.push({
          url: row.url.trim(),
          title: `قائمة ${results.length + 1} (${items.length} فيديو)`,
          items,
        });
      }

      setFetchedPlaylists(results);
      // Default: each playlist in its own slot
      const defaultSlots: Slot[] = results.map((_, i) => ({
        id: generateId(),
        playlists: [{ playlistIndex: i, startFrom: 1 }],
      }));
      setSlots(defaultSlots);
      setStep("order");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ أثناء جلب قوائم التشغيل."
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Slot management ──

  const assignedIndices = new Set(
    slots.flatMap((s) => s.playlists.map((p) => p.playlistIndex))
  );
  const unassignedIndices = fetchedPlaylists
    .map((_, i) => i)
    .filter((i) => !assignedIndices.has(i));

  const handleAddSlot = () => {
    setSlots((prev) => [...prev, { id: generateId(), playlists: [] }]);
  };

  const handleRemoveSlot = (slotId: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  };

  const handleStartFromChange = (
    slotId: string,
    playlistIndex: number,
    value: number
  ) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              playlists: s.playlists.map((p) =>
                p.playlistIndex === playlistIndex
                  ? { ...p, startFrom: Math.max(1, value) }
                  : p
              ),
            }
          : s
      )
    );
  };

  const handleRemoveFromSlot = (slotId: string, playlistIndex: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? { ...s, playlists: s.playlists.filter((p) => p.playlistIndex !== playlistIndex) }
          : s
      )
    );
  };

  // ── Drag playlist into slot ──
  const handlePlaylistDragStart = (
    playlistIndex: number,
    sourceSlotId: string | null
  ) => {
    setDragPlaylist({ playlistIndex, sourceSlotId });
  };

  const handleSlotDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    setDragOverSlotId(slotId);
  };

  const handleSlotDrop = (targetSlotId: string) => {
    if (!dragPlaylist) {
      setDragOverSlotId(null);
      return;
    }

    const { playlistIndex, sourceSlotId } = dragPlaylist;

    setSlots((prev) => {
      let updated = prev;
      // Remove from source slot if it was in one
      if (sourceSlotId) {
        updated = updated.map((s) =>
          s.id === sourceSlotId
            ? { ...s, playlists: s.playlists.filter((p) => p.playlistIndex !== playlistIndex) }
            : s
        );
      }
      // Add to target slot
      updated = updated.map((s) =>
        s.id === targetSlotId
          ? { ...s, playlists: [...s.playlists, { playlistIndex, startFrom: 1 }] }
          : s
      );
      return updated;
    });

    setDragPlaylist(null);
    setDragOverSlotId(null);
  };

  // ── Drag slot to reorder ──
  const handleSlotReorderStart = (idx: number) => {
    setDragSlotIdx(idx);
  };

  const handleSlotReorderOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverSlotIdx(idx);
  };

  const handleSlotReorderDrop = (targetIdx: number) => {
    if (dragSlotIdx === null || dragSlotIdx === targetIdx) {
      setDragSlotIdx(null);
      setDragOverSlotIdx(null);
      return;
    }

    setSlots((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragSlotIdx, 1);
      updated.splice(targetIdx, 0, moved);
      return updated;
    });
    setDragSlotIdx(null);
    setDragOverSlotIdx(null);
  };

  // ── Build preview & confirm ──
  const slotConfigs: SlotConfig[] = slots
    .filter((s) => s.playlists.length > 0)
    .map((s) => ({
      playlists: s.playlists.map((p) => ({
        playlistIndex: p.playlistIndex,
        startFrom: p.startFrom,
      })),
    }));

  const allPlaylistItems = fetchedPlaylists.map((p) => p.items);
  const previewAllRaw = interleaveSlots(allPlaylistItems, slotConfigs);

  // Distribute previewAllRaw across months starting from the selected start month
  const MAX_CARDS = 20;
  const distributedLessons: Lesson[] = (() => {
    const lessonsList: Lesson[] = [];
    let currentMonth = startMonth;

    // Track unique orders count per month
    const monthUniqueOrders = new Map<number, number>();
    const getMonthUniqueOrders = (m: number) => {
      if (!monthUniqueOrders.has(m)) {
        const count = new Set(
          existingLessons.filter((l) => l.month === m).map((l) => l.order)
        ).size;
        monthUniqueOrders.set(m, count);
      }
      return monthUniqueOrders.get(m)!;
    };

    // Track next order number to assign per month
    const monthNextOrders = new Map<number, number>();
    const getNextOrder = (m: number) => {
      if (!monthNextOrders.has(m)) {
        const lessonsInMonth = existingLessons.filter((l) => l.month === m);
        const maxOrder = lessonsInMonth.length > 0
          ? Math.max(...lessonsInMonth.map((l) => l.order))
          : 0;
        monthNextOrders.set(m, maxOrder + 1);
      }
      const nextOrder = monthNextOrders.get(m)!;
      monthNextOrders.set(m, nextOrder + 1);
      return nextOrder;
    };

    for (const item of previewAllRaw) {
      while (getMonthUniqueOrders(currentMonth) >= MAX_CARDS) {
        currentMonth += 1;
      }

      const order = getNextOrder(currentMonth);
      lessonsList.push({
        id: generateId(),
        youtubeUrl: item.youtubeUrl,
        title: item.title,
        thumbnail_url: item.thumbnail_url,
        month: currentMonth,
        order,
      });

      monthUniqueOrders.set(currentMonth, getMonthUniqueOrders(currentMonth) + 1);
    }
    return lessonsList;
  })();

  const previewItems = distributedLessons.slice(0, 12);
  const totalLessons = distributedLessons.length;

  const canConfirm = slotConfigs.length >= 2 || (slotConfigs.length === 1 && totalLessons > 0);

  const handleConfirm = () => {
    onAdd(distributedLessons);
    onClose();
  };

  return (
    <div className="add-modal__overlay" onClick={onClose}>
      <div
        className="add-modal playlist-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-modal__header">
          <h3>
            {step === "urls" ? "إضافة قوائم تشغيل" : "ترتيب قوائم التشغيل"}
          </h3>
          <button className="add-modal__close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        {/* ── Step 1: Enter URLs ── */}
        {step === "urls" && (
          <div className="add-modal__form">
            <p className="playlist-modal__hint">
              أدخل روابط قوائم التشغيل من يوتيوب. يمكنك إضافة أي عدد.
            </p>

            <div className="playlist-modal__rows">
              {rows.map((row, idx) => (
                <div key={row.id} className="playlist-modal__row">
                  <span className="playlist-modal__row-num">{idx + 1}</span>
                  <input
                    className="add-modal__input"
                    type="url"
                    placeholder="https://youtube.com/playlist?list=..."
                    value={row.url}
                    onChange={(e) => handleUrlChange(row.id, e.target.value)}
                    dir="ltr"
                  />
                  <button
                    className="playlist-modal__remove-btn"
                    onClick={() => handleRemoveRow(row.id)}
                    disabled={rows.length <= 1}
                    aria-label="حذف"
                    title="حذف"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              className="btn btn--ghost playlist-modal__add-row-btn"
              onClick={handleAddRow}
              type="button"
            >
              + إضافة قائمة تشغيل
            </button>

            <div className="playlist-modal__info-banner">
              <span>📅 سيتم إضافة الدروس بدءاً من <strong>الشهر {getArabicOrdinal(startMonth)}</strong></span>
            </div>

            {error && <p className="add-modal__error">{error}</p>}

            <div className="add-modal__actions">
              <button
                className="btn btn--primary"
                onClick={handleFetchPlaylists}
                disabled={loading || validRows.length === 0}
              >
                {loading ? "جارٍ الجلب..." : "التالي ←"}
              </button>
              <button className="btn btn--ghost" onClick={onClose}>
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Slot-based organizer ── */}
        {step === "order" && (
          <div className="add-modal__form">
            <p className="playlist-modal__hint">
              نظّم قوائم التشغيل في مراتب. كل مرتبة تشارك بالتناوب. داخل المرتبة
              الواحدة، القوائم تلعب بالتسلسل. اسحب القوائم بين المراتب لإعادة
              التنظيم.
            </p>

            {/* Unassigned playlists */}
            {unassignedIndices.length > 0 && (
              <div className="playlist-modal__unassigned">
                <h4 className="playlist-modal__section-title">
                  قوائم غير مُعيَّنة
                </h4>
                <div className="playlist-modal__chip-row">
                  {unassignedIndices.map((pIdx) => (
                    <div
                      key={pIdx}
                      className="playlist-modal__chip"
                      draggable
                      onDragStart={() => handlePlaylistDragStart(pIdx, null)}
                      onDragEnd={() => {
                        setDragPlaylist(null);
                        setDragOverSlotId(null);
                      }}
                    >
                      <span className="playlist-modal__chip-name">
                        {fetchedPlaylists[pIdx].title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slots */}
            <div className="playlist-modal__slots">
              {slots.map((slot, slotIdx) => (
                <div
                  key={slot.id}
                  className={`playlist-modal__slot ${
                    dragOverSlotId === slot.id
                      ? "playlist-modal__slot--drag-over"
                      : ""
                  } ${
                    dragOverSlotIdx === slotIdx
                      ? "playlist-modal__slot--reorder-over"
                      : ""
                  } ${
                    dragSlotIdx === slotIdx
                      ? "playlist-modal__slot--dragging"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    // Allow playlist drops
                    if (dragPlaylist) handleSlotDragOver(e, slot.id);
                    // Allow slot reorder
                    if (dragSlotIdx !== null) handleSlotReorderOver(e, slotIdx);
                  }}
                  onDrop={() => {
                    if (dragPlaylist) handleSlotDrop(slot.id);
                    if (dragSlotIdx !== null) handleSlotReorderDrop(slotIdx);
                  }}
                >
                  <div className="playlist-modal__slot-header">
                    <div
                      className="playlist-modal__slot-handle"
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        handleSlotReorderStart(slotIdx);
                      }}
                      onDragEnd={() => {
                        setDragSlotIdx(null);
                        setDragOverSlotIdx(null);
                      }}
                    >
                      ⠿
                    </div>
                    <span className="playlist-modal__slot-badge">
                      مرتبة {slotIdx + 1}
                    </span>
                    {slot.playlists.length === 0 && (
                      <span className="playlist-modal__slot-empty-hint">
                        اسحب قائمة تشغيل هنا
                      </span>
                    )}
                    <button
                      className="playlist-modal__remove-btn"
                      onClick={() => handleRemoveSlot(slot.id)}
                      title="حذف المرتبة"
                      aria-label="حذف المرتبة"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Playlists in this slot */}
                  {slot.playlists.map((sp, spIdx) => {
                    const playlist = fetchedPlaylists[sp.playlistIndex];
                    const effectiveCount = Math.max(
                      0,
                      playlist.items.length - Math.max(0, sp.startFrom - 1)
                    );
                    return (
                      <div
                        key={sp.playlistIndex}
                        className="playlist-modal__slot-playlist"
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handlePlaylistDragStart(sp.playlistIndex, slot.id);
                        }}
                        onDragEnd={() => {
                          setDragPlaylist(null);
                          setDragOverSlotId(null);
                        }}
                      >
                        <div className="playlist-modal__slot-playlist-info">
                          {slot.playlists.length > 1 && (
                            <span className="playlist-modal__seq-badge">
                              {spIdx + 1}
                            </span>
                          )}
                          <span className="playlist-modal__slot-playlist-name">
                            {playlist.title}
                          </span>
                          <span className="playlist-modal__slot-playlist-count">
                            {effectiveCount} درس
                          </span>
                        </div>
                        <div className="playlist-modal__slot-playlist-controls">
                          <label className="playlist-modal__start-label">
                            ابدأ من:
                          </label>
                          <input
                            type="number"
                            className="playlist-modal__start-input"
                            min={1}
                            max={playlist.items.length}
                            value={sp.startFrom}
                            onChange={(e) =>
                              handleStartFromChange(
                                slot.id,
                                sp.playlistIndex,
                                Number(e.target.value)
                              )
                            }
                          />
                          <button
                            className="playlist-modal__remove-btn"
                            onClick={() =>
                              handleRemoveFromSlot(slot.id, sp.playlistIndex)
                            }
                            title="إزالة من المرتبة"
                            aria-label="إزالة من المرتبة"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <button
              className="btn btn--ghost playlist-modal__add-row-btn"
              onClick={handleAddSlot}
              type="button"
            >
              + إضافة مرتبة
            </button>

            {/* Preview */}
            {totalLessons > 0 && (
              <div className="playlist-modal__preview">
                <h4 className="playlist-modal__preview-title">
                  معاينة الترتيب ({totalLessons} درس)
                </h4>
                <ol className="playlist-modal__preview-list">
                  {previewItems.map((item) => (
                    <li key={item.id} className="playlist-modal__preview-item">
                      <span className="playlist-modal__preview-month">
                        [الشهر {getArabicOrdinal(item.month)}]
                      </span>{" "}
                      {item.title}
                    </li>
                  ))}
                  {totalLessons > 12 && (
                    <li className="playlist-modal__preview-item playlist-modal__preview-more">
                      … و {totalLessons - 12} درس آخر
                    </li>
                  )}
                </ol>
              </div>
            )}

            {error && <p className="add-modal__error">{error}</p>}

            <div className="add-modal__actions">
              <button
                className="btn btn--primary"
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                إضافة {totalLessons} درس
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => setStep("urls")}
              >
                → رجوع
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
