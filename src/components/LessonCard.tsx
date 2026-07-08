import { useEffect, useState } from "react";
import type { Lesson } from "../types";
import { fetchVideoMeta } from "../utils/youtube";
import { Bell } from "lucide-react";
import "./LessonCard.css";

interface Props {
  lesson: Lesson;
  onDragStart: (id: string) => void;
  isDraggingOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDelete: (id: string) => void;
  onOpenNotifications: (lesson: Lesson) => void;
}

export function LessonCard({
  lesson,
  onDragStart,
  isDraggingOver,
  onDragOver,
  onDrop,
  onDelete,
  onOpenNotifications,
}: Props) {
  const [title, setTitle] = useState(lesson.title);
  const [thumbnail, setThumbnail] = useState(lesson.thumbnail_url);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only fetch if title or thumbnail is missing
    if (!lesson.title || !lesson.thumbnail_url) {
      setLoading(true);
      fetchVideoMeta(lesson.youtubeUrl)
        .then((meta) => {
          setTitle(meta.title);
          setThumbnail(meta.thumbnail_url);
        })
        .catch(() => {
          setTitle(lesson.title || "درس بدون عنوان");
        })
        .finally(() => setLoading(false));
    } else {
      setTitle(lesson.title);
      setThumbnail(lesson.thumbnail_url);
    }
  }, [lesson.youtubeUrl, lesson.title, lesson.thumbnail_url]);

  return (
    <div
      className={`lesson-card ${isDraggingOver ? "lesson-card--drag-over" : ""}`}
      draggable
      onDragStart={() => onDragStart(lesson.id)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="lesson-card__thumbnail-wrapper">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="lesson-card__thumbnail"
          />
        ) : (
          <div className="lesson-card__thumbnail-placeholder">
            {loading ? (
              <span className="lesson-card__spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            )}
          </div>
        )}
        <span className="lesson-card__order">#{lesson.order}</span>
        
        <button
          className="lesson-card__delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(lesson.id);
          }}
          title="حذف الدرس"
          aria-label="حذف الدرس"
        >
          ✕
        </button>
      </div>

      <div className="lesson-card__body">
        <p className="lesson-card__title">
          {loading ? "جارٍ التحميل..." : title || "درس بدون عنوان"}
        </p>
        <div className="lesson-card__footer-row">
          <a
            href={lesson.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lesson-card__link"
            onClick={(e) => e.stopPropagation()}
          >
            مشاهدة على يوتيوب ↗
          </a>
          <button
            type="button"
            className={`lesson-card__notifications-btn ${
              lesson.notification
                ? "lesson-card__notifications-btn--active"
                : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenNotifications(lesson);
            }}
            title="إدارة الإشعار"
          >
            <Bell size={13} />
            <span>
              {lesson.notification ? "تعديل الإشعار" : "إضافة إشعار"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
