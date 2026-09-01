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
        handleApprovalWorkflowFetch($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleApprovalWorkflowAction($pdo);
    }

    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to process approval workflow.',
    ]);
}

function handleApprovalWorkflowFetch(PDO $pdo): void
{
    $userId = filter_input(INPUT_GET, 'userId', FILTER_VALIDATE_INT);
    $role = trim((string) ($_GET['role'] ?? ''));
    $designation = trim((string) ($_GET['designation'] ?? ''));
    $showAll = filter_input(INPUT_GET, 'showAll', FILTER_VALIDATE_BOOL);

    if (!$userId) {
        jsonResponse(422, ['success' => false, 'message' => 'Valid user ID is required.']);
    }

    // Find the user
    $user = findApprovalUser($pdo, $userId);

    // If showAll is true, we check if the user is an approval personnel before showing all requests
    if ($showAll) {
        // Check if user has an approval designation
        $isApprovalPersonnel = getApproverTargetStatus($designation) !== null;

        if (!$isApprovalPersonnel) {
            jsonResponse(403, [
                'success' => false,
                'message' => 'Access denied. Approval personnel only.',
            ]);
            return;
        }

        $requests = fetchAllApprovalRequests($pdo);
        $approvalHistory = fetchApprovalHistory($pdo, $userId);

        jsonResponse(200, [
            'success' => true,
            'requests' => $requests,
            'approvalHistory' => $approvalHistory,
        ]);
        return;
    }

    // Determine which statuses this approver can see
    $targetStatus = getApproverTargetStatus($designation ?: $user['designation']);

    if ($targetStatus === null) {
        jsonResponse(200, [
            'success' => true,
            'requests' => [],
            'approvalHistory' => [],
            'message' => 'No matching approval queue for this role.',
        ]);
        return;
    }

    $requests = fetchApprovalQueue($pdo, $targetStatus);
    $approvalHistory = fetchApprovalHistory($pdo, $userId);

    jsonResponse(200, [
        'success' => true,
        'requests' => $requests,
        'approvalHistory' => $approvalHistory,
    ]);
}

function handleApprovalWorkflowAction(PDO $pdo): void
{
    $payload = getRequestData();
    $userId = isset($payload['userId']) ? (int) $payload['userId'] : 0;
    $requestId = isset($payload['requestId']) ? (int) $payload['requestId'] : 0;
    $action = trim((string) ($payload['action'] ?? ''));
    $remarks = trim((string) ($payload['remarks'] ?? ''));

    if (!$userId || !$requestId || !in_array($action, ['approve', 'reject'], true)) {
        jsonResponse(422, ['success' => false, 'message' => 'Invalid request parameters.']);
    }

    $user = findApprovalUser($pdo, $userId);
    $designation = (string) ($user['designation'] ?? $user['role']);

    // Fetch the request
    $request = findRequestForApproval($pdo, $requestId);

    if ($request === null) {
        jsonResponse(404, ['success' => false, 'message' => 'Request not found.']);
    }

    // Validate this approver can act on this request
    $currentStatus = $request['status'];
    $allowedStatus = getApproverTargetStatus($designation);

    if ($allowedStatus === null || $currentStatus !== $allowedStatus) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'This request is not in your approval queue or has already been processed.',
        ]);
    }

    // Check if this approver already approved
    $logCheck = $pdo->prepare(
        'SELECT id FROM approval_log WHERE request_id = :request_id AND approver_user_id = :user_id AND action = :action LIMIT 1'
    );
    $logCheck->execute([
        'request_id' => $requestId,
        'user_id' => $userId,
        'action' => 'approved',
    ]);
    if ($logCheck->fetch()) {
        jsonResponse(422, ['success' => false, 'message' => 'You have already approved this request.']);
    }

    $pdo->beginTransaction();

    try {
        // Determine next status
        if ($action === 'approve') {
            $nextStatus = getNextApprovalStatus($currentStatus);
        } else {
            $nextStatus = 'Rejected';
        }

        // Update request status
        $updateStmt = $pdo->prepare(
            'UPDATE supply_requests SET status = :status, updated_at = NOW() WHERE id = :id'
        );
        $updateStmt->execute([
            'status' => $nextStatus,
            'id' => $requestId,
        ]);

        // Log the approval action
        $logStmt = $pdo->prepare(
            'INSERT INTO approval_log (request_id, approver_user_id, approver_role, action, remarks)
             VALUES (:request_id, :approver_user_id, :approver_role, :action, :remarks)'
        );
        $logStmt->execute([
            'request_id' => $requestId,
            'approver_user_id' => $userId,
            'approver_role' => $designation,
            'action' => $action === 'approve' ? 'approved' : 'rejected',
            'remarks' => $remarks !== '' ? $remarks : null,
        ]);

        $pdo->commit();
    } catch (Throwable $throwable) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $throwable;
    }

    // Send notifications
    notifyApprovalAction($pdo, $request, $user, $action, $remarks, $nextStatus);

    jsonResponse(200, [
        'success' => true,
        'message' => $action === 'approve' ? 'Request approved successfully.' : 'Request rejected.',
    ]);
}

function findApprovalUser(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, role, designation, firstname, middlename, lastname, email
         FROM users WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(404, ['success' => false, 'message' => 'User not found.']);
    }

    $user['full_name'] = trim(implode(' ', array_filter([
        (string) ($user['firstname'] ?? ''),
        $user['middlename'] !== null ? (string) $user['middlename'] : '',
        (string) ($user['lastname'] ?? ''),
    ])));

    return $user;
}

function getApproverTargetStatus(string $designation): ?string
{
    $map = [
        'Immediate Head' => 'Pending Immediate Head',
        'Department Head' => 'Pending Immediate Head',
        'Budget Officer' => 'Pending Budget Officer',
        'VP Finance' => 'Pending VP Finance',
        'Vice President for Finance' => 'Pending VP Finance',
        'College President' => 'Pending College President',
        'President' => 'Pending College President',
    ];

    return $map[$designation] ?? null;
}

function getNextApprovalStatus(string $currentStatus): string
{
    $flow = [
        'Pending Immediate Head' => 'Pending Budget Officer',
        'Pending Budget Officer' => 'Pending VP Finance',
        'Pending VP Finance' => 'Pending College President',
        'Pending College President' => 'Approved',
    ];

    return $flow[$currentStatus] ?? $currentStatus;
}

function fetchAllApprovalRequests(PDO $pdo): array
{
    // Fetch all requests that are still in the approval workflow (not finalized)
    // Final statuses: Rejected, Completed, Fulfilled, Cancelled
    // We include Approved so approvers can see what they've approved
    $stmt = $pdo->prepare(
        'SELECT sr.id, sr.request_number, sr.purpose, sr.department, sr.date_needed, sr.grand_total,
                sr.status, sr.total_items, sr.total_quantity, sr.notes, sr.created_at, sr.updated_at,
                CONCAT_WS(" ", u.firstname, u.lastname) AS requested_by_name,
                u.id_number AS requested_by_id_number,
                u.email AS requested_by_email
         FROM supply_requests sr
         INNER JOIN users u ON u.id = sr.requested_by_user_id
         WHERE sr.status NOT IN (
             "Rejected", "Completed", "Fulfilled", "Cancelled"
         )
         ORDER BY sr.created_at ASC, sr.id ASC'
    );
    $stmt->execute();
    $requests = $stmt->fetchAll();

    if ($requests === []) {
        return [];
    }

    $requestIds = array_map(static fn (array $r): int => (int) $r['id'], $requests);
    $placeholders = implode(', ', array_fill(0, count($requestIds), '?'));

    // Fetch items
    $itemsStmt = $pdo->prepare(
        'SELECT sri.request_id, sri.custom_item_name, sri.unit_cost, sri.total_amount, sri.quantity_requested,
                s.id AS supply_id, s.item_code, s.name, s.description, s.image_path,
                c.name AS category_name
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
            'description' => $item['description'] !== null ? (string) $item['description'] : '',
            'imagePath' => $item['image_path'] !== null ? (string) $item['image_path'] : '',
            'quantityRequested' => (int) $item['quantity_requested'],
        ];
    }

    // Fetch approval logs for these requests
    $logsStmt = $pdo->prepare(
        'SELECT al.*, CONCAT_WS(" ", u.firstname, u.lastname) AS approver_name
         FROM approval_log al
         LEFT JOIN users u ON u.id = al.approver_user_id
         WHERE al.request_id IN (' . $placeholders . ')
         ORDER BY al.created_at ASC'
    );
    $logsStmt->execute($requestIds);
    $logs = $logsStmt->fetchAll();

    $logsByRequestId = [];
    foreach ($logs as $log) {
        $rid = (int) $log['request_id'];
        $logsByRequestId[$rid][] = [
            'id' => (int) $log['id'],
            'approverUserId' => (int) $log['approver_user_id'],
            'approverRole' => (string) $log['approver_role'],
            'action' => (string) $log['action'],
            'remarks' => $log['remarks'] !== null ? (string) $log['remarks'] : '',
            'approverName' => trim((string) ($log['approver_name'] ?? '')),
            'createdAt' => (string) $log['created_at'],
        ];
    }

    return array_map(static function (array $r) use ($itemsByRequestId, $logsByRequestId): array {
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
            'createdAt' => (string) $r['created_at'],
            'updatedAt' => (string) $r['updated_at'],
            'requestedByName' => trim((string) ($r['requested_by_name'] ?? '')),
            'requestedByIdNumber' => $r['requested_by_id_number'] !== null ? (string) $r['requested_by_id_number'] : '',
            'requestedByEmail' => (string) $r['requested_by_email'],
            'items' => $itemsByRequestId[$rid] ?? [],
            'approvalLogs' => $logsByRequestId[$rid] ?? [],
        ];
    }, $requests);
}

function findRequestForApproval(PDO $pdo, int $requestId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT * FROM supply_requests WHERE id = :id LIMIT 1'
    );
    $stmt->execute(['id' => $requestId]);
    $request = $stmt->fetch();
    return $request ?: null;
}

function fetchApprovalHistory(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT al.*, sr.request_number,
                CONCAT_WS(" ", u.firstname, u.lastname) AS requester_name
         FROM approval_log al
         INNER JOIN supply_requests sr ON sr.id = al.request_id
         INNER JOIN users u ON u.id = sr.requested_by_user_id
         WHERE al.approver_user_id = :user_id
         ORDER BY al.created_at DESC
         LIMIT 20'
    );
    $stmt->execute(['user_id' => $userId]);
    $logs = $stmt->fetchAll();

    return array_map(static function (array $log): array {
        return [
            'id' => (int) $log['id'],
            'requestId' => (int) $log['request_id'],
            'requestNumber' => (string) $log['request_number'],
            'action' => (string) $log['action'],
            'remarks' => $log['remarks'] !== null ? (string) $log['remarks'] : '',
            'requesterName' => trim((string) ($log['requester_name'] ?? '')),
            'createdAt' => (string) $log['created_at'],
        ];
    }, $logs);
}

function notifyApprovalAction(PDO $pdo, array $request, array $approver, string $action, string $remarks, string $newStatus): void
{
    // Notify the requester
    $statusLabel = $action === 'approve' ? 'Approved' : 'Rejected';
    $title = 'Request ' . $statusLabel;
    $message = sprintf(
        '%s has %s your request %s.',
        $approver['full_name'],
        strtolower($statusLabel),
        (string) $request['request_number']
    );

    createNotificationRecord(
        $pdo,
        (int) $request['requested_by_user_id'],
        (int) $approver['id'],
        'request_' . strtolower($statusLabel),
        $title,
        $message,
        '/my-requests',
        [
            'requestId' => (int) $request['id'],
            'requestNumber' => (string) $request['request_number'],
            'requestStatus' => $newStatus,
        ]
    );

    // If approved and there's a next approver, notify them
    if ($action === 'approve' && $newStatus !== 'Approved') {
        $nextDesignation = getNextApproverDesignation($newStatus);
        if ($nextDesignation !== null) {
            $nextApprovers = fetchUsersByDesignation($pdo, $nextDesignation);
            foreach ($nextApprovers as $nextApprover) {
                createNotificationRecord(
                    $pdo,
                    (int) $nextApprover['id'],
                    (int) $approver['id'],
                    'request_submitted',
                    'New Request for Approval',
                    sprintf(
                        'Request %s from %s needs your approval.',
                        (string) $request['request_number'],
                        trim((string) ($request['requested_by_name'] ?? 'Faculty'))
                    ),
                    getApproverPath($newStatus),
                    [
                        'requestId' => (int) $request['id'],
                        'requestNumber' => (string) $request['request_number'],
                    ]
                );
            }
        }
    }
}

function getNextApproverDesignation(string $nextStatus): ?string
{
    $map = [
        'Pending Budget Officer' => 'Budget Officer',
        'Pending VP Finance' => 'VP Finance',
        'Pending College President' => 'College President',
    ];

    return $map[$nextStatus] ?? null;
}

function getApproverPath(string $status): string
{
    $map = [
        'Pending Budget Officer' => '/approval/budget-officer',
        'Pending VP Finance' => '/approval/vp-finance',
        'Pending College President' => '/approval/president',
        'Approved' => '/approval/completed',
    ];

    return $map[$status] ?? '/dashboard';
}

function fetchUsersByDesignation(PDO $pdo, string $designation): array
{
    $stmt = $pdo->prepare(
        'SELECT id, role, designation, firstname, middlename, lastname, email
         FROM users
         WHERE designation = :designation
         ORDER BY firstname ASC'
    );
    $stmt->execute(['designation' => $designation]);
    $users = $stmt->fetchAll();

    return array_map(static function (array $user): array {
        return [
            'id' => (int) $user['id'],
            'role' => (string) $user['role'],
            'designation' => $user['designation'] !== null ? (string) $user['designation'] : '',
            'full_name' => trim(implode(' ', array_filter([
                (string) ($user['firstname'] ?? ''),
                $user['middlename'] !== null ? (string) $user['middlename'] : '',
                (string) ($user['lastname'] ?? ''),
            ]))),
        ];
    }, $users);
}