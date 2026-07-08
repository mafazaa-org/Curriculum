import { useState } from "react";
import type { Lesson } from "../types";
import { fetchVideoMeta } from "../utils/youtube";
import { getArabicOrdinal } from "../utils/arabic";
import "./AddLessonModal.css";

interface Props {
  onAdd: (lesson: Lesson) => void;
  onClose: () => void;
  defaultMonth: number;
  nextOrder: number;
  months: number[];
}

function generateId(): string {
  return crypto.randomUUID();
}

export function AddLessonModal({ onAdd, onClose, defaultMonth, nextOrder, months }: Props) {
  const [url, setUrl] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const meta = await fetchVideoMeta(url.trim());
      const lesson: Lesson = {
        id: generateId(),
        youtubeUrl: url.trim(),
        order: nextOrder,
        month,
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
      };
      onAdd(lesson);
      onClose();
    } catch {
      setError("تعذّر جلب بيانات الفيديو. تحقق من الرابط.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-modal__overlay" onClick={onClose}>
      <div className="add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-modal__header">
          <h3>أضف درسًا جديدًا</h3>
          <button className="add-modal__close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <form className="add-modal__form" onSubmit={handleSubmit}>
          <div className="add-modal__field">
            <label className="add-modal__label">رابط يوتيوب</label>
            <input
              className="add-modal__input"
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              required
              autoFocus
            />
          </div>

          <div className="add-modal__field">
            <label className="add-modal__label">الشهر</label>
            <select
              className="add-modal__select"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  الشهر {getArabicOrdinal(m)}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="add-modal__error">{error}</p>}

          <div className="add-modal__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !url.trim()}
            >
              {loading ? "جارٍ الإضافة..." : "إضافة الدرس"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
