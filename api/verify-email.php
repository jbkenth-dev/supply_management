<?php

declare(strict_types=1);

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
$code = trim((string) ($payload['code'] ?? ''));

if ($pendingId <= 0 && $userId <= 0) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Invalid registration ID.',
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
    ensurePendingRegistrationsTable($pdo);

    // Look up the pending registration (new flow) OR existing user (old flow)
    $pending = null;
    $isOldFlow = false;

    if ($pendingId > 0) {
        $pendingQuery = $pdo->prepare(
            'SELECT id, role, id_number, firstname, middlename, lastname, username, email, password_hash, code, expires_at
             FROM pending_registrations WHERE id = :id LIMIT 1'
        );
        $pendingQuery->execute(['id' => $pendingId]);
        $pending = $pendingQuery->fetch();
    }

    // Old flow: user exists in users table but not yet verified
    if (!$pending && $userId > 0) {
        $userQuery = $pdo->prepare(
            'SELECT id, role, id_number, firstname, middlename, lastname, username, email, password_hash, is_verified
             FROM users WHERE id = :id LIMIT 1'
        );
        $userQuery->execute(['id' => $userId]);
        $existingUser = $userQuery->fetch();

        if ($existingUser && (int) $existingUser['is_verified'] === 0) {
            // Check email_verifications for the code
            $codeQuery = $pdo->prepare(
                'SELECT id, code, expires_at FROM email_verifications
                 WHERE user_id = :user_id AND code = :code AND used = 0 AND expires_at > NOW()
                 LIMIT 1'
            );
            $codeQuery->execute(['user_id' => $userId, 'code' => $code]);
            $evCode = $codeQuery->fetch();

            if ($evCode) {
                $pdo->beginTransaction();
                try {
                    $updateCode = $pdo->prepare('UPDATE email_verifications SET used = 1 WHERE id = :id');
                    $updateCode->execute(['id' => $evCode['id']]);

                    $updateUser = $pdo->prepare('UPDATE users SET is_verified = 1 WHERE id = :id');
                    $updateUser->execute(['id' => $userId]);
                    $pdo->commit();
                } catch (Throwable $e) {
                    if ($pdo->inTransaction()) { $pdo->rollBack(); }
                    throw $e;
                }

                jsonResponse(200, [
                    'success' => true,
                    'message' => 'Email verified successfully.',
                    'user' => formatOldUserResponse($existingUser),
                ]);
            }

            // Check if expired
            $expiredQuery = $pdo->prepare(
                'SELECT id FROM email_verifications WHERE user_id = :user_id AND code = :code AND used = 0 LIMIT 1'
            );
            $expiredQuery->execute(['user_id' => $userId, 'code' => $code]);
            if ($expiredQuery->fetch()) {
                jsonResponse(400, ['success' => false, 'message' => 'Verification code has expired. Please request a new one.', 'expired' => true]);
            }

            jsonResponse(400, ['success' => false, 'message' => 'Invalid verification code. Please try again.']);
        }

        jsonResponse(404, ['success' => false, 'message' => 'User not found.']);
    }

    if (!$pending) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Registration not found. Please sign up again.',
        ]);
    }

    // Check if code has expired
    $expiresAt = new DateTimeImmutable((string) $pending['expires_at']);
    $now = new DateTimeImmutable();

    if ($now->getTimestamp() > $expiresAt->getTimestamp()) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Verification code has expired. Please request a new one.',
            'expired' => true,
        ]);
    }

    // Check if code matches
    if ((string) $pending['code'] !== $code) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid verification code. Please try again.',
        ]);
    }

    $pdo->beginTransaction();

    try {
        // Create the user in users table (is_verified=1 since they just verified)
        $insertUser = $pdo->prepare(
            'INSERT INTO users (role, id_number, firstname, middlename, lastname, username, email, password_hash, is_verified, approval_status)
             VALUES (:role, :id_number, :firstname, :middlename, :lastname, :username, :email, :password_hash, 1, \'pending\')'
        );
        $insertUser->execute([
            'role' => (string) $pending['role'],
            'id_number' => (string) $pending['id_number'],
            'firstname' => (string) $pending['firstname'],
            'middlename' => $pending['middlename'] !== null ? (string) $pending['middlename'] : null,
            'lastname' => (string) $pending['lastname'],
            'username' => (string) $pending['username'],
            'email' => (string) $pending['email'],
            'password_hash' => (string) $pending['password_hash'],
        ]);

        $newUserId = (int) $pdo->lastInsertId();

        // Delete the pending registration
        $deletePending = $pdo->prepare('DELETE FROM pending_registrations WHERE id = :id');
        $deletePending->execute(['id' => $pendingId]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    // Fetch the newly created user to return
    $userQuery = $pdo->prepare(
        'SELECT id, role, id_number, firstname, middlename, lastname, username, email,
                contact_number, address, profile_image_path, is_verified, approval_status
         FROM users WHERE id = :id LIMIT 1'
    );
    $userQuery->execute(['id' => $newUserId]);
    $user = $userQuery->fetch();

    jsonResponse(200, [
        'success' => true,
        'message' => 'Email verified successfully! Your account has been created.',
        'user' => [
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
        ],
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

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

function formatOldUserResponse(array $user): array
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
        'contactNumber' => null,
        'address' => null,
        'profileImageUrl' => null,
        'isVerified' => true,
        'approvalStatus' => 'pending',
    ];
}
