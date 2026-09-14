"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "otp" | "verify-otp" | "forgot" | "reset";

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);

  function changeMode(next: Mode) {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(redirectTo);
        router.refresh();
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else if (mode === "otp") {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        if (error) throw error;
        setMode("verify-otp");
        toast.success("Verification code sent.");
      } else if (mode === "verify-otp") {
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
        if (error) throw error;
        router.replace(redirectTo);
        router.refresh();
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMode("reset");
        toast.success("Password reset code sent.");
      } else {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const { error: verificationError } = await supabase.auth.verifyOtp({ email, token: otp, type: "recovery" });
        if (verificationError) throw verificationError;
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        changeMode("signin");
        toast.success("Password updated. Sign in with your new password.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const needsOtp = mode === "verify-otp" || mode === "reset";
  const needsPassword = mode === "signin" || mode === "signup" || mode === "reset";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center">
            <Image src="/logo.jpg" alt="Dhofar Global" width={48} height={48} priority />
          </div>
          <CardTitle>Dhofar Global — Performance Hub</CardTitle>
          <CardDescription>{descriptionFor(mode, email)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" autoComplete="email" required disabled={needsOtp} value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            {needsOtp && (
              <div className="grid gap-2">
                <Label htmlFor="otp">6-digit verification code</Label>
                <Input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} />
              </div>
            )}

            {needsPassword && (
              <div className="grid gap-2">
                <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
                <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
            )}

            {mode === "reset" && (
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {submitLabel(mode)}
            </Button>

            {(mode === "verify-otp" || mode === "reset") && (
              <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => changeMode(mode === "reset" ? "forgot" : "otp")}>
                Use a different email or resend the code
              </button>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              {mode === "signin" ? (
                <>
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => changeMode("signup")}>Need an account?</button>
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => changeMode("forgot")}>Forgot password?</button>
                  <button type="button" className="w-full underline-offset-2 hover:underline" onClick={() => changeMode("otp")}>Sign in with a verification code</button>
                </>
              ) : (
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => changeMode("signin")}>Back to sign in</button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function descriptionFor(mode: Mode, email: string) {
  if (mode === "signup") return "Create your account";
  if (mode === "otp") return "Receive a one-time code by email";
  if (mode === "verify-otp") return `Enter the code sent to ${email}`;
  if (mode === "forgot") return "Enter your email to reset your password";
  if (mode === "reset") return `Enter the recovery code sent to ${email}`;
  return "Sign in to continue";
}

function submitLabel(mode: Mode) {
  if (mode === "signup") return "Create account";
  if (mode === "otp") return "Send verification code";
  if (mode === "verify-otp") return "Verify and sign in";
  if (mode === "forgot") return "Send password reset code";
  if (mode === "reset") return "Reset password";
  return "Sign in";
}
