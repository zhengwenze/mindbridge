import { PageContainer } from "@/components/layout/page-container";
import { AgentRuntimeSwitchPanel } from "@/features/admin/components/agent-runtime-switch-panel";

export default function AdminRuntimeRoute() {
  return (
    <PageContainer title="运行切换" hideHeader>
      <AgentRuntimeSwitchPanel />
    </PageContainer>
  );
}
