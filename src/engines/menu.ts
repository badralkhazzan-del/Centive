import type { Dish, Kitchen, MenuCycle, MenuOverride, PortionSize, SchoolCalendar, Sized } from "@/types";
import { cycleDayIndex, cycleOffset, isoWeekday, schoolDayDate } from "./time";

export interface ResolvedComponent {
  ingredientId: string;
  grams: Sized<number>;
  dishId: string;
}

export interface ResolvedDish {
  dishId: string;
  /** Set when an approved Menu Switch replaced the planned dish. */
  switchedFromDishId?: string;
  components: ResolvedComponent[];
}

export interface ResolvedDay {
  kitchenId: string;
  week: number;
  dow: number;
  dayIndex: number;
  date: string;
  operating: boolean;
  holidayName?: { en: string; id: string };
  dishes: ResolvedDish[];
  override?: MenuOverride;
}

export function isOperatingDay(calendar: SchoolCalendar, dateIso: string): boolean {
  if (!calendar.operatingWeekdays.includes(isoWeekday(dateIso))) return false;
  return !calendar.holidays.some((h) => h.date === dateIso);
}

export function findOverride(
  overrides: MenuOverride[],
  kitchenId: string,
  week: number,
  dayIndex: number,
): MenuOverride | undefined {
  return overrides.find((o) => o.kitchenId === kitchenId && o.week === week && o.dayIndex === dayIndex);
}

/** Components of a dish, optionally with its main ingredient re-portioned. */
export function dishComponents(dish: Dish, mainGrams?: Sized<number>): ResolvedComponent[] {
  return dish.components.map((c) => ({
    ingredientId: c.ingredientId,
    dishId: dish.id,
    grams: c.ingredientId === dish.mainIngredientId && mainGrams ? { ...mainGrams } : { ...c.gramsPerPortion },
  }));
}

/**
 * The dishes actually planned for one kitchen on one school day, after applying
 * any approved Menu Switch (override) for that exact date.
 */
export function resolveDay(
  kitchen: Kitchen,
  cycle: MenuCycle,
  dishesById: Map<string, Dish>,
  overrides: MenuOverride[],
  today: string,
  week: number,
  dow: number,
): ResolvedDay {
  const dayIndex = cycleDayIndex(week, dow, cycleOffset(today, cycle.anchorMonday));
  const date = schoolDayDate(today, week, dow);
  const holiday = kitchen.schoolCalendar.holidays.find((h) => h.date === date);
  const operating = isOperatingDay(kitchen.schoolCalendar, date);
  const menuDay = cycle.days.find((d) => d.dayIndex === dayIndex);
  const override = findOverride(overrides, kitchen.id, week, dayIndex);
  const dishes: ResolvedDish[] = [];

  for (const dishId of menuDay?.dishIds ?? []) {
    const dish = dishesById.get(dishId);
    if (!dish) continue;
    if (override && override.fromDishId === dishId) {
      const target = dishesById.get(override.toDishId);
      if (target) {
        dishes.push({
          dishId: target.id,
          switchedFromDishId: dishId,
          components: dishComponents(target, override.gramsNew),
        });
        continue;
      }
    }
    dishes.push({ dishId, components: dishComponents(dish) });
  }

  // A switch can adjust the staple to keep energy within the rule.
  if (override && override.stapleIngredientId) {
    const adj = override.stapleTopUpG;
    for (const d of dishes) {
      for (const c of d.components) {
        if (c.ingredientId === override.stapleIngredientId) {
          c.grams = { small: Math.max(0, c.grams.small + adj.small), large: Math.max(0, c.grams.large + adj.large) };
        }
      }
    }
  }

  return {
    kitchenId: kitchen.id,
    week,
    dow,
    dayIndex,
    date,
    operating,
    holidayName: holiday ? { en: holiday.nameEn, id: holiday.nameId } : undefined,
    dishes,
    override,
  };
}

export function allComponents(day: ResolvedDay): ResolvedComponent[] {
  return day.dishes.flatMap((d) => d.components);
}

export function gramsOf(day: ResolvedDay, ingredientId: string, size: PortionSize): number {
  return allComponents(day)
    .filter((c) => c.ingredientId === ingredientId)
    .reduce((s, c) => s + c.grams[size], 0);
}

export function mainProteinOf(day: ResolvedDay, dishesById: Map<string, Dish>, proteinIds: Set<string>): string | undefined {
  for (const d of day.dishes) {
    const dish = dishesById.get(d.dishId);
    if (dish && proteinIds.has(dish.mainIngredientId)) return dish.mainIngredientId;
  }
  return undefined;
}

export function resolveWeek(
  kitchen: Kitchen,
  cycle: MenuCycle,
  dishesById: Map<string, Dish>,
  overrides: MenuOverride[],
  today: string,
  week: number,
): ResolvedDay[] {
  return [0, 1, 2, 3, 4].map((dow) => resolveDay(kitchen, cycle, dishesById, overrides, today, week, dow));
}
