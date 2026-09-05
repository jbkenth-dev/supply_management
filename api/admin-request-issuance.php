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
    $issuanceSlipNo = trim((string) ($_GET['issuanceSlipNo'] ?? ''));
    validateIssuanceManager($pdo, $userId, $role);

    $requestId = filter_input(INPUT_GET, 'requestId', FILTER_VALIDATE_INT);

    if ($requestId !== false && $requestId !== null) {
        // Fetch by request ID
        $request = findRequestById($pdo, $requestId);
        $requests = $request ? [$request] : [];
    } elseif ($issuanceSlipNo !== '') {
        // Fetch by issuance slip number
        $request = findRequestByIssuanceSlipNo($pdo, $issuanceSlipNo);
        $requests = $request ? [$request] : [];
    } else {
        // Fetch all requests
        $requests = fetchAllRequestsForAdmin($pdo);
    }

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

    if (!in_array($action, ['approve_request', 'reject_request', 'fulfill_request', 'update_status'], true)) {
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

    if ($action === 'update_status') {
        $nextStatus = trim((string) ($payload['status'] ?? ''));
        updateRequestStatus($pdo, $requestId, (int) $manager['id'], $nextStatus, $reviewNotes);
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

function updateRequestStatus(PDO $pdo, int $requestId, int $adminId, string $nextStatus, string $reviewNotes): void
{
    $request = findRequestById($pdo, $requestId);

    if ($request === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected request was not found.',
        ]);
    }

    $normalizedCurrentStatus = normalizeStatusValue((string) $request['status']);
    $normalizedNextStatus = normalizeStatusValue($nextStatus);

    $allowedTransitions = [
        'Approved' => ['Purchased'],
        'Purchased' => ['Ready for Release'],
        'Ready for Release' => ['Released'],
        'Released' => ['Received'],
        'Received' => ['Completed'],
    ];

    if (!isset($allowedTransitions[$normalizedCurrentStatus]) || !in_array($normalizedNextStatus, $allowedTransitions[$normalizedCurrentStatus], true)) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'The selected status is not a valid next step for this request.',
        ]);
    }

    $pdo->beginTransaction();

    try {
        $updateRequest = $pdo->prepare(
            'UPDATE supply_requests
             SET status = :status,
                 review_notes = :review_notes,
                 reviewed_by_user_id = :reviewed_by_user_id,
                 reviewed_at = COALESCE(reviewed_at, NOW())
             WHERE id = :id'
        );

        $updateRequest->execute([
            'status' => $normalizedNextStatus,
            'review_notes' => $reviewNotes !== '' ? $reviewNotes : ($request['reviewNotes'] !== '' ? $request['reviewNotes'] : null),
            'reviewed_by_user_id' => $adminId,
            'id' => $requestId,
        ]);

        $pdo->commit();
    } catch (Throwable $throwable) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $throwable;
    }

    respondWithRequestSnapshot($pdo, 'Request status updated successfully.');
}

function normalizeStatusValue(string $status): string
{
    $trimmed = trim($status);
    if ($trimmed === '') {
        return $trimmed;
    }

    $lookup = [
        'APPROVED' => 'Approved',
        'APPROVAL' => 'Approved',
        'PURCHASED OR IN STOCK' => 'Purchased',
        'PURCHASED OR IN-STOCK' => 'Purchased',
        'WAITING PURCHASE' => 'Purchased',
        'READY FOR RELEASE' => 'Ready for Release',
        'RELEASED' => 'Released',
        'RECEIVED' => 'Received',
        'COMPLETED' => 'Completed',
    ];

    $normalized = str_replace(['-', '_'], ' ', strtoupper($trimmed));
    $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

    if (isset($lookup[$normalized])) {
        return $lookup[$normalized];
    }

    if ($trimmed === 'Waiting Purchase') {
        return 'Purchased';
    }

    return $trimmed;
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
    // helper to safely fetch column from SHOW query
    $showTableExists = function(string $sql) use ($pdo): bool {
        $stmt = $pdo->query($sql);
        if ($stmt === false) {
            // query failed; treat as false to avoid creating duplicate?
            return false;
        }
        return (bool)$stmt->fetchColumn();
    };
    $showColumnExists = function(string $sql) use ($pdo): bool {
        $stmt = $pdo->query($sql);
        if ($stmt === false) {
            return false;
        }
        return (bool)$stmt->fetchColumn();
    };

    // supply_requests table
    $tableExists = $showTableExists("SHOW TABLES LIKE 'supply_requests'");
    if (!$tableExists) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS supply_requests (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                request_number VARCHAR(40) NOT NULL,
                requested_by_user_id INT UNSIGNED NOT NULL,
                purpose VARCHAR(500) NULL,
                department VARCHAR(100) NULL,
                date_needed DATE NULL,
                notes VARCHAR(500) NULL,
                status ENUM("Pending","Pending Immediate Head","Pending Resource Planning Officer","Pending VP Finance","Pending College President","Approved","Waiting Purchase","Purchased","Ready for Release","Released","Received","Completed","Rejected","Fulfilled","Cancelled") NOT NULL DEFAULT "Pending Immediate Head",
                total_items INT UNSIGNED NOT NULL DEFAULT 0,
                total_quantity INT UNSIGNED NOT NULL DEFAULT 0,
                grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
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
    }

    // supply_request_items table
    $tableExists = $showTableExists("SHOW TABLES LIKE 'supply_request_items'");
    if (!$tableExists) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS supply_request_items (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                request_id BIGINT UNSIGNED NOT NULL,
                supply_id INT UNSIGNED NULL,
                custom_item_name VARCHAR(200) NULL,
                unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                quantity_requested INT UNSIGNED NOT NULL,
                quantity_approved INT UNSIGNED NULL,
                quantity_fulfilled INT UNSIGNED NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_supply_request_items_request
                    FOREIGN KEY (request_id) REFERENCES supply_requests(id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    // approval_log table
    $tableExists = $showTableExists("SHOW TABLES LIKE 'approval_log'");
    if (!$tableExists) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS approval_log (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                request_id BIGINT UNSIGNED NOT NULL,
                approver_user_id INT UNSIGNED NOT NULL,
                approver_role VARCHAR(60) NOT NULL,
                action VARCHAR(40) NOT NULL,
                remarks TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_approval_log_request
                    FOREIGN KEY (request_id) REFERENCES supply_requests(id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE,
                CONSTRAINT fk_approval_log_approver
                    FOREIGN KEY (approver_user_id) REFERENCES users(id)
                    ON UPDATE CASCADE
                    ON DELETE RESTRICT,
                INDEX idx_approval_log_request (request_id, created_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    // department_budgets table
    $tableExists = $showTableExists("SHOW TABLES LIKE 'department_budgets'");
    if (!$tableExists) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS department_budgets (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                department VARCHAR(100) NOT NULL,
                fiscal_year YEAR NOT NULL,
                annual_budget DECIMAL(14,2) NOT NULL DEFAULT 0.00,
                total_spent DECIMAL(14,2) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_dept_fiscal (department, fiscal_year)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    // Ensure purpose column exists (for older installations)
    $colExists = $showColumnExists("SHOW COLUMNS FROM supply_requests LIKE 'purpose'");
    if (!$colExists) {
        try {
            $pdo->exec("ALTER TABLE supply_requests ADD COLUMN purpose VARCHAR(500) NULL AFTER requested_by_user_id");
        } catch (PDOException $e) {
            // column may already exist; ignore
        }
    }

    // Ensure department column exists
    $colExists = $showColumnExists("SHOW COLUMNS FROM supply_requests LIKE 'department'");
    if (!$colExists) {
        try {
            $pdo->exec("ALTER TABLE supply_requests ADD COLUMN department VARCHAR(100) NULL AFTER purpose");
        } catch (PDOException $e) {
            // column may already exist; ignore
        }
    }

    // Ensure date_needed column exists
    $colExists = $showColumnExists("SHOW COLUMNS FROM supply_requests LIKE 'date_needed'");
    if (!$colExists) {
        try {
            $pdo->exec("ALTER TABLE supply_requests ADD COLUMN date_needed DATE NULL AFTER department");
        } catch (PDOException $e) {
            // column may already exist; ignore
        }
    }

    // Ensure grand_total column exists
    $colExists = $showColumnExists("SHOW COLUMNS FROM supply_requests LIKE 'grand_total'");
    if (!$colExists) {
        try {
            $pdo->exec("ALTER TABLE supply_requests ADD COLUMN grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER total_quantity");
        } catch (PDOException $e) {
            // column may already exist; ignore
        }
    }

    // Ensure status column has correct ENUM (best effort)
    try {
        $pdo->exec("ALTER TABLE supply_requests MODIFY COLUMN status ENUM('Pending','Pending Immediate Head','Pending Resource Planning Officer','Pending VP Finance','Pending College President','Approved','Waiting Purchase','Purchased','Ready for Release','Released','Received','Completed','Rejected','Fulfilled','Cancelled') NOT NULL DEFAULT 'Pending Immediate Head'");
    } catch (PDOException $e) {
        // If fails, keep existing
    }

    // Ensure supply_request_items columns
    // custom_item_name
    $colExists = $showColumnExists("SHOW COLUMNS FROM supply_request_items LIKE 'custom_item_name'");
    if (!$colExists) {
        try {
            $pdo->exec("ALTER TABLE supply_request_items ADD COLUMN custom_item_name VARCHAR(200) NULL AFTER supply_id");
        } catch (PDOException $e) {
            // ignore
        }
    }
    // unit_cost
    $colExists = $showColumnExists("SHOW COLUMNS FROM supply_request_items LIKE 'unit_cost'");
    if (!$colExists) {
        try {
            $pdo->exec("ALTER TABLE supply_request_items ADD COLUMN unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER custom_item_name");
        } catch (PDOException $e) {
            // ignore
        }
    }
    // total_amount
    $colExists = $showColumnExists("SHOW COLUMNS FROM supply_request_items LIKE 'total_amount'");
    if (!$colExists) {
        try {
            $pdo->exec("ALTER TABLE supply_request_items ADD COLUMN total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_cost");
        } catch (PDOException $e) {
            // ignore
        }
    }
    // supply_id nullable
    $colExists = $showColumnExists("SHOW COLUMNS FROM supply_request_items LIKE 'supply_id'");
    if ($colExists) {
        // check if it's nullable; we just try to modify to INT UNSIGNED NULL if not already
        // We'll attempt to change to NULL allowed; if fails, ignore.
        try {
            $pdo->exec("ALTER TABLE supply_request_items MODIFY COLUMN supply_id INT UNSIGNED NULL");
        } catch (PDOException $e) {
            // ignore
        }
    }

    // Ensure users table has designation column
    $colExists = $showColumnExists("SHOW COLUMNS FROM users LIKE 'designation'");
    if (!$colExists) {
        try {
            $pdo->exec("ALTER TABLE users ADD COLUMN designation VARCHAR(60) NULL AFTER role");
        } catch (PDOException $e) {
            // column may already exist; ignore
        }
    }
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
        'SELECT sr.id, sr.request_number, sr.purpose, sr.department, sr.date_needed, sr.notes, sr.status, sr.total_items, sr.total_quantity, sr.grand_total,
                sr.review_notes, sr.reviewed_at, sr.fulfilled_at, sr.issuance_slip_no, sr.created_at, sr.updated_at,
                sr.reviewed_by_user_id, sr.fulfilled_by_user_id,
                sr.requested_by_user_id,
                CONCAT_WS(" ", requester.firstname, requester.lastname) AS requested_by_name,
                requester.id_number AS requested_by_id_number,
                requester.email AS requested_by_email,
                requester.profile_image_path AS requested_by_profile_image_path,
                CONCAT_WS(" ", reviewer.firstname, reviewer.lastname) AS reviewed_by_name,
                reviewer.role AS reviewed_by_role,
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
        'SELECT sri.id, sri.request_id, sri.custom_item_name, sri.unit_cost, sri.total_amount, sri.quantity_requested, sri.quantity_approved, sri.quantity_fulfilled,
                s.id AS supply_id, s.item_code, s.name, s.description, s.image_path, s.quantity_on_hand,
                c.name AS category_name
         FROM supply_request_items sri
         LEFT JOIN supplies s ON s.id = sri.supply_id
         LEFT JOIN supply_categories c ON c.id = s.category_id
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
            'supplyId' => $item['supply_id'] !== null ? (int) $item['supply_id'] : null,
            'customItemName' => $item['custom_item_name'] !== null ? (string) $item['custom_item_name'] : null,
            'unitCost' => (float) $item['unit_cost'],
            'totalAmount' => (float) $item['total_amount'],
            'itemCode' => $item['item_code'] !== null ? (string) $item['item_code'] : '',
            'name' => $item['custom_item_name'] !== null ? (string) $item['custom_item_name'] : ((string) ($item['name'] ?? '')),
            'categoryName' => $item['category_name'] !== null ? (string) $item['category_name'] : 'Other',
            'description' => $item['description'] !== null ? (string) $item['description'] : '',
            'imagePath' => $item['image_path'] !== null ? (string) $item['image_path'] : '',
            'quantityRequested' => (int) $item['quantity_requested'],
            'quantityApproved' => $item['quantity_approved'] !== null ? (int) $item['quantity_approved'] : null,
            'quantityFulfilled' => (int) $item['quantity_fulfilled'],
            'quantityOnHand' => $item['quantity_on_hand'] !== null ? (int) $item['quantity_on_hand'] : 0,
        ];
    }

    $rejectionLogsStatement = $pdo->prepare(
        'SELECT al.request_id, al.approver_user_id, al.approver_role,
                CONCAT_WS(" ", approver.firstname, approver.lastname) AS approver_name
         FROM approval_log al
         LEFT JOIN users approver ON approver.id = al.approver_user_id
         WHERE al.request_id IN (' . $placeholders . ') AND LOWER(al.action) = ?
         ORDER BY al.created_at DESC, al.id DESC'
    );
    $rejectionLogsStatement->execute([...$requestIds, 'rejected']);
    $rejectionByRequestId = [];

    foreach ($rejectionLogsStatement->fetchAll() as $rejectionLog) {
        $requestId = (int) $rejectionLog['request_id'];
        if (!isset($rejectionByRequestId[$requestId])) {
            $rejectionByRequestId[$requestId] = $rejectionLog;
        }
    }

    return array_map(static function (array $request) use ($itemsByRequestId, $rejectionByRequestId): array {
        $requestId = (int) $request['id'];
        $rejectionLog = (string) $request['status'] === 'Rejected'
            ? ($rejectionByRequestId[$requestId] ?? null)
            : null;
        $reviewedByName = $rejectionLog !== null
            ? trim((string) ($rejectionLog['approver_name'] ?? ''))
            : trim((string) ($request['reviewed_by_name'] ?? ''));
        $reviewedByRole = $rejectionLog !== null
            ? trim((string) ($rejectionLog['approver_role'] ?? ''))
            : trim((string) ($request['reviewed_by_role'] ?? ''));
        $rejectionReason = $rejectionLog !== null
            ? trim((string) ($rejectionLog['remarks'] ?? ''))
            : '';

        return [
            'id' => $requestId,
            'requestedByUserId' => (int) $request['requested_by_user_id'],
            'requestNumber' => (string) $request['request_number'],
            'purpose' => $request['purpose'] !== null ? (string) $request['purpose'] : '',
            'department' => $request['department'] !== null ? (string) $request['department'] : '',
            'dateNeeded' => $request['date_needed'] !== null ? (string) $request['date_needed'] : null,
            'grandTotal' => (float) ($request['grand_total'] ?? 0),
            'issuanceSlipNo' => $request['issuance_slip_no'] !== null ? (string) $request['issuance_slip_no'] : null,
            'requestedByName' => trim((string) ($request['requested_by_name'] ?? '')),
            'requestedByIdNumber' => $request['requested_by_id_number'] !== null ? (string) $request['requested_by_id_number'] : '',
            'requestedByEmail' => $request['requested_by_email'] !== null ? (string) $request['requested_by_email'] : '',
            'requestedByProfileImageUrl' => $request['requested_by_profile_image_path'] !== null ? (string) $request['requested_by_profile_image_path'] : null,
            'reviewedByName' => $reviewedByName,
            'reviewedByRole' => $reviewedByRole,
            'rejectionReason' => $rejectionReason,
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

function findRequestByIssuanceSlipNo(PDO $pdo, string $issuanceSlipNo): ?array
{
    foreach (fetchAllRequestsForAdmin($pdo) as $request) {
        if ($request['issuanceSlipNo'] === $issuanceSlipNo) {
            return $request;
        }
    }

    return null;
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
    $pendingStatuses = ['Pending', 'Pending Immediate Head', 'Pending Resource Planning Officer', 'Pending VP Finance', 'Pending College President'];
    $fulfilledStatuses = ['Fulfilled', 'Completed', 'Received'];
    return [
        'totalRequests' => count($requests),
        'pendingRequests' => count(array_filter($requests, static fn (array $request): bool => in_array($request['status'], $pendingStatuses, true))),
        'approvedRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Approved')),
        'rejectedRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Rejected')),
        'fulfilledRequests' => count(array_filter($requests, static fn (array $request): bool => in_array($request['status'], $fulfilledStatuses, true))),
    ];
}

function generateIssuanceSlipNumber(): string
{
    return 'IS-' . date('Ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
}
