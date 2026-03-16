export default function AppLoading() {
  return (
    <div className="container-shell flex min-h-screen items-center justify-center py-16">
      <div className="glass-panel flex w-full max-w-xl items-center gap-4 p-6 text-sm text-secondary-foreground">
        <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
        Loading today&apos;s execution stack...
      </div>
    </div>
  );
}
