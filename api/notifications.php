<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';
require_once __DIR__ . '/config/user_schema.php';
require_once __DIR__ . '/config/notifications.php';

sendApiHeaders(['GET', 'POST']);

try {
    $pdo = getDatabaseConnection();
    ensureUserProfileColumns($pdo);
    ensureNotificationTables($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleNotificationList($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleNotificationAction($pdo);
    }

    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to process notifications right now.',
    ]);
}

function handleNotificationList(PDO $pdo): void
{
    $userId = filter_input(INPUT_GET, 'userId', FILTER_VALIDATE_INT);
    $role = trim((string) ($_GET['role'] ?? ''));
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 20)));

    $user = validateNotificationUser($pdo, $userId, $role);
    $notifications = fetchUserNotifications($pdo, (int) $user['id'], $limit);

    jsonResponse(200, [
        'success' => true,
        'notifications' => $notifications,
        'unreadCount' => countUnreadNotifications($pdo, (int) $user['id']),
    ]);
}

function handleNotificationAction(PDO $pdo): void
{
    $payload = getRequestData();
    $action = trim((string) ($payload['action'] ?? ''));
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
    $role = trim((string) ($payload['role'] ?? ''));

    $user = validateNotificationUser($pdo, $userId, $role);

    if ($action === 'mark_read') {
        $notificationId = isset($payload['notificationId']) ? (int) $payload['notificationId'] : 0;

        if ($notificationId < 1) {
            jsonResponse(422, [
                'success' => false,
                'message' => 'A valid notification is required.',
            ]);
        }

        markNotificationAsRead($pdo, $notificationId, (int) $user['id']);
    } elseif ($action === 'mark_all_read') {
        markAllNotificationsAsRead($pdo, (int) $user['id']);
    } else {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid action.',
        ]);
    }

    jsonResponse(200, [
        'success' => true,
        'notifications' => fetchUserNotifications($pdo, (int) $user['id'], 50),
        'unreadCount' => countUnreadNotifications($pdo, (int) $user['id']),
    ]);
}

function validateNotificationUser(PDO $pdo, int|false|null $userId, string $role): array
{
    if (!$userId || $role === '') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid account is required.',
        ]);
    }

    $statement = $pdo->prepare(
        'SELECT id, role, firstname, middlename, lastname, email
         FROM users
         WHERE id = :id AND role = :role
         LIMIT 1'
    );
    $statement->execute([
        'id' => $userId,
        'role' => $role,
    ]);

    $user = $statement->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Account not found.',
        ]);
    }

    return $user;
}
