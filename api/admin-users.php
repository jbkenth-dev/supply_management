<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';
require_once __DIR__ . '/config/cors.php';

// Fallback: define if user_schema.php on server is outdated
if (!function_exists('ensureApprovalColumns')) {
    function ensureApprovalColumns(PDO $pdo): void
    {
        $pdo->exec("CREATE TABLE IF NOT EXISTS _schema_check (id INT)");
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

configureCors(['GET', 'POST', 'PUT', 'DELETE']);

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleList($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handlePost($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $jsonPayload = decodeJsonBody();
        $action = trim((string) ($jsonPayload['action'] ?? ''));

        if ($action === 'approve' || $action === 'reject') {
            handleApprovalAction($pdo, $jsonPayload, $action);
        }

        handleUpdatePayload($pdo, $jsonPayload);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        handleDelete($pdo);
    }

    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
} catch (PDOException $exception) {
    $message = 'Unable to process the admin users request right now.';

    if ((int) $exception->getCode() === 1049) {
        $message = 'Database "supply_management" was not found. Import the SQL setup file first.';
    }

    jsonResponse(500, [
        'success' => false,
        'message' => $message,
    ]);
} catch (Throwable $exception) {
    @file_put_contents(
        dirname(__DIR__) . '/api/logs/admin-users-error.log',
        sprintf("[%s] %s in %s on line %d\n", date('Y-m-d H:i:s'), $exception->getMessage(), $exception->getFile(), $exception->getLine()),
        FILE_APPEND
    );
    jsonResponse(500, [
        'success' => false,
        'message' => 'An unexpected error occurred. Please try again.',
    ]);
}

function handleList(PDO $pdo): void
{
    ensureApprovalColumns($pdo);

    $query = $pdo->query(
        "SELECT id, role, id_number, firstname, middlename, lastname, username, email, profile_image_path, is_verified, approval_status, created_at, updated_at
         FROM users
         WHERE role IN ('Faculty Staff', 'Property Custodian', 'Resource Planning Officer', 'Vice President for Finance', 'College President')
         ORDER BY CASE WHEN approval_status = 'pending' THEN 0 ELSE 1 END, lastname ASC, firstname ASC, id ASC"
    );

    $users = array_map(static fn (array $user): array => serializeManagedUser($user), $query->fetchAll());

    jsonResponse(200, [
        'success' => true,
        'users' => $users,
    ]);
}

function handlePost(PDO $pdo): void
{
    $payload = getRequestPayload();
    $action = trim((string) ($payload['action'] ?? 'create'));

    if ($action === 'update') {
        handleUpdatePayload($pdo, $payload);
    }

    handleCreatePayload($pdo, $payload);
}

function handleCreatePayload(PDO $pdo, array $payload): void
{
    $input = validateUserPayload($pdo, $payload, true);

    if ($input['errors'] !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the highlighted fields.',
            'errors' => $input['errors'],
        ]);
    }

    $insertUser = $pdo->prepare(
        'INSERT INTO users (role, id_number, firstname, middlename, lastname, username, email, profile_image_path, password_hash)
         VALUES (:role, :id_number, :firstname, :middlename, :lastname, :username, :email, :profile_image_path, :password_hash)'
    );

    $insertUser->execute([
        'role' => $input['role'],
        'id_number' => $input['idNumber'],
        'firstname' => $input['firstname'],
        'middlename' => $input['middlename'],
        'lastname' => $input['lastname'],
        'username' => $input['username'],
        'email' => $input['email'],
        'profile_image_path' => null,
        'password_hash' => password_hash((string) $input['password'], PASSWORD_DEFAULT),
    ]);

    $userId = (int) $pdo->lastInsertId();

    if (hasUploadedProfileImage()) {
        $profileImagePath = storeProfileImage($_FILES['profileImage'], $userId, $input['role']);
        $updateProfileImage = $pdo->prepare('UPDATE users SET profile_image_path = :profile_image_path WHERE id = :id');
        $updateProfileImage->execute([
            'profile_image_path' => $profileImagePath,
            'id' => $userId,
        ]);
    }

    $user = findManagedUser($pdo, $userId);

    jsonResponse(201, [
        'success' => true,
        'message' => 'User account created successfully.',
        'user' => serializeManagedUser($user),
    ]);
}

function handleApprovalAction(PDO $pdo, array $payload, string $action): void
{
    ensureApprovalColumns($pdo);

    $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);

    if (!$id) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid user ID is required.',
        ]);
    }

    $user = findManagedUser($pdo, (int) $id);

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'User not found.',
        ]);
    }

    if ((string) $user['role'] !== 'Faculty Staff' && (string) $user['role'] !== 'Property Custodian') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Only Faculty Staff and Property Custodian accounts can be approved or rejected.',
        ]);
    }

    $newStatus = $action === 'approve' ? 'approved' : 'rejected';

    $update = $pdo->prepare(
        'UPDATE users SET approval_status = :status WHERE id = :id'
    );
    $update->execute([
        'status' => $newStatus,
        'id' => (int) $id,
    ]);

    $updatedUser = findManagedUser($pdo, (int) $id);

    $label = $action === 'approve' ? 'approved' : 'rejected';
    $fullName = trim(implode(' ', array_filter([
        (string) $user['firstname'],
        $user['middlename'] !== null ? (string) $user['middlename'] : '',
        (string) $user['lastname'],
    ])));
    $userName = trim($fullName) !== '' ? $fullName : (string) $user['username'];
    $subject = $action === 'approve' ? 'Your Account Has Been Approved' : 'Your Account Application Was Not Approved';

    $htmlBody = sprintf(
        '<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f5f0eb;font-family:\'Segoe UI\',Tahoma,sans-serif;">
<table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f5f0eb;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#8B5E3C,#A0522D);padding:32px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">SFC-G Supply Management</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Account %s</p>
</td></tr>
<tr><td style="padding:40px 32px;text-align:center;">
<p style="color:#5C4033;font-size:16px;margin:0 0 8px;">Hello %s,</p>
<p style="color:#5C4033;font-size:14px;margin:0 0 24px;line-height:1.6;">%s</p>
%s
<p style="color:#999;font-size:12px;margin:24px 0 0;">If you have questions, please contact the administrator.</p>
</td></tr>
<tr><td style="background-color:#f5f0eb;padding:20px 32px;text-align:center;">
<p style="color:#999;font-size:11px;margin:0;">&copy; %d SFC-G Supply Management System.</p>
</td></tr>
</table></td></tr></table>
</body></html>',
        htmlspecialchars(ucfirst($label)),
        htmlspecialchars($userName),
        $action === 'approve'
            ? 'Your account has been <strong style="color:#059669;">approved</strong>! You can now log in and access the system.'
            : 'We regret to inform you that your account application has <strong style="color:#DC2626;">not been approved</strong> at this time. Please contact the administrator for more details.',
        $action === 'approve'
            ? '<div style="background-color:#f0fdf4;border-radius:12px;padding:16px;margin:0 0 24px;"><p style="color:#059669;font-size:14px;margin:0;font-weight:700;">&#10003; Account Approved</p></div>'
            : '<div style="background-color:#fef2f2;border-radius:12px;padding:16px;margin:0 0 24px;"><p style="color:#DC2626;font-size:14px;margin:0;font-weight:700;">&#10007; Account Not Approved</p></div>',
        (int) date('Y')
    );

    $textBody = sprintf(
        "Hello %s,\n\n%s\n\nIf you have questions, please contact the administrator.",
        $userName,
        $action === 'approve'
            ? 'Your account has been approved! You can now log in and access the system.'
            : 'We regret to inform you that your account application has not been approved at this time.'
    );

    if (function_exists('sendSmtpMail')) {
        sendSmtpMail((string) $user['email'], $userName, $subject, $htmlBody, $textBody);
    }

    jsonResponse(200, [
        'success' => true,
        'message' => 'User account ' . $label . ' successfully.',
        'user' => serializeManagedUser($updatedUser),
    ]);
}

function handleUpdatePayload(PDO $pdo, array $payload): void
{
    $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);

    if (!$id) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid user ID is required.',
            'errors' => [
                'id' => 'A valid user ID is required.',
            ],
        ]);
    }

    $existingUser = findManagedUser($pdo, (int) $id);

    if (!$existingUser) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected user account was not found.',
        ]);
    }

    $input = validateUserPayload($pdo, $payload, false, (int) $id);

    if ($input['errors'] !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the highlighted fields.',
            'errors' => $input['errors'],
        ]);
    }

    $fields = [
        'role = :role',
        'id_number = :id_number',
        'firstname = :firstname',
        'middlename = :middlename',
        'lastname = :lastname',
        'username = :username',
        'email = :email',
    ];
    $params = [
        'id' => (int) $id,
        'role' => $input['role'],
        'id_number' => $input['idNumber'],
        'firstname' => $input['firstname'],
        'middlename' => $input['middlename'],
        'lastname' => $input['lastname'],
        'username' => $input['username'],
        'email' => $input['email'],
    ];

    if (hasUploadedProfileImage()) {
        $fields[] = 'profile_image_path = :profile_image_path';
        $params['profile_image_path'] = storeProfileImage($_FILES['profileImage'], (int) $id, $input['role']);
    }

    if ($input['password'] !== null) {
        $fields[] = 'password_hash = :password_hash';
        $params['password_hash'] = password_hash($input['password'], PASSWORD_DEFAULT);
    }

    $updateUser = $pdo->prepare(
        'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id AND role IN (\'Faculty Staff\', \'Property Custodian\', \'Resource Planning Officer\', \'Vice President for Finance\', \'College President\')'
    );
    $updateUser->execute($params);

    $user = findManagedUser($pdo, (int) $id);

    jsonResponse(200, [
        'success' => true,
        'message' => 'User account updated successfully.',
        'user' => serializeManagedUser($user),
    ]);
}

function handleUpdateJson(PDO $pdo): void
{
    $payload = decodeJsonBody();
    handleUpdatePayload($pdo, $payload);
}

function handleDelete(PDO $pdo): void
{
    $payload = decodeJsonBody();
    $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);

    if (!$id) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid user ID is required.',
        ]);
    }

    $user = findManagedUser($pdo, (int) $id);

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected user account was not found.',
        ]);
    }

    $deleteUser = $pdo->prepare(
        "DELETE FROM users
         WHERE id = :id AND role IN ('Faculty Staff', 'Property Custodian', 'Resource Planning Officer', 'Vice President for Finance', 'College President')"
    );
    $deleteUser->execute([
        'id' => (int) $id,
    ]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'User account deleted successfully.',
    ]);
}

function validateUserPayload(PDO $pdo, array $payload, bool $isCreate, ?int $excludeId = null): array
{
    $role = trim((string) ($payload['role'] ?? ''));
    $idNumber = trim((string) ($payload['idNumber'] ?? ''));
    $firstname = trim((string) ($payload['firstname'] ?? ''));
    $middlename = trim((string) ($payload['middlename'] ?? ''));
    $lastname = trim((string) ($payload['lastname'] ?? ''));
    $username = trim((string) ($payload['username'] ?? ''));
    $email = trim((string) ($payload['email'] ?? ''));
    $password = (string) ($payload['password'] ?? '');
    $confirmPassword = (string) ($payload['confirmPassword'] ?? '');

    $errors = [];
    $allowedRoles = ['Faculty Staff', 'Property Custodian', 'Resource Planning Officer', 'Vice President for Finance', 'College President'];

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

    if (hasUploadedProfileImage()) {
        $imageError = validateProfileImageUpload($_FILES['profileImage']);
        if ($imageError !== null) {
            $errors['profileImage'] = $imageError;
        }
    }

    if ($isCreate || $password !== '' || $confirmPassword !== '') {
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
    }

    if ($errors === []) {
        $duplicateErrors = findDuplicateUserConflicts($pdo, $idNumber, $username, $email, $excludeId);
        $errors = array_merge($errors, $duplicateErrors);

        // Check for role uniqueness for restricted roles
        $restrictedRoles = ['Resource Planning Officer', 'Vice President for Finance', 'College President'];
        if (in_array($role, $restrictedRoles, true)) {
            $query = $pdo->prepare('SELECT COUNT(*) FROM users WHERE role = :role AND (:exclude_id IS NULL OR id <> :exclude_id)');
            $query->execute(['role' => $role, 'exclude_id' => $excludeId]);
            if ((int)$query->fetchColumn() > 0) {
                $errors['role'] = 'There is already a user assigned to this role.';
            }
        }
    }

    return [
        'errors' => $errors,
        'role' => $role,
        'idNumber' => $idNumber,
        'firstname' => $firstname,
        'middlename' => $middlename !== '' ? $middlename : null,
        'lastname' => $lastname,
        'username' => $username,
        'email' => $email,
        'password' => $password !== '' ? $password : null,
    ];
}

function findDuplicateUserConflicts(PDO $pdo, string $idNumber, string $username, string $email, ?int $excludeId): array
{
    $query = $pdo->prepare(
        'SELECT id, id_number, username, email
         FROM users
         WHERE (LOWER(id_number) = LOWER(:id_number) OR LOWER(username) = LOWER(:username) OR LOWER(email) = LOWER(:email))
           AND (:exclude_id IS NULL OR id <> :exclude_id)
         LIMIT 20'
    );
    $query->bindValue(':id_number', $idNumber);
    $query->bindValue(':username', $username);
    $query->bindValue(':email', $email);
    $query->bindValue(':exclude_id', $excludeId, $excludeId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $query->execute();

    $errors = [];

    foreach ($query->fetchAll() as $existingUser) {
        if (strcasecmp((string) ($existingUser['id_number'] ?? ''), $idNumber) === 0) {
            $errors['idNumber'] = 'ID number is already registered.';
        }

        if (strcasecmp((string) $existingUser['username'], $username) === 0) {
            $errors['username'] = 'Username is already taken.';
        }

        if (strcasecmp((string) $existingUser['email'], $email) === 0) {
            $errors['email'] = 'Email is already registered.';
        }
    }

    return $errors;
}

function findManagedUser(PDO $pdo, int $id): ?array
{
    $query = $pdo->prepare(
        "SELECT id, role, id_number, firstname, middlename, lastname, username, email, profile_image_path, is_verified, approval_status, created_at, updated_at
         FROM users
         WHERE id = :id AND role IN ('Faculty Staff', 'Property Custodian', 'Resource Planning Officer', 'Vice President for Finance', 'College President')
         LIMIT 1"
    );
    $query->execute([
        'id' => $id,
    ]);

    $user = $query->fetch();

    return $user ?: null;
}

function serializeManagedUser(array $user): array
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
        'isVerified' => isset($user['is_verified']) ? (int) $user['is_verified'] === 1 : true,
        'approvalStatus' => isset($user['approval_status']) ? (string) $user['approval_status'] : 'approved',
        'createdAt' => (string) $user['created_at'],
        'updatedAt' => (string) $user['updated_at'],
    ];
}

function getRequestPayload(): array
{
    if ($_POST !== []) {
        return $_POST;
    }

    return decodeJsonBody();
}

function hasUploadedProfileImage(): bool
{
    return isset($_FILES['profileImage'])
        && is_array($_FILES['profileImage'])
        && (int) $_FILES['profileImage']['error'] !== UPLOAD_ERR_NO_FILE;
}

function validateProfileImageUpload(array $file): ?string
{
    if ((int) $file['error'] !== UPLOAD_ERR_OK) {
        return 'Please upload the image again.';
    }

    if ((int) $file['size'] > 2 * 1024 * 1024) {
        return 'Profile picture must be 2MB or smaller.';
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file((string) $file['tmp_name']);
    $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!in_array($mimeType, $allowedMimeTypes, true)) {
        return 'Please upload a JPG, PNG, or WEBP image only.';
    }

    return null;
}

function storeProfileImage(array $file, int $userId, string $role): string
{
    $imageError = validateProfileImageUpload($file);

    if ($imageError !== null) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'The profile image could not be uploaded.',
            'errors' => [
                'profileImage' => $imageError,
            ],
        ]);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file((string) $file['tmp_name']);
    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    $uploadDirectory = dirname(__DIR__) . '/public/uploads/profile-pictures';

    if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0777, true) && !is_dir($uploadDirectory)) {
        jsonResponse(500, [
            'success' => false,
            'message' => 'Unable to prepare the profile image directory.',
        ]);
    }

    $rolePrefix = $role === 'Property Custodian' ? 'custodian' : 'faculty';
    $filename = sprintf('%s-%d-%d.%s', $rolePrefix, $userId, time(), $extensions[$mimeType]);
    $destination = $uploadDirectory . '/' . $filename;

    if (!move_uploaded_file((string) $file['tmp_name'], $destination)) {
        jsonResponse(500, [
            'success' => false,
            'message' => 'Unable to save the uploaded profile image.',
        ]);
    }

    return '/uploads/profile-pictures/' . $filename;
}

function decodeJsonBody(): array
{
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput ?: '', true);

    if (!is_array($payload)) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid request payload.',
        ]);
    }

    return $payload;
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
