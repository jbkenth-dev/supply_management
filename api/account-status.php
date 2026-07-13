<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/user_schema.php';
require_once __DIR__ . '/config/cors.php';

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
