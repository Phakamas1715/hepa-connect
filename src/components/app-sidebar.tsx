import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Cable, Activity, Moon, Sun } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Executive Dashboard", url: "/", icon: LayoutDashboard, desc: "KPIs & Care Cascade" },
  { title: "Patient Care Gap", url: "/patients", icon: Users, desc: "Behavioral AI Command" },
  { title: "MOPH Integration", url: "/integration", icon: Cable, desc: "API & Auto-Reporting" },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-medical shadow-lg">
            <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              HEPA-GLUE Engine
            </div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">
              Nam Phong • Khon Kaen
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-start gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                          <div className="truncate text-sm font-medium">{item.title}</div>
                          <div className="truncate text-[11px] text-sidebar-foreground/60">
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
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-2 py-1 group-data-[collapsible=icon]:flex-col">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs font-medium text-sidebar-foreground">รพ.น้ำพอง • FY2569</div>
            <div className="truncate text-[10px] text-sidebar-foreground/60">Code 11000</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleDark}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
