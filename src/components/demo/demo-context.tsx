"use client";

import { createContext, useContext } from "react";

export interface DemoApi {
  active: boolean;
  stepIndex: number;
  start: () => void;
  stop: () => void;
}

export const DemoContext = createContext<DemoApi>({ active: false, stepIndex: 0, start: () => undefined, stop: () => undefined });

export function useDemo() {
  return useContext(DemoContext);
}
