import { useState } from "react";
import type { Lesson } from "../types";
import { fetchVideoMeta } from "../utils/youtube";
import { getArabicOrdinal } from "../utils/arabic";
import "./EditLessonModal.css";

interface Props {
  lesson: Lesson;
  onSave: (oldLesson: Lesson, updatedLesson: Lesson) => void;
  onClose: () => void;
  months: number[];
}

export function EditLessonModal({ lesson, onSave, onClose, months }: Props) {
  const [title, setTitle] = useState(lesson.title || "");
  const [youtubeUrl, setYoutubeUrl] = useState(lesson.youtubeUrl || "");
  const [partTitle, setPartTitle] = useState(lesson.partTitle || "");
  const [partNumber, setPartNumber] = useState(
    lesson.partNumber !== undefined ? String(lesson.partNumber) : ""
  );
  const [startSecond, setStartSecond] = useState(
    lesson.startSecond !== undefined ? String(lesson.startSecond) : ""
  );
  const [endSecond, setEndSecond] = useState(
    lesson.endSecond !== undefined ? String(lesson.endSecond) : ""
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(lesson.thumbnail_url || "");
  const [month, setMonth] = useState(lesson.month);
  const [order, setOrder] = useState(lesson.order);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchMeta = async () => {
    if (!youtubeUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const meta = await fetchVideoMeta(youtubeUrl.trim());
      setTitle(meta.title);
      setThumbnailUrl(meta.thumbnail_url);
    } catch {
      setError("تعذّر جلب بيانات الفيديو. تحقق من الرابط.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !youtubeUrl.trim() || !thumbnailUrl.trim()) {
      setError("يرجى ملء جميع الحقول المطلوبة (العنوان، الرابط، الصورة المصغرة).");
      return;
    }

    const parsedPartNumber = partNumber.trim() ? Number(partNumber) : undefined;
    const parsedStartSecond = startSecond.trim() ? Number(startSecond) : undefined;
    const parsedEndSecond = endSecond.trim() ? Number(endSecond) : undefined;

    if (parsedPartNumber !== undefined && (isNaN(parsedPartNumber) || parsedPartNumber < 0)) {
      setError("رقم الجزء يجب أن يكون رقمًا موجبًا.");
      return;
    }
    if (parsedStartSecond !== undefined && (isNaN(parsedStartSecond) || parsedStartSecond < 0)) {
      setError("وقت البدء يجب أن يكون رقمًا موجبًا.");
      return;
    }
    if (parsedEndSecond !== undefined && (isNaN(parsedEndSecond) || parsedEndSecond < 0)) {
      setError("وقت النهاية يجب أن يكون رقمًا موجبًا.");
      return;
    }
    if (parsedStartSecond !== undefined && parsedEndSecond !== undefined && parsedStartSecond > parsedEndSecond) {
      setError("وقت البدء لا يمكن أن يكون أكبر من وقت النهاية.");
      return;
    }

    const updatedLesson: Lesson = {
      ...lesson,
      title: title.trim(),
      youtubeUrl: youtubeUrl.trim(),
      thumbnail_url: thumbnailUrl.trim(),
      month,
      order,
      // Only include optional fields if they have value
      ...(partTitle.trim() ? { partTitle: partTitle.trim() } : {}),
      ...(parsedPartNumber !== undefined ? { partNumber: parsedPartNumber } : {}),
      ...(parsedStartSecond !== undefined ? { startSecond: parsedStartSecond } : {}),
      ...(parsedEndSecond !== undefined ? { endSecond: parsedEndSecond } : {}),
    };

    // Clean up old optional properties that might be removed now
    if (!partTitle.trim()) delete updatedLesson.partTitle;
    if (parsedPartNumber === undefined) delete updatedLesson.partNumber;
    if (parsedStartSecond === undefined) delete updatedLesson.startSecond;
    if (parsedEndSecond === undefined) delete updatedLesson.endSecond;

    onSave(lesson, updatedLesson);
    onClose();
  };

  return (
    <div className="edit-modal__overlay" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal__header">
          <h3>تعديل الدرس</h3>
          <button className="edit-modal__close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <form className="edit-modal__form" onSubmit={handleSubmit}>
          <div className="edit-modal__grid">
            <div className="edit-modal__field edit-modal__field--full">
              <label className="edit-modal__label">رابط يوتيوب</label>
              <div className="edit-modal__url-input-group">
                <input
                  className="edit-modal__input"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  dir="ltr"
                  required
                />
                <button
                  type="button"
                  className="btn btn--secondary edit-modal__fetch-btn"
                  onClick={handleFetchMeta}
                  disabled={loading || !youtubeUrl.trim()}
                >
                  {loading ? "جلب..." : "جلب البيانات"}
                </button>
              </div>
            </div>

            <div className="edit-modal__field edit-modal__field--full">
              <label className="edit-modal__label">عنوان الدرس</label>
              <input
                className="edit-modal__input"
                type="text"
                placeholder="عنوان الدرس..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="edit-modal__field">
              <label className="edit-modal__label">رقم الجزء (اختياري)</label>
              <input
                className="edit-modal__input"
                type="number"
                placeholder="مثال: 1"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                min="0"
              />
            </div>

            <div className="edit-modal__field">
              <label className="edit-modal__label">عنوان الجزء (اختياري)</label>
              <input
                className="edit-modal__input"
                type="text"
                placeholder="مثال: الجزء الأول"
                value={partTitle}
                onChange={(e) => setPartTitle(e.target.value)}
              />
            </div>

            <div className="edit-modal__field">
              <label className="edit-modal__label">البداية بالثواني (اختياري)</label>
              <input
                className="edit-modal__input"
                type="number"
                placeholder="مثال: 0"
                value={startSecond}
                onChange={(e) => setStartSecond(e.target.value)}
                min="0"
              />
            </div>

            <div className="edit-modal__field">
              <label className="edit-modal__label">النهاية بالثواني (اختياري)</label>
              <input
                className="edit-modal__input"
                type="number"
                placeholder="مثال: 1200"
                value={endSecond}
                onChange={(e) => setEndSecond(e.target.value)}
                min="0"
              />
            </div>

            <div className="edit-modal__field edit-modal__field--full">
              <label className="edit-modal__label">رابط الصورة المصغرة</label>
              <input
                className="edit-modal__input"
                type="url"
                placeholder="https://i.ytimg.com/vi/..."
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                dir="ltr"
                required
              />
            </div>

            <div className="edit-modal__field">
              <label className="edit-modal__label">الشهر</label>
              <select
                className="edit-modal__select"
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

            <div className="edit-modal__field">
              <label className="edit-modal__label">الترتيب</label>
              <input
                className="edit-modal__input"
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                min="1"
                required
              />
            </div>
          </div>

          {error && <p className="edit-modal__error">{error}</p>}

          <div className="edit-modal__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !title.trim() || !youtubeUrl.trim()}
            >
              حفظ التعديلات
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
