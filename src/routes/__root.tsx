import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "AI Agent Dashboard" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

// Inline script to prevent FOUC (Flash of Unstyled Content)
const themeScript = `
(function() {
  var theme = localStorage.getItem('theme');
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.classList.add(theme);
})();
`;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme-detection script to prevent FOUC — no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
