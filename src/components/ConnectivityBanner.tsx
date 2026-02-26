import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WifiOff, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "api-error" | "recovering";

const ConnectivityBanner = () => {
  const [status, setStatus] = useState<Status>("online");
  const [checking, setChecking] = useState(false);

  const checkConnectivity = async () => {
    setChecking(true);

    // Check browser online status first
    if (!navigator.onLine) {
      setStatus("offline");
      setChecking(false);
      return;
    }

    try {
      // Lightweight query to check API connectivity
      const { error } = await supabase
        .from("requirements")
        .select("id", { count: "exact", head: true });

      if (error) {
        setStatus("api-error");
      } else {
        setStatus((prev) => (prev !== "online" ? "recovering" : "online"));
      }
    } catch {
      setStatus("api-error");
    } finally {
      setChecking(false);
    }
  };

  // Listen for browser online/offline events
  useEffect(() => {
    const goOffline = () => setStatus("offline");
    const goOnline = () => {
      setStatus("recovering");
      checkConnectivity();
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Initial check
    checkConnectivity();

    // Periodic health check every 30s
    const interval = setInterval(checkConnectivity, 30000);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      clearInterval(interval);
    };
  }, []);

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
