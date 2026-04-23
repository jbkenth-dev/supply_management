<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';
require_once __DIR__ . '/config/notifications.php';

sendApiHeaders(['GET', 'POST']);

try {
    $pdo = getDatabaseConnection();
    ensureInventoryTables($pdo);
    ensureFacultyRequestTables($pdo);
    ensureRequestIssuanceColumns($pdo);
    ensureNotificationTables($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleAdminRequestIssuanceFetch($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleAdminRequestIssuanceAction($pdo);
    }

    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
} catch (PDOException $exception) {
    $message = 'Unable to process request and issuance data right now.';

    if ((int) $exception->getCode() === 1049) {
        $message = 'Database "supply_management" was not found. Import the SQL setup file first.';
    }

    jsonResponse(500, [
        'success' => false,
        'message' => $message,
    ]);
}

function handleAdminRequestIssuanceFetch(PDO $pdo): void
{
    $userId = filter_input(INPUT_GET, 'userId', FILTER_VALIDATE_INT);
    $role = trim((string) ($_GET['role'] ?? ''));
    validateIssuanceManager($pdo, $userId, $role);

    $requests = fetchAllRequestsForAdmin($pdo);

    jsonResponse(200, [
        'success' => true,
        'requests' => $requests,
        'summary' => buildRequestIssuanceSummary($requests),
    ]);
}

function handleAdminRequestIssuanceAction(PDO $pdo): void
{
    $payload = getRequestData();
    $action = trim((string) ($payload['action'] ?? ''));
    $requestId = isset($payload['requestId']) ? (int) $payload['requestId'] : 0;
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
    $role = trim((string) ($payload['role'] ?? ''));
    $reviewNotes = trim((string) ($payload['reviewNotes'] ?? ''));

    $manager = validateIssuanceManager($pdo, $userId, $role);

    if ($requestId < 1) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid request is required.',
        ]);
    }

    if (!in_array($action, ['approve_request', 'reject_request', 'fulfill_request'], true)) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid action.',
        ]);
    }

    if ($action === 'approve_request') {
        approveRequest($pdo, $requestId, (int) $manager['id'], $reviewNotes);
    }

    if ($action === 'reject_request') {
        rejectRequest($pdo, $requestId, (int) $manager['id'], $reviewNotes);
    }

    if ($action === 'fulfill_request') {
        fulfillRequest($pdo, $requestId, (int) $manager['id'], $reviewNotes);
    }
}

function approveRequest(PDO $pdo, int $requestId, int $adminId, string $reviewNotes): void
{
    $request = findRequestById($pdo, $requestId);

    if ($request === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected request was not found.',
        ]);
    }

    if ($request['status'] !== 'Pending') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Only pending requests can be approved.',
        ]);
    }

    foreach ($request['items'] as $item) {
        if ($item['quantityOnHand'] < $item['quantityRequested']) {
            jsonResponse(422, [
                'success' => false,
                'message' => sprintf('Not enough stock for %s. Only %d available.', $item['name'], $item['quantityOnHand']),
            ]);
        }
    }

    $pdo->beginTransaction();

    try {
        $updateRequest = $pdo->prepare(
            'UPDATE supply_requests
             SET status = :status,
                 review_notes = :review_notes,
                 reviewed_by_user_id = :reviewed_by_user_id,
                 reviewed_at = NOW()
             WHERE id = :id'
        );
        $updateRequest->execute([
            'status' => 'Approved',
            'review_notes' => $reviewNotes !== '' ? $reviewNotes : null,
            'reviewed_by_user_id' => $adminId,
            'id' => $requestId,
        ]);

        $updateItems = $pdo->prepare(
            'UPDATE supply_request_items
             SET quantity_approved = quantity_requested
             WHERE request_id = :request_id'
        );
        $updateItems->execute([
            'request_id' => $requestId,
        ]);

        $pdo->commit();
    } catch (Throwable $throwable) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $throwable;
    }

    $updatedRequest = findRequestById($pdo, $requestId);
    $facultyUser = $updatedRequest !== null ? fetchNotificationUserById($pdo, (int) $updatedRequest['requestedByUserId']) : null;
    $actorUser = fetchNotificationUserById($pdo, $adminId);

    if ($updatedRequest !== null && $facultyUser !== null && $actorUser !== null) {
        notifyFacultyAboutRequestDecision($pdo, $updatedRequest, $facultyUser, $actorUser, 'Approved');
    }

    respondWithRequestSnapshot($pdo, 'Request approved successfully.');
}

function rejectRequest(PDO $pdo, int $requestId, int $adminId, string $reviewNotes): void
{
    $request = findRequestById($pdo, $requestId);

    if ($request === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected request was not found.',
        ]);
    }

    if (!in_array($request['status'], ['Pending', 'Approved'], true)) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Only pending or approved requests can be rejected.',
        ]);
    }

    $pdo->beginTransaction();

    try {
        $updateRequest = $pdo->prepare(
            'UPDATE supply_requests
             SET status = :status,
                 review_notes = :review_notes,
                 reviewed_by_user_id = :reviewed_by_user_id,
                 reviewed_at = NOW()
             WHERE id = :id'
        );
        $updateRequest->execute([
            'status' => 'Rejected',
            'review_notes' => $reviewNotes !== '' ? $reviewNotes : null,
            'reviewed_by_user_id' => $adminId,
            'id' => $requestId,
        ]);

        $updateItems = $pdo->prepare(
            'UPDATE supply_request_items
             SET quantity_approved = NULL,
                 quantity_fulfilled = 0
             WHERE request_id = :request_id'
        );
        $updateItems->execute([
            'request_id' => $requestId,
        ]);

        $pdo->commit();
    } catch (Throwable $throwable) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $throwable;
    }

    $updatedRequest = findRequestById($pdo, $requestId);
    $facultyUser = $updatedRequest !== null ? fetchNotificationUserById($pdo, (int) $updatedRequest['requestedByUserId']) : null;
    $actorUser = fetchNotificationUserById($pdo, $adminId);

    if ($updatedRequest !== null && $facultyUser !== null && $actorUser !== null) {
        notifyFacultyAboutRequestDecision($pdo, $updatedRequest, $facultyUser, $actorUser, 'Rejected');
    }

    respondWithRequestSnapshot($pdo, 'Request rejected successfully.');
}

function fulfillRequest(PDO $pdo, int $requestId, int $adminId, string $reviewNotes): void
{
    $request = findRequestById($pdo, $requestId);

    if ($request === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected request was not found.',
        ]);
    }

    if ($request['status'] !== 'Approved') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Only approved requests can be issued.',
        ]);
    }

    foreach ($request['items'] as $item) {
        $approvedQuantity = $item['quantityApproved'] ?? $item['quantityRequested'];

        if ($approvedQuantity < 1) {
            jsonResponse(422, [
                'success' => false,
                'message' => sprintf('Approved quantity for %s is invalid.', $item['name']),
            ]);
        }

        if ($item['quantityOnHand'] < $approvedQuantity) {
            jsonResponse(422, [
                'success' => false,
                'message' => sprintf('Not enough stock to issue %s. Only %d available.', $item['name'], $item['quantityOnHand']),
            ]);
        }
    }

    $issuanceSlipNo = generateIssuanceSlipNumber();

    $pdo->beginTransaction();

    try {
        $updateSupply = $pdo->prepare(
            'UPDATE supplies
             SET quantity_on_hand = quantity_on_hand - :quantity
             WHERE id = :id'
        );

        $updateItems = $pdo->prepare(
            'UPDATE supply_request_items
             SET quantity_fulfilled = :quantity_fulfilled
             WHERE id = :id'
        );

        foreach ($request['items'] as $item) {
            $approvedQuantity = $item['quantityApproved'] ?? $item['quantityRequested'];

            $updateSupply->execute([
                'quantity' => $approvedQuantity,
                'id' => $item['supplyId'],
            ]);

            $updateItems->execute([
                'quantity_fulfilled' => $approvedQuantity,
                'id' => $item['requestItemId'],
            ]);
        }

        $updateRequest = $pdo->prepare(
            'UPDATE supply_requests
             SET status = :status,
                 review_notes = :review_notes,
                 reviewed_by_user_id = :reviewed_by_user_id,
                 reviewed_at = COALESCE(reviewed_at, NOW()),
                 fulfilled_by_user_id = :fulfilled_by_user_id,
                 fulfilled_at = NOW(),
                 issuance_slip_no = :issuance_slip_no
             WHERE id = :id'
        );
        $updateRequest->execute([
            'status' => 'Fulfilled',
            'review_notes' => $reviewNotes !== '' ? $reviewNotes : ($request['reviewNotes'] !== '' ? $request['reviewNotes'] : null),
            'reviewed_by_user_id' => $request['reviewedByUserId'] ?? $adminId,
            'fulfilled_by_user_id' => $adminId,
            'issuance_slip_no' => $issuanceSlipNo,
            'id' => $requestId,
        ]);

        $pdo->commit();
    } catch (Throwable $throwable) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $throwable;
    }

    $updatedRequest = findRequestById($pdo, $requestId);
    $facultyUser = $updatedRequest !== null ? fetchNotificationUserById($pdo, (int) $updatedRequest['requestedByUserId']) : null;
    $actorUser = fetchNotificationUserById($pdo, $adminId);

    if ($updatedRequest !== null && $facultyUser !== null && $actorUser !== null) {
        notifyFacultyAboutRequestDecision($pdo, $updatedRequest, $facultyUser, $actorUser, 'Fulfilled');
    }

    respondWithRequestSnapshot($pdo, 'Issuance completed successfully.');
}

function respondWithRequestSnapshot(PDO $pdo, string $message): void
{
    $requests = fetchAllRequestsForAdmin($pdo);

    jsonResponse(200, [
        'success' => true,
        'message' => $message,
        'requests' => $requests,
        'summary' => buildRequestIssuanceSummary($requests),
    ]);
}

function validateIssuanceManager(PDO $pdo, int|false|null $userId, string $role): array
{
    $allowedRoles = ['Administrator', 'Property Custodian'];

    if (!$userId || !in_array($role, $allowedRoles, true)) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid administrator or property custodian account is required.',
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
        'role' => $role,
    ]);

    $user = $statement->fetch();

    if (!$user) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Authorized account not found.',
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

function ensureRequestIssuanceColumns(PDO $pdo): void
{
    $columns = [
        'fulfilled_by_user_id' => 'ALTER TABLE supply_requests ADD COLUMN fulfilled_by_user_id INT UNSIGNED NULL AFTER reviewed_at',
        'fulfilled_at' => 'ALTER TABLE supply_requests ADD COLUMN fulfilled_at DATETIME NULL AFTER fulfilled_by_user_id',
        'issuance_slip_no' => 'ALTER TABLE supply_requests ADD COLUMN issuance_slip_no VARCHAR(40) NULL AFTER fulfilled_at',
    ];

    foreach ($columns as $columnName => $statement) {
        $checkColumn = $pdo->prepare('SHOW COLUMNS FROM supply_requests LIKE :column_name');
        $checkColumn->execute([
            'column_name' => $columnName,
        ]);

        if (!$checkColumn->fetch()) {
            $pdo->exec($statement);
        }
    }

    $checkConstraint = $pdo->query("SHOW INDEX FROM supply_requests WHERE Key_name = 'idx_supply_requests_issuance_slip_no'");
    $hasIndex = $checkConstraint !== false && $checkConstraint->fetch();

    if (!$hasIndex) {
      $pdo->exec('ALTER TABLE supply_requests ADD INDEX idx_supply_requests_issuance_slip_no (issuance_slip_no)');
    }
}

function fetchAllRequestsForAdmin(PDO $pdo): array
{
    $requestRows = $pdo->query(
        'SELECT sr.id, sr.request_number, sr.notes, sr.status, sr.total_items, sr.total_quantity,
                sr.review_notes, sr.reviewed_at, sr.fulfilled_at, sr.issuance_slip_no, sr.created_at, sr.updated_at,
                sr.reviewed_by_user_id, sr.fulfilled_by_user_id,
                sr.requested_by_user_id,
                CONCAT_WS(" ", requester.firstname, requester.lastname) AS requested_by_name,
                requester.id_number AS requested_by_id_number,
                requester.email AS requested_by_email,
                requester.profile_image_path AS requested_by_profile_image_path,
                CONCAT_WS(" ", reviewer.firstname, reviewer.lastname) AS reviewed_by_name,
                CONCAT_WS(" ", fulfiller.firstname, fulfiller.lastname) AS fulfilled_by_name
         FROM supply_requests sr
         INNER JOIN users requester ON requester.id = sr.requested_by_user_id
         LEFT JOIN users reviewer ON reviewer.id = sr.reviewed_by_user_id
         LEFT JOIN users fulfiller ON fulfiller.id = sr.fulfilled_by_user_id
         ORDER BY sr.created_at DESC, sr.id DESC'
    )->fetchAll();

    if ($requestRows === []) {
        return [];
    }

    $requestIds = array_map(static fn (array $request): int => (int) $request['id'], $requestRows);
    $placeholders = implode(', ', array_fill(0, count($requestIds), '?'));

    $itemsStatement = $pdo->prepare(
        'SELECT sri.id, sri.request_id, sri.quantity_requested, sri.quantity_approved, sri.quantity_fulfilled,
                s.id AS supply_id, s.item_code, s.name, s.description, s.image_path, s.quantity_on_hand,
                c.name AS category_name
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
            'requestItemId' => (int) $item['id'],
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
            'requestedByUserId' => (int) $request['requested_by_user_id'],
            'requestNumber' => (string) $request['request_number'],
            'issuanceSlipNo' => $request['issuance_slip_no'] !== null ? (string) $request['issuance_slip_no'] : null,
            'requestedByName' => trim((string) ($request['requested_by_name'] ?? '')),
            'requestedByIdNumber' => $request['requested_by_id_number'] !== null ? (string) $request['requested_by_id_number'] : '',
            'requestedByEmail' => $request['requested_by_email'] !== null ? (string) $request['requested_by_email'] : '',
            'requestedByProfileImageUrl' => $request['requested_by_profile_image_path'] !== null ? (string) $request['requested_by_profile_image_path'] : null,
            'reviewedByName' => trim((string) ($request['reviewed_by_name'] ?? '')),
            'fulfilledByName' => trim((string) ($request['fulfilled_by_name'] ?? '')),
            'reviewedByUserId' => $request['reviewed_by_user_id'] !== null ? (int) $request['reviewed_by_user_id'] : null,
            'status' => (string) $request['status'],
            'notes' => $request['notes'] !== null ? (string) $request['notes'] : '',
            'reviewNotes' => $request['review_notes'] !== null ? (string) $request['review_notes'] : '',
            'totalItems' => (int) $request['total_items'],
            'totalQuantity' => (int) $request['total_quantity'],
            'createdAt' => (string) $request['created_at'],
            'updatedAt' => (string) $request['updated_at'],
            'reviewedAt' => $request['reviewed_at'] !== null ? (string) $request['reviewed_at'] : null,
            'fulfilledAt' => $request['fulfilled_at'] !== null ? (string) $request['fulfilled_at'] : null,
            'items' => $itemsByRequestId[$requestId] ?? [],
        ];
    }, $requestRows);
}

function findRequestById(PDO $pdo, int $requestId): ?array
{
    foreach (fetchAllRequestsForAdmin($pdo) as $request) {
        if ($request['id'] === $requestId) {
            return $request;
        }
    }

    return null;
}

function buildRequestIssuanceSummary(array $requests): array
{
    return [
        'totalRequests' => count($requests),
        'pendingRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Pending')),
        'approvedRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Approved')),
        'rejectedRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Rejected')),
        'fulfilledRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Fulfilled')),
    ];
}

function generateIssuanceSlipNumber(): string
{
    return 'IS-' . date('Ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
}
