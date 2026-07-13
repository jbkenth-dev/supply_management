<?php

declare(strict_types=1);

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
$code = trim((string) ($payload['code'] ?? ''));
$password = (string) ($payload['password'] ?? '');

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Please enter a valid email address.',
    ]);
}

if ($code === '' || !preg_match('/^\d{6}$/', $code)) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Invalid verification code.',
    ]);
}

if ($password === '') {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Password is required.',
    ]);
}

if (strlen($password) < 8) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Password must be at least 8 characters long.',
    ]);
}

try {
    $pdo = getDatabaseConnection();

    // Auto-create table if needed
    ensurePasswordResetsTable($pdo);

    // Look up user by email
    $userQuery = $pdo->prepare(
        'SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1'
    );
    $userQuery->execute(['email' => $email]);
    $user = $userQuery->fetch();

    if (!$user) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid verification code. Please try again.',
        ]);
    }

    $userId = (int) $user['id'];

    // Look up the verified code (used=1 means it was verified in step 2)
    $codeQuery = $pdo->prepare(
        'SELECT id, expires_at
         FROM password_resets
         WHERE user_id = :user_id AND code = :code AND used = 1
         ORDER BY id DESC
         LIMIT 1'
    );
    $codeQuery->execute([
        'user_id' => $userId,
        'code' => $code,
    ]);
    $resetRow = $codeQuery->fetch();

    if (!$resetRow) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid or unverified code. Please start over.',
        ]);
    }

    // Check the code hasn't expired (the verified code should still be within a reasonable window)
    $expiresAt = new DateTimeImmutable((string) $resetRow['expires_at']);
    $now = new DateTimeImmutable();
    $maxAge = 30; // 30 minutes max from original expiry

    if ($now->getTimestamp() > ($expiresAt->getTimestamp() + ($maxAge * 60))) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Session expired. Please start the password reset process again.',
            'expired' => true,
        ]);
    }

    // Hash the new password
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $pdo->beginTransaction();

    try {
        // Update the user's password
        $updatePassword = $pdo->prepare(
            'UPDATE users SET password_hash = :password_hash WHERE id = :id'
        );
        $updatePassword->execute([
            'password_hash' => $passwordHash,
            'id' => $userId,
        ]);

        // Delete ALL password reset records for this user (invalidate everything)
        $deleteResets = $pdo->prepare(
            'DELETE FROM password_resets WHERE user_id = :user_id'
        );
        $deleteResets->execute(['user_id' => $userId]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    jsonResponse(200, [
        'success' => true,
        'message' => 'Password updated successfully. Please sign in with your new password.',
    ]);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to reset password right now. Please try again later.',
    ]);
} catch (Throwable $exception) {
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

function jsonResponse(int $statusCode, array $body): void
{
    if (ob_get_level()) {
        ob_clean();
    }

    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
