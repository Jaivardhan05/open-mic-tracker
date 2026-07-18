import type { ReactNode } from 'react';

import styles from './BrutalistField.module.css';

interface BrutalistFieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
}

export function BrutalistField({ label, htmlFor, children }: BrutalistFieldProps) {
  return (
    <div className={styles.container} data-label={label}>
      <label htmlFor={htmlFor} className={styles.srLabel}>
        {label}
      </label>
      {children}
    </div>
  );
}
