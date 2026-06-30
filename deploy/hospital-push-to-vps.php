<?php
/**
 * รันบนเครื่องโรงพยาบาล (Laragon / เข้า HOSxP ได้)
 * ดึง lab hepatitis จาก local bridge แล้ว push ขึ้น VPS ผ่าน HTTPS ออก
 *
 * Task Scheduler (ทุก 1 ชม. หรือ 08:00):
 *   php C:\laragon\www\kumhos\kumhos_lab_api\hospital-push-to-vps.php
 *
 * ตั้ง env บนเครื่องโรงพยาบาล:
 *   HEPA_VPS_SYNC_URL=https://hepa-namphong.54.254.201.52.sslip.io/api/hosxp-sync
 *   HEPA_VPS_SYNC_TOKEN=<same as HEPA_HOSXP_PROXY_TOKEN on VPS>
 *   HEPA_LOCAL_BRIDGE_URL=http://127.0.0.1/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php
 *   HEPAGLUE_PROXY_TOKEN=<local bridge token>
 */
declare(strict_types=1);

$envFile = __DIR__ . '/hepa-push.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        putenv(trim($k) . '=' . trim($v));
    }
}

$vpsUrl = getenv('HEPA_VPS_SYNC_URL') ?: 'https://hepa-namphong.54.254.201.52.sslip.io/api/hosxp-sync';
$vpsToken = getenv('HEPA_VPS_SYNC_TOKEN') ?: getenv('HEPAGLUE_PROXY_TOKEN') ?: '';
$localBridge = getenv('HEPA_LOCAL_BRIDGE_URL') ?: 'http://127.0.0.1/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php';
$localToken = getenv('HEPAGLUE_PROXY_TOKEN') ?: '';

$dateTo = (new DateTimeImmutable('today'))->format('Y-m-d');
$dateFrom = (new DateTimeImmutable('-7 days'))->format('Y-m-d');

$pullUrl = $localBridge . '?' . http_build_query([
    'action' => 'hepatitis_labs',
    'date_from' => $dateFrom,
    'date_to' => $dateTo,
    'limit' => 500,
]);

$pullHeaders = ['Accept: application/json'];
if ($localToken !== '') {
    $pullHeaders[] = 'X-HEPAGLUE-TOKEN: ' . $localToken;
}

$ch = curl_init($pullUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => $pullHeaders,
]);
$pullBody = curl_exec($ch);
$pullStatus = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($pullBody === false || $pullStatus < 200 || $pullStatus >= 300) {
    fwrite(STDERR, "[HEPA push] local bridge failed HTTP $pullStatus\n");
    exit(1);
}

$bridge = json_decode($pullBody, true);
if (!is_array($bridge) || empty($bridge['ok'])) {
    fwrite(STDERR, "[HEPA push] bridge response not ok\n");
    exit(1);
}

$records = $bridge['records'] ?? [];
if (!is_array($records) || count($records) === 0) {
    echo "[HEPA push] no records to sync\n";
    exit(0);
}

$payload = json_encode([
    'source' => 'hospital_laragon_push',
    'date_from' => $dateFrom,
    'date_to' => $dateTo,
    'records' => $records,
], JSON_UNESCAPED_UNICODE);

$pushHeaders = ['Content-Type: application/json', 'Accept: application/json'];
if ($vpsToken !== '') {
    $pushHeaders[] = 'X-HEPAGLUE-TOKEN: ' . $vpsToken;
}

$ch = curl_init($vpsUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => $pushHeaders,
    CURLOPT_POSTFIELDS => $payload,
]);
$pushBody = curl_exec($ch);
$pushStatus = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($pushBody === false || $pushStatus < 200 || $pushStatus >= 300) {
    fwrite(STDERR, "[HEPA push] VPS sync failed HTTP $pushStatus: $pushBody\n");
    exit(1);
}

echo "[HEPA push] synced " . count($records) . " records -> $vpsUrl\n";
echo $pushBody . PHP_EOL;