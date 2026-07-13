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

$role = trim((string) ($payload['role'] ?? ''));
$idNumber = trim((string) ($payload['idNumber'] ?? ''));
$firstname = trim((string) ($payload['firstname'] ?? ''));
$middlename = trim((string) ($payload['middlename'] ?? ''));
$lastname = trim((string) ($payload['lastname'] ?? ''));
$username = trim((string) ($payload['username'] ?? ''));
$email = trim((string) ($payload['email'] ?? ''));
$password = (string) ($payload['password'] ?? '');
$confirmPassword = (string) ($payload['confirmPassword'] ?? '');

$allowedRoles = ['Faculty Staff', 'Property Custodian'];
$errors = [];

if (!in_array($role, $allowedRoles, true)) {
    $errors['role'] = 'Please select a valid role.';
}

if ($idNumber === '') {
    $errors['idNumber'] = 'ID number is required.';
} elseif (!preg_match('/^[A-Za-z0-9-]{4,30}$/', $idNumber)) {
    $errors['idNumber'] = 'ID number must be 4 to 30 characters using letters, numbers, or hyphens only.';
}

if ($firstname === '') {
    $errors['firstname'] = 'First name is required.';
}

if ($lastname === '') {
    $errors['lastname'] = 'Last name is required.';
}

if ($username === '') {
    $errors['username'] = 'Username is required.';
} elseif (!preg_match('/^[A-Za-z0-9._-]{4,30}$/', $username)) {
    $errors['username'] = 'Username must be 4 to 30 characters and use only letters, numbers, dot, underscore, or hyphen.';
}

if ($email === '') {
    $errors['email'] = 'Email is required.';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Please enter a valid email address.';
}

if ($password === '') {
    $errors['password'] = 'Password is required.';
} elseif (strlen($password) < 8) {
    $errors['password'] = 'Password must be at least 8 characters.';
}

if ($confirmPassword === '') {
    $errors['confirmPassword'] = 'Please confirm your password.';
} elseif ($password !== $confirmPassword) {
    $errors['confirmPassword'] = 'Passwords do not match.';
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
    ensureApprovalColumns($pdo);
    ensureVerificationTables($pdo);
    ensurePendingRegistrationsTable($pdo);

    // Check for duplicates in users table
    $dupUser = $pdo->prepare(
        'SELECT id_number, username, email FROM users WHERE id_number = :id_number OR username = :username OR email = :email LIMIT 1'
    );
    $dupUser->execute(['id_number' => $idNumber, 'username' => $username, 'email' => $email]);
    $existingUser = $dupUser->fetch();

    // Check for duplicates in pending_registrations table
    $dupPending = $pdo->prepare(
        'SELECT id_number, username, email FROM pending_registrations WHERE id_number = :id_number OR username = :username OR email = :email LIMIT 1'
    );
    $dupPending->execute(['id_number' => $idNumber, 'username' => $username, 'email' => $email]);
    $existingPending = $dupPending->fetch();

    $allExisting = array_filter([$existingUser, $existingPending]);

    if ($allExisting !== []) {
        $duplicateErrors = [];

        foreach ($allExisting as $row) {
            if (strcasecmp((string) ($row['id_number'] ?? ''), $idNumber) === 0) {
                $duplicateErrors['idNumber'] = 'ID number is already registered.';
            }
            if (strcasecmp((string) ($row['username'] ?? ''), $username) === 0) {
                $duplicateErrors['username'] = 'Username is already taken.';
            }
            if (strcasecmp((string) ($row['email'] ?? ''), $email) === 0) {
                $duplicateErrors['email'] = 'Email is already registered.';
            }
        }

        jsonResponse(409, [
            'success' => false,
            'message' => 'An account with that information already exists.',
            'errors' => $duplicateErrors,
        ]);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    // Generate 6-digit verification code
    $verificationCode = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = (new DateTimeImmutable())->modify('+5 minutes')->format('Y-m-d H:i:s');

    // Store in pending_registrations (NOT users)
    $insertPending = $pdo->prepare(
        'INSERT INTO pending_registrations (role, id_number, firstname, middlename, lastname, username, email, password_hash, code, expires_at)
         VALUES (:role, :id_number, :firstname, :middlename, :lastname, :username, :email, :password_hash, :code, :expires_at)'
    );
    $insertPending->execute([
        'role' => $role,
        'id_number' => $idNumber,
        'firstname' => $firstname,
        'middlename' => $middlename !== '' ? $middlename : null,
        'lastname' => $lastname,
        'username' => $username,
        'email' => $email,
        'password_hash' => $passwordHash,
        'code' => $verificationCode,
        'expires_at' => $expiresAt,
    ]);

    $pendingId = (int) $pdo->lastInsertId();

    // Send verification email
    $fullName = trim(implode(' ', array_filter([$firstname, $middlename !== '' ? $middlename : null, $lastname])));
    sendVerificationEmail($email, $fullName, $verificationCode);

    jsonResponse(201, [
        'success' => true,
        'message' => 'A verification code has been sent to your email. Please verify to complete registration.',
        'pendingId' => $pendingId,
        'email' => $email,
    ]);
} catch (PDOException $exception) {
    $message = 'Unable to save your account right now.';

    if ((int) $exception->getCode() === 1049) {
        $message = 'Database "supply_management" was not found. Import the SQL setup file first.';
    }

    jsonResponse(500, [
        'success' => false,
        'message' => $message,
    ]);
} catch (Throwable $exception) {
    @file_put_contents(
        dirname(__DIR__) . '/api/logs/signup-error.log',
        sprintf("[%s] %s in %s on line %d\n", date('Y-m-d H:i:s'), $exception->getMessage(), $exception->getFile(), $exception->getLine()),
        FILE_APPEND
    );
    jsonResponse(500, [
        'success' => false,
        'message' => 'An unexpected error occurred during signup. Please try again.',
    ]);
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
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
          <p style="color:#5C4033;font-size:14px;margin:0 0 32px;line-height:1.6;">Use the verification code below to complete your account registration.</p>
          <div style="background-color:#f5f0eb;border-radius:16px;padding:24px;margin:0 0 32px;">
            <p style="color:#8B5E3C;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Your Verification Code</p>
            <p style="color:#2D1810;font-size:42px;font-weight:900;letter-spacing:12px;margin:0;font-family:\'Courier New\',monospace;">%s</p>
          </div>
          <p style="color:#999;font-size:13px;margin:0 0 8px;">This code expires in <strong style="color:#A0522D;">5 minutes</strong>.</p>
          <p style="color:#999;font-size:12px;margin:0;">If you did not create an account, please ignore this email.</p>
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
        "Hello %s,\n\nYour verification code is: %s\n\nThis code expires in 5 minutes.\n\nIf you did not create an account, please ignore this email.",
        $toName !== '' ? $toName : 'User',
        $code
    );

    @require_once __DIR__ . '/config/email.php';

    if (function_exists('sendSmtpMail')) {
        sendSmtpMail($toEmail, $toName !== '' ? $toName : $toEmail, $subject, $htmlBody, $textBody);
    }
}
