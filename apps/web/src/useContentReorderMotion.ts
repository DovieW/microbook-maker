import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

type RowPosition = { top: number; left: number };
type ReorderSnapshot = { orderKey: string; positions: Map<string, RowPosition> };

export function useContentReorderMotion(orderKey: string): {
  listRef: RefObject<HTMLDivElement | null>;
  captureBeforeReorder: (nextOrderKey: string) => void;
} {
  const listRef = useRef<HTMLDivElement>(null);
  const before = useRef<ReorderSnapshot | null>(null);
  const animations = useRef<Animation[]>([]);
  const currentOrderKey = useRef(orderKey);
  currentOrderKey.current = orderKey;

  const captureBeforeReorder = (nextOrderKey: string) => {
    if (nextOrderKey === currentOrderKey.current) {
      before.current = null;
      return;
    }
    const list = listRef.current;
    if (!list) return;
    const positions = new Map<string, RowPosition>();
    for (const row of list.querySelectorAll<HTMLElement>('[data-content-token]')) {
      const token = row.dataset.contentToken;
      if (!token || positions.has(token)) continue;
      const rect = row.getBoundingClientRect();
      positions.set(token, { top: rect.top, left: rect.left });
    }
    before.current = { orderKey: nextOrderKey, positions };
  };

  useLayoutEffect(() => {
    const snapshot = before.current;
    before.current = null;
    if (!snapshot || snapshot.orderKey !== orderKey || !listRef.current) return;

    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (const row of listRef.current.querySelectorAll<HTMLElement>('[data-content-token]')) {
      const token = row.dataset.contentToken;
      const previous = token ? snapshot.positions.get(token) : undefined;
      if (!previous) continue;
      const current = row.getBoundingClientRect();
      const x = previous.left - current.left;
      const y = previous.top - current.top;
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue;
      animations.current.push(
        row.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }], {
          duration: 180,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        }),
      );
    }
  });

  useEffect(
    () => () => {
      animations.current.forEach((animation) => animation.cancel());
    },
    [],
  );

  return { listRef, captureBeforeReorder };
}
