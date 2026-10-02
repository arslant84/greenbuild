import { redirect } from "next/navigation";

// The Daily Challenge screen is the app's home in the Figma file.
export default function HomePage(): never {
  redirect("/play");
}
