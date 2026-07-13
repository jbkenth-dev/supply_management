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

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Please enter a valid email address.',
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

    // Look up the code
    $codeQuery = $pdo->prepare(
        'SELECT id, expires_at, used
         FROM password_resets
         WHERE user_id = :user_id AND code = :code AND used = 0
         ORDER BY id DESC
         LIMIT 1'
    );
    $codeQuery->execute([
        'user_id' => $userId,
        'code' => $code,
    ]);
    $resetRow = $codeQuery->fetch();

    if (!$resetRow) {
        // Check if code exists but is already used
        $usedQuery = $pdo->prepare(
            'SELECT id FROM password_resets
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

    // Check if code has expired
    $expiresAt = new DateTimeImmutable((string) $resetRow['expires_at']);
    $now = new DateTimeImmutable();

    if ($now->getTimestamp() > $expiresAt->getTimestamp()) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Verification code has expired. Please request a new one.',
            'expired' => true,
        ]);
    }

    // Mark code as used (verified) — the reset step will consume it
    $updateCode = $pdo->prepare(
        'UPDATE password_resets SET used = 1 WHERE id = :id'
    );
    $updateCode->execute(['id' => (int) $resetRow['id']]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Code verified successfully.',
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to verify code right now. Please try again later.',
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
