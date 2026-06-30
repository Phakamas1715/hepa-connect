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
