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

// Navel/Orange codes — exhaustive list from the 98-variety reference
const NAVEL_CODES = new Set([
  1, 4, 11, 16, 18, 20, 24, 28, 39, 40, 41, 43, 44, 45, 48, 50, 53,
  57, 73, 78, 81, 82, 85, 87, 95, 96, 97, 100, 115, 116, 132, 135,
]);

// Letter-based codes
const MANDARINE_LETTER_CODES = new Set(["CS", "CP", "CT", "CED", "PAM", "LM", "MS", "MP", "MT", "SAT"]);
const NAVEL_LETTER_CODES = new Set(["NS", "NP", "NT", "OT", "OS"]);

export type CalibreType = "mandarine" | "navel" | null;

export function getCalibreType(codeVariete: string): CalibreType {
  const upper = codeVariete.trim().toUpperCase();

  // Check letter codes first
  if (MANDARINE_LETTER_CODES.has(upper)) return "mandarine";
  if (NAVEL_LETTER_CODES.has(upper)) return "navel";

  // Then numeric codes
  const num = parseInt(codeVariete, 10);
  if (!isNaN(num) && NAVEL_CODES.has(num)) return "navel";

  // Default: mandarine (citronnier, cédratier, fortunella, lime, micro citrus, etc.)
  return "mandarine";
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
    return `hsl(${100 - ratio * 100}, 60%, ${40 + ratio * 10}%)`;
  }
  return `hsl(${50 - (ratio - 0.5) * 100}, 70%, ${45 + (ratio - 0.5) * 10}%)`;
}

// ── Excel Template Column Definitions (ALL columns always present) ──

export interface ExcelCalibreColumn {
  excelKey: string;      // Column name in Excel: e.g. "Cal_1xxx_M"
  excelHeader: string;   // Header with range: e.g. "Cal_1xxx_M (≥74)"
  dbColumn: string;      // DB column: e.g. "cal_1xxx"
  norm: "M" | "N" | "HC"; // M=Mandarine, N=Navel, HC=Hors calibre (shared)
}

export const EXCEL_CALIBRE_COLUMNS: ExcelCalibreColumn[] = [
  // Mandarine columns (_M)
  { excelKey: "Cal_1xxx_M", excelHeader: "Cal_1xxx_M (≥74)",   dbColumn: "cal_1xxx",    norm: "M" },
  { excelKey: "Cal_1xx_M",  excelHeader: "Cal_1xx_M (72-74)",  dbColumn: "cal_1xx",     norm: "M" },
  { excelKey: "Cal_1x_M",   excelHeader: "Cal_1x_M (68-72)",   dbColumn: "cal_1x_sup",  norm: "M" },
  { excelKey: "Cal_1_M",    excelHeader: "Cal_1_M (64-68)",     dbColumn: "cal_1x_inf",  norm: "M" },
  { excelKey: "Cal_2_M",    excelHeader: "Cal_2_M (59-64)",     dbColumn: "cal_2",       norm: "M" },
  { excelKey: "Cal_3_M",    excelHeader: "Cal_3_M (55-59)",     dbColumn: "cal_3",       norm: "M" },
  { excelKey: "Cal_4_M",    excelHeader: "Cal_4_M (51-55)",     dbColumn: "cal_4",       norm: "M" },
  { excelKey: "Cal_5_M",    excelHeader: "Cal_5_M (47-51)",     dbColumn: "cal_5",       norm: "M" },
  { excelKey: "Cal_6_M",    excelHeader: "Cal_6_M (44-47)",     dbColumn: "cal_6",       norm: "M" },
  // Navel columns (_N)
  { excelKey: "Cal_0_N",    excelHeader: "Cal_0_N (≥93)",       dbColumn: "cal_0",       norm: "N" },
  { excelKey: "Cal_1_N",    excelHeader: "Cal_1_N (88-93)",     dbColumn: "cal_1",       norm: "N" },
  { excelKey: "Cal_2_N",    excelHeader: "Cal_2_N (85-88)",     dbColumn: "cal_2",       norm: "N" },
  { excelKey: "Cal_3_N",    excelHeader: "Cal_3_N (82-85)",     dbColumn: "cal_3",       norm: "N" },
  { excelKey: "Cal_4_N",    excelHeader: "Cal_4_N (78-82)",     dbColumn: "cal_4",       norm: "N" },
  { excelKey: "Cal_5_N",    excelHeader: "Cal_5_N (74-78)",     dbColumn: "cal_5",       norm: "N" },
  { excelKey: "Cal_6_N",    excelHeader: "Cal_6_N (71-74)",     dbColumn: "cal_6",       norm: "N" },
  { excelKey: "Cal_7_N",    excelHeader: "Cal_7_N (68-71)",     dbColumn: "cal_7",       norm: "N" },
  { excelKey: "Cal_8_N",    excelHeader: "Cal_8_N (65-68)",     dbColumn: "cal_8",       norm: "N" },
  { excelKey: "Cal_10_N",   excelHeader: "Cal_10_N (61-65)",    dbColumn: "cal_10",      norm: "N" },
  { excelKey: "Cal_11_N",   excelHeader: "Cal_11_N (59-61)",    dbColumn: "cal_11",      norm: "N" },
  // Hors calibre (shared)
  { excelKey: "Cal_HC",     excelHeader: "Cal_HC (<44M/<59N)",  dbColumn: "cal_hors_calibre", norm: "HC" },
];

/** Get Excel calibre columns for a specific norm */
export function getExcelCalibreColumnsForNorm(norm: "M" | "N"): ExcelCalibreColumn[] {
  return EXCEL_CALIBRE_COLUMNS.filter(c => c.norm === norm || c.norm === "HC");
}

/** Map Excel row calibre values to DB columns based on variety type */
export function mapExcelCalibreToDb(
  row: Record<string, any>,
  calType: CalibreType
): Record<string, number> {
  const result: Record<string, number> = {};
  const norm = calType === "navel" ? "N" : "M";
  for (const col of EXCEL_CALIBRE_COLUMNS) {
    if (col.norm === norm || col.norm === "HC") {
      const val = Number(row[col.excelKey]) || 0;
      if (val > 0) result[col.dbColumn] = val;
    }
  }
  return result;
}

/** Validate calibre sum from Excel row */
export function validateExcelCalibreSum(
  row: Record<string, any>,
  calType: CalibreType
): { valid: boolean; sum: number } {
  const norm = calType === "navel" ? "N" : "M";
  let sum = 0;
  for (const col of EXCEL_CALIBRE_COLUMNS) {
    if (col.norm === norm || col.norm === "HC") {
      sum += Number(row[col.excelKey]) || 0;
    }
  }
  // Only validate if any calibre data was entered
  if (sum === 0) return { valid: true, sum: 0 };
  return { valid: sum === NB_ECHANTILLON, sum };
}
