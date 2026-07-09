"use client";

import { Alert, Card, Typography } from "antd";

import { getProfileRole } from "@/lib/auth/permissions";
import { useAuthStore } from "@/stores/use-auth-store";

import { PageContainer } from "./layout/page-container";

interface WorkspacePlaceholderProps {
  title: string;
  description: string;
}

export function WorkspacePlaceholder({ title, description }: WorkspacePlaceholderProps) {
  const profile = useAuthStore((state) => state.profile);
  const role = getProfileRole(profile);

  return (
    <PageContainer title={title} description={description}>
      <Card variant="outlined">
        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div>
            <Typography.Title level={4} className="!mb-2">
              基础应用框架已就绪
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-0">
              当前页面只用于验证全局 Header、Sidebar、PageContainer 和路由守卫，后续再接入具体业务模块。
            </Typography.Paragraph>
          </div>
          <Alert
            type="info"
            showIcon
            title="当前会话"
            description={`用户：${profile?.displayName ?? profile?.username ?? "未知"}；角色：${
              role === "admin" ? "管理员" : "学生"
            }`}
          />
        </div>
      </Card>
    </PageContainer>
  );
}
