import type { Kitchen, Kopdes, SchoolCalendar } from "@/types";

// Fictional organizations located in real subdistricts of Banyumas Regency,
// Central Java (Sumbang, Kembaran). Coordinates are approximate and only place
// the markers in the right area of the map.

export const SAMPLE_CALENDAR: SchoolCalendar = {
  operatingWeekdays: [1, 2, 3, 4, 5],
  holidays: [{ date: "2026-12-25", nameEn: "Christmas Day (public holiday)", nameId: "Hari Raya Natal (libur nasional)" }],
};

const calendar = (): SchoolCalendar => ({
  operatingWeekdays: [...SAMPLE_CALENDAR.operatingWeekdays],
  holidays: SAMPLE_CALENDAR.holidays.map((h) => ({ ...h })),
});

export const KOPDES: Kopdes[] = [
  {
    id: "kd-sumbangsari",
    name: "Kopdes Merah Putih Sumbangsari (sample)",
    village: "Sumbangsari",
    subdistrict: "Sumbang",
    lat: -7.3905,
    lng: 109.3045,
    memberFarmerIds: [],
    neighborKopdesIds: ["kd-karangmulya"],
  },
  {
    id: "kd-karangmulya",
    name: "Kopdes Merah Putih Karangmulya (sample)",
    village: "Karangmulya",
    subdistrict: "Kembaran",
    lat: -7.4205,
    lng: 109.2865,
    memberFarmerIds: [],
    neighborKopdesIds: ["kd-sumbangsari"],
  },
];

export function buildKitchens(): Kitchen[] {
  return [
    {
      id: "k-sumbang-1",
      name: "SPPG Sumbang 1 (sample)",
      subdistrict: "Sumbang",
      village: "Sumbangsari",
      lat: -7.3962,
      lng: 109.2958,
      beneficiaries: { small: 1300, large: 1700 },
      attendanceRate: 0.92,
      schoolCalendar: calendar(),
      linkedKopdesIds: ["kd-sumbangsari"],
      kopdesOrderShare: { "kd-sumbangsari": 0.5 },
      paymentSlaDays: 7,
      allergenExclusions: [],
      seasoningCostRp: { small: 600, large: 800 },
    },
    {
      id: "k-sumbang-2",
      name: "SPPG Sumbang 2 (sample)",
      subdistrict: "Sumbang",
      village: "Sumbangsari",
      lat: -7.3778,
      lng: 109.3152,
      beneficiaries: { small: 1250, large: 1800 },
      attendanceRate: 0.92,
      schoolCalendar: calendar(),
      linkedKopdesIds: ["kd-sumbangsari", "kd-karangmulya"],
      kopdesOrderShare: { "kd-sumbangsari": 0.25, "kd-karangmulya": 0.15 },
      paymentSlaDays: 7,
      allergenExclusions: [],
      seasoningCostRp: { small: 600, large: 800 },
    },
    {
      id: "k-kembaran-1",
      name: "SPPG Kembaran 1 (sample)",
      subdistrict: "Kembaran",
      village: "Karangmulya",
      lat: -7.4292,
      lng: 109.2788,
      beneficiaries: { small: 1400, large: 1550 },
      attendanceRate: 0.92,
      schoolCalendar: calendar(),
      linkedKopdesIds: ["kd-karangmulya"],
      kopdesOrderShare: { "kd-karangmulya": 0.3 },
      paymentSlaDays: 7,
      allergenExclusions: ["peanut"],
      seasoningCostRp: { small: 600, large: 800 },
    },
  ];
}

/** Dishes the nutritionist locked as anchors, per kitchen. */
export const SEED_LOCKS: Record<string, string[]> = {
  "k-sumbang-1": ["nasi_putih"],
  "k-sumbang-2": ["nasi_putih", "telur_balado"],
  "k-kembaran-1": ["nasi_putih"],
};
