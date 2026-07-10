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
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10">
      <Card
        className="w-full max-w-[420px] !rounded-2xl !border-slate-200 shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
        variant="outlined"
        classNames={{ body: "!px-8 !py-9 sm:!px-10" }}
      >
        <div className="mb-8 text-center">
          <Typography.Title
            level={2}
            className="!m-0 !text-[30px] !font-semibold !tracking-[-0.03em] !text-slate-950"
          >
            MindBridge
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0 !mt-2">
            {isLoginMode ? "登录后继续你的心理支持之旅" : "创建账号，开始使用 MindBridge"}
          </Typography.Paragraph>
        </div>

        <div className="mb-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          {(["login", "register"] as const).map((tab) => {
            const active = mode === tab;
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                disabled={isSubmitting}
                onClick={() => switchMode(tab)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab === "login" ? "登录" : "注册"}
              </button>
            );
          })}
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
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoginMode ? loginMutation.isPending : registerMutation.isPending}
              className="!h-11 !w-full !rounded-xl !border-blue-600 !bg-blue-600 !font-medium hover:!border-blue-700 hover:!bg-blue-700"
            >
              {isLoginMode ? "登录" : "创建账号"}
            </Button>
          </div>
        </Form>
      </Card>
    </main>
  );
}
