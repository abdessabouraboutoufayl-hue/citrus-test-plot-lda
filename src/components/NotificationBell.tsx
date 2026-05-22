import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifApi, tokenStore } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => notifApi.list(),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // SSE â€” replaces supabase.channel("notifications-realtime")
  useEffect(() => {
    if (!user) return;

    const token = tokenStore.get();
    if (!token) return;

    // EventSource doesn't support custom headers; pass token as query param
    const url = `${notifApi.streamUrl()}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        // New notification INSERT or init â†’ invalidate query
        if (payload.type === 'new_notification' || payload.type === 'init') {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; no manual retry needed
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [user?.id, queryClient]);

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notifApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notifApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => markAllReadMutation.mutate()}
            >
              Tout marquer lu
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                  !n.isRead ? "bg-primary/5" : ""
                }`}
                onClick={() => {
                  if (!n.isRead) markAsReadMutation.mutate(n.id);
                }}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && (
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.titre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

