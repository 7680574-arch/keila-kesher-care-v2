import { useEffect, useLayoutEffect, useState } from "react";

// מעלה רמת צפיפות עד שכל התוכן נכנס בתוך הקונטיינר (בלי גלילה)
export default function useFitLevel(ref, signature, max) {
  const [stamp, setStamp] = useState(0);
  const [state, setState] = useState({ sig: "", level: 0 });
  const sig = `${signature}#${stamp}`;
  const level = state.sig === sig ? state.level : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = { w: el.clientWidth, h: el.clientHeight };
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (Math.abs(w - last.w) > 20 || Math.abs(h - last.h) > 2) {
        last = { w, h };
        setStamp((s) => s + 1);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && level < max && el.scrollHeight > el.clientHeight + 1) {
      setState({ sig, level: level + 1 });
    }
  });

  return level;
}