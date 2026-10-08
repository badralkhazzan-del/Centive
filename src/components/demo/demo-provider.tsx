"use client";

import { useMemo, useState } from "react";
import { DemoContext, type DemoApi } from "./demo-context";

// Placeholder until Demo Mode (phase 8) is implemented.
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const api = useMemo<DemoApi>(
    () => ({ active, stepIndex: 0, start: () => setActive(true), stop: () => setActive(false) }),
    [active],
  );
  return <DemoContext.Provider value={api}>{children}</DemoContext.Provider>;
}
