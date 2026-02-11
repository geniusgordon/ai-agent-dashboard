import { Button } from "@/components/ui/button";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { TRPCRouter } from "@/integrations/trpc/router";
import { Provider } from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
  trpc: TRPCOptionsProxy<TRPCRouter>;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "AI Agent Dashboard" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "theme-color", content: "#0a0a0a" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-6xl font-bold font-heading text-primary">
          404
        </h1>
        <p className="mt-4 text-lg font-body">
          Oops! The page you're looking for doesn't exist.
        </p>
        <p className="mt-2 text-sm font-body text-muted-foreground">
          It might have been moved or deleted.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link to="/">
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  ),
});

// Inline script to prevent FOUC (Flash of Unstyled Content) and register SW
const headScript = `
(function() {
  var theme = localStorage.getItem('theme');
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.classList.add(theme);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
})();
`;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static script for theme detection + SW registration — no user input */}
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body className="bg-background text-foreground">
        <Provider queryClient={queryClient}>
          <Outlet />
        </Provider>
        <Scripts />
      </body>
    </html>
  );
}
