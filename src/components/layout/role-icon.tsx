import { ChefHat, Landmark, Sprout, Store } from "lucide-react";
import type { Role } from "@/types";

export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  const Icon = role === "kitchen" ? ChefHat : role === "kopdes" ? Store : role === "farmer" ? Sprout : Landmark;
  return <Icon className={className} aria-hidden />;
}
