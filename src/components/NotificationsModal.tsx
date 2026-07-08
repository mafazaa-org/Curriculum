import { useState } from "react";
import type { Lesson } from "../types";
import { Bell, Save, Trash2, X } from "lucide-react";
import "./NotificationsModal.css";

interface Props {
  lesson: Lesson;
  onClose: () => void;
  onUpdateNotification: (notification: string | undefined) => void;
}

export function NotificationsModal({ lesson, onClose, onUpdateNotification }: Props) {
  const [text, setText] = useState(lesson.notification ?? "");
  const hasExisting = Boolean(lesson.notification);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    onUpdateNotification(trimmed || undefined);
    onClose();
  };

  const handleClear = () => {
    if (!window.confirm("هل أنت متأكد من حذف الإشعار؟")) return;
    onUpdateNotification(undefined);
    onClose();
  };

  return (
    <div className="notifications-modal__overlay" onClick={onClose}>
      <div className="notifications-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="notifications-modal__header">
          <div className="notifications-modal__title-group">
            <Bell size={18} className="notifications-modal__icon" />
            <div className="notifications-modal__title-text">
              <span className="notifications-modal__label">إشعار الدرس</span>
              <span className="notifications-modal__lesson-title">{lesson.title}</span>
            </div>
          </div>
          <button
            className="notifications-modal__close"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form className="notifications-modal__body" onSubmit={handleSave}>
          <label className="notifications-modal__field-label">
            {hasExisting ? "تعديل الإشعار" : "إضافة إشعار"}
          </label>
          <textarea
            className="notifications-modal__textarea"
            placeholder="اكتب الإشعار هنا..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            autoFocus
          />

          {/* Footer */}
          <div className="notifications-modal__footer">
            {hasExisting && (
              <button
                type="button"
                className="btn notifications-modal__delete-btn"
                onClick={handleClear}
              >
                <Trash2 size={15} />
                حذف الإشعار
              </button>
            )}
            <div className="notifications-modal__footer-right">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                إلغاء
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!text.trim() && !hasExisting}
              >
                <Save size={15} />
                حفظ
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
