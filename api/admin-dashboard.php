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

    $userCounts = getUserCounts($pdo);
    $inventorySnapshot = getInventorySnapshot($pdo);
    $stockSnapshot = getStockSnapshot($pdo);

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
            'totalUsers' => $userCounts['totalUsers'],
            'administrators' => $userCounts['administrators'],
            'custodians' => $userCounts['custodians'],
            'facultyStaff' => $userCounts['facultyStaff'],
            'categories' => count($inventorySnapshot['categories']),
            'supplies' => count($supplies),
            'totalQuantity' => $totalQuantity,
            'outOfStock' => $outOfStockCount,
            'lowStock' => $lowStockCount,
            'recentEntries' => count($entries),
        ],
        'recentEntries' => array_slice($entries, 0, 8),
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to load dashboard data right now.',
    ]);
}

function getUserCounts(PDO $pdo): array
{
    $statement = $pdo->query(
        "SELECT
            COUNT(*) AS total_users,
            SUM(CASE WHEN role = 'Administrator' THEN 1 ELSE 0 END) AS administrators,
            SUM(CASE WHEN role = 'Property Custodian' THEN 1 ELSE 0 END) AS custodians,
            SUM(CASE WHEN role = 'Faculty Staff' THEN 1 ELSE 0 END) AS faculty_staff
         FROM users"
    );

    $counts = $statement->fetch();

    return [
        'totalUsers' => (int) ($counts['total_users'] ?? 0),
        'administrators' => (int) ($counts['administrators'] ?? 0),
        'custodians' => (int) ($counts['custodians'] ?? 0),
        'facultyStaff' => (int) ($counts['faculty_staff'] ?? 0),
    ];
}

