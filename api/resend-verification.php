<?php

declare(strict_types=1);

ob_start();

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';
require_once __DIR__ . '/config/cors.php';

// Fallback definitions
if (!function_exists('ensureApprovalColumns')) {
    function ensureApprovalColumns(PDO $pdo): void
    {
        foreach (['is_verified', 'approval_status'] as $col) {
            $chk = $pdo->prepare("SHOW COLUMNS FROM users LIKE ?");
            $chk->execute([$col]);
            if (!$chk->fetch()) {
                $pdo->exec($col === 'is_verified'
                    ? "ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER profile_image_path"
                    : "ALTER TABLE users ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER is_verified");
            }
        }
    }
}

if (!function_exists('ensureUserProfileColumns')) {
    function ensureUserProfileColumns(PDO $pdo): void
    {
        foreach (['id_number','contact_number','address','profile_image_path'] as $col) {
            $chk = $pdo->prepare("SHOW COLUMNS FROM users LIKE ?");
            $chk->execute([$col]);
            if (!$chk->fetch()) {
                $map = [
                    'id_number' => 'ALTER TABLE users ADD COLUMN id_number VARCHAR(50) NULL AFTER role',
                    'contact_number' => 'ALTER TABLE users ADD COLUMN contact_number VARCHAR(20) NULL AFTER email',
                    'address' => 'ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL AFTER contact_number',
                    'profile_image_path' => 'ALTER TABLE users ADD COLUMN profile_image_path VARCHAR(255) NULL AFTER address',
                ];
                $pdo->exec($map[$col]);
            }
        }
    }
}

if (!function_exists('ensureVerificationTables')) {
    function ensureVerificationTables(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS email_verifications (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                code VARCHAR(6) NOT NULL,
                expires_at DATETIME NOT NULL,
                used TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ev_user (user_id),
                INDEX idx_ev_code (user_id, code, used)
            )'
        );
    }
}

if (!function_exists('ensurePendingRegistrationsTable')) {
    function ensurePendingRegistrationsTable(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS pending_registrations (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                role VARCHAR(60) NOT NULL,
                id_number VARCHAR(50) NOT NULL,
                firstname VARCHAR(100) NOT NULL,
                middlename VARCHAR(100) DEFAULT NULL,
                lastname VARCHAR(100) NOT NULL,
                username VARCHAR(30) NOT NULL,
                email VARCHAR(150) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                code VARCHAR(6) NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pr_email (email),
                INDEX idx_pr_code (email, code)
            )'
        );
    }
}

configureCors(['POST']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput ?: '', true);

if (!is_array($payload)) {
    jsonResponse(400, [
        'success' => false,
        'message' => 'Invalid request payload.',
    ]);
}

$pendingId = isset($payload['pendingId']) ? (int) $payload['pendingId'] : 0;
$userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;

if ($pendingId <= 0 && $userId <= 0) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Invalid registration ID.',
    ]);
}

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);
    ensureApprovalColumns($pdo);
    ensureVerificationTables($pdo);
    ensurePendingRegistrationsTable($pdo);

    // Look up the pending registration (new flow) OR existing user (old flow)
    $pending = null;

    if ($pendingId > 0) {
        $pendingQuery = $pdo->prepare(
            'SELECT id, firstname, middlename, lastname, email
             FROM pending_registrations WHERE id = :id LIMIT 1'
        );
        $pendingQuery->execute(['id' => $pendingId]);
        $pending = $pendingQuery->fetch();
    }

    if (!$pending && $userId > 0) {
        // Old flow: look up existing unverified user
        $userQuery = $pdo->prepare(
            'SELECT id, firstname, middlename, lastname, email, is_verified
             FROM users WHERE id = :id LIMIT 1'
        );
        $userQuery->execute(['id' => $userId]);
        $existingUser = $userQuery->fetch();

        if ($existingUser && (int) $existingUser['is_verified'] === 0) {
            // Invalidate old codes
            $invalidate = $pdo->prepare('UPDATE email_verifications SET used = 1 WHERE user_id = :user_id AND used = 0');
            $invalidate->execute(['user_id' => $userId]);

            $verificationCode = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $expiresAt = (new DateTimeImmutable())->modify('+5 minutes')->format('Y-m-d H:i:s');

            $insertCode = $pdo->prepare('INSERT INTO email_verifications (user_id, code, expires_at) VALUES (:user_id, :code, :expires_at)');
            $insertCode->execute(['user_id' => $userId, 'code' => $verificationCode, 'expires_at' => $expiresAt]);

            $fullName = trim(implode(' ', array_filter([
                (string) $existingUser['firstname'],
                $existingUser['middlename'] !== null ? (string) $existingUser['middlename'] : '',
                (string) $existingUser['lastname'],
            ])));

            sendVerificationEmail((string) $existingUser['email'], $fullName, $verificationCode);

            jsonResponse(200, ['success' => true, 'message' => 'A new verification code has been sent to your email.']);
        }

        jsonResponse(404, ['success' => false, 'message' => 'User not found.']);
    }

    if (!$pending) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Registration not found. Please sign up again.',
        ]);
    }

    // Generate new 6-digit verification code
    $verificationCode = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = (new DateTimeImmutable())->modify('+5 minutes')->format('Y-m-d H:i:s');

    // Update the pending registration with new code
    $updatePending = $pdo->prepare(
        'UPDATE pending_registrations SET code = :code, expires_at = :expires_at WHERE id = :id'
    );
    $updatePending->execute([
        'code' => $verificationCode,
        'expires_at' => $expiresAt,
        'id' => $pendingId,
    ]);

    // Send verification email
    $fullName = trim(implode(' ', array_filter([
        (string) $pending['firstname'],
        $pending['middlename'] !== null ? (string) $pending['middlename'] : '',
        (string) $pending['lastname'],
    ])));

    sendVerificationEmail((string) $pending['email'], $fullName, $verificationCode);

    jsonResponse(200, [
        'success' => true,
        'message' => 'A new verification code has been sent to your email.',
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to resend verification code right now.',
    ]);
} catch (Throwable $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'An unexpected error occurred. Please try again.',
    ]);
}

function sendVerificationEmail(string $toEmail, string $toName, string $code): void
{
    $subject = 'Verify Your SFC-G Supply Management Account';

    $htmlBody = sprintf(
        '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f5f0eb;font-family:\'Segoe UI\',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f5f0eb;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#8B5E3C,#A0522D);padding:32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:900;letter-spacing:-0.5px;">SFC-G Supply Management</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Email Verification</p>
        </td></tr>
        <tr><td style="padding:40px 32px;text-align:center;">
          <p style="color:#5C4033;font-size:16px;margin:0 0 8px;">Hello %s,</p>
          <p style="color:#5C4033;font-size:14px;margin:0 0 32px;line-height:1.6;">Here is your new verification code.</p>
          <div style="background-color:#f5f0eb;border-radius:16px;padding:24px;margin:0 0 32px;">
            <p style="color:#8B5E3C;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Your Verification Code</p>
            <p style="color:#2D1810;font-size:42px;font-weight:900;letter-spacing:12px;margin:0;font-family:\'Courier New\',monospace;">%s</p>
          </div>
          <p style="color:#999;font-size:13px;margin:0 0 8px;">This code expires in <strong style="color:#A0522D;">5 minutes</strong>.</p>
          <p style="color:#999;font-size:12px;margin:0;">If you did not request this code, please ignore this email.</p>
        </td></tr>
        <tr><td style="background-color:#f5f0eb;padding:20px 32px;text-align:center;">
          <p style="color:#999;font-size:11px;margin:0;">&copy; %d SFC-G Supply Management System. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>',
        htmlspecialchars($toName !== '' ? $toName : 'User'),
        $code,
        (int) date('Y')
    );

    $textBody = sprintf(
        "Hello %s,\n\nYour new verification code is: %s\n\nThis code expires in 5 minutes.\n\nIf you did not request this code, please ignore this email.",
        $toName !== '' ? $toName : 'User',
        $code
    );

    @require_once __DIR__ . '/config/email.php';

    if (function_exists('sendSmtpMail')) {
        sendSmtpMail($toEmail, $toName !== '' ? $toName : $toEmail, $subject, $htmlBody, $textBody);
    }
}

function jsonResponse(int $statusCode, array $body): void
{
    if (ob_get_level()) {
        ob_clean();
    }

    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
