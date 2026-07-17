import { PageContainer } from "@/components/layout/page-container";
import { DocumentManagementWorkspace } from "@/features/admin/components/document-management-workspace";

export default function AdminDocumentsRoute() {
  return (
    <PageContainer title="文档管理" hideHeader>
      <DocumentManagementWorkspace />
    </PageContainer>
  );
}
