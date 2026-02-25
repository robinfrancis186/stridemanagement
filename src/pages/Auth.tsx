import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Clear stale tokens on mount to prevent retry storms
  useState(() => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach(k => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (!parsed?.access_token || !parsed?.refresh_token || parsed.refresh_token.length < 20) {
              localStorage.removeItem(k);
            }
          }
        });
    } catch { /* ignore */ }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "We sent a password reset link to your email address.",
        });
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (data.user) {
          await supabase.from("profiles").insert({
            user_id: data.user.id,
            full_name: fullName,
          });

          const { count } = await supabase
            .from("user_roles")
            .select("*", { count: "exact", head: true });

          if (count === 0) {
            await supabase.from("user_roles").insert({
              user_id: data.user.id,
              role: "coe_admin",
            });
            toast({
              title: "Admin account created",
              description: "You've been assigned as the first COE Admin.",
            });
          } else {
            toast({
              title: "Account created",
              description: "Your account is ready. An admin can assign your role.",
            });
          }
          navigate("/");
        }
      }
    } catch (error: any) {
      const msg = error?.message === "Failed to fetch"
        ? "Network error — please check your connection and try again."
        : error?.message || "An error occurred";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl gradient-primary shadow-elevated">
            <Zap className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            STRIDE COE
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assistive Device Workflow Management
          </p>
        </div>

        <Card className="shadow-elevated border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl">
              {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to access the dashboard"
                : mode === "signup"
                ? "Register for a new COE account"
                : "Enter your email to receive a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@organization.com"
                  required
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Sign In"
                  : mode === "signup"
                  ? "Create Account"
                  : "Send Reset Link"}
              </Button>
            </form>
            <div className="mt-4 space-y-2 text-center text-sm">
              {mode === "login" && (
                <button
                  type="button"
                  className="block w-full text-muted-foreground hover:text-primary hover:underline"
                  onClick={() => setMode("forgot")}
                >
                  Forgot your password?
                </button>
              )}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode(mode === "signup" ? "login" : mode === "login" ? "signup" : "login")}
              >
                {mode === "signup"
                  ? "Already have an account? Sign in"
                  : mode === "login"
                  ? "Need an account? Sign up"
                  : "Back to sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
