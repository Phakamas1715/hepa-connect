import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Bot, Cable, ClipboardList, LayoutDashboard, Moon, Network, Sun, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { HEPA_PROJECT_CONFIG } from "@/lib/hepa-data";

const items = [
  { title: "แดชบอร์ดผู้บริหาร", url: "/", icon: LayoutDashboard, desc: "KPI และ care cascade" },
  { title: "ทะเบียน Care Gap", url: "/patients", icon: Users, desc: "จัดลำดับการติดตาม" },
  { title: "HEPA Agent", url: "/agent", icon: Bot, desc: "LINE invite และ audit log" },
  { title: "รายงาน ILI", url: "/ili-report", icon: ClipboardList, desc: "D506 จันทร์-อังคาร" },
  { title: "สถาปัตยกรรมระบบ", url: "/architecture", icon: Network, desc: "Data Flow และ Closed Loop" },
  { title: "เชื่อมต่อ MOPH", url: "/integration", icon: Cable, desc: "สถานะระบบเชื่อมต่อ" },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const closeMobileMenu = () => {
    if (isMobile) setOpenMobile(false);
  };

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-medical shadow-lg shadow-black/10">
            <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">HEPA-GLUE Engine</div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">Nam Phong Clinical Dashboard</div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={closeMobileMenu}
            className="h-8 w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent md:hidden"
            aria-label="ปิดเมนู"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>ศูนย์ปฏิบัติการ</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="h-12">
                      <Link to={item.url} onClick={closeMobileMenu} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                          <div className="truncate text-sm font-medium">{item.title}</div>
                          <div className="truncate text-[11px] text-sidebar-foreground/60">{item.desc}</div>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="mx-2 my-2 rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-3 group-data-[collapsible=icon]:p-1">
          <div className="mb-3 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs font-semibold text-sidebar-foreground">Production status</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-sidebar-foreground/65">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              ตรวจสอบก่อนส่งข้อมูล
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs font-medium text-sidebar-foreground">
              {HEPA_PROJECT_CONFIG.hospitalName.replace("โรงพยาบาล", "รพ.")} · ปีงบ {HEPA_PROJECT_CONFIG.fiscalYear}
            </div>
            <div className="truncate text-[10px] text-sidebar-foreground/60">รหัสหน่วยบริการ {HEPA_PROJECT_CONFIG.hospitalCode}</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleDark}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="สลับโหมดสี"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
