<?php
declare(strict_types=1);

/*
 * HEPA-GLUE HOSxP hepatitis bridge.
 *
 * Install on the Nam Phong Laragon server:
 *   C:\laragon\www\kumhos\kumhos_lab_api\hepa_glue_hepatitis_proxy.php
 *
 * This file reuses the existing KUMHOS DB config/decryption and connects to HOSxP
 * from the server side, avoiding MariaDB host whitelist problems from a local PC.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $status, string $message, array $extra = []): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

function request_header(string $name): string
{
    $serverName = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string)($_SERVER[$serverName] ?? ''));
}

function positive_value($value): bool
{
    $text = mb_strtolower(trim((string)$value), 'UTF-8');
    if ($text === '') return false;

    foreach (['positive', 'reactive', 'detected', 'pos', '+', 'พบ', 'บวก'] as $needle) {
        if (str_contains($text, $needle)) return true;
    }
    return false;
}

function normalize_date(?string $value, string $fallback): string
{
    if (!$value) return $fallback;
    $dt = DateTime::createFromFormat('Y-m-d', $value);
    return $dt ? $dt->format('Y-m-d') : $fallback;
}

function normalize_icd10(string $value): string
{
    return strtoupper(str_replace('.', '', trim($value)));
}

$token = (string)(getenv('HEPAGLUE_PROXY_TOKEN') ?: '');
$provided = request_header('X-HEPAGLUE-TOKEN');
if ($token !== '' && !hash_equals($token, $provided)) {
    fail(401, 'Unauthorized bridge token');
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail(405, 'Method not allowed');
}

$action = trim((string)($_GET['action'] ?? 'status'));
$today = (new DateTimeImmutable('today'))->format('Y-m-d');
$defaultFrom = (new DateTimeImmutable('-7 days'))->format('Y-m-d');
$dateFrom = normalize_date($_GET['date_from'] ?? null, $defaultFrom);
$dateTo = normalize_date($_GET['date_to'] ?? null, $today);
$limit = max(1, min(500, (int)($_GET['limit'] ?? 100)));

try {
    require_once __DIR__ . '/sys/config.php';
    require_once __DIR__ . '/../connection/server_connect.php';

    if (!isset($conn) || !($conn instanceof PDO)) {
        fail(500, 'HOSxP connection is not available');
    }

    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if ($action === 'status') {
        $version = (string)$conn->query('SELECT VERSION()')->fetchColumn();
        $labHead = $conn->query("SHOW TABLES LIKE 'lab_head'")->fetchAll(PDO::FETCH_COLUMN);
        $labOrder = $conn->query("SHOW TABLES LIKE 'lab_order'")->fetchAll(PDO::FETCH_COLUMN);
        $patient = $conn->query("SHOW TABLES LIKE 'patient'")->fetchAll(PDO::FETCH_COLUMN);

        echo json_encode([
            'ok' => true,
            'mode' => 'server_side_hosxp_bridge',
            'mysql_version' => $version,
            'tables' => [
                'lab_head' => count($labHead) > 0,
                'lab_order' => count($labOrder) > 0,
                'patient' => count($patient) > 0,
            ],
            'checked_at' => date(DATE_ATOM),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'ili_daily_summary') {
        $reportDate = normalize_date($_GET['date'] ?? null, (new DateTimeImmutable('-1 day'))->format('Y-m-d'));
        $iliCodes = preg_split(
            '/[,\s]+/',
            (string)($_GET['codes'] ?? getenv('HEPAGLUE_ILI_CODES') ?: 'J00 J029 J069 J09 J10 J11 J120 J121 J122 J123 J128 J129 J13 J14 J15 J160 J168 J170 J171 J180 J181 J182 J188 J189 J851 A481 J205 J210 B974 U071 U072 U073'),
            -1,
            PREG_SPLIT_NO_EMPTY
        ) ?: [];
        $iliCodes = array_values(array_unique(array_map('normalize_icd10', $iliCodes)));

        $placeholders = [];
        $params = [':report_date' => $reportDate];
        foreach ($iliCodes as $idx => $code) {
            $key = ':ili_code' . $idx;
            $placeholders[] = $key;
            $params[$key] = $code;
        }

        $excludedDepartments = preg_split('/[,\s]+/', (string)(getenv('HEPAGLUE_EXCLUDE_DEPARTMENTS') ?: ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $departmentFilters = [];
        foreach (array_values($excludedDepartments) as $idx => $department) {
            $key = ':exclude_dep' . $idx;
            $departmentFilters[] = "o.main_dep <> $key";
            $params[$key] = $department;
        }
        $departmentWhere = count($departmentFilters) > 0 ? ' AND ' . implode(' AND ', $departmentFilters) : '';

        $iliSql = "
            SELECT COUNT(DISTINCT od.vn)
            FROM ovstdiag od
            INNER JOIN ovst o ON o.vn = od.vn
            WHERE o.vstdate = :report_date
              AND REPLACE(UPPER(od.icd10), '.', '') IN (" . implode(',', $placeholders) . ")
              $departmentWhere
        ";

        $totalSql = "
            SELECT COUNT(DISTINCT o.vn)
            FROM ovst o
            WHERE o.vstdate = :report_date
              $departmentWhere
              AND EXISTS (
                SELECT 1
                FROM ovstdiag od2
                WHERE od2.vn = o.vn
                  AND COALESCE(od2.icd10, '') <> ''
              )
        ";

        $iliStmt = $conn->prepare($iliSql);
        $totalStmt = $conn->prepare($totalSql);
        foreach ($params as $key => $value) {
            $iliStmt->bindValue($key, $value, PDO::PARAM_STR);
            if (!str_starts_with($key, ':ili_code')) {
                $totalStmt->bindValue($key, $value, PDO::PARAM_STR);
            }
        }

        $iliStmt->execute();
        $totalStmt->execute();

        $iliVisits = (int)$iliStmt->fetchColumn();
        $totalVisits = (int)$totalStmt->fetchColumn();
        $iliPercent = $totalVisits > 0 ? round(($iliVisits / $totalVisits) * 100, 2) : 0.0;

        echo json_encode([
            'ok' => true,
            'source' => 'HOSxP_SERVER_BRIDGE',
            'report_date' => $reportDate,
            'ili_visits' => $iliVisits,
            'total_visits' => $totalVisits,
            'ili_percent' => $iliPercent,
            'codes' => $iliCodes,
            'checked_at' => date(DATE_ATOM),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action !== 'hepatitis_labs') {
        fail(400, 'Unknown action');
    }

    $codes = preg_split(
        '/[,\s]+/',
        (string)($_GET['codes'] ?? getenv('HEPAGLUE_HEPATITIS_CODES') ?: 'HB001 HC001 HC002 HBsAg HCV_RNA HCV_Ab'),
        -1,
        PREG_SPLIT_NO_EMPTY
    ) ?: [];
    $codes = array_values(array_unique(array_map('trim', $codes)));

    $codePlaceholders = [];
    $params = [
        ':date_from' => $dateFrom,
        ':date_to' => $dateTo,
        ':limit' => $limit,
    ];
    foreach ($codes as $idx => $code) {
        $key = ':code' . $idx;
        $codePlaceholders[] = $key;
        $params[$key] = $code;
    }

    $sql = "
        SELECT
            p.hn,
            CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS patient_name,
            p.cid,
            p.birthday AS birth_date,
            p.moopart AS village,
            p.tmbpart AS subdistrict,
            DATE(lh.order_date) AS order_date,
            DATE(lh.report_date) AS report_date,
            lo.lab_order_number,
            lo.lab_items_code,
            COALESCE(lo.lab_items_name_ref, '') AS lab_items_name_ref,
            lo.lab_order_result
        FROM lab_head lh
        INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
        INNER JOIN patient p ON p.hn = lh.hn
        WHERE lh.order_date BETWEEN :date_from AND :date_to
          AND (
            lo.lab_items_code IN (" . implode(',', $codePlaceholders) . ")
            OR lo.lab_items_name_ref LIKE '%HBsAg%'
            OR lo.lab_items_name_ref LIKE '%Anti-HCV%'
            OR lo.lab_items_name_ref LIKE '%HCV%'
            OR lo.lab_items_name_ref LIKE '%ไวรัสตับ%'
          )
        ORDER BY lh.order_date DESC, lo.lab_order_number DESC
        LIMIT :limit
    ";

    $stmt = $conn->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, $key === ':limit' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $records = array_map(static function (array $row): array {
        $result = $row['lab_order_result'] ?? null;
        return [
            'hn' => (string)($row['hn'] ?? ''),
            'name' => trim((string)($row['patient_name'] ?? '')),
            'cid' => (string)($row['cid'] ?? ''),
            'birth_date' => (string)($row['birth_date'] ?? ''),
            'test_date' => (string)($row['report_date'] ?: $row['order_date'] ?: ''),
            'village' => (string)($row['village'] ?? ''),
            'subdistrict' => (string)($row['subdistrict'] ?? ''),
            'lab_order_number' => (string)($row['lab_order_number'] ?? ''),
            'lab_code' => (string)($row['lab_items_code'] ?? ''),
            'lab_name' => (string)($row['lab_items_name_ref'] ?? ''),
            'lab_result' => $result === null ? null : (string)$result,
            'needs_followup' => positive_value($result),
            'source' => 'HOSxP_SERVER_BRIDGE',
        ];
    }, $rows);

    echo json_encode([
        'ok' => true,
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'count' => count($records),
        'records' => $records,
        'checked_at' => date(DATE_ATOM),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('HEPA bridge error: ' . $e->getMessage());
    fail(502, 'HOSxP bridge query failed');
}
