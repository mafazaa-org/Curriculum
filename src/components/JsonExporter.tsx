import { useState } from "react";
import type { Lesson } from "../types";
import "./JsonExporter.css";

interface Props {
  lessons: Lesson[];
}

export function JsonExporter({ lessons }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const json = JSON.stringify(lessons, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button className="btn btn--secondary" onClick={() => setOpen(true)}>
        📤 تصدير JSON
      </button>

      {open && (
        <div className="json-exporter__overlay" onClick={() => setOpen(false)}>
          <div
            className="json-exporter__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="json-exporter__modal-header">
              <h3>بيانات JSON المُصدَّرة</h3>
              <button
                className="json-exporter__close"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <pre className="json-exporter__code">{json}</pre>

            <div className="json-exporter__modal-footer">
              <button className="btn btn--primary" onClick={handleCopy}>
                {copied ? "✓ تم النسخ!" : "📋 نسخ إلى الحافظة"}
              </button>
              <button className="btn btn--ghost" onClick={() => setOpen(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
