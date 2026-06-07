import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

export function usePermissions() {
  const { user, userInfo } = useAuth();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const perms = await adminApi.getPermissions(user.id);
      return perms
        .filter((p: any) => p.canView)
        .map((p: any) => p.menuKey as string);
    },
    enabled: !!user && userInfo.role !== "responsable_central",
  });

  const isCentral = userInfo.role === "responsable_central";

  const hasAccess = (submenuKey: string): boolean => {
    if (isCentral) return true;
    if (permissions.length === 0 && !isLoading) return true;
    return permissions.includes(submenuKey);
  };

  return { hasAccess, permissions, isLoading };
}
