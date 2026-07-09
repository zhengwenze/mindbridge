"use client";

import { Button, Result } from "antd";
import { useRouter } from "next/navigation";

import { getDefaultWorkspacePath } from "@/lib/auth/routing";
import { routes } from "@/lib/config/routes";
import { useAuthStore } from "@/stores/use-auth-store";
import { useLogout } from "@/features/auth/hooks/use-logout";

export function ForbiddenPanel() {
  const router = useRouter();
  const logout = useLogout();
  const profile = useAuthStore((state) => state.profile);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <Result
        status="403"
        title="无权访问"
        subTitle="当前账号没有访问该页面的权限。"
        extra={[
          <Button
            key="home"
            type="primary"
            onClick={() => router.replace(profile ? getDefaultWorkspacePath(profile) : routes.login)}
          >
            返回工作台
          </Button>,
          <Button key="logout" onClick={logout}>
            退出登录
          </Button>
        ]}
      />
    </main>
  );
}
