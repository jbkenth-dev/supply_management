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

configureCors(['GET']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
}

$userId = filter_input(INPUT_GET, 'userId', FILTER_VALIDATE_INT);

if (!$userId) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Valid user ID is required.',
    ]);
}

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);
    ensureApprovalColumns($pdo);

    $userQuery = $pdo->prepare(
        'SELECT id, role, id_number, firstname, middlename, lastname, username, email,
                contact_number, address, profile_image_path,
                is_verified, approval_status
         FROM users WHERE id = :id LIMIT 1'
    );
    $userQuery->execute(['id' => $userId]);
    $user = $userQuery->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'User not found.',
        ]);
    }

    jsonResponse(200, [
        'success' => true,
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
            'isVerified' => (int) $user['is_verified'] === 1,
            'approvalStatus' => (string) $user['approval_status'],
        ],
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to fetch account status.',
    ]);
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
