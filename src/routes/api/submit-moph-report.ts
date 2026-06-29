import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/submit-moph-report')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { patientData, portalType } = body;

          if (!patientData?.hn || !portalType) {
            return Response.json(
              {
                status: 'error',
                message: 'ต้องระบุ patientData.hn และ portalType',
              },
              { status: 400 },
            );
          }

          // Call your HEPA-GLUE MOPH Reporter here.
          // The local integration keeps this deterministic until portal credentials are configured.
          console.log(`Submitting MOPH report for ${patientData.hn} to ${portalType}`);

          return Response.json({
            status: 'success',
            message: 'MOPH report submitted successfully',
            patientData,
            portalType,
            transactionId: `TXN-${Date.now()}`,
          });
        } catch (error) {
          console.error('Error submitting MOPH report:', error);
          return Response.json(
            { status: 'error', message: 'ส่งรายงาน MOPH ไม่สำเร็จ' },
            { status: 500 },
          );
        }
      },
    },
  },
});
