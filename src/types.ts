// Core domain types for PiringTani. Engines in src/engines/ only depend on these
// types (no React), so the same logic can run in the browser, in tests and,
// later, on a server.

export type Lang = "en" | "id";
export type Role = "kitchen" | "kopdes" | "farmer" | "regency";
export type PortionSize = "small" | "large";
export type Sized<T> = Record<PortionSize, T>;

/** A bilingual string. Every user-facing generated text carries both languages. */
export interface LocalizedText {
  en: string;
  id: string;
}

export type FoodGroup =
  | "staple"
  | "animal_protein"
  | "plant_protein"
  | "vegetable"
  | "fruit"
  | "dairy"
  | "fat";

export type Allergen = "egg" | "fish" | "soy" | "milk" | "peanut" | "shellfish" | "gluten";

export interface Ingredient {
  id: string;
  nameEn: string;
  nameId: string;
  /** Name of the matching row in the Indonesian Food Composition Table (TKPI). */
  tkpiName: string;
  foodGroup: FoodGroup;
  unit: "kg" | "L";
  /** Only for liquids sold by the litre (cooking oil). */
  densityKgPerL?: number;
  energyKcalPer100g: number;
  proteinGPer100g: number;
  /** Edible fraction (BDD, bagian yang dapat dimakan), 0 to 1. */
  edibleFraction: number;
  allergens: Allergen[];
  /** Availability index per month (Jan..Dec), 0 to 1. */
  seasonalityByMonth: number[];
  /** True when farmers often have seasonal surpluses (used by the surplus trigger). */
  seasonal: boolean;
  dataSource: string;
  verified: boolean;
  dataNote?: string;
  emoji: string;
}

export interface DishComponent {
  ingredientId: string;
  /** Edible grams per portion (raw). Small = PAUD to SD grade 3, large = SD grade 4+. */
  gramsPerPortion: Sized<number>;
}

export interface Dish {
  id: string;
  nameEn: string;
  nameId: string;
  /** The ingredient that defines the dish (used for swaps and diversity). */
  mainIngredientId: string;
  components: DishComponent[];
}

export interface MenuDay {
  /** 1 to 20 within the 4-week cycle (Mon..Fri x 4). */
  dayIndex: number;
  dishIds: string[];
}

export interface MenuCycle {
  id: string;
  kitchenId: string;
  days: MenuDay[];
  /** Anchor dishes the nutritionist has locked: they are never swapped. */
  lockedDishIds: string[];
  /** Monday (ISO) of a week that uses cycle week 1. Keeps the cycle aligned as real weeks pass. */
  anchorMonday?: string;
}

export interface Holiday {
  date: string; // ISO yyyy-mm-dd
  nameEn: string;
  nameId: string;
}

export interface SchoolCalendar {
  /** ISO weekday numbers that operate: 1 = Monday ... 5 = Friday. */
  operatingWeekdays: number[];
  holidays: Holiday[];
}

export interface Kitchen {
  id: string;
  name: string;
  subdistrict: string;
  village: string;
  lat: number;
  lng: number;
  beneficiaries: Sized<number>;
  attendanceRate: number;
  schoolCalendar: SchoolCalendar;
  linkedKopdesIds: string[];
  /** Share of this kitchen's demand for local commodities ordered from each linked Kopdes. */
  kopdesOrderShare: Record<string, number>;
  paymentSlaDays: number;
  /** Allergens this kitchen excludes from every menu. */
  allergenExclusions: Allergen[];
  /** Spices, salt and other small items per portion (Rp), part of the raw-food budget. */
  seasoningCostRp: Sized<number>;
}

export interface Kopdes {
  id: string;
  name: string;
  village: string;
  subdistrict: string;
  lat: number;
  lng: number;
  memberFarmerIds: string[];
  neighborKopdesIds: string[];
}

export interface FarmerCommodity {
  ingredientId: string;
  weeklyCapacityKg: number;
}

export interface Farmer {
  id: string;
  /** First name only (privacy by design). */
  displayName: string;
  village: string;
  kopdesId: string;
  gender: "female" | "male";
  ageGroup: "youth" | "adult";
  commodities: FarmerCommodity[];
  reliabilityScore: number;
  phoneMasked: string;
  /** Full number for WhatsApp links (live workspaces). Only admins and the farmer's Kopdes see it. */
  phone?: string;
  consentGiven: boolean;
}

export type PriceSource = "PIHPS" | "PLACEHOLDER";

export interface PricePoint {
  ingredientId: string;
  weekStart: string; // ISO Monday
  priceRpPerKg: number; // per ingredient unit (kg, or L for cooking oil)
  source: PriceSource;
}

export interface PriceBand {
  ingredientId: string;
  week: number;
  ref: number;
  floor: number;
  ceiling: number;
  settlement: number;
  marketPrice: number;
}

export interface DemandForecast {
  kitchenId: string;
  ingredientId: string;
  week: number;
  kgExpected: number;
  kgLow: number;
  kgHigh: number;
}

export type CommitmentStatus =
  | "offered"
  | "accepted"
  | "declined"
  | "partially_fulfilled"
  | "fulfilled"
  | "defaulted";

export interface CommitmentBand {
  ref: number;
  floor: number;
  ceiling: number;
}

export interface Commitment {
  id: string;
  farmerId: string;
  /** The Kopdes that placed the order (may differ from the farmer's own Kopdes for neighbor requests). */
  kopdesId: string;
  ingredientId: string;
  weeks: number[];
  /** Agreed kg per week (for offers: the kg offered). */
  kgPerWeek: number;
  offeredKgPerWeek: number;
  priceBand: CommitmentBand;
  status: CommitmentStatus;
  createdAt: string;
  respondedAt?: string;
  origin: "seed" | "offer" | "neighbor";
}

export type SwitchReason = "shortage" | "price_spike" | "surplus";

export interface NutritionCheck {
  /** Whole-portion protein after the switch, as a share of the original portion (1 = 100%). */
  proteinPct: number;
  /** Whole-portion energy after the switch, as a share of the original portion. */
  energyPct: number;
  bySize: Sized<{ proteinPct: number; energyPct: number; proteinG: number; energyKcal: number }>;
}

export interface SuggestionScores {
  local: number;
  cost: number;
  nutrition: number;
  acceptance: number;
  total: number;
}

export interface SubstitutionOption {
  toIngredientId: string;
  toDishId: string;
  gramsNew: Sized<number>;
  /** Extra raw staple (rice) per portion used to keep energy within the rule. */
  stapleTopUpG: Sized<number>;
  stapleIngredientId?: string;
  scores: SuggestionScores;
  nutritionCheck: NutritionCheck;
  costPerPortionBefore: Sized<number>;
  costPerPortionAfter: Sized<number>;
  localFarmers: number;
  availableKg: number;
  neededKg: number;
  explanation: LocalizedText;
}

export interface SubstitutionSuggestion extends SubstitutionOption {
  id: string;
  kitchenId: string;
  week: number;
  dayIndex: number;
  date: string;
  fromIngredientId: string;
  fromDishId: string;
  fromGrams: Sized<number>;
  reason: SwitchReason;
  why: LocalizedText;
  status: "pending" | "approved" | "rejected";
  alternatives: SubstitutionOption[];
}

/** An approved Menu Switch, applied to one calendar day of one kitchen. */
export interface MenuOverride {
  suggestionId: string;
  kitchenId: string;
  week: number;
  dayIndex: number;
  fromDishId: string;
  toDishId: string;
  fromIngredientId: string;
  toIngredientId: string;
  gramsNew: Sized<number>;
  stapleTopUpG: Sized<number>;
  stapleIngredientId?: string;
  approvedAt: string;
}

export interface SuggestionDecision {
  key: string;
  status: "approved" | "rejected";
  suggestionId: string;
  decidedAt: string;
}

export interface SwitchRequest {
  id: string;
  kopdesId: string;
  ingredientId: string;
  weeks: number[];
  createdAt: string;
}

export interface Batch {
  id: string; // short code, e.g. PT-7K3Q
  farmerIds: string[];
  kopdesId: string;
  kitchenId: string;
  ingredientId: string;
  kg: number;
  harvestDate: string;
  grade: "A" | "B";
  coldChainChecked: boolean;
  createdAt: string;
  plannedDeliveryDate: string;
  deliveredAt?: string;
  receivedBy?: string;
  receivedChecked?: boolean;
  photoPlaceholder: string;
  week: number;
}

export interface Payment {
  batchId: string;
  deliveredAt: string;
  verifiedAt?: string;
  kitchenPaidAt?: string;
  farmerPaidAt?: string;
  amountRp: number;
}

export type Leftover = "none" | "quarter" | "half" | "most";

export interface PlateFeedback {
  kitchenId: string;
  date: string;
  dishId: string;
  leftover: Leftover;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorRole: Role | "system";
  action: string;
  details: string;
}

export type ChatSender = "kopdes" | "farmer";
export type ChatKind =
  | "offer"
  | "ask_partial"
  | "confirm"
  | "decline_ack"
  | "reminder"
  | "payment"
  | "reply"
  | "info";

export interface ChatButton {
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  farmerId: string;
  from: ChatSender;
  kind: ChatKind;
  /** Indonesian text (farmers use Indonesian), with an English translation. */
  textId: string;
  textEn: string;
  commitmentId?: string;
  buttons?: ChatButton[];
  answered?: boolean;
  at: string;
}

export interface SubstitutionSettings {
  minProteinPct: number;
  energyTolerancePct: number;
  leadTimeDays: number;
  maxMainProteinPerWeek: number;
  surplusThreshold: number;
  maxStapleTopUpG: number;
}

export interface Settings {
  priceBandFloorPct: number;
  priceBandCeilingPct: number;
  shieldPriceRisePct: number;
  shieldDemandSharePct: number;
  fairnessCapPct: number;
  safetyBuffer: number;
  attendanceRate: number;
  paymentSlaDays: number;
  commitmentLeadWeeks: number;
  substitution: SubstitutionSettings;
  /** Estimated weekly market supply around each Kopdes, kg per week (Price Shield). */
  marketSupplyKgPerWeek: Record<string, number>;
}

export interface UiState {
  lang: Lang;
  role: Role | null;
  activeKitchenId: string;
  activeKopdesId: string;
  activeFarmerId: string;
}

/** Set for workspaces on the server; absent in the read-only public copy. */
export interface WorkspaceMeta {
  id: string;
  name: string;
  region: string;
  /** True while the fictional sample region is loaded. */
  sample: boolean;
  timezone: string;
  createdAt: string;
}

/** Everything the app persists. The repository layer owns this shape. */
export interface AppData {
  version: number;
  today: string;
  workspace?: WorkspaceMeta;
  ui: UiState;
  settings: Settings;
  ingredients: Ingredient[];
  dishes: Dish[];
  menuCycles: MenuCycle[];
  kitchens: Kitchen[];
  kopdes: Kopdes[];
  farmers: Farmer[];
  prices: PricePoint[];
  commitments: Commitment[];
  overrides: MenuOverride[];
  decisions: SuggestionDecision[];
  switchRequests: SwitchRequest[];
  batches: Batch[];
  payments: Payment[];
  plateFeedback: PlateFeedback[];
  auditLog: AuditLog[];
  chat: ChatMessage[];
  /** Counter for deterministic ids. */
  seq: number;
}
