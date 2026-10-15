import type { Metadata } from "next";
import { ExploreHub } from "@/components/guest/explore-hub";

export const metadata: Metadata = { title: "Sample region" };

export default function Page() {
  return <ExploreHub />;
}
