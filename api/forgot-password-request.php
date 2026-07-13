<?php

declare(strict_types=1);

// Suppress any stray output (PHP notices/warnings) so the JSON response is always clean.
ob_start();

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/cors.php';

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

$email = strtolower(trim((string) ($payload['email'] ?? '')));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Please enter a valid email address.',
    ]);
}

$CODE_EXPIRY_MINUTES = 10;
$MAX_REQUESTS_PER_WINDOW = 3;
$RATE_LIMIT_WINDOW_MINUTES = 10;

try {
    $pdo = getDatabaseConnection();

    // Auto-create password_resets table if it doesn't exist
    ensurePasswordResetsTable($pdo);

    // Look up user by email (case-insensitive)
    $userQuery = $pdo->prepare(
        'SELECT id, firstname, middlename, lastname, email
         FROM users
         WHERE LOWER(email) = :email
         LIMIT 1'
    );
    $userQuery->execute(['email' => $email]);
    $user = $userQuery->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'No account found with this email address.',
        ]);
    }

    $userId = (int) $user['id'];

    // Rate limiting: check how many requests in the window
    $rateQuery = $pdo->prepare(
        'SELECT COUNT(*) AS request_count
         FROM password_resets
         WHERE user_id = :user_id
           AND created_at > DATE_SUB(NOW(), INTERVAL :window MINUTE)'
    );
    $rateQuery->execute([
        'user_id' => $userId,
        'window' => $RATE_LIMIT_WINDOW_MINUTES,
    ]);
    $rateRow = $rateQuery->fetch();

    if ($rateRow && (int) $rateRow['request_count'] >= $MAX_REQUESTS_PER_WINDOW) {
        jsonResponse(429, [
            'success' => false,
            'message' => 'Too many requests. Please wait a few minutes before trying again.',
        ]);
    }

    // Invalidate any existing unused password reset codes for this user
    $invalidate = $pdo->prepare(
        'UPDATE password_resets SET used = 1 WHERE user_id = :user_id AND used = 0'
    );
    $invalidate->execute(['user_id' => $userId]);

    // Generate 6-digit verification code
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = (new DateTimeImmutable())->modify("+{$CODE_EXPIRY_MINUTES} minutes")->format('Y-m-d H:i:s');

    // Save the code
    $insertCode = $pdo->prepare(
        'INSERT INTO password_resets (user_id, code, expires_at)
         VALUES (:user_id, :code, :expires_at)'
    );
    $insertCode->execute([
        'user_id' => $userId,
        'code' => $code,
        'expires_at' => $expiresAt,
    ]);

    // Build display name for email
    $fullName = trim(implode(' ', array_filter([
        (string) $user['firstname'],
        $user['middlename'] !== null ? (string) $user['middlename'] : '',
        (string) $user['lastname'],
    ])));

    // Try server-side email as a fallback (works if hosting allows outbound).
    // The frontend will also attempt email via the Vercel serverless function.
    try {
        sendPasswordResetEmail(
            (string) $user['email'],
            $fullName !== '' ? $fullName : 'User',
            $code,
            $CODE_EXPIRY_MINUTES
        );
    } catch (Throwable $mailException) {
        @file_put_contents(
            dirname(__DIR__) . '/api/logs/forgot-password-email-error.log',
            sprintf("[%s] %s in %s on line %d\n", date('Y-m-d H:i:s'), $mailException->getMessage(), $mailException->getFile(), $mailException->getLine()),
            FILE_APPEND
        );
    }

    // Return the code so the frontend can send the email via Vercel
    // serverless function (Awardspace blocks all outbound connections).
    jsonResponse(200, [
        'success' => true,
        'message' => 'A verification code has been sent to your email.',
        'email' => (string) $user['email'],
        'name' => $fullName,
        'code' => $code,
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to process your request right now. Please try again later.',
    ]);
} catch (Throwable $exception) {
    @file_put_contents(
        dirname(__DIR__) . '/api/logs/forgot-password-error.log',
        sprintf("[%s] %s in %s on line %d\n", date('Y-m-d H:i:s'), $exception->getMessage(), $exception->getFile(), $exception->getLine()),
        FILE_APPEND
    );
    jsonResponse(500, [
        'success' => false,
        'message' => 'An unexpected error occurred. Please try again.',
    ]);
}

function ensurePasswordResetsTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS password_resets (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            used TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pr_user (user_id),
            INDEX idx_pr_code (user_id, code, used)
        )'
    );
}

function sendPasswordResetEmail(string $toEmail, string $toName, string $code, int $expiryMinutes): bool
{
    $subject = 'Reset Your Password — SFC-G Supply Management';

    $year = (int) date('Y');

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
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Password Reset</p>
        </td></tr>
        <tr><td style="padding:40px 32px;text-align:center;">
          <p style="color:#5C4033;font-size:16px;margin:0 0 8px;">Hello %s,</p>
          <p style="color:#5C4033;font-size:14px;margin:0 0 32px;line-height:1.6;">We received a request to reset your password. Use the verification code below to proceed.</p>
          <div style="background-color:#f5f0eb;border-radius:16px;padding:24px;margin:0 0 32px;">
            <p style="color:#8B5E3C;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Your Verification Code</p>
            <p style="color:#2D1810;font-size:42px;font-weight:900;letter-spacing:12px;margin:0;font-family:\'Courier New\',monospace;">%s</p>
          </div>
          <p style="color:#999;font-size:13px;margin:0 0 8px;">This code expires in <strong style="color:#A0522D;">%d minutes</strong>.</p>
          <p style="color:#999;font-size:12px;margin:0;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
        </td></tr>
        <tr><td style="background-color:#f5f0eb;padding:20px 32px;text-align:center;">
          <p style="color:#999;font-size:11px;margin:0;">&copy; %d SFC-G Supply Management System. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>',
        htmlspecialchars($toName),
        $code,
        $expiryMinutes,
        $year
    );

    $textBody = sprintf(
        "Hello %s,\n\nWe received a request to reset your password. Your verification code is: %s\n\nThis code expires in %d minutes.\n\nIf you did not request a password reset, please ignore this email. Your password will remain unchanged.",
        $toName,
        $code,
        $expiryMinutes
    );

    @require_once __DIR__ . '/config/email.php';

    if (function_exists('sendSmtpMail')) {
        return sendSmtpMail($toEmail, $toName, $subject, $htmlBody, $textBody);
    }

    return false;
}

function jsonResponse(int $statusCode, array $body): void
{
    // Discard any unexpected output so the response is always clean JSON.
    if (ob_get_level()) {
        ob_clean();
    }

    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
