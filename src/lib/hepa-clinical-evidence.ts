export const HBV_HDV_MONITORING_INSIGHT = {
  id: "hbv-hdv-lonafarnib-dynamics",
  title: "HBV/HDV monitoring insight",
  sourceTitle:
    "Mathematical Modeling of HDV RNA, HBV DNA, and HBsAg Dynamics during Lonafarnib-Based Therapy",
  sourceUrl: "https://arxiv.org/abs/2606.13386",
  evidenceDate: "arXiv 2606.13386",
  summary:
    "ผู้ป่วย HBV ที่สงสัยติดเชื้อร่วม HDV ควรติดตาม marker แบบ longitudinal เพราะการลดลงของ HDV อาจสัมพันธ์กับการเปลี่ยนแปลง HBV DNA ในบางราย",
  findings: [
    "HDV RNA ตอบสนองเร็วในการรักษาเชิงทดลอง โดย half-life ประมาณ 1.26 วันในโมเดลของงานวิจัย",
    "Lonafarnib ลดการผลิต HDV RNA ช่วงแรกได้ประมาณ 94% ในบริบทการศึกษา LOWR HDV-1",
    "HBsAg อาจเปลี่ยนช้ากว่า HDV RNA และสะท้อน cell population/antigen source มากกว่าการตอบสนองรายวัน",
    "บางรายอาจเห็น HBV DNA เพิ่มขึ้นเมื่อ HDV ลดลง จึงไม่ควรดู marker แยกตัวเดียว",
  ],
  markers: ["HBsAg", "HBV DNA", "anti-HDV / HDV RNA", "ALT/AST"],
  operationalUse: [
    "ใช้เป็น evidence note เพื่อช่วยเจ้าหน้าที่พิจารณา risk tag HBV + suspected HDV",
    "ใช้เตือนให้ดูแนวโน้ม marker ต่อเนื่อง ไม่ใช้ตัดสินใจรักษาอัตโนมัติ",
    "ยังไม่ส่งเข้า MOPH automation โดยตรงจนกว่าจะมี protocol และข้อมูลยืนยันครบ",
  ],
  disclaimer:
    "หมายเหตุ: Lonafarnib ยังเป็นบริบทการศึกษา/การรักษาเชิงทดลองในบทความนี้ ระบบจึงใช้เป็น clinical intelligence เท่านั้น ไม่ใช่คำสั่งรักษา",
} as const;

type HbvHdvPatientLike = {
  hbsag?: string;
  rapid_hbv_result?: string;
  care_status?: string;
};

export function getHbvHdvMonitoringStatus(patient: HbvHdvPatientLike) {
  const hbvPositive = patient.hbsag === "Positive" || patient.rapid_hbv_result === "Positive";
  const unresolvedCare =
    !patient.care_status ||
    patient.care_status === "Pending" ||
    patient.care_status === "Awaiting Result" ||
    patient.care_status === "Follow-up";

  if (!hbvPositive) {
    return {
      flagged: false,
      label: "ไม่เข้าเกณฑ์ HBV/HDV review",
      detail: "ยังไม่พบ HBsAg/HBV positive ในข้อมูลคัดกรองชุดนี้",
      priority: "routine" as const,
    };
  }

  return {
    flagged: true,
    label: unresolvedCare ? "HBV+HDV review" : "HBV history review",
    detail: unresolvedCare
      ? "HBV positive และยังมี care gap: พิจารณา anti-HDV/HDV RNA หากมีข้อบ่งชี้ทางคลินิก"
      : "HBV positive ที่ปิด loop แล้ว: เก็บเป็น history/risk tag สำหรับติดตาม longitudinal marker",
    priority: unresolvedCare ? ("high" as const) : ("watch" as const),
  };
}
