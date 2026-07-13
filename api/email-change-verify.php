<?php

declare(strict_types=1);

// Suppress any stray output (PHP notices/warnings) so the JSON response is always clean.
ob_start();

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';
require_once __DIR__ . '/config/cors.php';

// Fallback definitions (in case user_schema.php does not define them)
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
$role = trim((string) ($payload['role'] ?? ''));
$code = trim((string) ($payload['code'] ?? ''));

/* ── Validation ───────────────────────────────────────────── */

$allowedRoles = ['Administrator', 'Faculty Staff', 'Property Custodian'];
$errors = [];

if ($userId <= 0) {
    $errors['userId'] = 'A valid user ID is required.';
}

if (!in_array($role, $allowedRoles, true)) {
    $errors['role'] = 'A valid account role is required.';
}

if ($code === '' || !preg_match('/^\d{6}$/', $code)) {
    $errors['code'] = 'Please enter a valid 6-digit code.';
}

if ($errors !== []) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Please correct the highlighted fields.',
        'errors' => $errors,
    ]);
}

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);
    ensureVerificationTables($pdo);

    /* ── Fetch current user ─────────────────────────────────── */

    $userQuery = $pdo->prepare(
        'SELECT id, role, firstname, middlename, lastname, email
         FROM users
         WHERE id = :id AND role = :role
         LIMIT 1'
    );
    $userQuery->execute([
        'id' => $userId,
        'role' => $role,
    ]);
    $user = $userQuery->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => getAccountNotFoundMessage($role),
        ]);
    }

    /* ── Look up the verification code ──────────────────────── */

    $codeQuery = $pdo->prepare(
        'SELECT id, expires_at, used
         FROM email_verifications
         WHERE user_id = :user_id AND code = :code AND used = 0
         ORDER BY id DESC
         LIMIT 1'
    );
    $codeQuery->execute([
        'user_id' => $userId,
        'code' => $code,
    ]);
    $evRow = $codeQuery->fetch();

    if (!$evRow) {
        // Check if the code exists but was already used
        $usedQuery = $pdo->prepare(
            'SELECT id FROM email_verifications
             WHERE user_id = :user_id AND code = :code AND used = 1
             ORDER BY id DESC LIMIT 1'
        );
        $usedQuery->execute([
            'user_id' => $userId,
            'code' => $code,
        ]);

        if ($usedQuery->fetch()) {
            jsonResponse(400, [
                'success' => false,
                'message' => 'This code has already been used. Please request a new one.',
                'expired' => true,
            ]);
        }

        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid verification code. Please try again.',
        ]);
    }

    /* ── Check if code has expired ──────────────────────────── */

    $expiresAt = new DateTimeImmutable((string) $evRow['expires_at']);
    $now = new DateTimeImmutable();

    if ($now->getTimestamp() > $expiresAt->getTimestamp()) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Verification code has expired. Please request a new one.',
            'expired' => true,
        ]);
    }

    /* ── Determine the pending new email ────────────────────── */
    /* The new email is stored in a metadata approach: we look up the  */
    /* most recent unused code's created_at to find the new email.     */
    /* Since we don't store the pending email directly, we need to     */
    /* get it from the client-side state. The client sends the new     */
    /* email that was requested. We'll verify it hasn't been taken.   */

    $newEmail = strtolower(trim((string) ($payload['newEmail'] ?? '')));

    if ($newEmail === '' || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Invalid new email address.',
        ]);
    }

    /* ── Verify the new email is still available ─────────────── */

    $currentEmail = strtolower((string) $user['email']);

    if ($newEmail === $currentEmail) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'The new email address is the same as your current one.',
        ]);
    }

    $dupQuery = $pdo->prepare(
        'SELECT id FROM users WHERE LOWER(email) = :email AND id != :id LIMIT 1'
    );
    $dupQuery->execute([
        'email' => $newEmail,
        'id' => $userId,
    ]);

    if ($dupQuery->fetch()) {
        jsonResponse(409, [
            'success' => false,
            'message' => 'This email address is already in use by another account.',
        ]);
    }

    /* ── Update email in a transaction ───────────────────────── */

    $pdo->beginTransaction();

    try {
        // Mark the code as used (replay attack prevention)
        $updateCode = $pdo->prepare(
            'UPDATE email_verifications SET used = 1 WHERE id = :id'
        );
        $updateCode->execute(['id' => (int) $evRow['id']]);

        // Update the user's email
        $updateEmail = $pdo->prepare(
            'UPDATE users SET email = :email WHERE id = :id AND role = :role'
        );
        $updateEmail->execute([
            'email' => $newEmail,
            'id' => $userId,
            'role' => $role,
        ]);

        // Invalidate ALL remaining unused codes for this user
        $invalidateAll = $pdo->prepare(
            'UPDATE email_verifications SET used = 1 WHERE user_id = :user_id AND used = 0'
        );
        $invalidateAll->execute(['user_id' => $userId]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    /* ── Fetch updated user and return ───────────────────────── */

    $updatedQuery = $pdo->prepare(
        'SELECT id, role, id_number, firstname, middlename, lastname, username, email, profile_image_path
         FROM users
         WHERE id = :id AND role = :role
         LIMIT 1'
    );
    $updatedQuery->execute([
        'id' => $userId,
        'role' => $role,
    ]);
    $updatedUser = $updatedQuery->fetch();

    jsonResponse(200, [
        'success' => true,
        'message' => 'Email address updated successfully.',
        'user' => serializeUser($updatedUser),
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to verify the email change right now. Please try again later.',
    ]);
} catch (Throwable $exception) {
    @file_put_contents(
        dirname(__DIR__) . '/api/logs/email-change-verify-error.log',
        sprintf("[%s] %s in %s on line %d\n", date('Y-m-d H:i:s'), $exception->getMessage(), $exception->getFile(), $exception->getLine()),
        FILE_APPEND
    );
    jsonResponse(500, [
        'success' => false,
        'message' => 'An unexpected error occurred. Please try again.',
    ]);
}

/* ── Helper Functions ─────────────────────────────────────── */

function getAccountNotFoundMessage(string $role): string
{
    if ($role === 'Administrator') {
        return 'Administrator account not found.';
    }

    if ($role === 'Property Custodian') {
        return 'Property custodian account not found.';
    }

    return 'Faculty account not found.';
}

function serializeUser(array $user): array
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
        'profileImageUrl' => $user['profile_image_path'] !== null ? (string) $user['profile_image_path'] : null,
    ];
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
