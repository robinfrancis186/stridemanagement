import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WifiOff, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "api-error" | "recovering";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

const ConnectivityBanner = () => {
  const [status, setStatus] = useState<Status>("online");
  const [checking, setChecking] = useState(false);
  const consecutiveFailures = useRef(0);

  const checkConnectivity = useCallback(async () => {
    setChecking(true);

    if (!navigator.onLine) {
      consecutiveFailures.current = 2;
      setStatus("offline");
      setChecking(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const { error } = await supabase
        .from("requirements")
        .select("id")
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeout);

      if (error) {
        consecutiveFailures.current++;
      } else {
        consecutiveFailures.current = 0;
        setStatus((prev) => (prev !== "online" ? "recovering" : "online"));
      }
    } catch {
      consecutiveFailures.current++;
    } finally {
      // Only show error after 2 consecutive failures
      if (consecutiveFailures.current >= 2) {
        setStatus("api-error");
      }
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const goOffline = () => {
      consecutiveFailures.current = 2;
      setStatus("offline");
    };
    const goOnline = () => {
      setStatus("recovering");
      consecutiveFailures.current = 0;
      checkConnectivity();
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Initial check after 5s delay to not compete with page load
    const initialTimeout = setTimeout(checkConnectivity, 5000);

    // Periodic health check every 60s
    const interval = setInterval(checkConnectivity, 60000);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  // Auto-dismiss "recovering" after 2s
  useEffect(() => {
    if (status === "recovering") {
      const timeout = setTimeout(() => setStatus("online"), 2000);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  if (status === "online") return null;

  const config = {
    offline: {
      icon: WifiOff,
      message: "You are offline. Check your internet connection.",
      bg: "bg-destructive text-destructive-foreground",
    },
    "api-error": {
      icon: WifiOff,
      message: "Unable to connect to backend. Data may not load.",
      bg: "bg-warning text-warning-foreground",
    },
    recovering: {
      icon: Wifi,
      message: "Connection restored!",
      bg: "bg-success text-success-foreground",
    },
  }[status];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all animate-fade-in",
        config.bg
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{config.message}</span>
      {status !== "recovering" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs hover:bg-white/20"
          onClick={checkConnectivity}
          disabled={checking}
        >
          <RefreshCw className={cn("h-3 w-3 mr-1", checking && "animate-spin")} />
          Retry
        </Button>
      )}
    </div>
  );
};

export default ConnectivityBanner;
