/**
 * Standard padding wrapper for non-session dashboard routes.
 * Provides the padding + max-width that was previously on DashboardLayout's <main>.
 */
export function PageContainer({
  maxWidth = "max-w-7xl",
  children,
}: {
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:p-8 lg:pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className={`${maxWidth} w-full mx-auto`}>{children}</div>
    </div>
  );
}
