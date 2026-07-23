"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Radio,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";

import { toApiError } from "@/lib/api/api-error";

import {
  useAgentRuntimeConfig,
  useAgentRuntimeUpdate,
} from "../hooks/use-agent-runtime";
import type {
  AgentRuntimeFramework,
  AgentRuntimeOption,
} from "../types/admin-types";

const frameworkLabels: Record<AgentRuntimeFramework, string> = {
  event_driven_multi_agent: "事件驱动多智能体",
  langgraph: "LangGraph",
  custom: "Custom",
};

function RuntimeOption({
  option,
}: {
  option: AgentRuntimeOption;
}) {
  return (
    <Radio
      value={option.value}
      disabled={!option.available}
      className="!flex !items-start !py-2"
    >
      <span className="ml-1 inline-flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <Typography.Text strong>
            {option.label || frameworkLabels[option.value]}
          </Typography.Text>
          {option.value === "langgraph" ? <Tag color="blue">默认</Tag> : null}
          {option.value === "custom" ? <Tag color="warning">基础 / 应急方式</Tag> : null}
          {!option.available ? <Tag>当前不可用</Tag> : null}
        </span>
        <Typography.Text type="secondary" className="!text-[13px]">
          {option.description}
          {!option.available ? "（请检查后端依赖后重试）" : ""}
        </Typography.Text>
      </span>
    </Radio>
  );
}

export function AgentRuntimeSwitchPanel() {
  const { message, modal } = App.useApp();
  const configQuery = useAgentRuntimeConfig();
  const updateMutation = useAgentRuntimeUpdate();
  const [selectedFramework, setSelectedFramework] =
    useState<AgentRuntimeFramework | null>(null);

  const config = configQuery.data;

  useEffect(() => {
    if (config) {
      setSelectedFramework(config.currentFramework);
    }
  }, [config]);

  if (configQuery.isLoading) {
    return (
      <Card title="Agent 主运行方式" variant="outlined">
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }

  if (configQuery.isError || !config) {
    return (
      <Card title="Agent 主运行方式" variant="outlined">
        <Alert
          type="error"
          showIcon
          title="运行配置读取失败"
          description={toApiError(configQuery.error).message}
          action={
            <Button
              onClick={() => configQuery.refetch()}
              loading={configQuery.isFetching}
            >
              重试
            </Button>
          }
        />
      </Card>
    );
  }

  const selectedOption = config.options.find(
    (option) => option.value === selectedFramework,
  );
  const hasChanged =
    selectedFramework !== null &&
    selectedFramework !== config.currentFramework;
  const canSubmit =
    hasChanged && Boolean(selectedOption?.available) && !updateMutation.isPending;

  function submitChange() {
    const currentFramework = configQuery.data?.currentFramework;
    if (!selectedFramework || !canSubmit || !currentFramework) {
      return;
    }

    const isCustom = selectedFramework === "custom";
    modal.confirm({
      title: isCustom ? "确认切换为 Custom？" : "确认切换主运行方式？",
      content: (
        <div className="grid gap-2">
          <Typography.Text>
            将主运行方式切换为
            <Typography.Text strong>
              {` ${selectedOption?.label || frameworkLabels[selectedFramework]} `}
            </Typography.Text>
            。
          </Typography.Text>
          <Typography.Text type="secondary">
            从下一轮新对话生效，当前流式回复不受影响。
          </Typography.Text>
          {isCustom ? (
            <Typography.Text type="warning">
              Custom 是基础应急方式，建议仅在排障或验证时使用。
            </Typography.Text>
          ) : null}
        </div>
      ),
      okText: "应用切换",
      cancelText: "取消",
      onOk: async () => {
        try {
          await updateMutation.mutateAsync({ framework: selectedFramework });
          message.success(
            `主运行方式已切换为 ${selectedOption?.label || frameworkLabels[selectedFramework]}`,
          );
        } catch (error) {
          setSelectedFramework(currentFramework);
          message.error(toApiError(error).message || "运行方式切换失败");
        }
      },
    });
  }

  return (
    <Card title="Agent 主运行方式" variant="outlined">
      <div className="grid gap-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Typography.Text type="secondary">当前主运行方式</Typography.Text>
            <div className="mt-1">
              <Tag color="success">
                {frameworkLabels[config.currentFramework] ??
                  config.currentFramework}
                · 已选择
              </Tag>
            </div>
          </div>
          <div>
            <Typography.Text type="secondary">默认方式</Typography.Text>
            <div className="mt-1">
              <Tag color="blue">
                {frameworkLabels[config.defaultFramework]}
              </Tag>
            </div>
          </div>
        </div>

        <Alert
          type="info"
          showIcon
          title="配置仅在当前后端进程内生效"
          description="服务重启后将恢复启动配置；未指定启动配置时使用 LangGraph。"
        />

        {config.activeFramework !== config.currentFramework ? (
          <Alert
            type="warning"
            showIcon
            title="所选运行方式当前未实际启用"
            description={`当前实际运行方式为 ${frameworkLabels[config.activeFramework] ?? config.activeFramework}，请检查目标运行方式的依赖状态。`}
          />
        ) : null}

        <Radio.Group
          value={selectedFramework}
          onChange={(event) =>
            setSelectedFramework(event.target.value as AgentRuntimeFramework)
          }
          className="grid gap-1"
          aria-label="选择 Agent 主运行方式"
        >
          {config.options.map((option) => (
            <RuntimeOption key={option.value} option={option} />
          ))}
        </Radio.Group>

        <div>
          <Button
            type="primary"
            disabled={!canSubmit}
            loading={updateMutation.isPending}
            onClick={submitChange}
          >
            应用切换
          </Button>
        </div>
      </div>
    </Card>
  );
}
