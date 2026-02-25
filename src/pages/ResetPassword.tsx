import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [isRecoveryValid, setIsRecoveryValid] = useState(false);

  const hashParams = useMemo(
    () => new URLSearchParams(window.location.hash.replace(/^#/, "")),
    []
  );

  useEffect(() => {
    let unmounted = false;

    const initializeRecoverySession = async () => {
      try {
        const type = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (type === "recovery" && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!unmounted) {
          setIsRecoveryValid(Boolean(session?.user));
        }
      } catch {
        if (!unmounted) {
          setIsRecoveryValid(false);
        }
      } finally {
        if (!unmounted) {
          setCheckingLink(false);
        }
      }
    };

    void initializeRecoverySession();

    return () => {
      unmounted = true;
    };
  }, [hashParams]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please re-enter both password fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });

      await supabase.auth.signOut().catch(() => {});
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast({
        title: "Could not reset password",
        description: error?.message || "Please request a new reset link.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60 shadow-elevated">
        <CardHeader>
          <CardTitle className="font-display text-xl">Set new password</CardTitle>
          <CardDescription>
            Choose a strong password to finish recovering your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingLink ? (
            <p className="text-sm text-muted-foreground">Validating reset link...</p>
          ) : isRecoveryValid ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or expired.
              </p>
              <Button className="w-full" onClick={() => navigate("/auth")}>Back to sign in</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
