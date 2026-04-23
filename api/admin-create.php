<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';

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

$firstname = trim((string) ($payload['firstname'] ?? ''));
$middlename = trim((string) ($payload['middlename'] ?? ''));
$lastname = trim((string) ($payload['lastname'] ?? ''));
$username = trim((string) ($payload['username'] ?? ''));
$email = trim((string) ($payload['email'] ?? ''));
$password = (string) ($payload['password'] ?? '');
$confirmPassword = (string) ($payload['confirmPassword'] ?? '');
$role = 'Administrator';

$errors = [];

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

    $duplicateCheck = $pdo->prepare(
        'SELECT username, email FROM users WHERE username = :username OR email = :email LIMIT 1'
    );
    $duplicateCheck->execute([
        'username' => $username,
        'email' => $email,
    ]);
    $existingUser = $duplicateCheck->fetch();

    if ($existingUser) {
        $duplicateErrors = [];

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
        'INSERT INTO users (role, firstname, middlename, lastname, username, email, password_hash)
         VALUES (:role, :firstname, :middlename, :lastname, :username, :email, :password_hash)'
    );

    $insertUser->execute([
        'role' => $role,
        'firstname' => $firstname,
        'middlename' => $middlename !== '' ? $middlename : null,
        'lastname' => $lastname,
        'username' => $username,
        'email' => $email,
        'password_hash' => $passwordHash,
    ]);

    jsonResponse(201, [
        'success' => true,
        'message' => 'Administrator account created successfully.',
    ]);
} catch (PDOException $exception) {
    $message = 'Unable to save the administrator account right now.';

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
