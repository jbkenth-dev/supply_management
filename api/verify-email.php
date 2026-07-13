<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';
require_once __DIR__ . '/config/cors.php';

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

$userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
$code = trim((string) ($payload['code'] ?? ''));

if ($userId <= 0) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Invalid user ID.',
    ]);
}

if ($code === '' || !preg_match('/^\d{6}$/', $code)) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Please enter a valid 6-digit code.',
    ]);
}

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);
    ensureApprovalColumns($pdo);
    ensureVerificationTables($pdo);

    // Check if user exists and is not yet verified
    $userQuery = $pdo->prepare(
        'SELECT id, is_verified, role, firstname, middlename, lastname, username, email
         FROM users WHERE id = :id LIMIT 1'
    );
    $userQuery->execute(['id' => $userId]);
    $user = $userQuery->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'User not found.',
        ]);
    }

    if ((int) $user['is_verified'] === 1) {
        jsonResponse(200, [
            'success' => true,
            'message' => 'Account is already verified.',
            'alreadyVerified' => true,
            'user' => formatUserResponse($user),
        ]);
    }

    // Find a valid, unused, non-expired code
    $codeQuery = $pdo->prepare(
        'SELECT id FROM email_verifications
         WHERE user_id = :user_id AND code = :code AND used = 0 AND expires_at > NOW()
         LIMIT 1'
    );
    $codeQuery->execute([
        'user_id' => $userId,
        'code' => $code,
    ]);
    $verification = $codeQuery->fetch();

    if (!$verification) {
        // Check if there's an expired code to give a specific message
        $expiredQuery = $pdo->prepare(
            'SELECT id FROM email_verifications
             WHERE user_id = :user_id AND code = :code AND used = 0
             LIMIT 1'
        );
        $expiredQuery->execute([
            'user_id' => $userId,
            'code' => $code,
        ]);
        $expiredCode = $expiredQuery->fetch();

        if ($expiredCode) {
            jsonResponse(400, [
                'success' => false,
                'message' => 'Verification code has expired. Please request a new one.',
                'expired' => true,
            ]);
        }

        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid verification code. Please try again.',
        ]);
    }

    $pdo->beginTransaction();

    try {
        // Mark code as used
        $updateCode = $pdo->prepare(
            'UPDATE email_verifications SET used = 1 WHERE id = :id'
        );
        $updateCode->execute(['id' => $verification['id']]);

        // Mark user as verified
        $updateUser = $pdo->prepare(
            'UPDATE users SET is_verified = 1 WHERE id = :id'
        );
        $updateUser->execute(['id' => $userId]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    jsonResponse(200, [
        'success' => true,
        'message' => 'Email verified successfully.',
        'user' => formatUserResponse($user),
    ]);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to verify email right now.',
    ]);
}

function formatUserResponse(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'role' => (string) $user['role'],
        'idNumber' => $user['id_number'] !== null ? (string) $user['id_number'] : null,
        'firstname' => (string) $user['firstname'],
        'middlename' => $user['middlename'] !== null ? (string) $user['middlename'] : null,
        'lastname' => (string) $user['lastname'],
        'username' => (string) $user['username'],
        'email' => (string) $user['email'],
        'contactNumber' => $user['contact_number'] ?? null,
        'address' => $user['address'] ?? null,
        'profileImageUrl' => $user['profile_image_path'] ?? null,
        'isVerified' => (int) $user['is_verified'] === 1,
        'approvalStatus' => $user['approval_status'] ?? 'pending',
    ];
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
