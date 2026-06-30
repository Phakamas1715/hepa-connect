import {
  HEPA_PROJECT_CONFIG,
  KPI,
  MOPH_CONFIG,
  SUBDISTRICTS,
} from "../src/lib/hepa-data";
import {
  HEPA_DISTRICT_HOSPITAL,
  HEPA_PRIMARY_CARE_UNITS,
  HEPA_SERVICE_AREAS,
  formatHepaServiceUnitShortName,
} from "../src/lib/hepa-service-area";

const failures: string[] = [];

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

const primaryCareCodes = new Set(HEPA_PRIMARY_CARE_UNITS.map((unit) => unit.code));
const allowedAreaCodes = new Set([...primaryCareCodes, HEPA_DISTRICT_HOSPITAL.code]);

assert(
  HEPA_PRIMARY_CARE_UNITS.length === HEPA_PROJECT_CONFIG.primaryCareUnitCount,
  `primary care count mismatch: units=${HEPA_PRIMARY_CARE_UNITS.length}, config=${HEPA_PROJECT_CONFIG.primaryCareUnitCount}`,
);

assert(
  KPI.targetPopulation === HEPA_PROJECT_CONFIG.targetPopulation,
  `KPI target mismatch: KPI=${KPI.targetPopulation}, config=${HEPA_PROJECT_CONFIG.targetPopulation}`,
);

assert(
  MOPH_CONFIG.hospitalCode === HEPA_PROJECT_CONFIG.hospitalCode,
  `MOPH hospital code mismatch: MOPH=${MOPH_CONFIG.hospitalCode}, config=${HEPA_PROJECT_CONFIG.hospitalCode}`,
);

assert(
  MOPH_CONFIG.hospitalName === HEPA_PROJECT_CONFIG.hospitalName,
  `MOPH hospital name mismatch: MOPH=${MOPH_CONFIG.hospitalName}, config=${HEPA_PROJECT_CONFIG.hospitalName}`,
);

assert(
  HEPA_DISTRICT_HOSPITAL.unitName === HEPA_PROJECT_CONFIG.hospitalName,
  `hospital unit name mismatch: service-area=${HEPA_DISTRICT_HOSPITAL.unitName}, config=${HEPA_PROJECT_CONFIG.hospitalName}`,
);

const subdistrictCodes = new Set(SUBDISTRICTS.map((unit) => unit.id));
for (const unit of HEPA_PRIMARY_CARE_UNITS) {
  const targetUnit = SUBDISTRICTS.find((item) => item.id === unit.code);
  assert(targetUnit, `missing target metrics for primary care unit ${unit.code}`);
  assert(
    targetUnit?.name === formatHepaServiceUnitShortName(unit.unitName),
    `display name mismatch for ${unit.code}: target=${targetUnit?.name}, service-area=${formatHepaServiceUnitShortName(unit.unitName)}`,
  );
}

for (const unit of SUBDISTRICTS) {
  assert(primaryCareCodes.has(unit.id), `target metrics reference unknown primary care unit ${unit.id}`);
}

assert(
  subdistrictCodes.size === SUBDISTRICTS.length,
  "duplicate primary care target code found in SUBDISTRICTS",
);

const primaryCareTargetTotal = SUBDISTRICTS.reduce((sum, unit) => sum + unit.target, 0);
assert(
  primaryCareTargetTotal === HEPA_PROJECT_CONFIG.primaryCareTargetPopulation,
  `primary care target total mismatch: sum=${primaryCareTargetTotal}, config=${HEPA_PROJECT_CONFIG.primaryCareTargetPopulation}`,
);

for (const area of HEPA_SERVICE_AREAS) {
  assert(allowedAreaCodes.has(area.code), `service area references unknown unit code ${area.code}`);
  assert(area.villages.length > 0, `service area ${area.code}/${area.subdistrict} has no village coverage`);
}

const villageCoverage = new Map<string, string>();
for (const area of HEPA_SERVICE_AREAS) {
  for (const village of area.villages) {
    const key = `${area.subdistrict}:${village}`;
    const existing = villageCoverage.get(key);
    assert(!existing, `duplicate village coverage ${key}: ${existing} and ${area.code}`);
    villageCoverage.set(key, area.code);
  }
}

if (failures.length) {
  console.error("HEPA consistency check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("HEPA consistency check passed");
console.log(`- hospital: ${HEPA_PROJECT_CONFIG.hospitalName} (${HEPA_PROJECT_CONFIG.hospitalCode})`);
console.log(`- primary care units: ${HEPA_PROJECT_CONFIG.primaryCareUnitCount}`);
console.log(`- district target: ${HEPA_PROJECT_CONFIG.targetPopulation.toLocaleString()}`);
console.log(`- primary care target: ${primaryCareTargetTotal.toLocaleString()}`);
