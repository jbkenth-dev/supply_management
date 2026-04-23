<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';

function sendApiHeaders(array $allowedMethods): void
{
    header('Content-Type: application/json; charset=utf-8');

    $allowedOrigins = [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
    ];

    if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: ' . implode(', ', $allowedMethods) . ', OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

function getJsonInput(): array
{
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput ?: '', true);

    return is_array($payload) ? $payload : [];
}

function getRequestData(): array
{
    if (!empty($_POST)) {
        return $_POST;
    }

    return getJsonInput();
}

function ensureInventoryTables(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS supply_categories (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_supply_category_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS supplies (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            category_id INT UNSIGNED NOT NULL,
            item_code VARCHAR(60) NOT NULL,
            name VARCHAR(150) NOT NULL,
            description VARCHAR(500) NULL,
            image_path VARCHAR(255) NULL,
            quantity_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_supply_item_code (item_code),
            UNIQUE KEY unique_supply_name (name),
            CONSTRAINT fk_supplies_category
                FOREIGN KEY (category_id) REFERENCES supply_categories(id)
                ON UPDATE CASCADE
                ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    ensureSuppliesItemCodeColumn($pdo);

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS stock_entries (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            supply_id INT UNSIGNED NOT NULL,
            quantity INT UNSIGNED NOT NULL,
            reference_no VARCHAR(60) NULL,
            remarks VARCHAR(255) NULL,
            created_by_user_id INT UNSIGNED NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_stock_entries_supply
                FOREIGN KEY (supply_id) REFERENCES supplies(id)
                ON UPDATE CASCADE
                ON DELETE RESTRICT,
            CONSTRAINT fk_stock_entries_user
                FOREIGN KEY (created_by_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function findCategoryById(PDO $pdo, int $categoryId): ?array
{
    $statement = $pdo->prepare('SELECT id, name FROM supply_categories WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $categoryId]);
    $category = $statement->fetch();

    return $category ?: null;
}

function findSupplyById(PDO $pdo, int $supplyId): ?array
{
    $statement = $pdo->prepare(
        'SELECT s.id, s.category_id, s.item_code, s.name, s.description, s.image_path, s.quantity_on_hand,
                c.name AS category_name
         FROM supplies s
         INNER JOIN supply_categories c ON c.id = s.category_id
         WHERE s.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $supplyId]);
    $supply = $statement->fetch();

    return $supply ?: null;
}

function getInventorySnapshot(PDO $pdo): array
{
    $categories = $pdo->query(
        'SELECT c.id, c.name, COUNT(s.id) AS supply_count
         FROM supply_categories c
         LEFT JOIN supplies s ON s.category_id = c.id
         GROUP BY c.id, c.name
         ORDER BY c.name ASC'
    )->fetchAll();

    $supplies = $pdo->query(
        'SELECT s.id, s.item_code, s.name, s.description, s.image_path, s.quantity_on_hand, s.created_at, s.updated_at,
                c.id AS category_id, c.name AS category_name
         FROM supplies s
         INNER JOIN supply_categories c ON c.id = s.category_id
         ORDER BY s.name ASC'
    )->fetchAll();

    return [
        'categories' => array_map(static function (array $category): array {
            return [
                'id' => (int) $category['id'],
                'name' => (string) $category['name'],
                'supplyCount' => (int) $category['supply_count'],
            ];
        }, $categories),
        'supplies' => array_map(static function (array $supply): array {
            return formatSupply($supply);
        }, $supplies),
    ];
}

function getStockSnapshot(PDO $pdo, string $search = ''): array
{
    $parameters = [];
    $whereClause = '';

    if ($search !== '') {
        $whereClause = 'WHERE s.name LIKE :search OR s.item_code LIKE :search OR c.name LIKE :search';
        $parameters['search'] = '%' . $search . '%';
    }

    $suppliesStatement = $pdo->prepare(
        'SELECT s.id, s.item_code, s.name, s.description, s.image_path, s.quantity_on_hand, s.updated_at,
                c.id AS category_id, c.name AS category_name
         FROM supplies s
         INNER JOIN supply_categories c ON c.id = s.category_id
         ' . $whereClause . '
         ORDER BY s.name ASC'
    );
    $suppliesStatement->execute($parameters);
    $supplies = $suppliesStatement->fetchAll();

    $entriesStatement = $pdo->prepare(
        'SELECT se.id, se.quantity, se.reference_no, se.remarks, se.created_at,
                s.id AS supply_id, s.item_code AS supply_item_code, s.name AS supply_name,
                c.name AS category_name,
                CONCAT_WS(" ", u.firstname, u.lastname) AS created_by_name
         FROM stock_entries se
         INNER JOIN supplies s ON s.id = se.supply_id
         INNER JOIN supply_categories c ON c.id = s.category_id
         LEFT JOIN users u ON u.id = se.created_by_user_id
         ' . ($search !== '' ? 'WHERE s.name LIKE :entry_search OR s.item_code LIKE :entry_search OR c.name LIKE :entry_search OR se.reference_no LIKE :entry_search' : '') . '
         ORDER BY se.created_at DESC
         LIMIT 25'
    );

    if ($search !== '') {
        $entriesStatement->execute([
            'entry_search' => '%' . $search . '%',
        ]);
    } else {
        $entriesStatement->execute();
    }

    $entries = $entriesStatement->fetchAll();

    return [
        'supplies' => array_map(static function (array $supply): array {
            return formatSupply($supply);
        }, $supplies),
        'entries' => array_map(static function (array $entry): array {
            return [
                'id' => (int) $entry['id'],
                'supplyId' => (int) $entry['supply_id'],
                'supplyItemCode' => (string) $entry['supply_item_code'],
                'supplyName' => (string) $entry['supply_name'],
                'categoryName' => (string) $entry['category_name'],
                'quantity' => (int) $entry['quantity'],
                'referenceNo' => $entry['reference_no'] !== null ? (string) $entry['reference_no'] : null,
                'remarks' => $entry['remarks'] !== null ? (string) $entry['remarks'] : null,
                'createdByName' => $entry['created_by_name'] !== null && trim((string) $entry['created_by_name']) !== ''
                    ? trim((string) $entry['created_by_name'])
                    : 'System',
                'createdAt' => (string) $entry['created_at'],
            ];
        }, $entries),
    ];
}

function formatSupply(array $supply): array
{
    return [
        'id' => (int) $supply['id'],
        'categoryId' => (int) $supply['category_id'],
        'categoryName' => (string) $supply['category_name'],
        'itemCode' => (string) $supply['item_code'],
        'name' => (string) $supply['name'],
        'description' => $supply['description'] !== null ? (string) $supply['description'] : '',
        'imagePath' => $supply['image_path'] !== null ? (string) $supply['image_path'] : '',
        'quantityOnHand' => (int) $supply['quantity_on_hand'],
        'createdAt' => isset($supply['created_at']) ? (string) $supply['created_at'] : null,
        'updatedAt' => isset($supply['updated_at']) ? (string) $supply['updated_at'] : null,
    ];
}

function normalizeName(string $value): string
{
    $value = trim(preg_replace('/\s+/', ' ', $value) ?? '');

    return $value;
}

function normalizeItemCode(string $value): string
{
    $value = strtoupper(trim(preg_replace('/\s+/', '', $value) ?? ''));

    return $value;
}

function ensureSuppliesItemCodeColumn(PDO $pdo): void
{
    $checkColumn = $pdo->query("SHOW COLUMNS FROM supplies LIKE 'item_code'");
    $hasItemCode = $checkColumn !== false && $checkColumn->fetch();

    if (!$hasItemCode) {
        $pdo->exec("ALTER TABLE supplies ADD COLUMN item_code VARCHAR(60) NULL AFTER category_id");

        $rows = $pdo->query('SELECT id FROM supplies WHERE item_code IS NULL OR item_code = ""')->fetchAll();

        $updateStatement = $pdo->prepare('UPDATE supplies SET item_code = :item_code WHERE id = :id');

        foreach ($rows as $row) {
            $updateStatement->execute([
                'id' => (int) $row['id'],
                'item_code' => 'LEGACY-' . (int) $row['id'],
            ]);
        }

        $pdo->exec('ALTER TABLE supplies MODIFY COLUMN item_code VARCHAR(60) NOT NULL');
    }

    $checkIndex = $pdo->query("SHOW INDEX FROM supplies WHERE Key_name = 'unique_supply_item_code'");
    $hasIndex = $checkIndex !== false && $checkIndex->fetch();

    if (!$hasIndex) {
        $pdo->exec('ALTER TABLE supplies ADD UNIQUE KEY unique_supply_item_code (item_code)');
    }
}

function uploadSupplyImage(array $file, ?string $currentPath = null): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return $currentPath ?? '';
    }

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Supply image upload failed.');
    }

    $allowedMimeTypes = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    $maxSizeBytes = 2 * 1024 * 1024;
    $tmpName = (string) ($file['tmp_name'] ?? '');
    $size = (int) ($file['size'] ?? 0);

    if ($size < 1 || $size > $maxSizeBytes) {
        throw new RuntimeException('Supply image must be 2MB or smaller.');
    }

    $mimeType = mime_content_type($tmpName) ?: '';

    if (!array_key_exists($mimeType, $allowedMimeTypes)) {
        throw new RuntimeException('Supply image must be a JPG, PNG, or WEBP file.');
    }

    $uploadDirectory = dirname(__DIR__, 2) . '/public/uploads/supplies';

    if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0775, true) && !is_dir($uploadDirectory)) {
        throw new RuntimeException('Unable to create the supply upload directory.');
    }

    $filename = sprintf('%s.%s', bin2hex(random_bytes(16)), $allowedMimeTypes[$mimeType]);
    $absolutePath = $uploadDirectory . '/' . $filename;

    if (!move_uploaded_file($tmpName, $absolutePath)) {
        throw new RuntimeException('Unable to save the uploaded supply image.');
    }

    if ($currentPath) {
        $currentAbsolutePath = dirname(__DIR__, 2) . '/public' . $currentPath;
        if (is_file($currentAbsolutePath)) {
            @unlink($currentAbsolutePath);
        }
    }

    return '/uploads/supplies/' . $filename;
}
