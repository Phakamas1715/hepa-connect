import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppSidebar } from "@/components/app-sidebar";
import { OfficialFooter, OFFICIAL_META } from "@/components/official-layout";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">ไม่พบหน้านี้</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          หน้าที่ต้องการไม่มีอยู่ หรือถูกย้ายไปแล้ว
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            กลับแดชบอร์ด
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          โหลดหน้านี้ไม่สำเร็จ
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ระบบขัดข้องชั่วคราว ลองโหลดใหม่หรือกลับไปหน้าแดชบอร์ด
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            ลองใหม่
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            กลับแดชบอร์ด
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HEPA-GLUE Engine — ระบบกำจัดไวรัสตับอักเสบ น้ำพอง" },
      {
        name: "description",
        content:
          "ศูนย์บัญชาการงานไวรัสตับอักเสบ B/C อำเภอน้ำพอง: KPI ทะเบียนติดตาม LINE และรายงาน MOPH",
      },
      { name: "author", content: "โรงพยาบาลน้ำพอง" },
      { property: "og:title", content: "HEPA-GLUE Engine" },
      {
        property: "og:description",
        content: "ศูนย์บัญชาการงานไวรัสตับอักเสบ B/C อำเภอน้ำพอง",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
      <Toaster />
    </QueryClientProvider>
  );
}

function AppLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname.startsWith("/line/")) {
    return (
      <main className="min-h-screen bg-background">
        <Outlet />
      </main>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="official-app-header flex min-h-14 flex-wrap items-center gap-3 px-4 py-2">
          <SidebarTrigger className="h-9 w-9 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-foreground">{OFFICIAL_META.system}</span>
              <Badge variant="outline" className="hidden h-5 rounded-md text-[10px] sm:inline-flex">
                {OFFICIAL_META.ministry}
              </Badge>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {OFFICIAL_META.hospital} · {OFFICIAL_META.program} · {OFFICIAL_META.fiscalYear}
            </p>
          </div>
          <Badge className="hidden rounded-md bg-primary/10 text-[10px] text-primary hover:bg-primary/10 md:inline-flex">
            นวัตกรรมดิจิทัลสุขภาพ
          </Badge>
        </header>
        <main className="min-w-0 flex-1">
          <Outlet />
          <OfficialFooter />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
