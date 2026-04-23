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

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleFetch($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleUpdate($pdo);
    }

    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
} catch (PDOException $exception) {
    $message = 'Unable to process the account request right now.';

    if ((int) $exception->getCode() === 1049) {
        $message = 'Database "supply_management" was not found. Import the SQL setup file first.';
    }

    jsonResponse(500, [
        'success' => false,
        'message' => $message,
    ]);
}

function handleFetch(PDO $pdo): void
{
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    $role = getValidatedRole($_GET['role'] ?? null);

    if (!$id) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid user ID is required.',
        ]);
    }

    $user = findUserByRole($pdo, (int) $id, $role);

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => getAccountNotFoundMessage($role),
        ]);
    }

    jsonResponse(200, [
        'success' => true,
        'user' => serializeUser($user),
    ]);
}

function handleUpdate(PDO $pdo): void
{
    $action = trim((string) ($_POST['action'] ?? 'profile'));

    if ($action === 'change_password') {
        handlePasswordUpdate($pdo);
    }

    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
    $role = getValidatedRole($_POST['role'] ?? null);
    $firstname = trim((string) ($_POST['firstname'] ?? ''));
    $middlename = trim((string) ($_POST['middlename'] ?? ''));
    $lastname = trim((string) ($_POST['lastname'] ?? ''));

    $errors = [];

    if (!$id) {
        $errors['id'] = 'A valid user ID is required.';
    }

    if ($firstname === '') {
        $errors['firstname'] = 'First name is required.';
    }

    if ($lastname === '') {
        $errors['lastname'] = 'Last name is required.';
    }

    if ($errors !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the highlighted fields.',
            'errors' => $errors,
        ]);
    }

    $user = findUserByRole($pdo, (int) $id, $role);

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => getAccountNotFoundMessage($role),
        ]);
    }

    $profileImagePath = $user['profile_image_path'] !== null ? (string) $user['profile_image_path'] : null;

    if (isset($_FILES['profileImage']) && is_array($_FILES['profileImage']) && (int) $_FILES['profileImage']['error'] !== UPLOAD_ERR_NO_FILE) {
        $profileImagePath = storeProfileImage($_FILES['profileImage'], (int) $id, $role);
    }

    $updateUser = $pdo->prepare(
        'UPDATE users
         SET firstname = :firstname,
             middlename = :middlename,
             lastname = :lastname,
             profile_image_path = :profile_image_path
         WHERE id = :id AND role = :role'
    );

    $updateUser->execute([
        'firstname' => $firstname,
        'middlename' => $middlename !== '' ? $middlename : null,
        'lastname' => $lastname,
        'profile_image_path' => $profileImagePath,
        'id' => (int) $id,
        'role' => $role,
    ]);

    $updatedUser = findUserByRole($pdo, (int) $id, $role);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Your Account details saved successfully.',
        'user' => serializeUser($updatedUser),
    ]);
}

function handlePasswordUpdate(PDO $pdo): void
{
    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
    $role = getValidatedRole($_POST['role'] ?? null);
    $currentPassword = (string) ($_POST['currentPassword'] ?? '');
    $newPassword = (string) ($_POST['newPassword'] ?? '');
    $confirmPassword = (string) ($_POST['confirmPassword'] ?? '');
    $errors = [];

    if (!$id) {
        $errors['id'] = 'A valid user ID is required.';
    }

    if ($currentPassword === '') {
        $errors['currentPassword'] = 'Current password is required.';
    }

    if ($newPassword === '') {
        $errors['newPassword'] = 'New password is required.';
    } elseif (strlen($newPassword) < 8) {
        $errors['newPassword'] = 'New password must be at least 8 characters.';
    }

    if ($confirmPassword === '') {
        $errors['confirmPassword'] = 'Please confirm your new password.';
    } elseif ($newPassword !== $confirmPassword) {
        $errors['confirmPassword'] = 'New password and confirmation do not match.';
    }

    if ($currentPassword !== '' && $newPassword !== '' && $currentPassword === $newPassword) {
        $errors['newPassword'] = 'New password must be different from your current password.';
    }

    if ($errors !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the highlighted password fields.',
            'errors' => $errors,
        ]);
    }

    $query = $pdo->prepare(
        'SELECT id, role, password_hash
         FROM users
         WHERE id = :id AND role = :role
         LIMIT 1'
    );
    $query->execute([
        'id' => (int) $id,
        'role' => $role,
    ]);
    $user = $query->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => getAccountNotFoundMessage($role),
        ]);
    }

    if (!password_verify($currentPassword, (string) $user['password_hash'])) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Current password is incorrect.',
            'errors' => [
                'currentPassword' => 'Current password is incorrect.',
            ],
        ]);
    }

    $updatePassword = $pdo->prepare(
        'UPDATE users
         SET password_hash = :password_hash
         WHERE id = :id AND role = :role'
    );
    $updatePassword->execute([
        'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
        'id' => (int) $id,
        'role' => $role,
    ]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Password changed successfully.',
    ]);
}

function findUserByRole(PDO $pdo, int $id, string $role): ?array
{
    $query = $pdo->prepare(
        'SELECT id, role, id_number, firstname, middlename, lastname, username, email, contact_number, address, profile_image_path
         FROM users
         WHERE id = :id AND role = :role
         LIMIT 1'
    );
    $query->execute([
        'id' => $id,
        'role' => $role,
    ]);

    $user = $query->fetch();

    return $user ?: null;
}

function storeProfileImage(array $file, int $userId, string $role): string
{
    if ((int) $file['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'The profile image upload failed.',
            'errors' => [
                'profileImage' => 'Please upload the image again.',
            ],
        ]);
    }

    if ((int) $file['size'] > 2 * 1024 * 1024) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'The profile image is too large.',
            'errors' => [
                'profileImage' => 'Profile picture must be 2MB or smaller.',
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

    if (!isset($extensions[$mimeType])) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Unsupported profile image format.',
            'errors' => [
                'profileImage' => 'Please upload a JPG, PNG, or WEBP image only.',
            ],
        ]);
    }

    $uploadDirectory = dirname(__DIR__) . '/public/uploads/profile-pictures';

    if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0777, true) && !is_dir($uploadDirectory)) {
        jsonResponse(500, [
            'success' => false,
            'message' => 'Unable to prepare the profile image directory.',
        ]);
    }

    $filename = sprintf('%s-%d-%d.%s', getRoleUploadPrefix($role), $userId, time(), $extensions[$mimeType]);
    $destination = $uploadDirectory . '/' . $filename;

    if (!move_uploaded_file((string) $file['tmp_name'], $destination)) {
        jsonResponse(500, [
            'success' => false,
            'message' => 'Unable to save the uploaded profile image.',
        ]);
    }

    return '/uploads/profile-pictures/' . $filename;
}

function getValidatedRole(mixed $value): string
{
    $role = trim((string) $value);
    $allowedRoles = ['Administrator', 'Faculty Staff', 'Property Custodian'];

    if (!in_array($role, $allowedRoles, true)) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid account role is required.',
        ]);
    }

    return $role;
}

function getRoleUploadPrefix(string $role): string
{
    if ($role === 'Administrator') {
        return 'admin';
    }

    if ($role === 'Property Custodian') {
        return 'custodian';
    }

    return 'faculty';
}

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
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
