import { useRef, useState } from "react";
import type { Lesson } from "../types";
import "./JsonImporter.css";

interface Props {
  onImport: (lessons: Lesson[]) => void;
}

function parseLessons(raw: string): Lesson[] {
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : Object.values(parsed);
  return arr as Lesson[];
}

export function JsonImporter({ onImport }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    try {
      const lessons = parseLessons(text);
      onImport(lessons);
      setError(null);
      setText("");
    } catch {
      setError("JSON غير صالح. يرجى التحقق من التنسيق.");
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
      try {
        const lessons = parseLessons(content);
        onImport(lessons);
        setError(null);
        setText("");
      } catch {
        setError("JSON غير صالح. يرجى التحقق من التنسيق.");
      }
    };
    reader.readAsText(file);
    // reset so the same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="json-importer">
      <textarea
        className="json-importer__textarea"
        placeholder='الصق JSON هنا... مثال: [{"id":"...","month":1,"order":1,...}]'
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        dir="ltr"
      />
      {error && <p className="json-importer__error">{error}</p>}
      <div className="json-importer__actions">
        <button
          className="btn btn--primary"
          onClick={handleImport}
          disabled={!text.trim()}
        >
          استيراد JSON
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => fileRef.current?.click()}
        >
          📂 رفع ملف
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
