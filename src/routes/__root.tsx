import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { Activity, ShieldCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { HEPA_PROJECT_CONFIG } from "@/lib/hepa-data";

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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">โหลดหน้านี้ไม่สำเร็จ</h1>
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
      { title: `HEPA-GLUE Engine — ระบบกำจัดไวรัสตับอักเสบ ${HEPA_PROJECT_CONFIG.districtName.replace("อำเภอ", "")}` },
      {
        name: "description",
        content:
          `ระบบติดตามงานไวรัสตับอักเสบ B/C ${HEPA_PROJECT_CONFIG.districtName}: KPI, การติดตามผู้ป่วย และรายงาน MOPH`,
      },
      { name: "author", content: HEPA_PROJECT_CONFIG.hospitalName },
      { property: "og:title", content: "HEPA-GLUE Engine" },
      {
        property: "og:description",
        content: `ระบบติดตามงานไวรัสตับอักเสบ B/C ${HEPA_PROJECT_CONFIG.districtName}`,
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
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
          <SidebarTrigger />
          <div className="ml-1 flex min-w-0 flex-1 items-center gap-3">
            <div className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl border bg-card shadow-sm sm:grid">
              <Activity className="h-4 w-4 text-teal" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">HEPA-GLUE Engine</div>
              <div className="hidden truncate text-xs text-muted-foreground sm:block">
                ระบบติดตาม HBV/HCV {HEPA_PROJECT_CONFIG.districtName} · ปีงบ {HEPA_PROJECT_CONFIG.fiscalYear}
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm md:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-teal" />
            <span>ตรวจสอบก่อนใช้งานจริง</span>
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
