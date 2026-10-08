import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { id } from "@/i18n/id";

type Leaf = { path: string; value: unknown };

function leaves(obj: unknown, prefix = ""): Leaf[] {
  if (typeof obj === "string" || typeof obj === "function") return [{ path: prefix, value: obj }];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (obj && typeof obj === "object") return Object.entries(obj).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  return [{ path: prefix, value: obj }];
}

const sample = (fn: (...a: unknown[]) => unknown) => fn(2, 3, "x");

describe("i18n", () => {
  it("has the same keys in English and Indonesian", () => {
    expect(leaves(id).map((l) => l.path)).toEqual(leaves(en).map((l) => l.path));
  });

  it("has no empty string in either language", () => {
    for (const dict of [en, id]) {
      for (const { path, value } of leaves(dict)) {
        const text = typeof value === "function" ? sample(value as (...a: unknown[]) => unknown) : value;
        expect(typeof text, path).toBe("string");
        expect((text as string).trim().length, path).toBeGreaterThan(0);
      }
    }
  });

  it("actually translates most strings", () => {
    const e = leaves(en);
    const i = leaves(id);
    const same = e.filter((l, k) => typeof l.value === "string" && l.value === i[k].value).length;
    expect(same / e.length).toBeLessThan(0.15);
  });
});
