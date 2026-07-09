import Link from "next/link";

import { routes } from "@/lib/config/routes";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-xl rounded border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">MindBridge</p>
        <h1 className="mb-2 mt-2 text-2xl font-semibold text-slate-950">
          入口
        </h1>
        <p className="text-sm leading-6 text-slate-600">前端已就绪，请登录</p>
        <Link
          className="mt-5 inline-flex rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
          href={routes.login}
        >
          进入登录页
        </Link>
      </section>
    </main>
  );
}
