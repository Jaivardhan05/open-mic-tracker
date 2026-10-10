'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import styles from './FlashCardStack.module.css';

interface FlashCardStackProps {
  center: ReactNode;
  outerLeft: ReactNode;
  innerLeft: ReactNode;
  innerRight: ReactNode;
  outerRight: ReactNode;
}

// Mirrors the touch-layout media query in FlashCardStack.module.css.
const TOUCH_QUERY = 'not all and (hover: hover)';

/**
 * Layout/animation shell only — knows nothing about card content, colors, or
 * fonts. Desktop fan-out is driven purely by CSS :hover (no JS state), so it
 * costs nothing when idle. Touch devices get an always-partially-visible
 * vertical stack. Only the top (center) card toggles the fan: a real tap
 * (the browser's `click`, which is never fired for a scroll/drag) or
 * Enter/Space. Touching the empty space around the cards does nothing, and
 * Escape closes an open fan.
 */
export function FlashCardStack({ center, outerLeft, innerLeft, innerRight, outerRight }: FlashCardStackProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const centerRef = useRef<HTMLDivElement>(null);
  const stackId = useId();

  useEffect(() => {
    const query = window.matchMedia(TOUCH_QUERY);
    setIsTouch(query.matches);
    function handleChange(event: MediaQueryListEvent) {
      setIsTouch(event.matches);
    }
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  function handleCenterKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen((current) => !current);
    }
  }

  function handleStackKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && isOpen) {
      setIsOpen(false);
      centerRef.current?.focus();
    }
  }

  const toggleProps = isTouch
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-expanded': isOpen,
        'aria-controls': stackId,
        onClick: () => setIsOpen((current) => !current),
        onKeyDown: handleCenterKeyDown,
      }
    : {};

  return (
    <div className={`${styles.wrapper} ${isTouch && isOpen ? styles.wrapperOpen : ''}`}>
      <div
        id={stackId}
        className={`${styles.stack} ${isOpen ? styles.open : ''}`}
        onKeyDown={isTouch ? handleStackKeyDown : undefined}
      >
        <div className={`${styles.card} ${styles.slotA}`}>{outerLeft}</div>
        <div className={`${styles.card} ${styles.slotB}`}>{innerLeft}</div>
        <div className={`${styles.card} ${styles.slotC}`}>{innerRight}</div>
        <div className={`${styles.card} ${styles.slotD}`}>{outerRight}</div>
        <div ref={centerRef} className={`${styles.card} ${styles.center}`} {...toggleProps}>
          {center}
        </div>
      </div>
    </div>
  );
}
