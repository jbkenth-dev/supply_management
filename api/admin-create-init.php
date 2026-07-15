<?php

declare(strict_types=1);

/**
 * Admin Create User — Step 1: Validate & send OTP
 *
 * Validates the new-user form submitted by an administrator, stores the
 * data in pending_registrations (reusing the existing signup table), and
 * sends a 6-digit verification code to the entered email address.
 *
 * Accepts JSON (Content-Type: application/json) — the same transport
 * used by /api/signup.php which is proven to work through the
 * Vercel → Awardspace rewrite proxy.
 *
 * No user record is inserted into the `users` table until the OTP is
 * successfully verified via admin-create-verify.php.
 */

ob_start();

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';
require_once __DIR__ . '/config/cors.php';

// ---------------------------------------------------------------------------
// Schema helpers (same pattern as admin-users.php / signup.php)
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
// Parse input — accept JSON body OR URL-encoded form data ( $_POST ).
//
// The Vercel → Awardspace rewrite proxy sometimes strips the raw body on
// POST requests, leaving php://input empty.  URL-encoded form data
// (application/x-www-form-urlencoded) always arrives via $_POST, so we
// check that first and fall back to a JSON decode of the raw body.
// ---------------------------------------------------------------------------

$payload = null;

// 1) Try $_POST first (URL-encoded / FormData)
if (!empty($_POST) && is_array($_POST)) {
    $payload = $_POST;
}

// 2) Fall back to raw JSON body
if ($payload === null) {
    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput ?: '', true);
    if (is_array($decoded)) {
        $payload = $decoded;
    }
}

if (!is_array($payload) || $payload === []) {
    jsonResponse(400, ['success' => false, 'message' => 'Invalid request payload.']);
}

// ---------------------------------------------------------------------------
// Extract & trim fields
// ---------------------------------------------------------------------------

$role           = trim((string) ($payload['role'] ?? ''));
$idNumber       = trim((string) ($payload['idNumber'] ?? ''));
$firstname      = trim((string) ($payload['firstname'] ?? ''));
$middlename     = trim((string) ($payload['middlename'] ?? ''));
$lastname       = trim((string) ($payload['lastname'] ?? ''));
$username       = trim((string) ($payload['username'] ?? ''));
$email          = trim((string) ($payload['email'] ?? ''));
$password       = (string) ($payload['password'] ?? '');
$confirmPassword = (string) ($payload['confirmPassword'] ?? '');

// ---------------------------------------------------------------------------
// Validation (mirrors validateUserPayload in admin-users.php)
// ---------------------------------------------------------------------------

$allowedRoles = ['Faculty Staff', 'Property Custodian', 'Resource Planning Officer', 'Vice President for Finance', 'College President'];
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

// ---------------------------------------------------------------------------
// Server-side checks requiring DB
// ---------------------------------------------------------------------------

if ($errors === []) {
    try {
        $pdo = getDatabaseConnection();
        ensureUserProfileColumns($pdo);
        ensurePendingRegistrationsTable($pdo);

        // Remove stale pending registrations FIRST so a previous abandoned/
        // unverified attempt never blocks a retry (mirrors signup.php flow).
        // Use case-insensitive comparison to match the duplicate check below.
        $removeStale = $pdo->prepare(
            'DELETE FROM pending_registrations
             WHERE LOWER(id_number) = LOWER(:id_number)
                OR LOWER(username) = LOWER(:username)
                OR LOWER(email) = LOWER(:email)'
        );
        $removeStale->execute(['id_number' => $idNumber, 'username' => $username, 'email' => $email]);

        // --- Duplicate check against existing users ---
        // Query only the specific values the admin submitted and compare
        // each field individually with case-insensitive PHP comparison.
        // This avoids false positives from the SQL OR combining matches
        // across unrelated rows.
        //
        // Only check against managed-role users (the same roles shown on
        // the admin users page) so that non-managed accounts (e.g.
        // Administrator) do not cause false-positive "already registered"
        // errors for administrators who cannot see those accounts.
        // Role values are trusted application constants — interpolated
        // directly to avoid PDO named-parameter issues on shared hosting.
        $hasDuplicate = false;

        // Check ID number
        if ($idNumber !== '') {
            $idCheck = $pdo->prepare(
                "SELECT 1 FROM users WHERE id_number = :id_number AND role IN ('Faculty Staff','Property Custodian','Resource Planning Officer','Vice President for Finance','College President') LIMIT 1"
            );
            $idCheck->execute(['id_number' => $idNumber]);
            if ($idCheck->fetch()) {
                $errors['idNumber'] = 'ID number is already registered.';
                $hasDuplicate = true;
            }
        }

        // Check username
        if ($username !== '') {
            $usernameCheck = $pdo->prepare(
                "SELECT 1 FROM users WHERE username = :username AND role IN ('Faculty Staff','Property Custodian','Resource Planning Officer','Vice President for Finance','College President') LIMIT 1"
            );
            $usernameCheck->execute(['username' => $username]);
            if ($usernameCheck->fetch()) {
                $errors['username'] = 'Username is already taken.';
                $hasDuplicate = true;
            }
        }

        // Check email
        if ($email !== '') {
            $emailCheck = $pdo->prepare(
                "SELECT 1 FROM users WHERE email = :email AND role IN ('Faculty Staff','Property Custodian','Resource Planning Officer','Vice President for Finance','College President') LIMIT 1"
            );
            $emailCheck->execute(['email' => $email]);
            if ($emailCheck->fetch()) {
                $errors['email'] = 'Email is already registered.';
                $hasDuplicate = true;
            }
        }

        // --- Role uniqueness for restricted roles ---
        if (!$hasDuplicate) {
            $restrictedRoles = ['Resource Planning Officer', 'Vice President for Finance', 'College President'];
            if (in_array($role, $restrictedRoles, true)) {
                $roleCheck = $pdo->prepare('SELECT COUNT(*) FROM users WHERE role = :role');
                $roleCheck->execute(['role' => $role]);
                if ((int) $roleCheck->fetchColumn() > 0) {
                    $errors['role'] = 'The role "' . htmlspecialchars($role) . '" can only have one account.';
                }
            }
        }
    } catch (PDOException $exception) {
        jsonResponse(500, [
            'success' => false,
            'message' => 'Unable to validate user data right now.',
        ]);
    }
}

// ---------------------------------------------------------------------------
// Return validation errors
// ---------------------------------------------------------------------------

if ($errors !== []) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Please correct the highlighted fields.',
        'errors' => $errors,
    ]);
}

// ---------------------------------------------------------------------------
// Store pending registration & send OTP
// ---------------------------------------------------------------------------

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);
    ensurePendingRegistrationsTable($pdo);

    // Remove any stale pending registrations for the same identifiers.
    $removeStale = $pdo->prepare(
        'DELETE FROM pending_registrations WHERE LOWER(id_number) = LOWER(:id_number) OR LOWER(username) = LOWER(:username) OR LOWER(email) = LOWER(:email)'
    );
    $removeStale->execute(['id_number' => $idNumber, 'username' => $username, 'email' => $email]);

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $verificationCode = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = (new DateTimeImmutable())->modify('+5 minutes')->format('Y-m-d H:i:s');

    $insertPending = $pdo->prepare(
        'INSERT INTO pending_registrations (role, id_number, firstname, middlename, lastname, username, email, password_hash, code, expires_at)
         VALUES (:role, :id_number, :firstname, :middlename, :lastname, :username, :email, :password_hash, :code, :expires_at)'
    );
    $insertPending->execute([
        'role'           => $role,
        'id_number'      => $idNumber,
        'firstname'      => $firstname,
        'middlename'     => $middlename !== '' ? $middlename : null,
        'lastname'       => $lastname,
        'username'       => $username,
        'email'          => $email,
        'password_hash'  => $passwordHash,
        'code'           => $verificationCode,
        'expires_at'     => $expiresAt,
    ]);

    $pendingId = (int) $pdo->lastInsertId();

    $fullName = trim(implode(' ', array_filter([$firstname, $middlename !== '' ? $middlename : null, $lastname])));

    // Try server-side email as a fallback (works if hosting allows outbound).
    // The frontend will also attempt email via the Vercel serverless function.
    try {
        sendAdminVerificationEmail($email, $fullName, $verificationCode);
    } catch (Throwable $mailException) {
        @file_put_contents(
            dirname(__DIR__) . '/api/logs/admin-create-email-error.log',
            sprintf("[%s] %s in %s on line %d\n", date('Y-m-d H:i:s'), $mailException->getMessage(), $mailException->getFile(), $mailException->getLine()),
            FILE_APPEND
        );
    }

    jsonResponse(201, [
        'success'  => true,
        'message'  => 'A verification code has been sent to ' . $email . '. Please verify to complete user creation.',
        'pendingId' => $pendingId,
        'email'    => $email,
        'code'     => $verificationCode,
        'name'     => $fullName,
    ]);
} catch (PDOException $exception) {
    @file_put_contents(
        dirname(__DIR__) . '/api/logs/admin-create-init-error.log',
        sprintf("[%s] PDOError %s in %s on line %d\n", date('Y-m-d H:i:s'), $exception->getMessage(), $exception->getFile(), $exception->getLine()),
        FILE_APPEND
    );
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to create the pending registration right now.',
    ]);
} catch (Throwable $exception) {
    @file_put_contents(
        dirname(__DIR__) . '/api/logs/admin-create-init-error.log',
        sprintf("[%s] %s in %s on line %d\n", date('Y-m-d H:i:s'), $exception->getMessage(), $exception->getFile(), $exception->getLine()),
        FILE_APPEND
    );
    jsonResponse(500, [
        'success' => false,
        'message' => 'An unexpected error occurred. Please try again.',
    ]);
}

// ===========================================================================
// Helper functions
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

/**
 * Send verification email (reuses the same SMTP infrastructure).
 */
function sendAdminVerificationEmail(string $toEmail, string $toName, string $code): bool
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
          <p style="color:#5C4033;font-size:14px;margin:0 0 32px;line-height:1.6;">Use the verification code below to complete the account creation.</p>
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
        "Hello %s,\n\nYour verification code is: %s\n\nThis code expires in 5 minutes.\n\nIf you did not request this code, please ignore this email.",
        $toName !== '' ? $toName : 'User',
        $code
    );

    @require_once __DIR__ . '/config/email.php';

    if (function_exists('sendSmtpMail')) {
        return sendSmtpMail($toEmail, $toName !== '' ? $toName : $toEmail, $subject, $htmlBody, $textBody);
    }

    return false;
}
