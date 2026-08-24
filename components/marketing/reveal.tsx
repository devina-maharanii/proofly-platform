// Phase 10 public foundation: preserve the approved editorial layout while keeping initial content static, immediate, and low-motion by default.
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  immediate?: boolean;
};

export function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>;
}
