import type { Metadata } from "next";
import { SimulationLab } from "@/components/simulation/simulation-lab";

export const metadata: Metadata = { title: "Simulation Lab" };

export default function Page() {
  return <SimulationLab />;
}
