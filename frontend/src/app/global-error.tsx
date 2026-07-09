"use client";

import { useEffect } from "react";

import "./globals.css";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <section className="w-full max-w-lg rounded border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm font-medium text-slate-500">500</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">应用启动失败</h1>
            <p className="mt-2 text-sm text-slate-500">全局应用框架遇到异常，请重新加载。</p>
            <button
              className="mt-5 rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
              type="button"
              onClick={reset}
            >
              重新加载
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
