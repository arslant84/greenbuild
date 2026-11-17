import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryCodeSchema, countryName } from "./countries.js";

const ISO_3166_COUNTRIES = 249;

describe("COUNTRY_CODES", () => {
  it("lists the 249 ISO 3166-1 countries and Kosovo", () => {
    expect(COUNTRY_CODES).toHaveLength(ISO_3166_COUNTRIES + 1);
    expect(COUNTRY_CODES).toEqual(expect.arrayContaining(["KZ", "US", "GB", "AX", "XK"]));
  });

  it("leaves out groups, pseudo-locales, reserved and retired codes", () => {
    for (const code of ["EU", "UN", "XA", "ZZ", "UK", "IC", "SU", "YU", "ZR"]) {
      expect(COUNTRY_CODES).not.toContain(code);
    }
  });
});

describe("countryCodeSchema", () => {
  it("accepts a country code and refuses anything else", () => {
    expect([countryCodeSchema.safeParse("KZ").success, countryCodeSchema.safeParse("EU").success, countryCodeSchema.safeParse("kz").success]).toEqual([true, false, false]);
  });
});

describe("countryName", () => {
  it("shows a code as players read it", () => {
    expect(countryName("KZ")).toBe("Kazakhstan");
  });
});
