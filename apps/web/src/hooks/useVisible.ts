import { useCallback, useEffect, useState } from 'react';

// Fires once when the element first enters the viewport, then disconnects.
// Uses a callback ref (rather than a plain useRef) so the observer attaches
// correctly even when the target element mounts after the initial render
// (e.g. behind a loading state) — a useRef-based effect only runs once on
// mount and would miss elements that appear later.
export function useVisible(threshold = 0.1) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  const ref = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) { setVisible(true); obs.unobserve(node); }
      },
      { threshold },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [node, threshold]);

  return [ref, visible] as const;
}

// Returns opacity + translateY entrance styles with a per-element delay.
export function enter(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0px)' : 'translateY(18px)',
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  };
}
