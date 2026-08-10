"use server";

import { signIn } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInForDevelopment(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  await signIn("dev", { email, redirectTo: "/dashboard" });
}
