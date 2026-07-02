import {
  Bot,
  Cable,
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Network,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  title: string;
  shortTitle: string;
  url: string;
  icon: LucideIcon;
  desc: string;
};

export type NavigationCategory = {
  title: string;
  description: string;
  items: NavigationItem[];
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    title: "แดชบอร์ดผู้บริหาร",
    shortTitle: "ภาพรวม",
    url: "/",
    icon: LayoutDashboard,
    desc: "ตัวชี้วัด ผลงาน และประเด็นที่ต้องเร่งดำเนินการ",
  },
  {
    title: "ทะเบียนผู้ป่วยค้างติดตาม",
    shortTitle: "ทะเบียนผู้ป่วย",
    url: "/patients",
    icon: Users,
    desc: "ค้นหารายชื่อ จัดลำดับ และเปิดคิวติดตาม",
  },
  {
    title: "คิวจองคัดกรอง",
    shortTitle: "คิวคัดกรอง",
    url: "/screening-queue",
    icon: CalendarCheck,
    desc: "ตรวจสอบผู้ลงทะเบียนและยืนยันสิทธิ์คัดกรอง",
  },
  {
    title: "ผู้แจ้งผลตรวจผ่าน LINE",
    shortTitle: "ผู้แจ้งผลตรวจ",
    url: "/positive-intake",
    icon: UserCheck,
    desc: "ตรวจข้อมูล ติดต่อ และส่งต่อเข้าสู่การดูแล",
  },
  {
    title: "นัดหมายและติดตาม",
    shortTitle: "นัดหมาย",
    url: "/agent",
    icon: Bot,
    desc: "สร้างบัตรนัด เชื่อม LINE และติดตามการตอบรับ",
  },
  {
    title: "รายงานไข้หวัดใหญ่",
    shortTitle: "รายงาน ILI",
    url: "/ili-report",
    icon: ClipboardList,
    desc: "เตรียมข้อมูลรายงาน D506 ตามรอบ",
  },
  {
    title: "เชื่อมโยงรายงานกระทรวง",
    shortTitle: "การเชื่อมต่อ",
    url: "/integration",
    icon: Cable,
    desc: "ตรวจสถานะ HOSxP, LINE และระบบรายงาน",
  },
  {
    title: "ตรวจสอบความพร้อมระบบ",
    shortTitle: "ตรวจระบบ",
    url: "/agent-bench",
    icon: FlaskConical,
    desc: "ทดสอบบริการและความสอดคล้องของข้อมูล",
  },
  {
    title: "โครงสร้างและเส้นทางข้อมูล",
    shortTitle: "โครงสร้างระบบ",
    url: "/architecture",
    icon: Network,
    desc: "ดูแหล่งข้อมูล การไหลของงาน และจุดตรวจสอบ",
  },
];

const byUrl = (url: string) => NAVIGATION_ITEMS.find((item) => item.url === url)!;

export const PRIMARY_NAVIGATION = [
  byUrl("/"),
  byUrl("/patients"),
  byUrl("/screening-queue"),
  byUrl("/positive-intake"),
  byUrl("/agent"),
];

export const NAVIGATION_CATEGORIES: NavigationCategory[] = [
  {
    title: "งานบริการและติดตามผู้ป่วย",
    description: "งานประจำที่เจ้าหน้าที่ใช้รับบริการ ติดต่อ และนัดหมาย",
    items: [
      byUrl("/patients"),
      byUrl("/screening-queue"),
      byUrl("/positive-intake"),
      byUrl("/agent"),
    ],
  },
  {
    title: "ข้อมูลและรายงาน",
    description: "ภาพรวมผลงาน รายงานโรค และสถานะการส่งข้อมูล",
    items: [byUrl("/"), byUrl("/ili-report"), byUrl("/integration")],
  },
  {
    title: "ตรวจสอบและดูแลระบบ",
    description: "สำหรับผู้ดูแลระบบและการแก้ไขปัญหาการเชื่อมต่อ",
    items: [byUrl("/agent-bench"), byUrl("/architecture")],
  },
];

export function getCurrentNavigation(pathname: string) {
  return NAVIGATION_ITEMS.find(
    (item) => pathname === item.url || (item.url !== "/" && pathname.startsWith(`${item.url}/`)),
  );
}

export function getCurrentCategory(pathname: string) {
  return NAVIGATION_CATEGORIES.find((category) =>
    category.items.some(
      (item) => pathname === item.url || (item.url !== "/" && pathname.startsWith(`${item.url}/`)),
    ),
  );
}
