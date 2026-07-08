import { useState, useRef } from "react";
import type { Lesson } from "./types";
import { MonthColumn } from "./components/MonthColumn";
import { JsonImporter } from "./components/JsonImporter";
import { JsonExporter } from "./components/JsonExporter";
import { AddLessonModal } from "./components/AddLessonModal";
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
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeMonths, setActiveMonths] = useState<number[]>([1]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImporter, setShowImporter] = useState(false);

  // drag state
  const draggingId = useRef<string | null>(null);
  const [dropTargetRow, setDropTargetRow] = useState<string | null>(null);
  const [dropTargetGap, setDropTargetGap] = useState<string | null>(null);

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = (imported: Lesson[]) => {
    setLessons(imported);
    const uniqueMonths = Array.from(new Set(imported.map((l) => l.month))).sort(
      (a, b) => a - b
    );
    setActiveMonths(uniqueMonths.length > 0 ? uniqueMonths : [1]);
    setShowImporter(false);
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

  // ── Add/Delete lesson ─────────────────────────────────────────────────────
  const handleAdd = (lesson: Lesson) => {
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

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragStart = (id: string) => {
    draggingId.current = id;
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
    const sourceId = draggingId.current;
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
    const sourceId = draggingId.current;
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
    draggingId.current = null;
    setDropTargetRow(null);
    setDropTargetGap(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  const defaultMonth = activeMonths.length > 0 ? activeMonths[0] : 1;

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
            className="btn btn--ghost"
            onClick={() => setShowImporter((v) => !v)}
          >
            📥 استيراد JSON
          </button>
          <JsonExporter lessons={lessons} />
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

      {/* ── Board ── */}
      {activeMonths.length === 0 ? (
        <div className="kanban-empty">
          <div className="kanban-empty__icon">📋</div>
          <p className="kanban-empty__title">لا توجد أشهر بعد</p>
          <button className="btn btn--primary" onClick={handleAddMonth}>
            إضافة شهر جديد للبدء
          </button>
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
                draggingId={draggingId.current}
                dropTargetRow={dropTargetRow}
                dropTargetGap={dropTargetGap}
                onDragStart={handleDragStart}
                onDragOverRow={handleDragOverRow}
                onDropOnRow={handleDropOnRow}
                onDragOverGap={handleDragOverGap}
                onDropOnGap={handleDropOnGap}
                onDeleteLesson={handleDeleteLesson}
                onDeleteColumn={handleDeleteMonth}
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
    </div>
  );
}