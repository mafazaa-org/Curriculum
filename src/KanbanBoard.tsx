import { useState, useRef, useEffect } from "react";
import type { Lesson } from "./types";
import { MonthColumn } from "./components/MonthColumn";
import { JsonImporter } from "./components/JsonImporter";
import { JsonExporter } from "./components/JsonExporter";
import { AddLessonModal } from "./components/AddLessonModal";
import { AddPlaylistsModal } from "./components/AddPlaylistsModal";
import { NotificationsModal } from "./components/NotificationsModal";
import { EditLessonModal } from "./components/EditLessonModal";
import "./KanbanBoard.css";

// ─── Drag & Drop helpers ───────────────────────────────────────────────────

/**
 * Renormalize column orders consecutively while maintaining side-by-side duplicate groups.
 */
function normalizeColumnOrders(columnLessons: Lesson[]): Lesson[] {
  const groupedByOrder = new Map<number, Lesson[]>();
  for (const l of columnLessons) {
    const list = groupedByOrder.get(l.order) ?? [];
    list.push(l);
    groupedByOrder.set(l.order, list);
  }
  const sortedOrders = Array.from(groupedByOrder.keys()).sort((a, b) => a - b);

  return sortedOrders.flatMap((oldOrder, newIndex) => {
    const group = groupedByOrder.get(oldOrder)!;
    return group.map((l) => ({ ...l, order: newIndex + 1 }));
  });
}

// ─── Component ────────────────────────────────────────────────────────────

export default function KanbanBoard() {
  const [lessons, setLessons] = useState<Lesson[]>(() => {
    const saved = localStorage.getItem("curriculum_lessons");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeMonths, setActiveMonths] = useState<number[]>(() => {
    const saved = localStorage.getItem("curriculum_active_months");
    const initialized = localStorage.getItem("curriculum_initialized") === "true";
    if (!initialized) return [];
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(() => {
    return localStorage.getItem("curriculum_initialized") !== "true";
  });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastUsedMonth, setLastUsedMonth] = useState<number | null>(() => {
    const saved = localStorage.getItem("curriculum_last_used_month");
    return saved ? Number(saved) : null;
  });
  const [showImporter, setShowImporter] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [activeNotificationsLesson, setActiveNotificationsLesson] = useState<Lesson | null>(null);
  const [activeEditLesson, setActiveEditLesson] = useState<Lesson | null>(null);

  // drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetRow, setDropTargetRow] = useState<string | null>(null);
  const [dropTargetGap, setDropTargetGap] = useState<string | null>(null);

  // Load initial data if not initialized
  useEffect(() => {
    const initialized = localStorage.getItem("curriculum_initialized") === "true";
    if (!initialized) {
      setLoading(true);
      fetch("https://api.npoint.io/2035ddb6c563a8a7b572")
        .then((res) => {
          if (!res.ok) throw new Error("فشل تحميل البيانات الافتراضية");
          return res.json();
        })
        .then((data: Lesson[]) => {
          setLessons(data);
          const uniqueMonths = Array.from(new Set(data.map((l) => l.month))).sort(
            (a, b) => a - b
          );
          const initialMonths = uniqueMonths.length > 0 ? uniqueMonths : [1];
          setActiveMonths(initialMonths);
          localStorage.setItem("curriculum_lessons", JSON.stringify(data));
          localStorage.setItem("curriculum_active_months", JSON.stringify(initialMonths));
          localStorage.setItem("curriculum_initialized", "true");
        })
        .catch((err) => {
          console.error(err);
          setFetchError("حدث خطأ أثناء تحميل البيانات الافتراضية.");
          setActiveMonths([1]);
          localStorage.setItem("curriculum_initialized", "true");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  // Sync state to localStorage
  useEffect(() => {
    const initialized = localStorage.getItem("curriculum_initialized") === "true";
    if (initialized) {
      localStorage.setItem("curriculum_lessons", JSON.stringify(lessons));
      localStorage.setItem("curriculum_active_months", JSON.stringify(activeMonths));
    }
  }, [lessons, activeMonths]);

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = (imported: Lesson[]) => {
    setLessons(imported);
    const uniqueMonths = Array.from(new Set(imported.map((l) => l.month))).sort(
      (a, b) => a - b
    );
    const targetMonths = uniqueMonths.length > 0 ? uniqueMonths : [1];
    setActiveMonths(targetMonths);
    localStorage.setItem("curriculum_lessons", JSON.stringify(imported));
    localStorage.setItem("curriculum_active_months", JSON.stringify(targetMonths));
    localStorage.setItem("curriculum_initialized", "true");
    setShowImporter(false);
  };

  const handleRestoreDefault = () => {
    const confirmRestore = window.confirm("هل أنت متأكد من رغبتك في استعادة المنهج الافتراضي؟ سيؤدي هذا إلى مسح التعديلات الحالية.");
    if (!confirmRestore) return;

    setLoading(true);
    setFetchError(null);
    fetch("https://api.npoint.io/2035ddb6c563a8a7b572")
      .then((res) => {
        if (!res.ok) throw new Error("فشل تحميل البيانات الافتراضية");
        return res.json();
      })
      .then((data: Lesson[]) => {
        setLessons(data);
        const uniqueMonths = Array.from(new Set(data.map((l) => l.month))).sort(
          (a, b) => a - b
        );
        const newMonths = uniqueMonths.length > 0 ? uniqueMonths : [1];
        setActiveMonths(newMonths);
        localStorage.setItem("curriculum_lessons", JSON.stringify(data));
        localStorage.setItem("curriculum_active_months", JSON.stringify(newMonths));
        localStorage.setItem("curriculum_initialized", "true");
      })
      .catch((err) => {
        console.error(err);
        setFetchError("حدث خطأ أثناء استعادة البيانات الافتراضية.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleClearCurriculum = () => {
    const confirmClear = window.confirm("هل أنت متأكد من رغبتك في مسح المنهج بالكامل؟ لا يمكن التراجع عن هذه الخطوة.");
    if (!confirmClear) return;

    setLessons([]);
    setActiveMonths([]);
    localStorage.setItem("curriculum_lessons", JSON.stringify([]));
    localStorage.setItem("curriculum_active_months", JSON.stringify([]));
    localStorage.setItem("curriculum_initialized", "true");
  };

  // ── Add/Delete Month ──────────────────────────────────────────────────────
  const handleAddMonth = () => {
    setActiveMonths((prev) => {
      const nextMonth = prev.length > 0 ? Math.max(...prev) + 1 : 1;
      return [...prev, nextMonth];
    });
  };

  const handleDeleteMonth = (month: number) => {
    const monthLessons = lessons.filter((l) => l.month === month);
    if (monthLessons.length > 0) {
      const confirmDelete = window.confirm(
        `هذا العمود يحتوي على ${monthLessons.length} درس. هل أنت متأكد من حذف العمود وجميع الدروس التي بداخله؟`
      );
      if (!confirmDelete) return;
    }

    setLessons((prev) => prev.filter((l) => l.month !== month));
    setActiveMonths((prev) => {
      const filtered = prev.filter((m) => m !== month);
      return filtered.length > 0 ? filtered : [1];
    });
  };

  // ── Bulk add from playlists ────────────────────────────────────────────────
  const handleAddPlaylists = (newLessons: Lesson[]) => {
    if (newLessons.length === 0) return;

    setLessons((prev) => {
      const all = [...prev, ...newLessons];
      const affectedMonths = Array.from(new Set(newLessons.map((l) => l.month)));

      let updatedAll = all;
      for (const m of affectedMonths) {
        const col = updatedAll.filter((l) => l.month === m);
        const normalizedCol = normalizeColumnOrders(col);
        updatedAll = updatedAll.filter((l) => l.month !== m).concat(normalizedCol);
      }
      return updatedAll;
    });

    const newMonths = Array.from(new Set(newLessons.map((l) => l.month)));
    setActiveMonths((prev) => {
      const combined = Array.from(new Set([...prev, ...newMonths])).sort((a, b) => a - b);
      return combined;
    });
  };


  // ── Add/Delete lesson ─────────────────────────────────────────────────────
  const handleAdd = (lesson: Lesson) => {
    setLastUsedMonth(lesson.month);
    localStorage.setItem("curriculum_last_used_month", String(lesson.month));
    setLessons((prev) => {
      const targetMonthLessons = prev.filter((l) => l.month === lesson.month);
      const maxOrder =
        targetMonthLessons.length > 0
          ? Math.max(...targetMonthLessons.map((l) => l.order))
          : 0;
      const correctedLesson = {
        ...lesson,
        order: maxOrder + 1,
      };
      return [...prev, correctedLesson];
    });
  };

  const handleDeleteLesson = (id: string) => {
    const confirmDelete = window.confirm("هل أنت متأكد من رغبتك في حذف هذا الدرس؟");
    if (!confirmDelete) return;

    setLessons((prev) => {
      const lessonToDelete = prev.find((l) => l.id === id);
      if (!lessonToDelete) return prev;

      const remaining = prev.filter((l) => l.id !== id);
      const month = lessonToDelete.month;
      const col = remaining.filter((l) => l.month === month);
      const normalizedTarget = normalizeColumnOrders(col);

      return remaining.filter((l) => l.month !== month).concat(normalizedTarget);
    });
  };

  const handleUpdateLesson = (updatedLesson: Lesson) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === updatedLesson.id ? updatedLesson : l))
    );
  };

  const handleEditLesson = (oldLesson: Lesson, updatedLesson: Lesson) => {
    setLessons((prev) => {
      const index = prev.findIndex((l) => l.id === updatedLesson.id);
      if (index === -1) return prev;

      let nextLessons = [...prev];
      nextLessons[index] = updatedLesson;

      if (oldLesson.month !== updatedLesson.month || oldLesson.order !== updatedLesson.order) {
        const sourceCol = nextLessons.filter((l) => l.month === oldLesson.month);
        const normalizedSource = normalizeColumnOrders(sourceCol);
        nextLessons = nextLessons.filter((l) => l.month !== oldLesson.month).concat(normalizedSource);

        if (oldLesson.month !== updatedLesson.month) {
          const targetCol = nextLessons.filter((l) => l.month === updatedLesson.month);
          const normalizedTarget = normalizeColumnOrders(targetCol);
          nextLessons = nextLessons.filter((l) => l.month !== updatedLesson.month).concat(normalizedTarget);
        }
      }
      return nextLessons;
    });
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOverRow = (e: React.DragEvent, month: number, order: number) => {
    e.preventDefault();
    setDropTargetRow(`${month}-${order}`);
    setDropTargetGap(null);
  };

  const handleDragOverGap = (
    e: React.DragEvent,
    month: number,
    order: number | null
  ) => {
    e.preventDefault();
    setDropTargetGap(order !== null ? `${month}-${order}` : `${month}-end`);
    setDropTargetRow(null);
  };

  const handleDropOnRow = (e: React.DragEvent, targetMonth: number, targetOrder: number) => {
    e.preventDefault();
    const sourceId = draggingId;
    if (!sourceId) {
      reset();
      return;
    }

    const sourceLesson = lessons.find((l) => l.id === sourceId);
    if (!sourceLesson) {
      reset();
      return;
    }

    // Don't join same order in the same month if it already belongs to it
    if (sourceLesson.month === targetMonth && sourceLesson.order === targetOrder) {
      reset();
      return;
    }

    setLessons((prev) => {
      const remaining = prev.filter((l) => l.id !== sourceId);
      const targetCol = remaining.filter((l) => l.month === targetMonth);
      const moved: Lesson = {
        ...sourceLesson,
        month: targetMonth,
        order: targetOrder,
      };
      targetCol.push(moved);

      const normalizedTarget = normalizeColumnOrders(targetCol);
      const sourceMonth = sourceLesson.month;

      if (sourceMonth === targetMonth) {
        return remaining.filter((l) => l.month !== targetMonth).concat(normalizedTarget);
      } else {
        const sourceCol = remaining.filter((l) => l.month === sourceMonth);
        const normalizedSource = normalizeColumnOrders(sourceCol);
        return remaining
          .filter((l) => l.month !== sourceMonth && l.month !== targetMonth)
          .concat(normalizedSource, normalizedTarget);
      }
    });
    reset();
  };

  const handleDropOnGap = (
    e: React.DragEvent,
    targetMonth: number,
    targetOrder: number | null
  ) => {
    e.preventDefault();
    const sourceId = draggingId;
    if (!sourceId) {
      reset();
      return;
    }

    const sourceLesson = lessons.find((l) => l.id === sourceId);
    if (!sourceLesson) {
      reset();
      return;
    }

    setLessons((prev) => {
      const remaining = prev.filter((l) => l.id !== sourceId);
      const movedLesson = { ...sourceLesson, month: targetMonth };

      let updatedTargetCol = remaining.filter((l) => l.month === targetMonth);
      if (targetOrder !== null) {
        updatedTargetCol = updatedTargetCol.map((l) => {
          if (l.order >= targetOrder) {
            return { ...l, order: l.order + 1 };
          }
          return l;
        });
        movedLesson.order = targetOrder;
      } else {
        const maxOrder =
          updatedTargetCol.length > 0
            ? Math.max(...updatedTargetCol.map((l) => l.order))
            : 0;
        movedLesson.order = maxOrder + 1;
      }

      updatedTargetCol.push(movedLesson);

      const normalizedTarget = normalizeColumnOrders(updatedTargetCol);
      const sourceMonth = sourceLesson.month;

      if (sourceMonth === targetMonth) {
        return remaining.filter((l) => l.month !== targetMonth).concat(normalizedTarget);
      } else {
        const sourceCol = remaining.filter((l) => l.month === sourceMonth);
        const normalizedSource = normalizeColumnOrders(sourceCol);
        return remaining
          .filter((l) => l.month !== sourceMonth && l.month !== targetMonth)
          .concat(normalizedSource, normalizedTarget);
      }
    });
    reset();
  };

  const reset = () => {
    setDraggingId(null);
    setDropTargetRow(null);
    setDropTargetGap(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  const defaultMonth =
    lastUsedMonth !== null && activeMonths.includes(lastUsedMonth)
      ? lastUsedMonth
      : activeMonths.length > 0
        ? activeMonths[0]
        : 1;

  if (loading) {
    return (
      <div className="kanban-root kanban-root--loading" dir="rtl">
        <div className="kanban-loading">
          <div className="kanban-loading__spinner">⏳</div>
          <p className="kanban-loading__text">جاري تحميل المنهج الافتراضي...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kanban-root" dir="rtl">
      {/* ── Toolbar ── */}
      <header className="kanban-toolbar">
        <div className="kanban-toolbar__brand">
          <h1 className="kanban-toolbar__title">لوحة المناهج</h1>
          <span className="kanban-toolbar__subtitle">
            {lessons.length} درس · {activeMonths.length} أشهر
          </span>
        </div>

        <div className="kanban-toolbar__actions">
          <button className="btn btn--secondary" onClick={handleAddMonth}>
            ➕ إضافة عمود شهر
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => setShowPlaylistModal(true)}
          >
            📋 إضافة قوائم تشغيل
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => setShowImporter((v) => !v)}
          >
            📥 استيراد JSON
          </button>
          <JsonExporter lessons={lessons} />
          <button
            className="btn btn--danger"
            onClick={handleClearCurriculum}
            disabled={lessons.length === 0 && activeMonths.length === 0}
          >
            🗑️ مسح المنهج
          </button>
          <button
            className="btn btn--primary"
            onClick={() => setShowAddModal(true)}
          >
            + أضف درسًا
          </button>
        </div>
      </header>

      {/* ── Importer panel (toggle) ── */}
      {showImporter && (
        <div className="kanban-importer-panel">
          <JsonImporter onImport={handleImport} />
        </div>
      )}

      {fetchError && (
        <div className="kanban-error-banner">
          <span>⚠️ {fetchError}</span>
          <button className="btn btn--secondary btn--sm" onClick={handleRestoreDefault}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* ── Board ── */}
      {activeMonths.length === 0 ? (
        <div className="kanban-empty">
          <div className="kanban-empty__icon">📋</div>
          <p className="kanban-empty__title">لا توجد أشهر بعد</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button className="btn btn--primary" onClick={handleAddMonth}>
              إضافة شهر جديد للبدء
            </button>
            <button className="btn btn--secondary" onClick={handleRestoreDefault}>
              🔄 استعادة المنهج الافتراضي
            </button>
          </div>
        </div>
      ) : (
        <div className="kanban-board" onDragEnd={reset}>
          {activeMonths.map((month) => {
            const cols = lessons.filter((l) => l.month === month);
            return (
              <MonthColumn
                key={month}
                month={month}
                lessons={cols}
                draggingId={draggingId}
                dropTargetRow={dropTargetRow}
                dropTargetGap={dropTargetGap}
                onDragStart={handleDragStart}
                onDragOverRow={handleDragOverRow}
                onDropOnRow={handleDropOnRow}
                onDragOverGap={handleDragOverGap}
                onDropOnGap={handleDropOnGap}
                onDeleteLesson={handleDeleteLesson}
                onDeleteColumn={handleDeleteMonth}
                onOpenNotifications={setActiveNotificationsLesson}
                onEdit={setActiveEditLesson}
              />
            );
          })}
        </div>
      )}

      {/* ── Add Lesson Modal ── */}
      {showAddModal && (
        <AddLessonModal
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
          defaultMonth={defaultMonth}
          nextOrder={lessons.length + 1}
          months={activeMonths}
        />
      )}

      {/* ── Add Playlists Modal ── */}
      {showPlaylistModal && (
        <AddPlaylistsModal
          onAdd={handleAddPlaylists}
          onClose={() => setShowPlaylistModal(false)}
          defaultMonth={defaultMonth}
          months={activeMonths}
          existingLessons={lessons}
        />
      )}

      {/* ── Notifications Modal ── */}
      {activeNotificationsLesson && (
        <NotificationsModal
          lesson={activeNotificationsLesson}
          onClose={() => setActiveNotificationsLesson(null)}
          onUpdateNotification={(newNotification) => {
            handleUpdateLesson({
              ...activeNotificationsLesson,
              notification: newNotification,
            });
          }}
        />
      )}
      {/* ── Edit Lesson Modal ── */}
      {activeEditLesson && (
        <EditLessonModal
          lesson={activeEditLesson}
          onClose={() => setActiveEditLesson(null)}
          onSave={handleEditLesson}
          months={activeMonths}
        />
      )}
    </div>
  );
}