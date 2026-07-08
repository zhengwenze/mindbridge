export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-xl rounded border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">MindBridge Frontend</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">前端工程已初始化</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          当前阶段只包含 Next.js、TypeScript、Ant Design、Tailwind CSS、React Query 和 Zustand 基础配置。
        </p>
      </section>
    </main>
  );
}
