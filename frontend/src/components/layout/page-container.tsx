import { Breadcrumb, Typography } from "antd";

interface PageContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function PageContainer({ title, description, children }: PageContainerProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5">
        <Breadcrumb
          className="mb-3"
          items={[
            {
              title: "MindBridge"
            },
            {
              title
            }
          ]}
        />
        <Typography.Title level={2} className="!mb-1 !text-[24px]">
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Paragraph type="secondary" className="!mb-0">
            {description}
          </Typography.Paragraph>
        ) : null}
      </div>
      {children}
    </section>
  );
}
