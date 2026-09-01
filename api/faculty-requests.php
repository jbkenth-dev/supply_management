<?php

declare(strict_types=1);

ob_start();

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
        return;
    }

    if ($action === 'confirm_received') {
        handleConfirmReceived($pdo, $payload);
        return;
    }

    handleFacultyRequestCreate($pdo, $payload);
}

function handleFacultyRequestCreate(PDO $pdo, array $payload): void
{
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
    $role = trim((string) ($payload['role'] ?? ''));
    $purpose = trim((string) ($payload['purpose'] ?? ''));
    $department = trim((string) ($payload['department'] ?? ''));
    $dateNeeded = trim((string) ($payload['dateNeeded'] ?? ''));
    $notes = trim((string) ($payload['notes'] ?? ''));
    $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];

    $user = validateFacultyUser($pdo, $userId, $role);

    if ($items === []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Add at least one supply item to your request.',
        ]);
    }

    if ($purpose === '') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Purpose is required.',
        ]);
    }

    if ($department === '') {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Department is required.',
        ]);
    }

    // Check budget sufficiency
    $totalAmount = array_reduce($items, static fn (float $total, array $item): float => $total + ((float) ($item['unitCost'] ?? 0) * (int) ($item['quantity'] ?? 0)), 0.0);
    $budgetCheck = checkBudgetEnough($pdo, $department, $totalAmount);
    if (!$budgetCheck['sufficient']) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Budget Insufficient. Your department does not have enough remaining budget.',
            'budgetInfo' => $budgetCheck,
        ]);
    }

    $normalizedItems = normalizeRequestedItemsV2($items);
    $validatedItems = [];
    $totalQuantity = 0;
    $grandTotal = 0.0;

    foreach ($normalizedItems as $item) {
        if ($item['isCustom']) {
            // "Others" item - custom name, no supply_id
            $customName = trim((string) ($item['customItemName'] ?? ''));
            if ($customName === '') {
                jsonResponse(422, [
                    'success' => false,
                    'message' => 'Please specify the custom item name.',
                ]);
            }
            $validatedItems[] = [
                'supplyId' => null,
                'customItemName' => $customName,
                'quantityRequested' => $item['quantity'],
                'unitCost' => $item['unitCost'],
                'totalAmount' => $item['totalAmount'],
            ];
        } else {
            $supply = findSupplyById($pdo, $item['supplyId']);

            if ($supply === null) {
                jsonResponse(422, [
                    'success' => false,
                    'message' => 'One or more selected supplies no longer exist.',
                ]);
            }

            $validatedItems[] = [
                'supplyId' => (int) $supply['id'],
                'customItemName' => null,
                'quantityRequested' => $item['quantity'],
                'unitCost' => $item['unitCost'],
                'totalAmount' => $item['totalAmount'],
            ];
        }

        $totalQuantity += $item['quantity'];
        $grandTotal += $item['totalAmount'];
    }

    $requestNumber = generateFacultyRequestNumber();

    $pdo->beginTransaction();

    try {
        $insertRequest = $pdo->prepare(
            'INSERT INTO supply_requests (request_number, requested_by_user_id, purpose, department, date_needed, notes, status, total_items, total_quantity, grand_total)
             VALUES (:request_number, :requested_by_user_id, :purpose, :department, :date_needed, :notes, :status, :total_items, :total_quantity, :grand_total)'
        );
        $insertRequest->execute([
            'request_number' => $requestNumber,
            'requested_by_user_id' => (int) $user['id'],
            'purpose' => $purpose !== '' ? $purpose : null,
            'department' => $department !== '' ? $department : null,
            'date_needed' => $dateNeeded !== '' ? $dateNeeded : null,
            'notes' => $notes !== '' ? $notes : null,
            'status' => 'Pending Immediate Head',
            'total_items' => count($validatedItems),
            'total_quantity' => $totalQuantity,
            'grand_total' => $grandTotal,
        ]);

        $requestId = (int) $pdo->lastInsertId();

        $insertItem = $pdo->prepare(
            'INSERT INTO supply_request_items (request_id, supply_id, custom_item_name, unit_cost, total_amount, quantity_requested)
             VALUES (:request_id, :supply_id, :custom_item_name, :unit_cost, :total_amount, :quantity_requested)'
        );

        foreach ($validatedItems as $item) {
            $insertItem->execute([
                'request_id' => $requestId,
                'supply_id' => $item['supplyId'],
                'custom_item_name' => $item['customItemName'],
                'unit_cost' => $item['unitCost'],
                'total_amount' => $item['totalAmount'],
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

    if ($request['status'] !== 'Pending Immediate Head') {
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

function handleConfirmReceived(PDO $pdo, array $payload): void
{
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
    $role = trim((string) ($payload['role'] ?? ''));
    $requestId = isset($payload['requestId']) ? (int) $payload['requestId'] : 0;

    $user = validateFacultyUser($pdo, $userId, $role);

    if ($requestId < 1) {
        jsonResponse(422, ['success' => false, 'message' => 'Valid request is required.']);
    }

    $request = findFacultyRequestById($pdo, (int) $user['id'], $requestId);

    if ($request === null) {
        jsonResponse(404, ['success' => false, 'message' => 'Request not found.']);
    }

    if ($request['status'] !== 'Released') {
        jsonResponse(422, ['success' => false, 'message' => 'Only released requests can be confirmed.']);
    }

    $pdo->prepare(
        'UPDATE supply_requests
         SET status = :status, confirmed_received = 1, completion_date = NOW(), updated_at = NOW()
         WHERE id = :id AND requested_by_user_id = :user_id'
    )->execute([
        'status' => 'Completed',
        'id' => $requestId,
        'user_id' => (int) $user['id'],
    ]);

    // Deduct budget after completion
    $fullRequest = $pdo->prepare('SELECT * FROM supply_requests WHERE id = :id LIMIT 1');
    $fullRequest->execute(['id' => $requestId]);
    $updatedRequest = $fullRequest->fetch();
    if ($updatedRequest) {
        deductDepartmentBudget($pdo, $updatedRequest);
    }

    $requests = fetchFacultyRequests($pdo, (int) $user['id']);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Receipt confirmed. Request completed.',
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

function normalizeRequestedItemsV2(array $items): array
{
    $grouped = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $isCustom = (bool) ($item['isCustom'] ?? false);
        $supplyId = (int) ($item['supplyId'] ?? 0);
        $quantity = (int) ($item['quantity'] ?? 0);
        $unitCost = (float) ($item['unitCost'] ?? 0);
        $customItemName = trim((string) ($item['customItemName'] ?? ''));

        if ($quantity < 1) {
            jsonResponse(422, [
                'success' => false,
                'message' => 'Each requested item must have a valid quantity.',
            ]);
        }

        if ($unitCost < 0) {
            jsonResponse(422, [
                'success' => false,
                'message' => 'Unit cost cannot be negative.',
            ]);
        }

        if ($isCustom) {
            $key = 'custom_' . $customItemName;
            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'isCustom' => true,
                    'supplyId' => 0,
                    'customItemName' => $customItemName,
                    'quantity' => 0,
                    'unitCost' => $unitCost,
                    'totalAmount' => 0.0,
                ];
            }
            $grouped[$key]['quantity'] += $quantity;
            $grouped[$key]['totalAmount'] = $grouped[$key]['quantity'] * $grouped[$key]['unitCost'];
        } else {
            if ($supplyId < 1) {
                jsonResponse(422, [
                    'success' => false,
                    'message' => 'Each requested supply must include a valid item.',
                ]);
            }

            if (!isset($grouped['supply_' . $supplyId])) {
                $grouped['supply_' . $supplyId] = [
                    'isCustom' => false,
                    'supplyId' => $supplyId,
                    'customItemName' => '',
                    'quantity' => 0,
                    'unitCost' => $unitCost,
                    'totalAmount' => 0.0,
                ];
            }
            $grouped['supply_' . $supplyId]['quantity'] += $quantity;
            $grouped['supply_' . $supplyId]['totalAmount'] = $grouped['supply_' . $supplyId]['quantity'] * $grouped['supply_' . $supplyId]['unitCost'];
        }
    }

    return array_values($grouped);
}

function generateFacultyRequestNumber(): string
{
    return 'REQ-' . date('Ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
}

function buildFacultyRequestSummary(array $requests): array
{
    $pendingStatuses = ['Pending', 'Pending Immediate Head', 'Pending Resource Planning Officer', 'Pending VP Finance', 'Pending College President'];
    return [
        'totalRequests' => count($requests),
        'pendingRequests' => count(array_filter($requests, static fn (array $request): bool => in_array($request['status'], $pendingStatuses, true))),
        'approvedRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Approved' || $request['status'] === 'Completed' || $request['status'] === 'Fulfilled')),
        'fulfilledRequests' => count(array_filter($requests, static fn (array $request): bool => in_array($request['status'], ['Fulfilled', 'Completed', 'Received'], true))),
        'rejectedRequests' => count(array_filter($requests, static fn (array $request): bool => $request['status'] === 'Rejected')),
    ];
}

function fetchFacultyRequests(PDO $pdo, int $userId): array
{
    $requestRows = $pdo->prepare(
        'SELECT sr.id, sr.request_number, sr.purpose, sr.department, sr.date_needed, sr.notes, sr.status, sr.total_items, sr.total_quantity, sr.grand_total, sr.review_notes, sr.reviewed_at, sr.created_at, sr.updated_at,
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
                sri.custom_item_name, sri.unit_cost, sri.total_amount,
                s.id AS supply_id, s.item_code, s.name, s.description, s.image_path, s.quantity_on_hand,
                c.id AS category_id, c.name AS category_name
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

    return array_map(static function (array $request) use ($itemsByRequestId): array {
        $requestId = (int) $request['id'];
        return [
            'id' => $requestId,
            'requestNumber' => (string) $request['request_number'],
            'requestedByName' => trim((string) ($request['requested_by_name'] ?? '')),
            'purpose' => $request['purpose'] !== null ? (string) $request['purpose'] : '',
            'department' => $request['department'] !== null ? (string) $request['department'] : '',
            'dateNeeded' => $request['date_needed'] !== null ? (string) $request['date_needed'] : null,
            'grandTotal' => (float) ($request['grand_total'] ?? 0),
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

function checkBudgetEnough(PDO $pdo, string $department, float $amount): array
{
    $stmt = $pdo->prepare(
        'SELECT annual_budget, total_spent,
                (annual_budget - total_spent) AS remaining_budget
         FROM department_budgets
         WHERE department = :department AND fiscal_year = :fiscal_year
         LIMIT 1'
    );
    $stmt->execute([
        'department' => $department,
        'fiscal_year' => (int) date('Y'),
    ]);
    $budget = $stmt->fetch();

    if (!$budget) {
        // No budget set = no restriction
        return ['sufficient' => true, 'remainingBudget' => null, 'requestAmount' => $amount];
    }

    $remainingBudget = (float) $budget['remaining_budget'];

    return [
        'sufficient' => $remainingBudget >= $amount,
        'remainingBudget' => $remainingBudget,
        'requestAmount' => $amount,
        'annualBudget' => (float) $budget['annual_budget'],
        'totalSpent' => (float) $budget['total_spent'],
    ];
}
