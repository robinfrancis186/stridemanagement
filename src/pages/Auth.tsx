import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";
import { clearCorruptAuthTokenKeys, clearSupabaseStorageKeys } from "@/lib/authStorage";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    clearCorruptAuthTokenKeys();
  }, []);

  const recoverFromFetchFailure = async () => {
    clearSupabaseStorageKeys();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  };

  const withAuthRecovery = async <T,>(request: () => Promise<T>): Promise<T> => {
    try {
      return await request();
    } catch (error: any) {
      if (error?.message === "Failed to fetch") {
        await recoverFromFetchFailure();
        await new Promise((resolve) => setTimeout(resolve, 200));
        return await request();
      }
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await withAuthRecovery(() =>
          supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          })
        );
        if (error) throw error;

        toast({
          title: "Check your email",
          description: "We sent a password reset link to your email address.",
        });
        setMode("login");
      } else if (mode === "login") {
        const { error } = await withAuthRecovery(() =>
          supabase.auth.signInWithPassword({ email, password })
        );
        if (error) throw error;
        navigate("/");
      } else {
        const { data, error } = await withAuthRecovery(() =>
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: window.location.origin,
            },
          })
        );
        if (error) throw error;

        if (!data.user) {
          toast({
            title: "Account creation failed",
            description: "Please try again.",
            variant: "destructive",
          });
          return;
        }

        if (!data.session) {
          toast({
            title: "Account created",
            description: "Please verify your email before signing in.",
          });
          setMode("login");
          return;
        }

        const { error: profileError } = await supabase.from("profiles").insert({
          user_id: data.user.id,
          full_name: fullName,
        });

        if (profileError) {
          console.warn("Profile creation skipped:", profileError.message);
        }

        const { count, error: countError } = await supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true });

        if (!countError && count === 0) {
          const { error: roleError } = await supabase.from("user_roles").insert({
            user_id: data.user.id,
            role: "coe_admin",
          });

          if (!roleError) {
            toast({
              title: "Admin account created",
              description: "You've been assigned as the first COE Admin.",
            });
          }
        } else {
          toast({
            title: "Account created",
            description: "Your account is ready. An admin can assign your role.",
          });
        }

        navigate("/");
      }
    } catch (error: any) {
      const rawMessage = error?.message || "";
      const isNetworkIssue =
        rawMessage === "Failed to fetch" ||
        rawMessage === "Load failed" ||
        /network/i.test(rawMessage);

      if (isNetworkIssue) {
        await recoverFromFetchFailure();
      }

      toast({
        title: "Error",
        description: isNetworkIssue
          ? "Network error — we reset your session locally. Please try again."
          : rawMessage || "An error occurred",
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

              {mode === "login" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const { error } = await withAuthRecovery(() =>
                        supabase.auth.signInWithPassword({
                          email: "demo@stride-coe.com",
                          password: "demo1234",
                        })
                      );
                      if (error) throw error;
                      navigate("/");
                    } catch (error: any) {
                      toast({
                        title: "Demo login failed",
                        description: error?.message || "Could not sign in with demo account. It may not exist yet.",
                        variant: "destructive",
                      });
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Try Demo
                </Button>
              )}
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

