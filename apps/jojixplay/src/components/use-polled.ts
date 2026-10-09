import { useEffect, useRef, useState } from "preact/hooks";

/** Samples a fast-changing source at a slow interface cadence. Equal samples do not rerender. */
export function usePolled<T>(read: () => T, intervalMs: number): T {
  const [value, setValue] = useState(read);
  const latest = useRef(read);
  latest.current = read;
  useEffect(() => {
    const timer = window.setInterval(() => setValue(() => latest.current()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return value;
}
