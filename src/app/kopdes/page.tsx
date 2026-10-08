import type { Metadata } from "next";
import { CommitmentBoard } from "@/components/kopdes/commitment-board";

export const metadata: Metadata = { title: "Commitment Board" };

export default function Page() {
  return <CommitmentBoard />;
}
