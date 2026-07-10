"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

/**
 * Page transition wrapper — fades and slides content in on route change
 * (200ms, per the design spec). Rendered inside the dashboard layout's
 * <main> so the shell (sidebar/header) stays static while pages animate.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
