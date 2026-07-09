import Link from "next/link";

import { routes } from "@/lib/config/routes";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-lg rounded border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-medium text-slate-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          页面不存在
        </h1>
        <p className="mt-2 text-sm text-slate-500">请检查访问地址是否正确。</p>
        <Link
          className="mt-5 inline-flex rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
          href={routes.login}
        >
          返回登录页
        </Link>
      </section>
    </main>
  );
}
