<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';

header('Content-Type: application/json; charset=utf-8');

$allowedOrigin = 'http://127.0.0.1:5173';
if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
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

    $duplicateCheck = $pdo->prepare(
        'SELECT id_number, username, email
         FROM users
         WHERE id_number = :id_number OR username = :username OR email = :email
         LIMIT 1'
    );
    $duplicateCheck->execute([
        'id_number' => $idNumber,
        'username' => $username,
        'email' => $email,
    ]);
    $existingUser = $duplicateCheck->fetch();

    if ($existingUser) {
        $duplicateErrors = [];

        if (strcasecmp((string) ($existingUser['id_number'] ?? ''), $idNumber) === 0) {
            $duplicateErrors['idNumber'] = 'ID number is already registered.';
        }

        if (strcasecmp((string) $existingUser['username'], $username) === 0) {
            $duplicateErrors['username'] = 'Username is already taken.';
        }

        if (strcasecmp((string) $existingUser['email'], $email) === 0) {
            $duplicateErrors['email'] = 'Email is already registered.';
        }

        jsonResponse(409, [
            'success' => false,
            'message' => 'An account with that information already exists.',
            'errors' => $duplicateErrors,
        ]);
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $insertUser = $pdo->prepare(
        'INSERT INTO users (role, id_number, firstname, middlename, lastname, username, email, password_hash)
         VALUES (:role, :id_number, :firstname, :middlename, :lastname, :username, :email, :password_hash)'
    );

    $insertUser->execute([
        'role' => $role,
        'id_number' => $idNumber,
        'firstname' => $firstname,
        'middlename' => $middlename !== '' ? $middlename : null,
        'lastname' => $lastname,
        'username' => $username,
        'email' => $email,
        'password_hash' => $passwordHash,
    ]);

    jsonResponse(201, [
        'success' => true,
        'message' => 'Account created successfully.',
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
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
