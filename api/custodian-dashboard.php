<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';

sendApiHeaders(['GET']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
}

try {
    $pdo = getDatabaseConnection();
    ensureInventoryTables($pdo);
    ensureCustodianRequestTables($pdo);

    $inventorySnapshot = getInventorySnapshot($pdo);
    $stockSnapshot = getStockSnapshot($pdo);
    $requestSummary = getCustodianRequestSummary($pdo);

    $supplies = $inventorySnapshot['supplies'];
    $entries = $stockSnapshot['entries'];

    $outOfStockCount = 0;
    $lowStockCount = 0;
    $totalQuantity = 0;

    foreach ($supplies as $supply) {
        $quantity = (int) ($supply['quantityOnHand'] ?? 0);
        $totalQuantity += $quantity;

        if ($quantity === 0) {
            $outOfStockCount++;
        } elseif ($quantity <= 10) {
            $lowStockCount++;
        }
    }

    jsonResponse(200, [
        'success' => true,
        'stats' => [
            'categories' => count($inventorySnapshot['categories']),
            'supplies' => count($supplies),
            'totalQuantity' => $totalQuantity,
            'outOfStock' => $outOfStockCount,
            'lowStock' => $lowStockCount,
            'pendingRequests' => $requestSummary['pendingRequests'],
            'approvedRequests' => $requestSummary['approvedRequests'],
            'fulfilledToday' => $requestSummary['fulfilledToday'],
            'recentStockEntries' => count($entries),
        ],
        'recentRequests' => getRecentCustodianRequests($pdo),
        'recentEntries' => array_slice($entries, 0, 6),
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to load dashboard data right now.',
    ]);
}

function ensureCustodianRequestTables(PDO $pdo): void
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

    ensureCustodianRequestColumns($pdo);
}

function ensureCustodianRequestColumns(PDO $pdo): void
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
}

function getCustodianRequestSummary(PDO $pdo): array
{
    $statement = $pdo->query(
        'SELECT
            COUNT(*) AS total_requests,
            SUM(CASE WHEN status = "Pending" THEN 1 ELSE 0 END) AS pending_requests,
            SUM(CASE WHEN status = "Approved" THEN 1 ELSE 0 END) AS approved_requests,
            SUM(CASE WHEN status = "Fulfilled" AND DATE(fulfilled_at) = CURDATE() THEN 1 ELSE 0 END) AS fulfilled_today
         FROM supply_requests'
    );

    $summary = $statement->fetch();

    return [
        'totalRequests' => (int) ($summary['total_requests'] ?? 0),
        'pendingRequests' => (int) ($summary['pending_requests'] ?? 0),
        'approvedRequests' => (int) ($summary['approved_requests'] ?? 0),
        'fulfilledToday' => (int) ($summary['fulfilled_today'] ?? 0),
    ];
}

function getRecentCustodianRequests(PDO $pdo): array
{
    $rows = $pdo->query(
        'SELECT sr.id, sr.request_number, sr.status, sr.total_items, sr.total_quantity, sr.issuance_slip_no,
                sr.created_at, sr.reviewed_at, sr.fulfilled_at,
                CONCAT_WS(" ", requester.firstname, requester.lastname) AS requested_by_name
         FROM supply_requests sr
         INNER JOIN users requester ON requester.id = sr.requested_by_user_id
         ORDER BY COALESCE(sr.fulfilled_at, sr.reviewed_at, sr.created_at) DESC, sr.id DESC
         LIMIT 6'
    )->fetchAll();

    return array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'requestNumber' => (string) $row['request_number'],
            'requestedByName' => trim((string) ($row['requested_by_name'] ?? '')),
            'status' => (string) $row['status'],
            'totalItems' => (int) $row['total_items'],
            'totalQuantity' => (int) $row['total_quantity'],
            'issuanceSlipNo' => $row['issuance_slip_no'] !== null ? (string) $row['issuance_slip_no'] : null,
            'createdAt' => (string) $row['created_at'],
            'reviewedAt' => $row['reviewed_at'] !== null ? (string) $row['reviewed_at'] : null,
            'fulfilledAt' => $row['fulfilled_at'] !== null ? (string) $row['fulfilled_at'] : null,
        ];
    }, $rows);
}
