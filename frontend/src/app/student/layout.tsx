import { AuthRouteGuard } from "@/components/auth-route-guard";
import { AppShell } from "@/components/layout/app-shell";

export default function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthRouteGuard allowedRole="student">
      <AppShell workspace="student">{children}</AppShell>
    </AuthRouteGuard>
  );
}
