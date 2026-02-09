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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className={`${maxWidth} w-full mx-auto`}>{children}</div>
    </div>
  );
}
