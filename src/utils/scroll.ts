import { useEffect, type RefObject } from "react";

/**
 * When a form opens (edit project, edit profile, submit project), bring it
 * into view and focus its first field so the user lands on the actual
 * editing UI instead of hunting for it down the page. Pair with a
 * `scroll-mt-*` class on the form to clear the sticky bars.
 */
export function useScrollToForm(open: boolean, ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const frame = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const field = el.querySelector("input, select, textarea") as HTMLElement | null;
      field?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, ref]);
}
