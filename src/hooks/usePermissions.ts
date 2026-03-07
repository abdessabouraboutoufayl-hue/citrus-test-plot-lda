import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePermissions() {
  const { user, userInfo } = useAuth();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get user's permission profile id
      const { data: roles } = await supabase
        .from("user_roles")
        .select("permission_profile_id")
        .eq("user_id", user.id)
        .not("permission_profile_id", "is", null);
      
      const profileIds = (roles || [])
        .map(r => r.permission_profile_id)
        .filter(Boolean) as string[];

      if (profileIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profile_permissions")
        .select("submenu_key, can_access")
        .in("profile_id", profileIds)
        .eq("can_access", true);

      if (error) throw error;
      return data.map(p => p.submenu_key);
    },
    enabled: !!user,
  });

  const isCentral = userInfo.role === "responsable_central";

  const hasAccess = (submenuKey: string): boolean => {
    // responsable_central always has full access
    if (isCentral) return true;
    // If user has no profile assigned, grant full access (backward compat)
    if (permissions.length === 0 && !isLoading) return true;
    return permissions.includes(submenuKey);
  };

  return { hasAccess, permissions, isLoading };
}
