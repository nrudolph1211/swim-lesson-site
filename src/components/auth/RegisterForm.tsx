"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Waves, Loader2, Gift } from "lucide-react";

function getPasswordStrength(password: string): {
  score: number;
  label: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 20, label: "Weak" };
  if (score === 2) return { score: 40, label: "Fair" };
  if (score === 3) return { score: 60, label: "Good" };
  if (score === 4) return { score: 80, label: "Strong" };
  return { score: 100, label: "Very Strong" };
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [hacMemberId, setHacMemberId] = useState("");
  const [isMilitary, setIsMilitary] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = "Full name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    if (!password) errors.password = "Password is required.";
    else if (password.length < 8)
      errors.password = "Password must be at least 8 characters.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validate()) return;

    setLoading(true);

    // 1. Sign up
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });

    if (signUpError) {
      console.error("SignUp error:", signUpError);
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Check if email confirmation is required (no session means unconfirmed)
    if (!data.session) {
      setError(
        "A confirmation email has been sent. Please check your inbox and confirm your email before signing in."
      );
      setLoading(false);
      return;
    }

    // 2. Update profile with extra fields
    const updates: Record<string, unknown> = {};
    if (phone.trim()) updates.phone = phone.trim();
    if (hacMemberId.trim()) updates.hac_member_id = hacMemberId.trim();
    if (isMilitary) updates.is_military = true;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from("profiles")
        .update(updates)
        .eq("id", data.user.id);
    }

    // 3. Handle referral code
    if (refCode) {
      await supabase
        .from("referrals")
        .update({
          referred_id: data.user.id,
          status: "signed_up",
        })
        .eq("referral_code", refCode)
        .eq("status", "pending");
    }

    // 4. Redirect
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Link href="/" className="mb-2 flex items-center gap-2">
            <Waves className="size-8 text-primary" />
            <span className="font-heading text-xl font-bold text-primary">
              HAC Swim
            </span>
          </Link>
          <h1 className="font-heading text-2xl font-bold">Create Account</h1>
          <p className="text-sm text-muted-foreground">
            Sign up to book swim lessons for your family
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {refCode && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                <Gift className="size-4 shrink-0" />
                <span>
                  You were referred! Sign up and get <strong>$25 off</strong> your first enrollment.
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
              {fieldErrors.fullName && (
                <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="regEmail">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="regEmail"
                type="email"
                placeholder="parent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(254) 555-0123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="regPassword">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="regPassword"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="space-y-1">
                  <Progress value={strength.score} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    Strength: {strength.label}
                  </p>
                </div>
              )}
              {fieldErrors.password && (
                <p className="text-xs text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* HAC Member ID */}
            <div className="space-y-2">
              <Label htmlFor="hacId">HAC Member ID</Label>
              <Input
                id="hacId"
                type="text"
                placeholder="HAC-12345"
                value={hacMemberId}
                onChange={(e) => setHacMemberId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your HAC membership number for member pricing
              </p>
            </div>

            {/* Military */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="military"
                checked={isMilitary}
                onCheckedChange={(checked) =>
                  setIsMilitary(checked === true)
                }
                className="mt-0.5"
              />
              <Label htmlFor="military" className="text-sm leading-snug">
                I am active duty military or a dependent stationed at Fort
                Cavazos
              </Label>
            </div>

            {/* Hidden referral code */}
            {refCode && <input type="hidden" name="ref" value={refCode} />}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create Account
            </Button>
          </CardContent>
        </form>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-accent hover:underline"
            >
              Sign In
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
