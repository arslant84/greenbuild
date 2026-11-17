import { COUNTRY_CODES, countryName, DISPLAY_NAME_MAX, type ErrorResponse, HANDLE_MAX, HANDLE_MIN, type MeResponse, type UpdateMeRequest } from "@greenbuild/shared";

// The settings screen's Profile section (Figma 7:10273 › Profile Settings, task 47b): what the form edits,
// what a save sends, and what a failed save says.

export interface ProfileFields {
  display_name: string;
  handle: string;
  // An ISO country code, or "" for none.
  country: string;
}

export interface CountryOption {
  code: string;
  name: string;
}

export const DISPLAY_NAME_HINT = `Max ${DISPLAY_NAME_MAX} characters`;
export const HANDLE_HINT = `Lowercase letters, digits & inner hyphens (${HANDLE_MIN}-${HANDLE_MAX} chars)`;

export function profileFields(me: Pick<MeResponse, "display_name" | "handle" | "country">): ProfileFields {
  return { display_name: me.display_name ?? "", handle: me.handle ?? "", country: me.country ?? "" };
}

// countryOptions lists the countries by name. The server builds it, so the browser shows the same names its
// page was rendered with, whatever its own region names are.
export function countryOptions(): CountryOption[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, "en"));
}

// profileChanges is the PATCH body: only the fields that differ from what was loaded, as the API stores them.
export function profileChanges(loaded: ProfileFields, edited: ProfileFields): UpdateMeRequest {
  const changes: UpdateMeRequest = {};
  const displayName = edited.display_name.trim();
  const handle = edited.handle.trim().toLowerCase();
  if (displayName !== loaded.display_name) {
    changes.display_name = displayName;
  }
  if (handle !== loaded.handle) {
    changes.handle = handle;
  }
  if (edited.country !== loaded.country) {
    changes.country = edited.country === "" ? null : edited.country;
  }
  return changes;
}

export function isDirty(loaded: ProfileFields, edited: ProfileFields): boolean {
  return Object.keys(profileChanges(loaded, edited)).length > 0;
}

// saveError says why a save failed, from the API's error code.
export function saveError(error: Pick<ErrorResponse, "code"> | null): string {
  if (error?.code === "conflict") {
    return "That handle is taken. Choose another one.";
  }
  if (error?.code === "validation_failed") {
    return `Check the fields: a display name of 1-${DISPLAY_NAME_MAX} characters, a handle of ${HANDLE_MIN}-${HANDLE_MAX} lowercase letters, digits and inner hyphens.`;
  }
  return "Your changes were not saved. Try again.";
}
