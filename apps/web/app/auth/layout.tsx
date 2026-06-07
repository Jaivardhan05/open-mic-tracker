import type { CSSProperties, ReactNode } from "react";
import { Bebas_Neue, Cormorant_Garamond } from "next/font/google";

import styles from "./auth.module.css";

const openMicFont = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
});

const delhiFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic"],
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={styles.authShell}
      style={{
        "--font-openmic": openMicFont.style.fontFamily,
        "--font-delhi": delhiFont.style.fontFamily,
      } as CSSProperties}
    >
      <div className={styles.authBackground} aria-hidden="true" />
      <div className={styles.authLayer}>{children}</div>
    </div>
  );
}