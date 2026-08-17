"use client";

import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

/** Card entrance stagger on dashboard load (§16). Wrap a grid's children with StaggerItem. */
export function StaggerGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={item}>{children}</motion.div>;
}
