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

    $itemCode = normalizeItemCode((string) ($_GET['itemCode'] ?? ''));

    if ($itemCode !== '') {
        $statement = $pdo->prepare(
            'SELECT s.id, s.item_code, s.name, s.description, s.image_path, s.quantity_on_hand, s.created_at, s.updated_at,
                    c.id AS category_id, c.name AS category_name
             FROM supplies s
             INNER JOIN supply_categories c ON c.id = s.category_id
             WHERE UPPER(s.item_code) = UPPER(:item_code)
             LIMIT 1'
        );
        $statement->execute([
            'item_code' => $itemCode,
        ]);
        $supply = $statement->fetch();

        if (!$supply) {
            jsonResponse(404, [
                'success' => false,
                'message' => 'Supply not found.',
            ]);
        }

        jsonResponse(200, [
            'success' => true,
            'supply' => formatSupply($supply),
        ]);
    }

    $snapshot = getInventorySnapshot($pdo);
    $categories = array_values(array_map(
        static fn (array $category): string => (string) $category['name'],
        $snapshot['categories']
    ));

    jsonResponse(200, [
        'success' => true,
        'categories' => $categories,
        'supplies' => $snapshot['supplies'],
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to load public supply data right now.',
    ]);
}

