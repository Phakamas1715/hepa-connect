import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NAVIGATION_CATEGORIES } from "@/components/navigation-config";

export function ModuleLauncher({
  trigger,
  onNavigate,
}: {
  trigger: ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const categories = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("th");
    if (!keyword) return NAVIGATION_CATEGORIES;
    return NAVIGATION_CATEGORIES.map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.title.toLocaleLowerCase("th").includes(keyword) ||
          item.desc.toLocaleLowerCase("th").includes(keyword),
      ),
    })).filter((category) => category.items.length > 0);
  }, [query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/20 px-5 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <LayoutGrid className="h-5 w-5 text-primary" />
            เลือกงานที่ต้องการ
          </DialogTitle>
          <DialogDescription>
            โมดูลถูกจัดตามลักษณะงาน เลือกเพียงรายการเดียวเพื่อไปยังหน้าที่เกี่ยวข้อง
          </DialogDescription>
          <div className="relative pt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหา เช่น นัดหมาย คัดกรอง หรือรายงาน"
              className="bg-background pl-9"
            />
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            {categories.map((category) => (
              <section key={category.title}>
                <div className="mb-3">
                  <h2 className="text-sm font-bold text-foreground">{category.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items.map((item) => {
                    const active = pathname === item.url;
                    return (
                      <Link
                        key={item.url}
                        to={item.url}
                        onClick={() => {
                          setOpen(false);
                          onNavigate?.();
                        }}
                        className={`group flex min-h-24 items-start gap-3 rounded-xl border p-3.5 transition ${
                          active
                            ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
                            : "bg-card hover:border-primary/30 hover:bg-muted/30"
                        }`}
                      >
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="text-sm font-semibold">{item.title}</div>
                            {active && (
                              <Badge className="h-5 bg-primary/10 px-1.5 text-[9px] text-primary hover:bg-primary/10">
                                หน้าปัจจุบัน
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {item.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
            {!categories.length && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                ไม่พบโมดูลตามคำค้นหา
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
