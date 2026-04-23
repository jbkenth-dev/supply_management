<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';
require_once __DIR__ . '/config/notifications.php';

sendApiHeaders(['GET', 'POST']);

try {
    $pdo = getDatabaseConnection();
    ensureInventoryTables($pdo);
    ensureFacultyRequestTables($pdo);
    ensureNotificationTables($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleFacultyRequestList($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleFacultyRequestPost($pdo);
    }

    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
} catch (PDOException $exception) {
    $message = 'Unable to process faculty requests right now.';

    if ((int) $exception->getCode() === 1049) {
        $message = 'Database "supply_management" was not found. Import the SQL setup file first.';
    }

    jsonResponse(500, [
        'success' => false,
        'message' => $message,
    ]);
}

function handleFacultyRequestList(PDO $pdo): void
{
    $userId = filter_input(INPUT_GET, 'userId', FILTER_VALIDATE_INT);
    $role = trim((string) ($_GET['role'] ?? ''));

    $user = validateFacultyUser($pdo, $userId, $role);
    $requests = fetchFacultyRequests($pdo, (int) $user['id']);

    jsonResponse(200, [
        'success' => true,
        'requests' => $requests,
        'summary' => buildFacultyRequestSummary($requests),
    ]);
}

function handleFacultyRequestPost(PDO $pdo): void
{
    $payload = getRequestData();
    $action = trim((string) ($payload['action'] ?? 'create_request'));

    if ($action === 'cancel_request') {
        handleFacultyRequestCancel($pdo, $payload);
    }

    handleFacultyRequestCreate($pdo, $payload);
}

function handleFacultyRequestCreate(PDO $pdo, array $payload): void
{
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
    $role = trim((string) ($payload['role'] ?? ''));
    $notes = trim((string) ($payload['notes'] ?? ''));
    $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

    $user = validateFacultyUser($pdo, $userId, $role);

    if ($items === []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Add at least one supply item to your request.',
        ]);
    }

    $normalizedItems = normalizeRequestedItems($items);
    $validatedItems = [];
    $totalQuantity = 0;

    foreach ($normalizedItems as $item) {
        $supply = findSupplyById($pdo, $item['supplyId']);

        if ($supply === null) {
            jsonResponse(422, [
                'success' => false,
                'message' => 'One or more selected supplies no longer exist.',
            ]);
        }

        $quantityOnHand = (int) $supply['quantity_on_hand'];

        if ($quantityOnHand < 1) {
            jsonResponse(422, [
                'success' => false,
                'message' => sprintf('%s is currently out of stock.', (string) $supply['name']),
            ]);
        }

        if ($item['quantity'] > $quantityOnHand) {
            jsonResponse(422, [
                'success' => false,
                'message' => sprintf('Only %d unit(s) of %s are available right now.', $quantityOnHand, (string) $supply['name']),
            ]);
        }

        $validatedItems[] = [
            'supplyId' => (int) $supply['id'],
            'quantityRequested' => $item['quantity'],
        ];
        $totalQuantity += $item['quantity'];
    }

    $requestNumber = generateFacultyRequestNumber();

    $pdo->beginTransaction();

    try {
        $insertRequest = $pdo->prepare(
            'INSERT INTO supply_requests (request_number, requested_by_user_id, notes, status, total_items, total_quantity)
             VALUES (:request_number, :requested_by_user_id, :notes, :status, :total_items, :total_quantity)'
        );
        $insertRequest->execute([
            'request_number' => $requestNumber,
            'requested_by_user_id' => (int) $user['id'],
            'notes' => $notes !== '' ? $notes : null,
            'status' => 'Pending',
            'total_items' => count($validatedItems),
            'total_quantity' => $totalQuantity,
        ]);

        $requestId = (int) $pdo->lastInsertId();

        $insertItem = $pdo->prepare(
            'INSERT INTO supply_request_items (request_id, supply_id, quantity_requested)
             VALUES (:request_id, :supply_id, :quantity_requested)'
        );

        foreach ($validatedItems as $item) {
            $insertItem->execute([
                'request_id' => $requestId,
                'supply_id' => $item['supplyId'],
                'quantity_requested' => $item['quantityRequested'],
            ]);
        }

        $pdo->commit();
    } catch (Throwable $throwable) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $throwable;
    }

    $requests = fetchFacultyRequests($pdo, (int) $user['id']);
    $createdRequest = null;

    foreach ($requests as $request) {
        if ($request['requestNumber'] === $requestNumber) {
            $createdRequest = $request;
            break;
        }
    }

    $facultyNotificationUser = fetchNotificationUserById($pdo, (int) $user['id']);

    if ($createdRequest !== null && $facultyNotificationUser !== null) {
        notifyOfficeUsersAboutFacultyRequest($pdo, $createdRequest, $facultyNotificationUser);
    }

    jsonResponse(201, [
        'success' => true,
        'message' => 'Supply request submitted successfully.',
        'request' => $createdRequest,
    ]);
}

function handleFacultyRequestCancel(PDO $pdo, array $payload): void
{
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
    $role = trim((string) ($payload['role'] ?? ''));
    $requestId = isset($payload['requestId']) ? (int) $payload['requestId'] : 0;

    $user = validateFacultyUser($pdo, $userId, $role);

    if ($requestId < 1) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid request is required.',
        ]);
    }

    $request = findFacultyRequestById($pdo, (int) $user['id'], $requestId);

    if ($request === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected request was not found.',
        ]);
    }

    if ($request['status'] !== 'Pending') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Only pending requests can be cancelled.',
        ]);
    }

    $statement = $pdo->prepare(
        'UPDATE supply_requests
         SET status = :status,
             updated_at = NOW()
         WHERE id = :id AND requested_by_user_id = :user_id'
    );
    $statement->execute([
        'status' => 'Cancelled',
        'id' => $requestId,
        'user_id' => (int) $user['id'],
    ]);

    $requests = fetchFacultyRequests($pdo, (int) $user['id']);
    $updatedRequest = findFacultyRequestById($pdo, (int) $user['id'], $requestId);
    $facultyNotificationUser = fetchNotificationUserById($pdo, (int) $user['id']);

    if ($updatedRequest !== null && $facultyNotificationUser !== null) {
        notifyOfficeUsersAboutFacultyRequestCancellation($pdo, $updatedRequest, $facultyNotificationUser);
    }

    jsonResponse(200, [
        'success' => true,
        'message' => 'Request cancelled successfully.',
        'requests' => $requests,
        'summary' => buildFacultyRequestSummary($requests),
    ]);
}

function validateFacultyUser(PDO $pdo, int|false|null $userId, string $role): array
{
    if (!$userId || $role !== 'Faculty Staff') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid faculty account is required.',
        ]);
    }

    $statement = $pdo->prepare(
        'SELECT id, role, firstname, middlename, lastname
         FROM users
         WHERE id = :id AND role = :role
         LIMIT 1'
    );
    $statement->execute([
        'id' => $userId,
        'role' => 'Faculty Staff',
    ]);

    $user = $statement->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Faculty account not found.',
        ]);
    }

    return $user;
}

function ensureFacultyRequestTables(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS supply_requests (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            request_number VARCHAR(40) NOT NULL,
            requested_by_user_id INT UNSIGNED NOT NULL,
            notes VARCHAR(500) NULL,
            status ENUM("Pending","Approved","Rejected","Fulfilled","Cancelled") NOT NULL DEFAULT "Pending",
            total_items INT UNSIGNED NOT NULL DEFAULT 0,
            total_quantity INT UNSIGNED NOT NULL DEFAULT 0,
            reviewed_by_user_id INT UNSIGNED NULL,
            review_notes VARCHAR(500) NULL,
            reviewed_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_supply_request_number (request_number),
            CONSTRAINT fk_supply_requests_requested_by
                FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE RESTRICT,
            CONSTRAINT fk_supply_requests_reviewed_by
                FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS supply_request_items (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            request_id BIGINT UNSIGNED NOT NULL,
            supply_id INT UNSIGNED NOT NULL,
            quantity_requested INT UNSIGNED NOT NULL,
            quantity_approved INT UNSIGNED NULL,
            quantity_fulfilled INT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_supply_request_items_request
                FOREIGN KEY (request_id) REFERENCES supply_requests(id)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT fk_supply_request_items_supply
                FOREIGN KEY (supply_id) REFERENCES supplies(id)
                ON UPDATE CASCADE
                ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function normalizeRequestedItems(array $items): array
{
    $grouped = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $supplyId = (int) ($item['supplyId'] ?? 0);
        $quantity = (int) ($item['quantity'] ?? 0);

        if ($supplyId < 1 || $quantity < 1) {
            jsonResponse(422, [
                'success' => false,
                'message' => 'Each requested supply must include a valid item and quantity.',
            ]);
        }

        if (!isset($grouped[$supplyId])) {
            $grouped[$supplyId] = [
                'supplyId' => $supplyId,
                'quantity' => 0,
            ];
        }

        $grouped[$supplyId]['quantity'] += $quantity;
    }

    return array_values($grouped);
}

function generateFacultyRequestNumber(): string
{
    return 'REQ-' . date('Ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
}

function buildFacultyRequestSummary(array $requests): array
{
    return [
        'totalRequests' => count($requests),
        'pendingRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Pending')),
        'approvedRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Approved')),
        'fulfilledRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Fulfilled')),
        'rejectedRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Rejected')),
    ];
}

function fetchFacultyRequests(PDO $pdo, int $userId): array
{
    $requestRows = $pdo->prepare(
        'SELECT sr.id, sr.request_number, sr.notes, sr.status, sr.total_items, sr.total_quantity, sr.review_notes, sr.reviewed_at, sr.created_at, sr.updated_at,
                CONCAT_WS(" ", u.firstname, u.lastname) AS requested_by_name
         FROM supply_requests sr
         INNER JOIN users u ON u.id = sr.requested_by_user_id
         WHERE sr.requested_by_user_id = :user_id
         ORDER BY sr.created_at DESC, sr.id DESC'
    );
    $requestRows->execute([
        'user_id' => $userId,
    ]);
    $requests = $requestRows->fetchAll();

    if ($requests === []) {
        return [];
    }

    $requestIds = array_map(static fn (array $request): int => (int) $request['id'], $requests);
    $placeholders = implode(', ', array_fill(0, count($requestIds), '?'));

    $itemsStatement = $pdo->prepare(
        'SELECT sri.request_id, sri.quantity_requested, sri.quantity_approved, sri.quantity_fulfilled,
                s.id AS supply_id, s.item_code, s.name, s.description, s.image_path, s.quantity_on_hand,
                c.id AS category_id, c.name AS category_name
         FROM supply_request_items sri
         INNER JOIN supplies s ON s.id = sri.supply_id
         INNER JOIN supply_categories c ON c.id = s.category_id
         WHERE sri.request_id IN (' . $placeholders . ')
         ORDER BY sri.id ASC'
    );
    $itemsStatement->execute($requestIds);
    $items = $itemsStatement->fetchAll();

    $itemsByRequestId = [];

    foreach ($items as $item) {
        $requestId = (int) $item['request_id'];
        $itemsByRequestId[$requestId][] = [
            'supplyId' => (int) $item['supply_id'],
            'itemCode' => (string) $item['item_code'],
            'name' => (string) $item['name'],
            'categoryName' => (string) $item['category_name'],
            'description' => $item['description'] !== null ? (string) $item['description'] : '',
            'imagePath' => $item['image_path'] !== null ? (string) $item['image_path'] : '',
            'quantityRequested' => (int) $item['quantity_requested'],
            'quantityApproved' => $item['quantity_approved'] !== null ? (int) $item['quantity_approved'] : null,
            'quantityFulfilled' => (int) $item['quantity_fulfilled'],
            'quantityOnHand' => (int) $item['quantity_on_hand'],
        ];
    }

    return array_map(static function (array $request) use ($itemsByRequestId): array {
        $requestId = (int) $request['id'];
        return [
            'id' => $requestId,
            'requestNumber' => (string) $request['request_number'],
            'requestedByName' => trim((string) ($request['requested_by_name'] ?? '')),
            'status' => (string) $request['status'],
            'notes' => $request['notes'] !== null ? (string) $request['notes'] : '',
            'reviewNotes' => $request['review_notes'] !== null ? (string) $request['review_notes'] : '',
            'totalItems' => (int) $request['total_items'],
            'totalQuantity' => (int) $request['total_quantity'],
            'createdAt' => (string) $request['created_at'],
            'updatedAt' => (string) $request['updated_at'],
            'reviewedAt' => $request['reviewed_at'] !== null ? (string) $request['reviewed_at'] : null,
            'items' => $itemsByRequestId[$requestId] ?? [],
        ];
    }, $requests);
}

function findFacultyRequestById(PDO $pdo, int $userId, int $requestId): ?array
{
    foreach (fetchFacultyRequests($pdo, $userId) as $request) {
        if ((int) $request['id'] === $requestId) {
            return $request;
        }
    }

    return null;
}
