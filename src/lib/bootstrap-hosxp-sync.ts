import { PREPARED_PATIENTS, isPositive } from "@/lib/hepa-data";
import { mergeHosxpSyncRecords } from "@/lib/hosxp-sync-store";

export function bootstrapFromPreparedPatients() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const records = PREPARED_PATIENTS.filter(isPositive).map((patient) => ({
    hn: patient.hn,
    name: patient.name,
    test_date: yesterday,
    hbsag: patient.hbsag,
    hcvAb: patient.hcvAb,
    hcvVL: patient.hcvVL,
    rapid_hbv_result: patient.rapid_hbv_result,
    rapid_hcv_result: patient.rapid_hcv_result,
    needs_followup: true,
    source: "prepared_registry_bootstrap",
  }));

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  return mergeHosxpSyncRecords(records, {
    source: "prepared_registry_bootstrap",
    dateFrom: weekAgo,
    dateTo: today,
  });
}