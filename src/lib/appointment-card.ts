import type { AgentAppointment } from "@/lib/hepa-agent-store";

export type LineFlexMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

function thaiAppointmentDate(value: string) {
  return new Date(`${value}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

export function buildAppointmentFlexMessage(appointment: AgentAppointment): LineFlexMessage {
  const dateLabel = thaiAppointmentDate(appointment.appointmentDate);
  const timeLabel = appointment.appointmentTime
    ? `${appointment.appointmentTime} น.`
    : "ตามเวลาที่เจ้าหน้าที่แจ้ง";
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appointment.facilityName)}`;

  return {
    type: "flex",
    altText: `บัตรนัดน้ำพองรักตับ ${dateLabel} ${timeLabel}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#087F73",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "น้ำพองรักตับ",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
          },
          {
            type: "text",
            text: "บัตรนัดหมายติดตามสุขภาพ",
            color: "#D7FAF4",
            size: "sm",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        spacing: "lg",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#E9F8F5",
            cornerRadius: "12px",
            paddingAll: "16px",
            contents: [
              {
                type: "text",
                text: dateLabel,
                color: "#08665E",
                weight: "bold",
                size: "lg",
                wrap: true,
              },
              {
                type: "text",
                text: timeLabel,
                color: "#D85C41",
                weight: "bold",
                size: "xl",
                margin: "sm",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ผู้รับบริการ", color: "#78908D", size: "sm", flex: 2 },
                  {
                    type: "text",
                    text: appointment.patientName,
                    color: "#183331",
                    weight: "bold",
                    size: "sm",
                    align: "end",
                    wrap: true,
                    flex: 3,
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "สถานที่นัด", color: "#78908D", size: "sm", flex: 2 },
                  {
                    type: "text",
                    text: appointment.facilityName,
                    color: "#183331",
                    weight: "bold",
                    size: "sm",
                    align: "end",
                    wrap: true,
                    flex: 3,
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "รหัสนัด", color: "#78908D", size: "sm", flex: 2 },
                  {
                    type: "text",
                    text: appointment.appointmentCode,
                    color: "#183331",
                    weight: "bold",
                    size: "sm",
                    align: "end",
                    flex: 3,
                  },
                ],
              },
            ],
          },
          ...(appointment.note
            ? [
                {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#FFF8E6",
                  cornerRadius: "8px",
                  paddingAll: "12px",
                  contents: [
                    {
                      type: "text",
                      text: `หมายเหตุ: ${appointment.note}`,
                      color: "#7A5A12",
                      size: "sm",
                      wrap: true,
                    },
                  ],
                },
              ]
            : []),
          {
            type: "text",
            text: "กรุณามาก่อนเวลานัดประมาณ 15 นาที และนำบัตรประชาชนหรือเอกสารที่เจ้าหน้าที่แจ้งมาแสดง",
            color: "#506765",
            size: "xs",
            wrap: true,
            lineSpacing: "4px",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#087F73",
            height: "sm",
            action: {
              type: "message",
              label: "ยืนยันวันนัด",
              text: `ยืนยันนัด ${appointment.appointmentCode}`,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "message",
              label: "ขอเลื่อนนัด",
              text: `ขอเลื่อนนัด ${appointment.appointmentCode}`,
            },
          },
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "เปิดแผนที่สถานบริการ",
              uri: mapUrl,
            },
          },
          {
            type: "text",
            text: "หากมีข้อสงสัย กรุณาติดต่อสถานบริการที่นัดหมาย",
            color: "#8A9D9A",
            size: "xxs",
            align: "center",
            margin: "md",
            wrap: true,
          },
        ],
      },
    },
  };
}
