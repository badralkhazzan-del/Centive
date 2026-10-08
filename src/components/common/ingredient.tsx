"use client";

import type { Ingredient } from "@/types";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

export function IngredientLabel({ ingredient, className }: { ingredient: Ingredient | undefined; className?: string }) {
  const { nm } = useT();
  if (!ingredient) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className="text-[1.1em] leading-none">
        {ingredient.emoji}
      </span>
      <span>{nm(ingredient)}</span>
    </span>
  );
}
