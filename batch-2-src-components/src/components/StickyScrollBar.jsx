import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * פס גלילה אופקי דביק שמוצמד לתחתית המסך.
 * מקבל ref למכל ה-overflow-x-auto של הטבלה ומסנכרן את הגלילה ביניהם.
 * מופיע רק כשהטבלה חורגת ברוחב.
 */
export default function StickyScrollBar({ targetRef, className }) {
  const barRef = useRef(null);
  const [innerWidth, setInnerWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const update = () => {
      setInnerWidth(el.scrollWidth);
      setVisible(el.scrollWidth > el.clientWidth + 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const table = el.querySelector("table");
    if (table) ro.observe(table);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    const bar = barRef.current;
    if (!el || !bar || !visible) return;
    const syncEl = () => { bar.scrollLeft = el.scrollLeft; };
    const syncBar = () => { el.scrollLeft = bar.scrollLeft; };
    el.addEventListener("scroll", syncEl, { passive: true });
    bar.addEventListener("scroll", syncBar, { passive: true });
    syncEl();
    return () => {
      el.removeEventListener("scroll", syncEl);
      bar.removeEventListener("scroll", syncBar);
    };
  }, [targetRef, visible]);

  if (!visible) return null;
  return (
    <div
      ref={barRef}
      className={cn("sticky bottom-0 z-30 overflow-x-auto overflow-y-hidden bg-card border-t border-border shadow-[0_-2px_6px_rgba(0,0,0,0.05)]", className)}
      style={{ height: 14 }}
      aria-hidden="true"
    >
      <div style={{ width: innerWidth, height: 1 }} />
    </div>
  );
}