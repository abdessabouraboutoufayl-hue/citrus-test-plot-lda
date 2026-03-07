import { describe, it, expect } from "vitest";
import {
  getCalibreType,
  getCalibreEntries,
  calibreFromRecord,
  calibreToInsert,
  getCalibreColor,
  mapExcelCalibreToDb,
  validateExcelCalibreSum,
  NB_ECHANTILLON,
} from "@/lib/calibre-config";

describe("getCalibreType", () => {
  it("returns 'mandarine' for mandarine letter codes", () => {
    expect(getCalibreType("CS")).toBe("mandarine");
    expect(getCalibreType("MT")).toBe("mandarine");
    expect(getCalibreType("SAT")).toBe("mandarine");
  });

  it("returns 'navel' for navel letter codes", () => {
    expect(getCalibreType("NS")).toBe("navel");
    expect(getCalibreType("NT")).toBe("navel");
    expect(getCalibreType("OT")).toBe("navel");
  });

  it("returns 'navel' for numeric navel codes", () => {
    expect(getCalibreType("081")).toBe("navel");
    expect(getCalibreType("041")).toBe("navel");
    expect(getCalibreType("115")).toBe("navel");
  });

  it("returns 'mandarine' for unknown codes (default)", () => {
    expect(getCalibreType("999")).toBe("mandarine");
    expect(getCalibreType("XYZ")).toBe("mandarine");
  });

  it("is case-insensitive", () => {
    expect(getCalibreType("nt")).toBe("navel");
    expect(getCalibreType("cs")).toBe("mandarine");
  });
});

describe("getCalibreEntries", () => {
  it("returns mandarine entries with 10 items", () => {
    const entries = getCalibreEntries("mandarine");
    expect(entries.length).toBe(10);
    expect(entries[0].key).toBe("1xxx");
  });

  it("returns navel entries with 12 items", () => {
    const entries = getCalibreEntries("navel");
    expect(entries.length).toBe(12);
    expect(entries[0].key).toBe("0");
  });

  it("returns empty array for null type", () => {
    expect(getCalibreEntries(null)).toEqual([]);
  });
});

describe("calibreFromRecord", () => {
  it("extracts calibre values from a record", () => {
    const record = { cal_1xxx: 5, cal_1xx: 3, cal_2: 10, cal_hors_calibre: 2 };
    const result = calibreFromRecord(record, "mandarine");
    expect(result.cal_1xxx).toBe(5);
    expect(result.cal_1xx).toBe(3);
    expect(result.cal_hors_calibre).toBe(2);
  });

  it("defaults missing values to 0", () => {
    const result = calibreFromRecord({}, "mandarine");
    expect(result.cal_1xxx).toBe(0);
  });
});

describe("validateExcelCalibreSum", () => {
  it("returns valid=true when sum equals NB_ECHANTILLON", () => {
    const row: Record<string, any> = { "Cal_1xxx_M": 15, "Cal_1xx_M": 10, "Cal_HC": 5 };
    const { valid, sum } = validateExcelCalibreSum(row, "mandarine");
    expect(sum).toBe(30);
    expect(valid).toBe(true);
  });

  it("returns valid=true when sum is 0 (no data)", () => {
    const { valid, sum } = validateExcelCalibreSum({}, "mandarine");
    expect(valid).toBe(true);
    expect(sum).toBe(0);
  });

  it("returns valid=false when sum is not NB_ECHANTILLON", () => {
    const row = { "Cal_1xxx_M": 10 };
    const { valid } = validateExcelCalibreSum(row, "mandarine");
    expect(valid).toBe(false);
  });
});

describe("mapExcelCalibreToDb", () => {
  it("maps mandarine excel columns to db columns", () => {
    const row = { "Cal_1xxx_M": 5, "Cal_HC": 2 };
    const result = mapExcelCalibreToDb(row, "mandarine");
    expect(result.cal_1xxx).toBe(5);
    expect(result.cal_hors_calibre).toBe(2);
  });

  it("ignores navel columns when type is mandarine", () => {
    const row = { "Cal_0_N": 5 };
    const result = mapExcelCalibreToDb(row, "mandarine");
    expect(result.cal_0).toBeUndefined();
  });
});

describe("getCalibreColor", () => {
  it("returns a valid hsl string", () => {
    const color = getCalibreColor(0, 10);
    expect(color).toMatch(/^hsl\(/);
  });
});

describe("NB_ECHANTILLON", () => {
  it("equals 30", () => {
    expect(NB_ECHANTILLON).toBe(30);
  });
});
