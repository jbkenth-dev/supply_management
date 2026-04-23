<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';

sendApiHeaders(['GET', 'POST']);

try {
    $pdo = getDatabaseConnection();
    ensureAnnouncementTables($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleAnnouncementFetch($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleAnnouncementCreate($pdo);
    }

    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to process announcements right now.',
    ]);
}

function ensureAnnouncementTables(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS announcements (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(180) NOT NULL,
            description VARCHAR(1000) NOT NULL,
            type ENUM("feature", "maintenance", "update") NOT NULL DEFAULT "update",
            created_by_user_id INT UNSIGNED NOT NULL,
            published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_announcements_created_by
                FOREIGN KEY (created_by_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE RESTRICT,
            INDEX idx_announcements_published (published_at DESC, id DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function handleAnnouncementFetch(PDO $pdo): void
{
    $limit = isset($_GET['limit']) ? max(1, min(50, (int) $_GET['limit'])) : 6;
    $includeAll = filter_var($_GET['includeAll'] ?? false, FILTER_VALIDATE_BOOLEAN);

    $announcements = fetchAnnouncements($pdo, $limit, $includeAll);

    jsonResponse(200, [
        'success' => true,
        'announcements' => $announcements,
    ]);
}

function handleAnnouncementCreate(PDO $pdo): void
{
    $payload = getRequestData();
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
    $role = trim((string) ($payload['role'] ?? ''));
    $title = trim((string) ($payload['title'] ?? ''));
    $description = trim((string) ($payload['description'] ?? ''));
    $type = trim((string) ($payload['type'] ?? 'update'));

    validateAdminAnnouncementUser($pdo, $userId, $role);

    $allowedTypes = ['feature', 'maintenance', 'update'];
    $errors = [];

    if ($title === '') {
        $errors['title'] = 'Announcement title is required.';
    } elseif (mb_strlen($title) > 180) {
        $errors['title'] = 'Announcement title must be 180 characters or fewer.';
    }

    if ($description === '') {
        $errors['description'] = 'Announcement description is required.';
    } elseif (mb_strlen($description) > 1000) {
        $errors['description'] = 'Announcement description must be 1000 characters or fewer.';
    }

    if (!in_array($type, $allowedTypes, true)) {
        $errors['type'] = 'Invalid announcement type.';
    }

    if ($errors !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the announcement details.',
            'errors' => $errors,
        ]);
    }

    $statement = $pdo->prepare(
        'INSERT INTO announcements (title, description, type, created_by_user_id, published_at)
         VALUES (:title, :description, :type, :created_by_user_id, NOW())'
    );
    $statement->execute([
        'title' => $title,
        'description' => $description,
        'type' => $type,
        'created_by_user_id' => $userId,
    ]);

    jsonResponse(201, [
        'success' => true,
        'message' => 'Announcement posted successfully.',
        'announcements' => fetchAnnouncements($pdo, 20, true),
    ]);
}

function validateAdminAnnouncementUser(PDO $pdo, int $userId, string $role): array
{
    if ($userId < 1 || $role !== 'Administrator') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid administrator account is required.',
        ]);
    }

    $statement = $pdo->prepare(
        'SELECT id, role, firstname, lastname
         FROM users
         WHERE id = :id AND role = :role
         LIMIT 1'
    );
    $statement->execute([
        'id' => $userId,
        'role' => 'Administrator',
    ]);

    $user = $statement->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Administrator account not found.',
        ]);
    }

    return $user;
}

function fetchAnnouncements(PDO $pdo, int $limit = 6, bool $includeAll = false): array
{
    $statement = $pdo->prepare(
        'SELECT a.id, a.title, a.description, a.type, a.published_at, a.created_at, a.updated_at,
                CONCAT_WS(" ", u.firstname, u.lastname) AS created_by_name
         FROM announcements a
         INNER JOIN users u ON u.id = a.created_by_user_id
         ORDER BY ' . ($includeAll ? 'a.published_at DESC, a.id DESC' : 'a.published_at DESC, a.id DESC') . '
         LIMIT :limit_value'
    );
    $statement->bindValue(':limit_value', $limit, PDO::PARAM_INT);
    $statement->execute();

    return array_map(static function (array $announcement): array {
        return [
            'id' => (int) $announcement['id'],
            'title' => (string) $announcement['title'],
            'description' => (string) $announcement['description'],
            'type' => (string) $announcement['type'],
            'publishedAt' => (string) $announcement['published_at'],
            'createdAt' => (string) $announcement['created_at'],
            'updatedAt' => (string) $announcement['updated_at'],
            'createdByName' => trim((string) ($announcement['created_by_name'] ?? '')),
        ];
    }, $statement->fetchAll());
}
