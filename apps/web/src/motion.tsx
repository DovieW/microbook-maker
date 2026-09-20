import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';

const motionQuery = '(prefers-reduced-motion: reduce)';
const detailsAnimations = new WeakMap<HTMLDetailsElement, Animation>();
const detailsTargets = new WeakMap<HTMLDetailsElement, boolean>();

function directSummary(details: HTMLDetailsElement) {
  return Array.from(details.children).find((child) => child.tagName === 'SUMMARY') as HTMLElement | undefined;
}

function shouldAnimateDetails(details: HTMLDetailsElement) {
  return (
    !!details.closest('.sidebar-body, .images-pane') &&
    !details.matches('.content-filter-menu, .overflow-menu, .kept-row > details') &&
    !details.closest('.content-filter-menu, .overflow-menu')
  );
}

/** Adds interruptible motion to native disclosure widgets without changing their semantics. */
export function installDisclosureMotion() {
  const onClick = (event: MouseEvent) => {
    const summary = (event.target as Element | null)?.closest('summary');
    const details = summary?.parentElement;
    if (
      !(summary instanceof HTMLElement) ||
      !(details instanceof HTMLDetailsElement) ||
      summary !== directSummary(details)
    )
      return;
    const interactive = (event.target as Element | null)?.closest('button, input, select, textarea, a');
    if (interactive && interactive !== summary) return;
    if (!shouldAnimateDetails(details) || window.matchMedia(motionQuery).matches) return;

    event.preventDefault();
    const previousTarget = detailsTargets.get(details);
    const opening = previousTarget === undefined ? !details.open : !previousTarget;
    detailsTargets.set(details, opening);

    const oldAnimation = detailsAnimations.get(details);
    const startHeight = details.getBoundingClientRect().height;
    oldAnimation?.cancel();

    // Measure the browser's real outer boxes so borders, padding, and summary margins do not snap.
    details.open = opening;
    const endHeight = details.getBoundingClientRect().height;
    if (!opening) details.open = true;
    details.style.overflow = 'clip';

    const animation = details.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    detailsAnimations.set(details, animation);

    animation.onfinish = () => {
      if (detailsAnimations.get(details) !== animation) return;
      if (!opening) details.open = false;
      details.style.removeProperty('height');
      details.style.removeProperty('overflow');
      detailsAnimations.delete(details);
      detailsTargets.delete(details);
    };
    animation.oncancel = () => {
      if (detailsAnimations.get(details) !== animation) return;
      detailsAnimations.delete(details);
    };
  };

  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

export function AnimatedDisclosure({
  open,
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const frame = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    window.cancelAnimationFrame(frame.current ?? 0);
    if (open) {
      setMounted(true);
      // A second frame guarantees the collapsed state is painted after a fresh mount.
      frame.current = window.requestAnimationFrame(() => {
        frame.current = window.requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
    }
    return () => window.cancelAnimationFrame(frame.current ?? 0);
  }, [open]);

  useEffect(() => {
    if (open || !mounted) return;
    if (window.matchMedia(motionQuery).matches) {
      setMounted(false);
      return;
    }
    const timeout = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timeout);
  }, [mounted, open]);

  if (!mounted) return null;
  return (
    <div
      {...props}
      className={`animated-disclosure${visible ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden={!visible || undefined}
      inert={!visible ? true : undefined}
      onTransitionEnd={(event) => {
        props.onTransitionEnd?.(event);
        if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows' && !open)
          setMounted(false);
      }}
    >
      <div className="animated-disclosure-inner">{children}</div>
    </div>
  );
}
