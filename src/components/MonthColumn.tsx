import type { Lesson } from "../types";
import { LessonCard } from "./LessonCard";
import { getArabicOrdinal } from "../utils/arabic";
import "./MonthColumn.css";

const MAX_CARDS = 25;

interface Props {
  month: number;
  lessons: Lesson[];
  draggingId: string | null;
  dropTargetRow: string | null;
  dropTargetGap: string | null;
  onDragStart: (id: string) => void;
  onDragOverRow: (e: React.DragEvent, month: number, order: number) => void;
  onDropOnRow: (e: React.DragEvent, month: number, order: number) => void;
  onDragOverGap: (e: React.DragEvent, month: number, order: number | null) => void;
  onDropOnGap: (e: React.DragEvent, month: number, order: number | null) => void;
  onDeleteLesson: (id: string) => void;
  onDeleteColumn: (month: number) => void;
  onOpenNotifications: (lesson: Lesson) => void;
}

export function MonthColumn({
  month,
  lessons,
  draggingId,
  dropTargetRow,
  dropTargetGap,
  onDragStart,
  onDragOverRow,
  onDropOnRow,
  onDragOverGap,
  onDropOnGap,
  onDeleteLesson,
  onDeleteColumn,
  onOpenNotifications,
}: Props) {
  // Group lessons by order
  const groupedByOrder = new Map<number, Lesson[]>();
  for (const lesson of lessons) {
    const list = groupedByOrder.get(lesson.order) ?? [];
    list.push(lesson);
    groupedByOrder.set(lesson.order, list);
  }

  // Sort orders consecutively
  const sortedOrders = Array.from(groupedByOrder.keys()).sort((a, b) => a - b);

  const isOverLimit = sortedOrders.length > MAX_CARDS;

  return (
    <div className="month-column">
      <div className="month-column__header">
        <div className="month-column__title-row">
          <div className="month-column__title-group">
            <h2 className="month-column__title">
              الشهر {getArabicOrdinal(month)}
            </h2>
            <span className="month-column__count">{sortedOrders.length}</span>
          </div>
          
          <button
            className="month-column__delete-btn"
            onClick={() => onDeleteColumn(month)}
            title="حذف هذا الشهر"
            aria-label="حذف هذا الشهر"
          >
            ✕
          </button>
        </div>
        {isOverLimit && (
          <div className="month-column__warning" role="alert">
            ⚠️ هذا الشهر يحتوي على أكثر من {MAX_CARDS} درسًا
          </div>
        )}
      </div>

      <div
        className="month-column__list"
        onDragOver={(e) => onDragOverGap(e, month, null)}
        onDrop={(e) => onDropOnGap(e, month, null)}
      >
        {sortedOrders.map((order) => {
          const rowLessons = groupedByOrder.get(order)!;
          const isRowActive = dropTargetRow === `${month}-${order}`;
          const isGapActive = dropTargetGap === `${month}-${order}`;

          return (
            <div key={order} className="month-column__row-container">
              {/* Gap Dropzone before this row */}
              <div
                className={`month-column__gap-dropzone ${
                  isGapActive ? "month-column__gap-dropzone--active" : ""
                }`}
                onDragOver={(e) => onDragOverGap(e, month, order)}
                onDrop={(e) => onDropOnGap(e, month, order)}
              />

              {/* Order Row Container */}
              <div
                className={`month-column__order-row ${
                  isRowActive ? "month-column__order-row--active" : ""
                }`}
                onDragOver={(e) => onDragOverRow(e, month, order)}
                onDrop={(e) => onDropOnRow(e, month, order)}
              >
                {rowLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    onDragStart={onDragStart}
                    isDraggingOver={false}
                    onDragOver={(e) => {
                      // Row handles the dragover & drop events for the order group
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                    }}
                    onDelete={onDeleteLesson}
                    onOpenNotifications={onOpenNotifications}
                  />
                ))}

                {/* Subtle indicator for merging lessons side-by-side */}
                {draggingId && !rowLessons.some((l) => l.id === draggingId) && (
                  <div className="month-column__row-join-indicator">
                    <span>+ دمج</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Gap Dropzone after the last row (if column has items) */}
        {sortedOrders.length > 0 && (
          <div
            className={`month-column__gap-dropzone ${
              dropTargetGap === `${month}-end` ? "month-column__gap-dropzone--active" : ""
            }`}
            onDragOver={(e) => onDragOverGap(e, month, null)}
            onDrop={(e) => onDropOnGap(e, month, null)}
          />
        )}

        {sortedOrders.length === 0 && (
          <div className="month-column__empty">اسحب درسًا هنا</div>
        )}
      </div>
    </div>
  );
}

