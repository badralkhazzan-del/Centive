// Accepted production commitments at the start of the demo (fictional).
// [farmerId, kopdesId (the ordering Kopdes), ingredientId, weeks, kg per week]
// Weeks are planning weeks (1 = next week). Every row respects the 30% fairness cap.
// Eggs for Kopdes Sumbangsari are deliberately short in weeks 3 to 6 (62% covered):
// that gap is what the Demo Mode resolves.

const W = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const ODD = [1, 3, 5];
const EVEN = [2, 4, 6];

export type SeedCommitment = [farmerId: string, kopdesId: string, ingredientId: string, weeks: number[], kgPerWeek: number];

const S = "kd-sumbangsari";
const K = "kd-karangmulya";

export const SEED_COMMITMENTS: SeedCommitment[] = [
  // Kopdes Sumbangsari
  ["f-sri", S, "eggs", W(1, 8), 75],
  ["f-wati", S, "eggs", W(1, 8), 55],
  ["f-ratna", S, "eggs", W(1, 6), 38],
  ["f-darto", S, "eggs", [1, 2], 50],
  ["f-joko", S, "chicken", W(1, 6), 115],
  ["f-eko", S, "chicken", W(1, 6), 105],
  ["f-slamet", S, "chicken", W(1, 7), 120],
  ["f-bayu", S, "catfish", [...ODD, 7], 55],
  ["f-rina", S, "catfish", ODD, 50],
  ["f-agus", S, "catfish", ODD, 45],
  ["f-tini", S, "catfish", [...ODD, 7], 35],
  ["f-agus", S, "tilapia", EVEN, 60],
  ["f-bayu", S, "tilapia", EVEN, 55],
  ["f-dimas", S, "tilapia", EVEN, 55],
  ["f-yanti", S, "tilapia", EVEN, 45],
  ["f-joko", S, "rice", W(1, 7), 245],
  ["f-slamet", S, "rice", W(1, 6), 245],
  ["f-agus", S, "rice", W(1, 6), 230],
  ["f-ratna", S, "tempe", W(1, 6), 60],
  ["f-rina", S, "tempe", W(1, 6), 55],
  ["f-tini", S, "tempe", W(1, 7), 55],
  ["f-sri", S, "spinach", W(1, 7), 85],
  ["f-wati", S, "spinach", W(1, 6), 70],
  ["f-rina", S, "spinach", W(1, 6), 75],
  ["f-tini", S, "spinach", W(1, 7), 70],
  ["f-wati", S, "kangkung", W(1, 8), 50],
  ["f-eko", S, "kangkung", W(1, 6), 45],
  ["f-bayu", S, "kangkung", W(1, 6), 45],
  ["f-tini", S, "kangkung", W(1, 6), 30],
  // Rainy-season harvest peak: extra water spinach offered for week 6.
  ["f-rina", S, "kangkung", [6], 35],
  ["f-darto", S, "bananas", W(1, 8), 70],
  ["f-sri", S, "bananas", W(1, 6), 90],
  ["f-eko", S, "bananas", W(1, 6), 120],
  ["f-slamet", S, "bananas", W(1, 6), 50],
  ["f-joko", S, "bananas", W(1, 6), 100],

  // Kopdes Karangmulya
  ["f-supri", K, "chicken", W(1, 6), 70],
  ["f-parman", K, "chicken", W(1, 6), 70],
  ["f-supri", K, "rice", W(1, 7), 145],
  ["f-parman", K, "rice", W(1, 6), 145],
  ["f-ningsih", K, "rice", W(1, 6), 145],
  ["f-yanti", K, "eggs", W(1, 6), 45],
  ["f-parman", K, "eggs", W(1, 6), 45],
  ["f-lestari", K, "eggs", W(1, 6), 40],
  ["f-yanti", K, "tilapia", EVEN, 35],
  ["f-dimas", K, "tilapia", EVEN, 35],
  ["f-supri", K, "tilapia", EVEN, 35],
  ["f-dimas", K, "catfish", ODD, 30],
  ["f-supri", K, "catfish", ODD, 30],
  ["f-lestari", K, "catfish", ODD, 30],
  ["f-ningsih", K, "spinach", W(1, 7), 50],
  ["f-lestari", K, "spinach", W(1, 6), 50],
  ["f-yanti", K, "spinach", W(1, 6), 35],
  ["f-supri", K, "spinach", W(1, 6), 45],
  ["f-ningsih", K, "carrots", W(1, 6), 23],
  ["f-dimas", K, "carrots", W(1, 6), 20],
  ["f-lestari", K, "carrots", W(1, 6), 20],
  ["f-dimas", K, "long_beans", W(1, 6), 23],
  ["f-ningsih", K, "long_beans", W(1, 6), 23],
  ["f-lestari", K, "long_beans", W(1, 6), 23],
  ["f-yanti", K, "oranges", W(1, 6), 85],
  ["f-lestari", K, "oranges", W(1, 6), 85],
  ["f-parman", K, "oranges", W(1, 6), 85],
  ["f-ningsih", K, "oranges", W(1, 6), 85],
];
