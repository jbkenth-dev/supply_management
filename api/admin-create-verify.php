<?php

declare(strict_types=1);

/**
 * Admin Create User — Step 2: Verify OTP & insert user
 *
 * Verifies the 6-digit code sent to the administrator's email, then
 * promotes the pending registration into a real user account with
 * `is_verified = 1` and `approval_status = 'approved'`.
 *
 * No user record is written to the `users` table until this endpoint
 * confirms a valid, unexpired, unused OTP.
 */

ob_start();

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';
require_once __DIR__ . '/config/cors.php';

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

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

if (!function_exists('ensureApprovalColumns')) {
    function ensureApprovalColumns(PDO $pdo): void
    {
        foreach (['is_verified', 'approval_status'] as $col) {
            $chk = $pdo->prepare("SHOW COLUMNS FROM users LIKE ?");
            $chk->execute([$col]);
            if (!$chk->fetch()) {
                if ($col === 'is_verified') {
                    $pdo->exec("ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER profile_image_path");
                } else {
                    $pdo->exec("ALTER TABLE users ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER is_verified");
                }
            }
        }
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

// ---------------------------------------------------------------------------
// CORS & method check
// ---------------------------------------------------------------------------

configureCors(['POST']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['success' => false, 'message' => 'Method not allowed.']);
}

// ---------------------------------------------------------------------------
// Parse input
// ---------------------------------------------------------------------------

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput ?: '', true);

if (!is_array($payload)) {
    jsonResponse(400, ['success' => false, 'message' => 'Invalid request payload.']);
}

$pendingId = isset($payload['pendingId']) ? (int) $payload['pendingId'] : 0;
$code = trim((string) ($payload['code'] ?? ''));

if ($pendingId <= 0) {
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

// ---------------------------------------------------------------------------
// Verify OTP & create user
// ---------------------------------------------------------------------------

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);
    ensureApprovalColumns($pdo);
    ensurePendingRegistrationsTable($pdo);

    // --- Look up pending registration ---
    $pendingQuery = $pdo->prepare(
        'SELECT id, role, id_number, firstname, middlename, lastname, username, email, password_hash, code, expires_at
         FROM pending_registrations WHERE id = :id LIMIT 1'
    );
    $pendingQuery->execute(['id' => $pendingId]);
    $pending = $pendingQuery->fetch();

    if (!$pending) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Registration not found. Please try creating the user again.',
        ]);
    }

    // --- Check expiration ---
    $expiresAt = new DateTimeImmutable((string) $pending['expires_at']);
    $now = new DateTimeImmutable();

    if ($now->getTimestamp() > $expiresAt->getTimestamp()) {
        jsonResponse(400, [
            'success'  => false,
            'message'  => 'Verification code has expired. Please request a new one.',
            'expired'  => true,
        ]);
    }

    // --- Check code match ---
    if ((string) $pending['code'] !== $code) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid verification code. Please try again.',
        ]);
    }

    // --- Check for role uniqueness (defense-in-depth — may have been created between init & verify) ---
    $restrictedRoles = ['Resource Planning Officer', 'Vice President for Finance', 'College President'];
    if (in_array((string) $pending['role'], $restrictedRoles, true)) {
        $roleCheck = $pdo->prepare('SELECT COUNT(*) FROM users WHERE role = :role');
        $roleCheck->execute(['role' => $pending['role']]);
        if ((int) $roleCheck->fetchColumn() > 0) {
            // Clean up the pending registration so it doesn't block future attempts.
            $pdo->prepare('DELETE FROM pending_registrations WHERE id = :id')->execute(['id' => $pendingId]);
            jsonResponse(409, [
                'success' => false,
                'message' => 'The role "' . htmlspecialchars((string) $pending['role']) . '" can only have one account.',
            ]);
        }
    }

    // --- Also check for duplicate user that appeared between init & verify ---
    // Check ALL roles (not just managed) because the INSERT targets the full
    // users table and a unique constraint would reject duplicates regardless
    // of role.
    $dupCheck = $pdo->prepare(
        'SELECT id FROM users
         WHERE LOWER(id_number) = LOWER(:id_number) OR LOWER(username) = LOWER(:username) OR LOWER(email) = LOWER(:email)
         LIMIT 1'
    );
    $dupCheck->execute([
        'id_number' => (string) $pending['id_number'],
        'username'  => (string) $pending['username'],
        'email'     => (string) $pending['email'],
    ]);
    if ($dupCheck->fetch()) {
        $pdo->prepare('DELETE FROM pending_registrations WHERE id = :id')->execute(['id' => $pendingId]);
        jsonResponse(409, [
            'success' => false,
            'message' => 'An account with that information already exists.',
        ]);
    }

    // --- Transaction: create user & clean up ---
    $pdo->beginTransaction();

    try {
        $insertUser = $pdo->prepare(
            'INSERT INTO users (role, id_number, firstname, middlename, lastname, username, email, password_hash, is_verified, approval_status)
             VALUES (:role, :id_number, :firstname, :middlename, :lastname, :username, :email, :password_hash, 1, \'approved\')'
        );
        $insertUser->execute([
            'role'          => (string) $pending['role'],
            'id_number'     => (string) $pending['id_number'],
            'firstname'     => (string) $pending['firstname'],
            'middlename'    => $pending['middlename'] !== null ? (string) $pending['middlename'] : null,
            'lastname'      => (string) $pending['lastname'],
            'username'      => (string) $pending['username'],
            'email'         => (string) $pending['email'],
            'password_hash' => (string) $pending['password_hash'],
        ]);

        $newUserId = (int) $pdo->lastInsertId();

        // --- Move temp profile image to final location ---
        $profileImagePath = null;
        $tempPath = dirname(__DIR__) . '/public/uploads/profile-pictures/admin-pending-' . $pendingId . '.*';
        $tempFiles = glob($tempPath);

        if (!empty($tempFiles)) {
            $tempFile = $tempFiles[0];
            $ext = pathinfo($tempFile, PATHINFO_EXTENSION);
            $rolePrefix = strtolower((string) $pending['role']) === 'property custodian' ? 'custodian' : 'faculty';
            $finalFilename = sprintf('%s-%d-%d.%s', $rolePrefix, $newUserId, time(), $ext);
            $finalDir = dirname(__DIR__) . '/public/uploads/profile-pictures';
            $finalPath = $finalDir . '/' . $finalFilename;

            if (rename($tempFile, $finalPath)) {
                $profileImagePath = '/uploads/profile-pictures/' . $finalFilename;

                $updateImage = $pdo->prepare('UPDATE users SET profile_image_path = :path WHERE id = :id');
                $updateImage->execute(['path' => $profileImagePath, 'id' => $newUserId]);
            }
        }

        // --- Delete the pending registration ---
        $deletePending = $pdo->prepare('DELETE FROM pending_registrations WHERE id = :id');
        $deletePending->execute(['id' => $pendingId]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    // --- Fetch the newly created user ---
    $userQuery = $pdo->prepare(
        "SELECT id, role, id_number, firstname, middlename, lastname, username, email,
                profile_image_path, is_verified, approval_status, created_at, updated_at
         FROM users WHERE id = :id LIMIT 1"
    );
    $userQuery->execute(['id' => $newUserId]);
    $user = $userQuery->fetch();

    jsonResponse(200, [
        'success' => true,
        'message' => 'Email verified successfully! User account created.',
        'user' => [
            'id'              => (int) $user['id'],
            'role'            => (string) $user['role'],
            'idNumber'        => $user['id_number'] !== null ? (string) $user['id_number'] : null,
            'firstname'       => (string) $user['firstname'],
            'middlename'      => $user['middlename'] !== null ? (string) $user['middlename'] : null,
            'lastname'        => (string) $user['lastname'],
            'username'        => (string) $user['username'],
            'email'           => (string) $user['email'],
            'profileImageUrl' => $user['profile_image_path'] ?? null,
            'isVerified'      => (int) $user['is_verified'] === 1,
            'approvalStatus'  => $user['approval_status'] ?? 'approved',
            'createdAt'       => (string) $user['created_at'],
            'updatedAt'       => (string) $user['updated_at'],
        ],
    ]);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    @file_put_contents(
        dirname(__DIR__) . '/api/logs/admin-create-verify-error.log',
        sprintf("[%s] PDOError %s in %s on line %d\n", date('Y-m-d H:i:s'), $exception->getMessage(), $exception->getFile(), $exception->getLine()),
        FILE_APPEND
    );

    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to verify the code right now.',
    ]);
} catch (Throwable $exception) {
    @file_put_contents(
        dirname(__DIR__) . '/api/logs/admin-create-verify-error.log',
        sprintf("[%s] %s in %s on line %d\n", date('Y-m-d H:i:s'), $exception->getMessage(), $exception->getFile(), $exception->getLine()),
        FILE_APPEND
    );
    jsonResponse(500, [
        'success' => false,
        'message' => 'An unexpected error occurred. Please try again.',
    ]);
}

// ===========================================================================
// Helper
// ===========================================================================

function jsonResponse(int $statusCode, array $body): void
{
    if (ob_get_level()) {
        ob_clean();
    }

    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
