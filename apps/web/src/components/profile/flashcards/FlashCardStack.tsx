'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import styles from './FlashCardStack.module.css';

interface FlashCardStackProps {
  center: ReactNode;
  outerLeft: ReactNode;
  innerLeft: ReactNode;
  innerRight: ReactNode;
  outerRight: ReactNode;
}

/**
 * Layout/animation shell only — knows nothing about card content, colors, or
 * fonts. Desktop fan-out is driven purely by CSS :hover (no JS state), so it
 * costs nothing when idle. Touch devices get an always-partially-visible
 * vertical stack that a tap expands, tracked via `isOpen` + click-outside-to-close.
 */
export function FlashCardStack({ center, outerLeft, innerLeft, innerRight, outerRight }: FlashCardStackProps) {
  const [isOpen, setIsOpen] = useState(false);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (stackRef.current && !stackRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  return (
    <div className={styles.wrapper}>
      <div
        ref={stackRef}
        className={`${styles.stack} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className={`${styles.card} ${styles.slotA}`}>{outerLeft}</div>
        <div className={`${styles.card} ${styles.slotB}`}>{innerLeft}</div>
        <div className={`${styles.card} ${styles.slotC}`}>{innerRight}</div>
        <div className={`${styles.card} ${styles.slotD}`}>{outerRight}</div>
        <div className={`${styles.card} ${styles.center}`}>{center}</div>
      </div>
    </div>
  );
}
