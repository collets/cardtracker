"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function redeemGuestAccessAction(
  _previous: { error: string },
  formData: FormData,
) {
  try {
    await signIn("guest", {
      guestAccessToken: String(formData.get("guestAccessToken") ?? ""),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "This guest link is invalid, expired, revoked, or has already reached its visitor limit.",
      };
    }
    throw error;
  }
  return { error: "Guest access could not be started. Please retry." };
}
