interface AppLoadingProps {
  label?: string;
}

export function AppLoading({ label = "正在加载" }: AppLoadingProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="flex flex-col items-center gap-3 rounded border border-slate-200 bg-white px-8 py-7">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700" />
        <span className="text-sm text-slate-500">{label}</span>
      </div>
    </main>
  );
}
