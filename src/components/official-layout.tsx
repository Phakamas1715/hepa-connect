import { Link } from "@tanstack/react-router";
import { Building2, Calendar, CheckCircle2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export const OFFICIAL_META = {
  hospital: "โรงพยาบาลน้ำพอง",
  district: "อำเภอน้ำพอง จังหวัดขอนแก่น",
  program: "โครงการกำจัดไวรัสตับอักเสบ B และ C",
  system: "HEPA-GLUE Engine",
  fiscalYear: "ปีงบประมาณ 2569",
  unitCode: "รหัสหน่วยบริการ 11000",
  ministry: "กระทรวงสาธารณสุข",
} as const;

export function OfficialTrustStrip() {
  return (
    <div className="official-trust-strip">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="official-badge">
          <Building2 className="h-3 w-3" />
          {OFFICIAL_META.hospital}
        </Badge>
        <Badge variant="outline" className="official-badge">
          <Calendar className="h-3 w-3" />
          {OFFICIAL_META.fiscalYear}
        </Badge>
        <Badge variant="outline" className="official-badge">
          {OFFICIAL_META.unitCode}
        </Badge>
      </div>
      <div className="text-[11px] text-muted-foreground">
        ข้อมูลแสดงจากรายชื่อเป้าหมายและระบบติดตามอัตโนมัติของหน่วยบริการ
      </div>
    </div>
  );
}

export function OfficialPageHeader({
  eyebrow,
  title,
  description,
  badges,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badges?: string[];
  children?: ReactNode;
}) {
  return (
    <header className="official-page-header">
      <div className="official-page-header-accent" aria-hidden />
      <div className="relative space-y-4">
        <OfficialTrustStrip />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="official-eyebrow">
              <ShieldCheck className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <h1 className="official-title">{title}</h1>
            <p className="official-description">{description}</p>
            {badges && badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <Badge key={badge} className="official-innovation-badge">
                    <CheckCircle2 className="h-3 w-3" />
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </header>
  );
}

export function InnovationShowcase({ items }: { items: Array<{ title: string; detail: string }> }) {
  return (
    <section className="official-innovation-panel" aria-label="แนวทางการทำงานของระบบ">
      <div className="official-section-label">แนวทางการทำงานของระบบ</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="official-innovation-item">
            <div className="font-semibold text-foreground">{item.title}</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OfficialFooter() {
  return (
    <footer className="official-footer">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {OFFICIAL_META.hospital} · {OFFICIAL_META.district} · {OFFICIAL_META.fiscalYear}
        </div>
        <div className="text-xs text-muted-foreground">
          ระบบ {OFFICIAL_META.system} — ใช้เพื่อการบริหารจัดการและติดตามผลงานภายในหน่วยบริการ
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground/80">
        ข้อมูลคลินิกในระบบนี้ใช้สนับสนุนการติดตามและรายงาน ไม่ทดแทนการวินิจฉัยโดยแพทย์
      </div>
    </footer>
  );
}

export function OfficialNavHint({ to, label }: { to: string; label: string }) {
  return (
    <p className="official-nav-hint">
      ดูรายละเอียดเพิ่มเติมที่{" "}
      <Link to={to} className="font-medium text-primary underline-offset-2 hover:underline">
        {label}
      </Link>
    </p>
  );
}
