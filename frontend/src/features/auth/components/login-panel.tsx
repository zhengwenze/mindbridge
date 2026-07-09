"use client";

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { toApiError } from "@/lib/api/api-error";
import {
  getDefaultWorkspacePath,
  resolvePostLoginPath,
} from "@/lib/auth/routing";
import { useAuthStore } from "@/stores/use-auth-store";

import { loginWithBasicAuth, registerStudent } from "../api/auth-api";

interface LoginFormValues {
  username: string;
  displayName?: string;
  password: string;
  confirmPassword?: string;
}

export function LoginPanel() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const profile = useAuthStore((state) => state.profile);
  const setSession = useAuthStore((state) => state.setSession);
  const [form] = Form.useForm<LoginFormValues>();
  const [mode, setMode] = useState<"login" | "register">("login");
  const { message } = App.useApp();
  const loginMutation = useMutation({
    mutationFn: loginWithBasicAuth,
    onSuccess: (session) => {
      setSession(session);
      message.success("登录成功");
      const params = new URLSearchParams(window.location.search);
      router.replace(
        resolvePostLoginPath(session.profile, params.get("redirect")),
      );
    },
    onError: (error) => {
      const apiError = toApiError(error);
      message.error(apiError.message || "登录失败");
    },
  });
  const registerMutation = useMutation({
    mutationFn: registerStudent,
    onSuccess: (session) => {
      setSession(session);
      message.success("注册成功");
      router.replace(resolvePostLoginPath(session.profile, null));
    },
    onError: (error) => {
      const apiError = toApiError(error);
      message.error(apiError.message || "注册失败");
    },
  });

  useEffect(() => {
    if (status === "authenticated" && profile) {
      router.replace(getDefaultWorkspacePath(profile));
    }
  }, [profile, router, status]);

  async function handleSubmit(values: LoginFormValues) {
    const username = values.username.trim();
    if (mode === "login") {
      loginMutation.mutate({ username, password: values.password });
      return;
    }

    registerMutation.mutate({
      username,
      password: values.password,
      displayName: values.displayName,
    });
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    form.setFieldsValue({ confirmPassword: undefined });
  }

  const isLoginMode = mode === "login";
  const isSubmitting = loginMutation.isPending || registerMutation.isPending;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <Card
        className="w-full max-w-[420px] shadow-sm"
        variant="borderless"
        classNames={{ body: "!px-8 !py-9" }}
      >
        <div className="mb-8">
          <Typography.Title
            level={2}
            className="!m-0 !text-[28px] !font-semibold !text-slate-950"
          >
            MindBridge
          </Typography.Title>
        </div>

        <Form<LoginFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, message: "用户名至少 3 位" },
              { max: 32, message: "用户名最多 32 位" },
              {
                pattern: /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/,
                message: "用户名只能包含字母、数字、下划线、点或短横线",
              },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              autoComplete="username"
              placeholder="请输入用户名"
              variant="underlined"
              size="large"
            />
          </Form.Item>

          {!isLoginMode ? (
            <Form.Item
              label="显示名"
              name="displayName"
              rules={[{ max: 64, message: "显示名最多 64 位" }]}
            >
              <Input
                prefix={<UserOutlined />}
                autoComplete="name"
                placeholder="请输入显示名"
                variant="underlined"
                size="large"
                maxLength={64}
              />
            </Form.Item>
          ) : null}

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              ...(!isLoginMode ? [{ min: 6, message: "密码至少 6 位" }] : []),
              { max: 64, message: "密码最多 64 位" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="current-password"
              placeholder="请输入密码"
              variant="underlined"
              size="large"
            />
          </Form.Item>

          {!isLoginMode ? (
            <Form.Item
              label="确认密码"
              name="confirmPassword"
              dependencies={["password"]}
              rules={[
                { required: true, message: "请再次输入密码" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("两次输入的密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                autoComplete="new-password"
                placeholder="请再次输入密码"
                variant="underlined"
                size="large"
              />
            </Form.Item>
          ) : null}

          <div className="mt-8">
            {isLoginMode ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loginMutation.isPending}
                  className="!border-blue-600 !bg-blue-600 !font-medium hover:!border-blue-700 hover:!bg-blue-700"
                >
                  登录
                </Button>
                <Button
                  htmlType="button"
                  size="large"
                  disabled={isSubmitting}
                  onClick={() => switchMode("register")}
                  className="!bg-white !font-medium"
                >
                  注册
                </Button>
              </div>
            ) : (
              <div className="flex justify-center">
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={registerMutation.isPending}
                  className="!w-full !max-w-xs !border-blue-600 !bg-blue-600 !font-medium hover:!border-blue-700 hover:!bg-blue-700"
                >
                  注册
                </Button>
              </div>
            )}
          </div>
        </Form>
      </Card>
    </main>
  );
}
