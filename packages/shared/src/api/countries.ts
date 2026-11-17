import { z } from "zod";

// Two-letter codes the runtime names that are not ISO 3166-1 countries: groups and pseudo-locales (EU to ZZ),
// codes ISO only reserves (AC to UK), and retired codes whose countries have a current one (AN to ZR).
const NOT_COUNTRIES = new Set([
  ...["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ"],
  ...["AC", "CP", "CQ", "DG", "EA", "IC", "TA", "UK"],
  ...["AN", "BU", "CS", "DD", "DY", "FX", "HV", "NH", "RH", "SU", "TP", "VD", "YD", "YU", "ZR"],
]);

const ALPHABET_START = 65;
const ALPHABET_LENGTH = 26;
const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

function allTwoLetterCodes(): string[] {
  const letters = Array.from({ length: ALPHABET_LENGTH }, (_, index) => String.fromCharCode(ALPHABET_START + index));
  return letters.flatMap((first) => letters.map((second) => first + second));
}

// The countries a player can pick: ISO 3166-1 alpha-2 and Kosovo (XK), as the runtime's region names know
// them, so no list is kept by hand. The country leaderboard (task 45b) is one per code.
export const COUNTRY_CODES: readonly string[] = allTwoLetterCodes().filter((code) => !NOT_COUNTRIES.has(code) && regionNames.of(code) !== undefined);

// countryName shows a code as players read it, e.g. "KZ" → "Kazakhstan".
export function countryName(code: string): string {
  return regionNames.of(code) ?? code;
}

export const countryCodeSchema = z.string().refine((code) => COUNTRY_CODES.includes(code), "an ISO 3166-1 country code like KZ");
