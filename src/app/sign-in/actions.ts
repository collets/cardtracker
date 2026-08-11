"use server";

import { signIn } from "@/auth";
import { normalizeEmail } from "@/lib/utils";
import { z } from "zod";

const developmentSignInSchema = z.object({ email: z.email() });

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInForDevelopment(formData: FormData) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.AUTH_ENABLE_DEV_PROVIDER !== "true"
  ) {
    throw new Error("Development sign-in is unavailable");
  }
  const { email } = developmentSignInSchema.parse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
  });
  await signIn("dev", { email, redirectTo: "/dashboard" });
}
