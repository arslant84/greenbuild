import { cookies } from "next/headers";
import { AGE_COOKIE } from "./age-cookie";

// ageConfirmedInBrowser says whether this request's browser carries the 16+ confirmation. Only for code
// that runs inside a request, such as Auth.js's routes.
export async function ageConfirmedInBrowser(): Promise<boolean> {
  return (await cookies()).get(AGE_COOKIE)?.value === "1";
}
