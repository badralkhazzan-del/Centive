import type { Role } from "@/types";
import type { Dict } from "@/i18n/en";

export interface NavItem {
  href: string;
  label: (t: Dict) => string;
  tour?: string;
}

export const ROLE_HOME: Record<Role, string> = {
  kitchen: "/kitchen",
  kopdes: "/kopdes",
  farmer: "/farmer",
  regency: "/regency",
};

export const ROLE_NAV: Record<Role, NavItem[]> = {
  kitchen: [
    { href: "/kitchen", label: (t) => t.nav.kitchenHome },
    { href: "/kitchen/menu", label: (t) => t.nav.kitchenMenu },
    { href: "/kitchen/forecast", label: (t) => t.nav.kitchenForecast },
    { href: "/kitchen/switch", label: (t) => t.nav.kitchenSwitch, tour: "nav-switch" },
    { href: "/kitchen/receive", label: (t) => t.nav.kitchenReceive },
    { href: "/kitchen/feedback", label: (t) => t.nav.kitchenFeedback },
  ],
  kopdes: [
    { href: "/kopdes", label: (t) => t.nav.kopdesBoard },
    { href: "/kopdes/farmers", label: (t) => t.nav.kopdesFarmers },
    { href: "/kopdes/delivery", label: (t) => t.nav.kopdesDelivery },
    { href: "/kopdes/payments", label: (t) => t.nav.kopdesPayments },
  ],
  farmer: [{ href: "/farmer", label: (t) => t.nav.farmerChat }],
  regency: [{ href: "/regency", label: (t) => t.nav.regencyDashboard }],
};

export function roleFromPath(pathname: string): Role | null {
  if (pathname.startsWith("/kitchen")) return "kitchen";
  if (pathname.startsWith("/kopdes")) return "kopdes";
  if (pathname.startsWith("/farmer")) return "farmer";
  if (pathname.startsWith("/regency")) return "regency";
  return null;
}
