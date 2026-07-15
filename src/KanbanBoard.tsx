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

/**
 * Balance lessons across active columns to ensure each column has at most 20 cards (merged rows count as one card).
 * Cascades excess lessons forward and pulls lessons forward if earlier columns are under capacity.
 */
function balanceLessons(lessons: Lesson[], activeMonths: number[]): Lesson[] {
  if (activeMonths.length === 0) return lessons;

  const maxCards = 20;
  const activeMonthsSet = new Set(activeMonths);
  const lessonsInActive = lessons.filter((l) => activeMonthsSet.has(l.month));
  const lessonsOutside = lessons.filter((l) => !activeMonthsSet.has(l.month));

  const getMonthIndex = (m: number) => activeMonths.indexOf(m);

  // 1. Group active lessons by (month, order)
  const groupMap = new Map<string, Lesson[]>();
  for (const l of lessonsInActive) {
    const key = `${l.month}-${l.order}`;
    const list = groupMap.get(key) ?? [];
    list.push(l);
    groupMap.set(key, list);
  }

  // 2. Convert groups to an array and sort them by current display position
  interface LessonGroup {
    month: number;
    order: number;
    lessons: Lesson[];
    origMinIndex: number;
  }

  const groups: LessonGroup[] = Array.from(groupMap.values()).map((list) => {
    // Find min index in the original lessons array for stable sorting
    const indices = list.map((l) => lessons.indexOf(l));
    const origMinIndex = Math.min(...indices);
    return {
      month: list[0].month,
      order: list[0].order,
      lessons: list,
      origMinIndex,
    };
  });

  // Sort groups by:
  // - Month index in activeMonths
  // - Order index ascending
  // - origMinIndex ascending (stable sorting)
  groups.sort((a, b) => {
    const aMonthIdx = getMonthIndex(a.month);
    const bMonthIdx = getMonthIndex(b.month);
    if (aMonthIdx !== bMonthIdx) return aMonthIdx - bMonthIdx;
    if (a.order !== b.order) return a.order - b.order;
    return a.origMinIndex - b.origMinIndex;
  });

  // 3. Distribute groups across active columns (up to maxCards per month)
  const balanced: Lesson[] = [];
  let groupIdx = 0;

  for (let mIdx = 0; mIdx < activeMonths.length; mIdx++) {
    const month = activeMonths[mIdx];
    let currentOrder = 1;

    for (let count = 0; count < maxCards && groupIdx < groups.length; count++) {
      const group = groups[groupIdx];
      // Assign the new month and consecutive order to all lessons in this group
      for (const l of group.lessons) {
        balanced.push({
          ...l,
          month,
          order: currentOrder,
        });
      }
      currentOrder++;
      groupIdx++;
    }
  }

  // 4. If there are overflow groups left, append them to the last active month
  const lastMonth = activeMonths[activeMonths.length - 1];
  let lastMonthMaxOrder = balanced.filter(l => l.month === lastMonth).reduce((max, l) => Math.max(max, l.order), 0);

  while (groupIdx < groups.length) {
    const group = groups[groupIdx];
    lastMonthMaxOrder++;
    for (const l of group.lessons) {
      balanced.push({
        ...l,
        month: lastMonth,
        order: lastMonthMaxOrder,
      });
    }
    groupIdx++;
  }

  return [...lessonsOutside, ...balanced];
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

  // selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectLesson = (id: string, isMulti: boolean) => {
    if (isMulti) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleBoardClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest(".lesson-card")) {
      setSelectedIds([]);
    }
  };

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

    const nextMonths = activeMonths.filter((m) => m !== month);
    const targetMonths = nextMonths.length > 0 ? nextMonths : [1];

    setLessons((prev) => {
      const filteredLessons = prev.filter((l) => l.month !== month);
      return balanceLessons(filteredLessons, targetMonths);
    });
    setActiveMonths((prev) => {
      const filtered = prev.filter((m) => m !== month);
      return filtered.length > 0 ? filtered : [1];
    });
  };

  // ── Bulk add from playlists ────────────────────────────────────────────────
  const handleAddPlaylists = (newLessons: Lesson[]) => {
    if (newLessons.length === 0) return;

    const newMonths = Array.from(new Set(newLessons.map((l) => l.month)));
    const combinedMonths = Array.from(new Set([...activeMonths, ...newMonths])).sort((a, b) => a - b);

    setLessons((prev) => {
      const all = [...prev, ...newLessons];
      const affectedMonths = Array.from(new Set(newLessons.map((l) => l.month)));

      let updatedAll = all;
      for (const m of affectedMonths) {
        const col = updatedAll.filter((l) => l.month === m);
        const normalizedCol = normalizeColumnOrders(col);
        updatedAll = updatedAll.filter((l) => l.month !== m).concat(normalizedCol);
      }
      return balanceLessons(updatedAll, combinedMonths);
    });

    setActiveMonths(combinedMonths);
  };


  // ── Add/Delete lesson ─────────────────────────────────────────────────────
  const handleAdd = (lessonOrLessons: Lesson | Lesson[]) => {
    const newLessons = Array.isArray(lessonOrLessons) ? lessonOrLessons : [lessonOrLessons];
    if (newLessons.length === 0) return;

    setLastUsedMonth(newLessons[0].month);
    localStorage.setItem("curriculum_last_used_month", String(newLessons[0].month));
    
    setLessons((prev) => {
      let currentLessons = [...prev];
      for (const newL of newLessons) {
        const targetMonthLessons = currentLessons.filter((l) => l.month === newL.month);
        const maxOrder =
          targetMonthLessons.length > 0
            ? Math.max(...targetMonthLessons.map((l) => l.order))
            : 0;
        const correctedLesson = {
          ...newL,
          order: maxOrder + 1,
        };
        currentLessons.push(correctedLesson);
      }
      return balanceLessons(currentLessons, activeMonths);
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

      const targetList = remaining.filter((l) => l.month !== month).concat(normalizedTarget);
      return balanceLessons(targetList, activeMonths);
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
      return balanceLessons(nextLessons, activeMonths);
    });
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragStart = (id: string) => {
    setDraggingId(id);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev;
      } else {
        return [id];
      }
    });
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
    if (selectedIds.length === 0) {
      reset();
      return;
    }

    setLessons((prev) => {
      // Remove all selected lessons from their current locations
      const remaining = prev.filter((l) => !selectedIds.includes(l.id));

      const targetCol = remaining.filter((l) => l.month === targetMonth);
      const otherCols = remaining.filter((l) => l.month !== targetMonth);

      // In drop on row, all moved lessons get the targetMonth and targetOrder (merging them into the row)
      const movedLessons = prev
        .filter((l) => selectedIds.includes(l.id))
        .map((l) => ({
          ...l,
          month: targetMonth,
          order: targetOrder,
        }));

      const combinedTarget = [...targetCol, ...movedLessons];
      const normalizedTarget = normalizeColumnOrders(combinedTarget);

      const sourceMonths = Array.from(
        new Set(prev.filter((l) => selectedIds.includes(l.id)).map((l) => l.month))
      ).filter((m) => m !== targetMonth);

      let updatedOthers = otherCols;
      for (const srcMonth of sourceMonths) {
        const col = updatedOthers.filter((l) => l.month === srcMonth);
        const normalizedCol = normalizeColumnOrders(col);
        updatedOthers = updatedOthers.filter((l) => l.month !== srcMonth).concat(normalizedCol);
      }

      return balanceLessons(updatedOthers.concat(normalizedTarget), activeMonths);
    });

    reset();
  };

  const handleDropOnGap = (
    e: React.DragEvent,
    targetMonth: number,
    targetOrder: number | null
  ) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      reset();
      return;
    }

    // Sort the selected lessons based on their display order (active month order, then order index, then array index)
    const getMonthIndex = (m: number) => activeMonths.indexOf(m);
    const sortedSelected = [...lessons]
      .filter((l) => selectedIds.includes(l.id))
      .sort((a, b) => {
        const aMonthIdx = getMonthIndex(a.month);
        const bMonthIdx = getMonthIndex(b.month);
        if (aMonthIdx !== bMonthIdx) {
          return aMonthIdx - bMonthIdx;
        }
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return lessons.indexOf(a) - lessons.indexOf(b);
      });

    setLessons((prev) => {
      // Remove all selected lessons from their current locations
      const remaining = prev.filter((l) => !selectedIds.includes(l.id));

      // Separate the target column from the rest of the board
      let targetCol = remaining.filter((l) => l.month === targetMonth);
      const otherCols = remaining.filter((l) => l.month !== targetMonth);

      // Now, let's place the sortedSelected lessons into the target column.
      // We need to figure out their new orders.
      // A group can be defined by the unique (month, order) pair.
      // Let's map each lesson to a group index.
      const groups: string[] = [];
      const lessonToGroupIdx = new Map<string, number>();
      
      for (const l of sortedSelected) {
        const key = `${l.month}-${l.order}`;
        let idx = groups.indexOf(key);
        if (idx === -1) {
          groups.push(key);
          idx = groups.length - 1;
        }
        lessonToGroupIdx.set(l.id, idx);
      }
      
      const numGroups = groups.length;

      // Update orders of target column lessons that are >= targetOrder
      let startOrder: number;
      if (targetOrder !== null) {
        // Shift existing lessons at or after targetOrder by numGroups
        targetCol = targetCol.map((l) => {
          if (l.order >= targetOrder) {
            return { ...l, order: l.order + numGroups };
          }
          return l;
        });
        startOrder = targetOrder;
      } else {
        const maxOrder = targetCol.length > 0 ? Math.max(...targetCol.map((l) => l.order)) : 0;
        startOrder = maxOrder + 1;
      }

      // Assign new month and order to the moved lessons
      const movedLessons = sortedSelected.map((l) => {
        const groupIdx = lessonToGroupIdx.get(l.id)!;
        return {
          ...l,
          month: targetMonth,
          order: startOrder + groupIdx,
        };
      });

      // Combine target column and normalize
      const combinedTarget = [...targetCol, ...movedLessons];
      const normalizedTarget = normalizeColumnOrders(combinedTarget);

      // Normalize any other columns that were affected (i.e. source columns)
      const sourceMonths = Array.from(new Set(sortedSelected.map((l) => l.month)))
        .filter((m) => m !== targetMonth); // targetMonth is handled separately

      let updatedOthers = otherCols;
      for (const srcMonth of sourceMonths) {
        const col = updatedOthers.filter((l) => l.month === srcMonth);
        const normalizedCol = normalizeColumnOrders(col);
        updatedOthers = updatedOthers.filter((l) => l.month !== srcMonth).concat(normalizedCol);
      }

      return balanceLessons(updatedOthers.concat(normalizedTarget), activeMonths);
    });

    reset();
  };

  const reset = () => {
    setDraggingId(null);
    setDropTargetRow(null);
    setDropTargetGap(null);
    setSelectedIds([]);
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
    <div className="kanban-root" dir="rtl" onClick={handleBoardClick}>
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
                selectedIds={selectedIds}
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
                onSelectLesson={handleSelectLesson}
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