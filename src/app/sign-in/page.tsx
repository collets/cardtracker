import { ShieldCheck } from "lucide-react";
import { signInForDevelopment, signInWithGoogle } from "@/app/sign-in/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const googleConfigured = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
  const devEnabled =
    process.env.AUTH_ENABLE_DEV_PROVIDER === "true" &&
    process.env.NODE_ENV !== "production";

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <Card className="w-full max-w-md border-white/10 bg-slate-950/70 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">Enter Riftwatch</CardTitle>
            <CardDescription className="mt-2">
              Sign in with an invited Google account to monitor Riftbound
              prices.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleConfigured ? (
            <form action={signInWithGoogle}>
              <Button className="w-full" type="submit">
                Continue with Google
              </Button>
            </form>
          ) : (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200">
              Google OAuth is not configured in this environment.
            </p>
          )}
          {devEnabled ? (
            <form
              action={signInForDevelopment}
              className="space-y-3 border-t border-white/10 pt-4"
            >
              <Input
                name="email"
                type="email"
                placeholder="Invited development email"
                required
              />
              <Button variant="secondary" className="w-full" type="submit">
                Development sign in
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
