export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-semibold">
            8
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Octaflame OS</h1>
          <p className="text-sm text-muted-foreground">
            Operations Management System
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
