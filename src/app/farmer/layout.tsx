import { EntityGate } from "@/components/layout/entity-gate";

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <EntityGate kind="farmer">{children}</EntityGate>;
}
