// Calibre configuration based on variety type

export interface CalibreEntry {
  key: string;       // DB column suffix, e.g. "1xxx", "0"
  label: string;     // Display label
  range: string;     // mm range description
  dbColumn: string;  // Full DB column name
}

const MANDARINE_CALIBRES: CalibreEntry[] = [
  { key: "1xxx", label: "1xxx", range: "≥74", dbColumn: "cal_1xxx" },
  { key: "1xx", label: "1xx", range: "72-74", dbColumn: "cal_1xx" },
  { key: "1x_sup", label: "1x", range: "68-72", dbColumn: "cal_1x_sup" },
  { key: "1x_inf", label: "1", range: "64-68", dbColumn: "cal_1x_inf" },
  { key: "2", label: "2", range: "59-64", dbColumn: "cal_2" },
  { key: "3", label: "3", range: "55-59", dbColumn: "cal_3" },
  { key: "4", label: "4", range: "51-55", dbColumn: "cal_4" },
  { key: "5", label: "5", range: "47-51", dbColumn: "cal_5" },
  { key: "6", label: "6", range: "44-47", dbColumn: "cal_6" },
  { key: "hors_calibre", label: "Hors cal.", range: "<44", dbColumn: "cal_hors_calibre" },
];

const NAVEL_CALIBRES: CalibreEntry[] = [
  { key: "0", label: "0", range: "≥93", dbColumn: "cal_0" },
  { key: "1", label: "1", range: "88-93", dbColumn: "cal_1" },
  { key: "2", label: "2", range: "85-88", dbColumn: "cal_2" },
  { key: "3", label: "3", range: "82-85", dbColumn: "cal_3" },
  { key: "4", label: "4", range: "78-82", dbColumn: "cal_4" },
  { key: "5", label: "5", range: "74-78", dbColumn: "cal_5" },
  { key: "6", label: "6", range: "71-74", dbColumn: "cal_6" },
  { key: "7", label: "7", range: "68-71", dbColumn: "cal_7" },
  { key: "8", label: "8", range: "65-68", dbColumn: "cal_8" },
  { key: "10", label: "10", range: "61-65", dbColumn: "cal_10" },
  { key: "11", label: "11", range: "59-61", dbColumn: "cal_11" },
  { key: "hors_calibre", label: "Hors cal.", range: "<59", dbColumn: "cal_hors_calibre" },
];

// Mandarine codes: 007-120, 136
const MANDARINE_CODE_RANGES = [
  { min: 7, max: 120 },
  { min: 136, max: 136 },
];

// Navel/Orange codes: 041, 052, 081-087, 115, 135
const NAVEL_CODES = new Set([41, 52, 81, 82, 83, 84, 85, 86, 87, 115, 135]);

export type CalibreType = "mandarine" | "navel" | null;

export function getCalibreType(codeVariete: string): CalibreType {
  const num = parseInt(codeVariete, 10);
  if (isNaN(num)) return null;

  if (NAVEL_CODES.has(num)) return "navel";

  for (const range of MANDARINE_CODE_RANGES) {
    if (num >= range.min && num <= range.max) return "mandarine";
  }

  return null;
}

export function getCalibreEntries(type: CalibreType): CalibreEntry[] {
  if (type === "mandarine") return MANDARINE_CALIBRES;
  if (type === "navel") return NAVEL_CALIBRES;
  return [];
}

export const NB_ECHANTILLON = 30;

/** Build a calibre values map from DB column values */
export function calibreFromRecord(record: Record<string, any>, type: CalibreType): Record<string, number> {
  const entries = getCalibreEntries(type);
  const result: Record<string, number> = {};
  for (const e of entries) {
    result[e.dbColumn] = Number(record[e.dbColumn]) || 0;
  }
  return result;
}

/** Build insert-ready calibre object */
export function calibreToInsert(values: Record<string, number>): Record<string, number> {
  return { ...values };
}

/** Get the calibre bar chart color based on index */
export function getCalibreColor(index: number, total: number): string {
  // Green → Yellow → Red gradient
  const ratio = index / Math.max(total - 1, 1);
  if (ratio < 0.5) {
    const g = Math.round(180 - ratio * 2 * 80);
    return `hsl(${100 - ratio * 100}, 60%, ${40 + ratio * 10}%)`;
  }
  return `hsl(${50 - (ratio - 0.5) * 100}, 70%, ${45 + (ratio - 0.5) * 10}%)`;
}
