import type { Metadata } from "next";
import { ForecastView } from "@/components/kitchen/forecast-view";

export const metadata: Metadata = { title: "Forecast" };

export default function Page() {
  return <ForecastView />;
}
