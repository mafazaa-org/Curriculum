import { useState } from "react";
import type { Lesson } from "../types";
import { fetchVideoMeta, getSplitParts } from "../utils/youtube";
import { getArabicOrdinal } from "../utils/arabic";
import "./AddLessonModal.css";

interface Props {
  onAdd: (lesson: Lesson | Lesson[]) => void;
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
  const [notification, setNotification] = useState("");
  const [partTitle, setPartTitle] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [startSecond, setStartSecond] = useState("");
  const [endSecond, setEndSecond] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    const parsedPartNumber = partNumber.trim() ? Number(partNumber) : undefined;
    const parsedStartSecond = startSecond.trim() ? Number(startSecond) : undefined;
    const parsedEndSecond = endSecond.trim() ? Number(endSecond) : undefined;

    if (parsedPartNumber !== undefined && (isNaN(parsedPartNumber) || parsedPartNumber < 0)) {
      setError("رقم الجزء يجب أن يكون رقمًا موجبًا.");
      setLoading(false);
      return;
    }
    if (parsedStartSecond !== undefined && (isNaN(parsedStartSecond) || parsedStartSecond < 0)) {
      setError("وقت البدء يجب أن يكون رقمًا موجبًا.");
      setLoading(false);
      return;
    }
    if (parsedEndSecond !== undefined && (isNaN(parsedEndSecond) || parsedEndSecond < 0)) {
      setError("وقت النهاية يجب أن يكون رقمًا موجبًا.");
      setLoading(false);
      return;
    }
    if (parsedStartSecond !== undefined && parsedEndSecond !== undefined && parsedStartSecond > parsedEndSecond) {
      setError("وقت البدء لا يمكن أن يكون أكبر من وقت النهاية.");
      setLoading(false);
      return;
    }

    try {
      const meta = await fetchVideoMeta(url.trim());

      const parts = getSplitParts({
        startSecond: parsedStartSecond,
        endSecond: parsedEndSecond,
        durationSeconds: meta.durationSeconds,
      });

      if (parts && parts.length >= 2) {
        const [part1, part2] = parts;
        const lesson1: Lesson = {
          id: generateId(),
          youtubeUrl: url.trim(),
          order: nextOrder,
          month,
          title: meta.title,
          thumbnail_url: meta.thumbnail_url,
          partNumber: part1.partNumber,
          partTitle: part1.partTitle,
          startSecond: part1.startSecond,
          endSecond: part1.endSecond,
          ...(notification.trim() ? { notification: notification.trim() } : {}),
        };

        const lesson2: Lesson = {
          id: generateId(),
          youtubeUrl: url.trim(),
          order: nextOrder + 1,
          month,
          title: meta.title,
          thumbnail_url: meta.thumbnail_url,
          partNumber: part2.partNumber,
          partTitle: part2.partTitle,
          startSecond: part2.startSecond,
          endSecond: part2.endSecond,
          ...(notification.trim() ? { notification: notification.trim() } : {}),
        };

        onAdd([lesson1, lesson2]);
      } else {
        const lesson: Lesson = {
          id: generateId(),
          youtubeUrl: url.trim(),
          order: nextOrder,
          month,
          title: meta.title,
          thumbnail_url: meta.thumbnail_url,
          ...(notification.trim() ? { notification: notification.trim() } : {}),
          ...(partTitle.trim() ? { partTitle: partTitle.trim() } : {}),
          ...(parsedPartNumber !== undefined ? { partNumber: parsedPartNumber } : {}),
          ...(parsedStartSecond !== undefined ? { startSecond: parsedStartSecond } : {}),
          ...(parsedEndSecond !== undefined ? { endSecond: parsedEndSecond } : {}),
        };
        onAdd(lesson);
      }
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="add-modal__field">
              <label className="add-modal__label">رقم الجزء (اختياري)</label>
              <input
                className="add-modal__input"
                type="number"
                placeholder="مثال: 1"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                min="0"
              />
            </div>

            <div className="add-modal__field">
              <label className="add-modal__label">عنوان الجزء (اختياري)</label>
              <input
                className="add-modal__input"
                type="text"
                placeholder="مثال: الجزء الأول"
                value={partTitle}
                onChange={(e) => setPartTitle(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="add-modal__field">
              <label className="add-modal__label">البداية بالثواني (اختياري)</label>
              <input
                className="add-modal__input"
                type="number"
                placeholder="مثال: 0"
                value={startSecond}
                onChange={(e) => setStartSecond(e.target.value)}
                min="0"
              />
            </div>

            <div className="add-modal__field">
              <label className="add-modal__label">النهاية بالثواني (اختياري)</label>
              <input
                className="add-modal__input"
                type="number"
                placeholder="مثال: 1200"
                value={endSecond}
                onChange={(e) => setEndSecond(e.target.value)}
                min="0"
              />
            </div>
          </div>

          <div className="add-modal__field">
            <label className="add-modal__label">إشعار الدرس (اختياري)</label>
            <input
              className="add-modal__input"
              type="text"
              placeholder="اكتب إشعاراً لهذا الدرس إذا أردت..."
              value={notification}
              onChange={(e) => setNotification(e.target.value)}
            />
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
