<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
];

if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Vary: Origin');
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

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

$identifier = trim((string) ($payload['identifier'] ?? ''));
$password = (string) ($payload['password'] ?? '');
$identifierKey = strtolower($identifier);
$maxAttempts = 5;
$lockoutSeconds = 300;
$errors = [];

if ($identifier === '') {
    $errors['identifier'] = 'Email or username is required.';
}

if ($password === '') {
    $errors['password'] = 'Password is required.';
}

if ($errors !== []) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Please enter your email/username and password.',
        'errors' => $errors,
    ]);
}

try {
    $pdo = getDatabaseConnection();
    ensureLoginAttemptsTable($pdo);
    ensureUserProfileColumns($pdo);

    $pdo->beginTransaction();

    $attemptQuery = $pdo->prepare(
        'SELECT id, failed_attempts, lockout_until
         FROM login_attempts
         WHERE identifier_key = :identifier_key
         LIMIT 1
         FOR UPDATE'
    );
    $attemptQuery->execute([
        'identifier_key' => $identifierKey,
    ]);
    $attempt = $attemptQuery->fetch();

    $now = new DateTimeImmutable();

    $lockoutExpired = false;

    if ($attempt && $attempt['lockout_until'] !== null) {
        $lockoutUntil = new DateTimeImmutable((string) $attempt['lockout_until']);
        $retryAfterSeconds = max(0, $lockoutUntil->getTimestamp() - $now->getTimestamp());

        if ($retryAfterSeconds > 0) {
            $pdo->commit();

            jsonResponse(423, [
                'success' => false,
                'message' => 'Too many failed login attempts. Please wait 5 minutes before trying again.',
                'attemptsRemaining' => 0,
                'retryAfterSeconds' => $retryAfterSeconds,
                'lockedUntil' => $lockoutUntil->format(DATE_ATOM),
            ]);
        }

        $lockoutExpired = true;
    }

    $userQuery = $pdo->prepare(
        'SELECT id, role, id_number, firstname, middlename, lastname, username, email, contact_number, address, profile_image_path, password_hash
         FROM users
         WHERE LOWER(username) = :identifier OR LOWER(email) = :identifier
         LIMIT 1'
    );
    $userQuery->execute([
        'identifier' => $identifierKey,
    ]);
    $user = $userQuery->fetch();

    $isValidLogin = $user && password_verify($password, (string) $user['password_hash']);

    if (!$isValidLogin) {
        $currentAttempts = $attempt && !$lockoutExpired ? (int) $attempt['failed_attempts'] : 0;
        $failedAttempts = $currentAttempts + 1;
        $remainingAttempts = max(0, $maxAttempts - $failedAttempts);
        $lockoutUntil = null;

        if ($failedAttempts >= $maxAttempts) {
            $failedAttempts = $maxAttempts;
            $remainingAttempts = 0;
            $lockoutUntil = $now->modify("+{$lockoutSeconds} seconds")->format('Y-m-d H:i:s');
        }

        saveLoginAttempt($pdo, $identifierKey, $failedAttempts, $lockoutUntil, $attempt ? (int) $attempt['id'] : null);
        $pdo->commit();

        if ($lockoutUntil !== null) {
            jsonResponse(423, [
                'success' => false,
                'message' => 'Too many failed login attempts. Please wait 5 minutes before trying again.',
                'attemptsRemaining' => 0,
                'retryAfterSeconds' => $lockoutSeconds,
                'lockedUntil' => (new DateTimeImmutable($lockoutUntil))->format(DATE_ATOM),
            ]);
        }

        jsonResponse(401, [
            'success' => false,
            'message' => 'Invalid email/username or password.',
            'attemptsRemaining' => $remainingAttempts,
        ]);
    }

    clearLoginAttempts($pdo, [
        $identifierKey,
        strtolower((string) $user['username']),
        strtolower((string) $user['email']),
    ]);

    $pdo->commit();

    jsonResponse(200, [
        'success' => true,
        'message' => 'Login successful.',
        'user' => [
            'id' => (int) $user['id'],
            'role' => (string) $user['role'],
            'idNumber' => $user['id_number'] !== null ? (string) $user['id_number'] : null,
            'firstname' => (string) $user['firstname'],
            'middlename' => $user['middlename'] !== null ? (string) $user['middlename'] : null,
            'lastname' => (string) $user['lastname'],
            'username' => (string) $user['username'],
            'email' => (string) $user['email'],
            'contactNumber' => $user['contact_number'] !== null ? (string) $user['contact_number'] : null,
            'address' => $user['address'] !== null ? (string) $user['address'] : null,
            'profileImageUrl' => $user['profile_image_path'] !== null ? (string) $user['profile_image_path'] : null,
        ],
    ]);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $message = 'Unable to log in right now.';

    if ((int) $exception->getCode() === 1049) {
        $message = 'Database "supply_management" was not found. Import the SQL setup file first.';
    }

    jsonResponse(500, [
        'success' => false,
        'message' => $message,
    ]);
}

function ensureLoginAttemptsTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS login_attempts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            identifier_key VARCHAR(150) NOT NULL UNIQUE,
            failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
            lockout_until DATETIME NULL,
            last_failed_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )'
    );
}

function saveLoginAttempt(PDO $pdo, string $identifierKey, int $failedAttempts, ?string $lockoutUntil, ?int $attemptId): void
{
    if ($attemptId !== null) {
        $updateAttempt = $pdo->prepare(
            'UPDATE login_attempts
             SET failed_attempts = :failed_attempts,
                 lockout_until = :lockout_until,
                 last_failed_at = NOW()
             WHERE id = :id'
        );
        $updateAttempt->execute([
            'failed_attempts' => $failedAttempts,
            'lockout_until' => $lockoutUntil,
            'id' => $attemptId,
        ]);

        return;
    }

    $insertAttempt = $pdo->prepare(
        'INSERT INTO login_attempts (identifier_key, failed_attempts, lockout_until, last_failed_at)
         VALUES (:identifier_key, :failed_attempts, :lockout_until, NOW())'
    );
    $insertAttempt->execute([
        'identifier_key' => $identifierKey,
        'failed_attempts' => $failedAttempts,
        'lockout_until' => $lockoutUntil,
    ]);
}

function clearLoginAttempts(PDO $pdo, array $identifierKeys): void
{
    $identifierKeys = array_values(array_unique(array_filter($identifierKeys, static fn ($value): bool => $value !== '')));

    if ($identifierKeys === []) {
        return;
    }

    $placeholders = implode(', ', array_fill(0, count($identifierKeys), '?'));
    $deleteAttempt = $pdo->prepare("DELETE FROM login_attempts WHERE identifier_key IN ($placeholders)");
    $deleteAttempt->execute($identifierKeys);
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
