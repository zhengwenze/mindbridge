"use client";

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { toApiError } from "@/lib/api/api-error";
import { getDefaultWorkspacePath, resolvePostLoginPath } from "@/lib/auth/routing";
import { useAuthStore } from "@/stores/use-auth-store";

import { loginWithBasicAuth } from "../api/auth-api";

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPanel() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const profile = useAuthStore((state) => state.profile);
  const setSession = useAuthStore((state) => state.setSession);
  const [form] = Form.useForm<LoginFormValues>();
  const { message } = App.useApp();
  const loginMutation = useMutation({
    mutationFn: loginWithBasicAuth,
    onSuccess: (session) => {
      setSession(session);
      message.success("登录成功");
      const params = new URLSearchParams(window.location.search);
      router.replace(resolvePostLoginPath(session.profile, params.get("redirect")));
    },
    onError: (error) => {
      const apiError = toApiError(error);
      message.error(apiError.message || "登录失败");
    }
  });

  useEffect(() => {
    if (status === "authenticated" && profile) {
      router.replace(getDefaultWorkspacePath(profile));
    }
  }, [profile, router, status]);

  async function handleSubmit(values: LoginFormValues) {
    loginMutation.mutate(values);
  }

  function handleRegister() {
    message.info("请联系管理员开通账号");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <Card
        className="w-full max-w-[420px] shadow-sm"
        variant="borderless"
        classNames={{ body: "!px-8 !py-9" }}
      >
        <div className="mb-8">
          <Typography.Title level={2} className="!m-0 !text-[28px] !font-semibold !text-slate-950">
            MindBridge
          </Typography.Title>
        </div>

        <Form<LoginFormValues> form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input
              prefix={<UserOutlined />}
              autoComplete="username"
              placeholder="请输入用户名"
              variant="underlined"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="current-password"
              placeholder="请输入密码"
              variant="underlined"
              size="large"
            />
          </Form.Item>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loginMutation.isPending}
              className="!border-blue-600 !bg-blue-600 !font-medium hover:!border-blue-700 hover:!bg-blue-700"
            >
              登录
            </Button>
            <Button size="large" onClick={handleRegister} className="!bg-white !font-medium">
              注册
            </Button>
          </div>
        </Form>
      </Card>
    </main>
  );
}
