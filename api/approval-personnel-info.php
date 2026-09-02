<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/user_schema.php';

configureCors(['GET']);

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);
    ensureApprovalColumns($pdo);

    $rolesParam = trim((string) ($_GET['roles'] ?? ''));
    if ($rolesParam === '') {
        jsonResponse(422, ['success' => false, 'message' => 'A comma-separated list of roles is required.']);
    }

    $roles = array_map('trim', explode(',', $rolesParam));
    $allowedRoles = ['Immediate Head', 'Resource Planning Officer', 'Vice President for Finance', 'College President'];
    $roles = array_filter($roles, static fn(string $r): bool => in_array($r, $allowedRoles, true));

    if ($roles === []) {
        jsonResponse(200, ['success' => true, 'personnel' => []]);
    }

    $placeholders = implode(',', array_fill(0, count($roles), '?'));
    $stmt = $pdo->prepare(
        "SELECT id, role, firstname, middlename, lastname
         FROM users
         WHERE role IN ($placeholders) AND is_verified = 1 AND approval_status = 'approved'
         ORDER BY FIELD(role, $placeholders)"
    );
    $stmt->execute(array_merge($roles, $roles));
    $rows = $stmt->fetchAll();

    $personnel = [];
    foreach ($rows as $row) {
        $fullName = trim(implode(' ', array_filter([
            (string) ($row['firstname'] ?? ''),
            $row['middlename'] !== null ? (string) $row['middlename'] : '',
            (string) ($row['lastname'] ?? ''),
        ])));
        $personnel[] = [
            'role' => (string) $row['role'],
            'fullName' => $fullName,
        ];
    }

    jsonResponse(200, ['success' => true, 'personnel' => $personnel]);
} catch (PDOException $exception) {
    jsonResponse(500, ['success' => false, 'message' => 'Unable to load approval personnel information.']);
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
