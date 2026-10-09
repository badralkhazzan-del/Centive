import { addDays } from "@/engines/time";
import { deliveryPool, nextSchoolDays, suggestedBatchKg } from "@/lib/delivery";
import { actions, getDerived, repo } from "@/lib/repo";

// The Demo Mode script (spec section 8). Each step opens a screen and highlights
// elements by their data-tour name. Timed actions change the demo data the same
// way the screens do. `run` changes data and happens exactly once; `view` only
// moves the camera (navigate, highlight) and is skipped when a step is cut short,
// so pressing Next early still leaves every step's data change applied, in order.

export const DEMO_KOPDES = "kd-sumbangsari";
export const DEMO_KITCHEN = "k-sumbang-1";
export const DEMO_FARMER = "f-darto";
export const DEMO_INGREDIENT = "eggs";

export interface DemoCtx {
  go: (href: string) => void;
  focus: (...tours: string[]) => void;
  /** Values handed from one action to a later one (the batch code). */
  memo: Record<string, string>;
  /** True while the step plays normally; false when it is being completed early. */
  live: boolean;
  receivedBy: string;
}

export interface DemoAction {
  at: number;
  run?: (ctx: DemoCtx) => void;
  view?: (ctx: DemoCtx) => void;
}

export interface DemoStep {
  href: (ctx: DemoCtx) => string;
  focus: string[];
  factId?: string;
  enter?: () => void;
  actions: DemoAction[];
}

/** Click a real button when it is on screen (so its toast shows), otherwise call the action. */
function clickOr(selector: string, ctx: DemoCtx, fallback: () => void) {
  const el = ctx.live ? document.querySelector<HTMLButtonElement>(selector) : null;
  if (el && !el.disabled) el.click();
  else fallback();
}

function pendingChat(farmerId: string, value: string) {
  return [...repo.getState().chat].reverse().find((m) => m.farmerId === farmerId && !m.answered && m.buttons?.some((b) => b.value === value));
}

function reply(value: string) {
  const msg = pendingChat(DEMO_FARMER, value);
  if (msg) actions.chatReply(msg.id, value);
}

export const DEMO_STEPS: DemoStep[] = [
  // 1. Landing: the gap.
  { href: () => "/", focus: ["stat-kopdes"], factId: "kopdes-share-2026-05", actions: [] },

  // 2. Kitchen: menu cycle -> 8-week forecast.
  {
    href: () => "/kitchen/forecast",
    focus: ["forecast-chart"],
    enter: () => actions.setActiveKitchen(DEMO_KITCHEN),
    actions: [],
  },

  // 3. Kopdes: eggs at 62% (red) -> send offers to farmers.
  {
    href: () => "/kopdes",
    focus: [`board-${DEMO_INGREDIENT}`],
    enter: () => actions.setActiveKopdes(DEMO_KOPDES),
    actions: [
      { at: 3000, view: (c) => c.focus(`send-offers-${DEMO_INGREDIENT}`) },
      {
        at: 5000,
        run: (c) => clickOr(`[data-testid="send-offers-${DEMO_INGREDIENT}"]`, c, () => actions.sendOffers(DEMO_KOPDES, DEMO_INGREDIENT)),
        view: (c) => c.focus(`board-${DEMO_INGREDIENT}`),
      },
    ],
  },

  // 4. Farmer: Pak Darto takes part of the order, 20 kg/week; the board bar rises live.
  {
    href: () => "/farmer",
    focus: ["farmer-phone"],
    enter: () => {
      actions.setActiveKopdes(DEMO_KOPDES);
      actions.setActiveFarmer(DEMO_FARMER);
    },
    actions: [
      { at: 3500, run: () => reply("2"), view: (c) => c.focus("farmer-phone") },
      { at: 7000, run: () => reply("20"), view: (c) => c.focus("live-board") },
    ],
  },

  // 5. Kopdes: chicken price spike -> Price Shield alert, Menu Switch triggered.
  {
    href: () => "/kopdes",
    focus: ["price-shield"],
    enter: () => actions.setActiveKopdes(DEMO_KOPDES),
    actions: [],
  },

  // 6. Kitchen: approve chicken -> catfish.
  {
    href: () => "/kitchen/switch",
    focus: ["switch-top"],
    enter: () => actions.setActiveKitchen(DEMO_KITCHEN),
    actions: [
      {
        at: 8000,
        run: () => {
          const list = getDerived(repo.getState()).suggestions.get(DEMO_KITCHEN) ?? [];
          const s = list.find((x) => x.fromIngredientId === "chicken" && x.toIngredientId === "catfish") ?? list.find((x) => x.reason === "price_spike");
          if (s) actions.approveSuggestion(s);
        },
        view: (c) => c.focus("switch-decided"),
      },
    ],
  },

  // 7. Kopdes -> Kitchen: batch QR label, scanned on receipt, Payment Clock starts.
  {
    href: (c) => (c.memo.batch ? `/kopdes/delivery?label=${c.memo.batch}` : "/kopdes/delivery"),
    focus: ["generate-qr"],
    enter: () => actions.setActiveKopdes(DEMO_KOPDES),
    actions: [
      {
        at: 2500,
        run: (c) => {
          const d = getDerived(repo.getState());
          const date = nextSchoolDays(addDays(d.today, 1), 1)[0];
          const pool = deliveryPool(d, DEMO_KOPDES, DEMO_INGREDIENT, date);
          const farmerIds = pool.map((p) => p.farmerId);
          if (farmerIds.length === 0) return;
          const batch = actions.createBatch({
            kopdesId: DEMO_KOPDES,
            kitchenId: DEMO_KITCHEN,
            ingredientId: DEMO_INGREDIENT,
            farmerIds,
            kg: suggestedBatchKg(d, DEMO_KOPDES, DEMO_KITCHEN, DEMO_INGREDIENT, date, pool, farmerIds),
            grade: "A",
            coldChainChecked: true,
            harvestDate: addDays(date, -1),
            plannedDeliveryDate: date,
          });
          c.memo.batch = batch.id;
        },
        view: (c) => {
          if (!c.memo.batch) return;
          c.go(`/kopdes/delivery?label=${c.memo.batch}`);
          c.focus("qr-label");
        },
      },
      {
        at: 8000,
        view: (c) => {
          if (!c.memo.batch) return;
          actions.setActiveKitchen(DEMO_KITCHEN);
          c.go(`/kitchen/receive?code=${c.memo.batch}`);
          c.focus("receive-card");
        },
      },
      {
        at: 11000,
        run: (c) => {
          if (c.memo.batch) actions.receiveBatch(c.memo.batch, { receivedChecked: true, coldChainChecked: true, receivedBy: c.receivedBy });
        },
        view: (c) => c.focus("payment-clock"),
      },
    ],
  },

  // 8. Regency: the KPIs add up.
  { href: () => "/regency", focus: ["regency-kpis"], actions: [] },
];
