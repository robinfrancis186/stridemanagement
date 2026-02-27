import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { confirmPasswordReset } from "firebase/auth";
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

  useEffect(() => {
    let unmounted = false;

    const initializeRecoverySession = () => {
      try {
        const queryParams = new URLSearchParams(window.location.search);
        const mode = queryParams.get("mode");
        const oobCode = queryParams.get("oobCode");

        if (mode === "resetPassword" && oobCode) {
          if (!unmounted) setIsRecoveryValid(true);
        } else {
          if (!unmounted) setIsRecoveryValid(false);
        }
      } catch {
        if (!unmounted) setIsRecoveryValid(false);
      } finally {
        if (!unmounted) setCheckingLink(false);
      }
    };

    initializeRecoverySession();

    return () => { unmounted = true; };
  }, []);

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
      const queryParams = new URLSearchParams(window.location.search);
      const oobCode = queryParams.get("oobCode");
      if (!oobCode) throw new Error("Missing reset code");

      await confirmPasswordReset(auth, oobCode, password);

      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });

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
