"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/**
 * Page transition (§16). A brief fade+rise on route change, keyed by
 * pathname so it doesn't fight the framework's own streaming/Suspense
 * boundaries — no AnimatePresence, no delayed unmount, nothing that could
 * hold up data being readable.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
