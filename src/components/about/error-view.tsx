"use client";

import Link from "next/link";
import { House, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { StatusScreen } from "./status-screen";

/** Friendly fallback shown by the root error boundary (src/app/error.tsx). */
export function ErrorView({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  return (
    <StatusScreen
      testId="error-boundary"
      tone="danger"
      live
      badge={<TriangleAlert />}
      title={t.common.errorTitle}
      body={t.common.errorBody}
      actions={
        <>
          <Button size="lg" onClick={onRetry} data-testid="error-retry">
            <RotateCcw aria-hidden /> {t.common.tryAgain}
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/">
              <House aria-hidden /> {t.common.goHome}
            </Link>
          </Button>
        </>
      }
    />
  );
}
