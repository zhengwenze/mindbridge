"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser } from "../api/admin-api";
import type { AdminUserFilters, AdminUserUpdatePayload } from "../types/admin-types";

export const adminUserQueryKeys = {
  all: ["admin", "users"] as const,
  list: (filters: AdminUserFilters) => ["admin", "users", "list", filters] as const,
};

export function useAdminUsers(filters: AdminUserFilters) {
  return useQuery({ queryKey: adminUserQueryKeys.list(filters), queryFn: () => fetchAdminUsers(filters) });
}

export function useAdminUserActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: adminUserQueryKeys.all });
  return {
    createMutation: useMutation({ mutationFn: createAdminUser, onSuccess: refresh }),
    updateMutation: useMutation({ mutationFn: ({ id, payload }: { id: number; payload: AdminUserUpdatePayload }) => updateAdminUser(id, payload), onSuccess: refresh }),
    deleteMutation: useMutation({ mutationFn: deleteAdminUser, onSuccess: refresh }),
  };
}
