<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';
require_once __DIR__ . '/config/notifications.php';

sendApiHeaders(['GET', 'POST']);

try {
    $pdo = getDatabaseConnection();
    ensureInventoryTables($pdo);
    ensureFacultyRequestTables($pdo);
    ensureCustodianColumns($pdo);
    ensureNotificationTables($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleCustodianFetch($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleCustodianAction($pdo);
    }

    jsonResponse(405, ['success' => false, 'message' => 'Method not allowed.']);
} catch (PDOException $exception) {
    jsonResponse(500, ['success' => false, 'message' => 'Unable to process custodian request.']);
}

function ensureCustodianColumns(PDO $pdo): void
{
    try {
        $pdo->exec("ALTER TABLE supply_requests ADD COLUMN IF NOT EXISTS receipt_path VARCHAR(255) NULL AFTER issuance_slip_no");
        $pdo->exec("ALTER TABLE supply_requests ADD COLUMN IF NOT EXISTS liquidation_path VARCHAR(255) NULL AFTER receipt_path");
        $pdo->exec("ALTER TABLE supply_requests ADD COLUMN IF NOT EXISTS purchase_date DATETIME NULL AFTER liquidation_path");
        $pdo->exec("ALTER TABLE supply_requests ADD COLUMN IF NOT EXISTS release_date DATETIME NULL AFTER purchase_date");
        $pdo->exec("ALTER TABLE supply_requests ADD COLUMN IF NOT EXISTS completion_date DATETIME NULL AFTER release_date");
        $pdo->exec("ALTER TABLE supply_requests ADD COLUMN IF NOT EXISTS confirmed_received TINYINT(1) NOT NULL DEFAULT 0 AFTER completion_date");
    } catch (PDOException $e) {
        // Columns may already exist
    }
}

function handleCustodianFetch(PDO $pdo): void
{
    $userId = filter_input(INPUT_GET, 'userId', FILTER_VALIDATE_INT);

    // Fetch requests approved and awaiting purchase
    $queued = fetchCustodianQueue($pdo);

    // Fetch purchase history
    $history = fetchCustodianHistory($pdo);

    jsonResponse(200, [
        'success' => true,
        'queued' => $queued,
        'history' => $history,
    ]);
}

function handleCustodianAction(PDO $pdo): void
{
    $payload = getRequestData();
    $action = trim((string) ($payload['action'] ?? ''));
    $requestId = isset($payload['requestId']) ? (int) $payload['requestId'] : 0;
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;

    if (!$requestId) {
        jsonResponse(422, ['success' => false, 'message' => 'Valid request ID is required.']);
    }

    $request = findCustodianRequest($pdo, $requestId);

    if ($request === null) {
        jsonResponse(404, ['success' => false, 'message' => 'Request not found.']);
    }

    $user = fetchNotificationUserById($pdo, $userId);

    switch ($action) {
        case 'mark_purchased':
            if ($request['status'] !== 'Approved' && $request['status'] !== 'Waiting Purchase') {
                jsonResponse(422, ['success' => false, 'message' => 'Request is not in a purchasable state.']);
            }

            $receiptPath = null;
            if (!empty($_FILES['receipt'])) {
                $receiptPath = uploadReceiptFile($_FILES['receipt']);
            } elseif (!empty($payload['receipt'])) {
                $receiptPath = $payload['receipt'];
            }

            $updateStmt = $pdo->prepare(
                'UPDATE supply_requests
                 SET status = :status, purchase_date = NOW(), receipt_path = COALESCE(:receipt_path, receipt_path), updated_at = NOW()
                 WHERE id = :id'
            );
            $updateStmt->execute([
                'status' => 'Purchased',
                'receipt_path' => $receiptPath,
                'id' => $requestId,
            ]);

            // Notify requester
            if ($user) {
                notifyPurchased($pdo, $request, $user);
            }
            break;

        case 'mark_ready':
            if ($request['status'] !== 'Purchased') {
                jsonResponse(422, ['success' => false, 'message' => 'Request must be purchased first.']);
            }

            $pdo->prepare('UPDATE supply_requests SET status = :status, updated_at = NOW() WHERE id = :id')
                ->execute(['status' => 'Ready for Release', 'id' => $requestId]);
            break;

        case 'mark_released':
            if ($request['status'] !== 'Ready for Release') {
                jsonResponse(422, ['success' => false, 'message' => 'Request must be ready for release first.']);
            }

            $pdo->prepare('UPDATE supply_requests SET status = :status, release_date = NOW(), updated_at = NOW() WHERE id = :id')
                ->execute(['status' => 'Released', 'id' => $requestId]);

            // Notify requester
            if ($user) {
                notifyReleased($pdo, $request, $user);
            }
            break;

        case 'upload_receipt':
            $receiptPath = null;
            if (!empty($_FILES['receipt'])) {
                $receiptPath = uploadReceiptFile($_FILES['receipt']);
            } else {
                jsonResponse(422, ['success' => false, 'message' => 'No receipt file provided.']);
            }

            $pdo->prepare('UPDATE supply_requests SET receipt_path = :receipt_path, updated_at = NOW() WHERE id = :id')
                ->execute(['receipt_path' => $receiptPath, 'id' => $requestId]);
            break;

        case 'upload_liquidation':
            $liquidationPath = null;
            if (!empty($_FILES['liquidation'])) {
                $liquidationPath = uploadReceiptFile($_FILES['liquidation'], 'liquidation');
            } else {
                jsonResponse(422, ['success' => false, 'message' => 'No liquidation file provided.']);
            }

            $pdo->prepare('UPDATE supply_requests SET liquidation_path = :liquidation_path, updated_at = NOW() WHERE id = :id')
                ->execute(['liquidation_path' => $liquidationPath, 'id' => $requestId]);
            break;

        case 'complete':
            if ($request['status'] !== 'Released') {
                jsonResponse(422, ['success' => false, 'message' => 'Request must be released first.']);
            }

            $pdo->prepare('UPDATE supply_requests SET status = :status, completion_date = NOW(), updated_at = NOW() WHERE id = :id')
                ->execute(['status' => 'Completed', 'id' => $requestId]);

            // Deduct budget after completion
            deductDepartmentBudget($pdo, $request);
            break;

        default:
            jsonResponse(422, ['success' => false, 'message' => 'Invalid action.']);
    }

    jsonResponse(200, ['success' => true, 'message' => 'Action completed successfully.']);
}

function fetchCustodianQueue(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT sr.id, sr.request_number, sr.purpose, sr.department, sr.date_needed, sr.grand_total,
                sr.status, sr.total_items, sr.total_quantity, sr.notes,
                sr.receipt_path, sr.liquidation_path, sr.purchase_date, sr.release_date, sr.completion_date,
                sr.confirmed_received, sr.created_at, sr.updated_at,
                CONCAT_WS(" ", u.firstname, u.lastname) AS requested_by_name,
                u.email AS requested_by_email
         FROM supply_requests sr
         INNER JOIN users u ON u.id = sr.requested_by_user_id
         WHERE sr.status IN ("Approved", "Waiting Purchase", "Purchased", "Ready for Release", "Released")
         ORDER BY sr.created_at ASC'
    );
    $requests = $stmt->fetchAll();
    return mapCustodianRequests($pdo, $requests);
}

function fetchCustodianHistory(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT sr.id, sr.request_number, sr.purpose, sr.department, sr.grand_total,
                sr.status, sr.total_items, sr.total_quantity,
                sr.receipt_path, sr.liquidation_path, sr.purchase_date, sr.release_date, sr.completion_date,
                sr.confirmed_received, sr.created_at, sr.updated_at,
                CONCAT_WS(" ", u.firstname, u.lastname) AS requested_by_name
         FROM supply_requests sr
         INNER JOIN users u ON u.id = sr.requested_by_user_id
         WHERE sr.status IN ("Completed", "Received", "Rejected", "Cancelled")
         ORDER BY sr.updated_at DESC
         LIMIT 50'
    );
    $requests = $stmt->fetchAll();
    return mapCustodianRequests($pdo, $requests);
}

function mapCustodianRequests(PDO $pdo, array $requests): array
{
    if ($requests === []) return [];

    $requestIds = array_map(static fn (array $r): int => (int) $r['id'], $requests);
    $placeholders = implode(', ', array_fill(0, count($requestIds), '?'));

    $itemsStmt = $pdo->prepare(
        'SELECT sri.request_id, sri.custom_item_name, sri.unit_cost, sri.total_amount, sri.quantity_requested, sri.quantity_approved,
                s.id AS supply_id, s.item_code, s.name, c.name AS category_name
         FROM supply_request_items sri
         LEFT JOIN supplies s ON s.id = sri.supply_id
         LEFT JOIN supply_categories c ON c.id = s.category_id
         WHERE sri.request_id IN (' . $placeholders . ')
         ORDER BY sri.id ASC'
    );
    $itemsStmt->execute($requestIds);
    $items = $itemsStmt->fetchAll();

    $itemsByRequestId = [];
    foreach ($items as $item) {
        $rid = (int) $item['request_id'];
        $itemsByRequestId[$rid][] = [
            'supplyId' => $item['supply_id'] !== null ? (int) $item['supply_id'] : null,
            'customItemName' => $item['custom_item_name'] !== null ? (string) $item['custom_item_name'] : null,
            'unitCost' => (float) $item['unit_cost'],
            'totalAmount' => (float) $item['total_amount'],
            'itemCode' => $item['item_code'] !== null ? (string) $item['item_code'] : '',
            'name' => $item['custom_item_name'] !== null ? (string) $item['custom_item_name'] : ((string) ($item['name'] ?? '')),
            'categoryName' => $item['category_name'] !== null ? (string) $item['category_name'] : 'Other',
            'quantityRequested' => (int) $item['quantity_requested'],
            'quantityApproved' => $item['quantity_approved'] !== null ? (int) $item['quantity_approved'] : null,
        ];
    }

    return array_map(static function (array $r) use ($itemsByRequestId): array {
        $rid = (int) $r['id'];
        return [
            'id' => $rid,
            'requestNumber' => (string) $r['request_number'],
            'purpose' => $r['purpose'] !== null ? (string) $r['purpose'] : '',
            'department' => $r['department'] !== null ? (string) $r['department'] : '',
            'dateNeeded' => $r['date_needed'] !== null ? (string) $r['date_needed'] : null,
            'grandTotal' => (float) ($r['grand_total'] ?? 0),
            'status' => (string) $r['status'],
            'totalItems' => (int) $r['total_items'],
            'totalQuantity' => (int) $r['total_quantity'],
            'notes' => $r['notes'] !== null ? (string) $r['notes'] : '',
            'receiptPath' => $r['receipt_path'] !== null ? (string) $r['receipt_path'] : null,
            'liquidationPath' => $r['liquidation_path'] !== null ? (string) $r['liquidation_path'] : null,
            'purchaseDate' => $r['purchase_date'] !== null ? (string) $r['purchase_date'] : null,
            'releaseDate' => $r['release_date'] !== null ? (string) $r['release_date'] : null,
            'completionDate' => $r['completion_date'] !== null ? (string) $r['completion_date'] : null,
            'confirmedReceived' => (bool) $r['confirmed_received'],
            'createdAt' => (string) $r['created_at'],
            'updatedAt' => (string) $r['updated_at'],
            'requestedByName' => trim((string) ($r['requested_by_name'] ?? '')),
            'requestedByEmail' => $r['requested_by_email'] ?? '',
            'items' => $itemsByRequestId[$rid] ?? [],
        ];
    }, $requests);
}

function findCustodianRequest(PDO $pdo, int $requestId): ?array
{
    foreach (fetchCustodianQueue($pdo) as $request) {
        if ($request['id'] === $requestId) return $request;
    }
    foreach (fetchCustodianHistory($pdo) as $request) {
        if ($request['id'] === $requestId) return $request;
    }
    return null;
}

function uploadReceiptFile(array $file, string $prefix = 'receipt'): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('File upload failed.');
    }

    $allowedMimeTypes = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    $mimeType = mime_content_type((string) ($file['tmp_name'] ?? '')) ?: '';
    if (!array_key_exists($mimeType, $allowedMimeTypes)) {
        throw new RuntimeException('File must be PDF, JPG, or PNG.');
    }

    $uploadDir = dirname(__DIR__, 2) . '/public/uploads';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
        throw new RuntimeException('Unable to create upload directory.');
    }

    $filename = sprintf('%s-%s.%s', $prefix, bin2hex(random_bytes(12)), $allowedMimeTypes[$mimeType]);
    $destPath = $uploadDir . '/' . $filename;

    if (!move_uploaded_file((string) ($file['tmp_name'] ?? ''), $destPath)) {
        throw new RuntimeException('Unable to save uploaded file.');
    }

    return '/uploads/' . $filename;
}

function notifyPurchased(PDO $pdo, array $request, array $actor): void
{
    $title = 'Items Purchased';
    $message = sprintf('Your items for request %s have been purchased.', (string) $request['requestNumber']);

    createNotificationRecord(
        $pdo,
        (int) $request['requested_by_user_id'] ?? 0,
        (int) $actor['id'],
        'request_purchased',
        $title,
        $message,
        '/my-requests',
        ['requestId' => $request['id'], 'requestNumber' => $request['requestNumber']]
    );
}

function notifyReleased(PDO $pdo, array $request, array $actor): void
{
    $title = 'Items Released';
    $message = sprintf('Your items for request %s have been released. Please confirm receipt.', (string) $request['requestNumber']);

    createNotificationRecord(
        $pdo,
        (int) $request['requested_by_user_id'] ?? 0,
        (int) $actor['id'],
        'request_released',
        $title,
        $message,
        '/my-requests',
        ['requestId' => $request['id'], 'requestNumber' => $request['requestNumber']]
    );
}

function deductDepartmentBudget(PDO $pdo, array $request): void
{
    $department = $request['department'] ?? '';
    $grandTotal = (float) ($request['grand_total'] ?? 0);

    if ($department === '' || $grandTotal <= 0) return;

    $stmt = $pdo->prepare(
        'UPDATE department_budgets
         SET total_spent = total_spent + :amount, updated_at = NOW()
         WHERE department = :department AND fiscal_year = :fiscal_year'
    );
    $stmt->execute([
        'amount' => $grandTotal,
        'department' => $department,
        'fiscal_year' => (int) date('Y'),
    ]);
}
