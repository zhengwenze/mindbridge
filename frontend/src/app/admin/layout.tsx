import { AuthRouteGuard } from "@/components/auth-route-guard";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthRouteGuard allowedRole="admin">
      <AppShell workspace="admin">{children}</AppShell>
    </AuthRouteGuard>
  );
}
