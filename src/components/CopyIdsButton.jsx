import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyIdsButton({ ids }) {
  const [done, setDone] = useState(false);
  const list = (ids || []).filter(Boolean);
  const count = list.length;

  const copy = async (e) => {
    e.stopPropagation();
    const text = list.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`העתקת ${count} מספרי זהות (לפי הסינון)`}
      disabled={count === 0}
      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-40 disabled:no-underline"
    >
      {done ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {done ? "הועתקו" : `העתקת מ"ז (${count})`}
    </button>
  );
}