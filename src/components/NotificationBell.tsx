import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, updateDoc, doc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  requirement_id: string | null;
  created_at: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const isDemoUser = user?.uid === DEMO_USER_ID;

  const fetchNotifications = async () => {
    if (!user || isDemoUser) return;
    try {
      const snap = await getDocs(query(
        collection(db, "notifications"),
        where("user_id", "==", user.uid),
        orderBy("created_at", "desc"),
        limit(20)
      ));
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Notification[]);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    if (isDemoUser) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user, isDemoUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!user || isDemoUser) return;
    const snap = await getDocs(query(collection(db, "notifications"), where("user_id", "==", user.uid), where("read", "==", false)));
    await Promise.all(snap.docs.map(d => updateDoc(doc(db, "notifications", d.id), { read: true })));
    fetchNotifications();
  };

  const handleClick = (n: Notification) => {
    if (n.requirement_id) {
      navigate(`/requirements/${n.requirement_id}`);
      setOpen(false);
    }
    if (!n.read) {
      updateDoc(doc(db, "notifications", n.id), { read: true }).then(() => fetchNotifications());
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" side="right">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-display font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`flex gap-3 p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                onClick={() => handleClick(n)}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.read ? "font-medium" : ""}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.read && <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
