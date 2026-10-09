"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { ErrorView } from "@/components/about/error-view";

// Next.js 16.3+ passes `retry` (re-fetch and re-render the segment) and `reset`
// (clear the error state only). The docs recommend `retry` for "Try again".
export default function RootError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorView onRetry={() => (retry ?? reset)?.()} />;
}
