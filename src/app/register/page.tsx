import { redirect } from "next/navigation";

// Registration is temporarily disabled while the production database is being repaired.
export default function RegisterPage() {
  redirect("/login");
}
