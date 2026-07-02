import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  Cable,
  ClipboardList,
  CalendarCheck,
  FlaskConical,
  Database,
  LayoutDashboard,
  Moon,
  Network,
  Sun,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { OFFICIAL_META } from "@/components/official-layout";
import { TARGET_REGISTRY_SOURCE } from "@/lib/hepa-data";

const items = [
  {
    title: "แดชบอร์ดผู้บริหาร",
    url: "/",
    icon: LayoutDashboard,
    desc: "ตัวชี้วัดและผลงานรายพื้นที่",
  },
  {
    title: "ทะเบียนผู้ป่วยค้างติดตาม",
    url: "/patients",
    icon: Users,
    desc: "รายชื่อและสถานะการดูแล",
  },
  {
    title: "คิวจองคัดกรอง",
    url: "/screening-queue",
    icon: CalendarCheck,
    desc: "ประชาชนลงทะเบียนผ่าน LINE",
  },
  {
    title: "ผู้พบเชื้อจาก LINE",
    url: "/positive-intake",
    icon: UserCheck,
    desc: "ตรวจสอบและติดตามผู้แจ้งผล",
  },
  {
    title: "นัดหมายและติดตาม",
    url: "/agent",
    icon: Bot,
    desc: "บัตรนัดและข้อความผ่าน LINE",
  },
  {
    title: "ตรวจสอบความพร้อมระบบ",
    url: "/agent-bench",
    icon: FlaskConical,
    desc: "ทดสอบการเชื่อมต่อและข้อมูล",
  },
  {
    title: "รายงานไข้หวัดใหญ่",
    url: "/ili-report",
    icon: ClipboardList,
    desc: "แบบฟอร์ม D506 รายสัปดาห์",
  },
  {
    title: "สถาปัตยกรรมระบบ",
    url: "/architecture",
    icon: Network,
    desc: "เส้นทางข้อมูลและจุดตรวจสอบ",
  },
  {
    title: "เชื่อมโยงรายงาน สธ.",
    url: "/integration",
    icon: Cable,
    desc: "สถานะเชื่อมต่อและรายงาน",
  },
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
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/10 bg-primary shadow-sm group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9">
            <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              {OFFICIAL_META.hospital}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-sidebar-foreground/60">
              {OFFICIAL_META.system}
            </div>
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

      <SidebarContent className="px-2 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      size="lg"
                      tooltip={item.title}
                      className="h-12 rounded-lg px-3 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm hover:bg-sidebar-accent/80 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9"
                    >
                      <Link
                        to={item.url}
                        onClick={closeMobileMenu}
                        className="flex items-center gap-3"
                      >
                        <item.icon className="h-4.5 w-4.5 shrink-0" />
                        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                          <div className="truncate text-sm font-medium">{item.title}</div>
                          <div
                            className={`truncate text-[11px] ${
                              active
                                ? "text-sidebar-primary-foreground/75"
                                : "text-sidebar-foreground/55"
                            }`}
                          >
                            {item.desc}
                          </div>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4 p-0 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            แหล่งข้อมูล
          </SidebarGroupLabel>
          <div className="mx-1 rounded-lg border border-sidebar-border bg-sidebar-accent/35 p-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar-primary/15 text-sidebar-primary">
                <Database className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-sidebar-foreground">
                  {TARGET_REGISTRY_SOURCE.label}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-sidebar-foreground/60">
                  แดชบอร์ดและทะเบียนติดตามใช้รายชื่อชุดเดียวกัน
                </div>
                <Badge className="mt-2 h-5 border-sidebar-primary/30 bg-sidebar-primary/15 px-1.5 text-[10px] text-sidebar-primary hover:bg-sidebar-primary/15">
                  แหล่งข้อมูลหลักของระบบ
                </Badge>
              </div>
            </div>
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs font-medium text-sidebar-foreground">
              {OFFICIAL_META.fiscalYear}
            </div>
            <div className="truncate text-[10px] text-sidebar-foreground/60">
              {OFFICIAL_META.unitCode}
            </div>
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
      </SidebarFooter>
    </Sidebar>
  );
}
