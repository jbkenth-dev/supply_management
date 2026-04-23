<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';

sendApiHeaders(['GET', 'POST']);

try {
    $pdo = getDatabaseConnection();
    ensureInventoryTables($pdo);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to connect to the database.',
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonResponse(200, [
        'success' => true,
        ...getInventorySnapshot($pdo),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
}

$data = getRequestData();
$action = (string) ($data['action'] ?? '');

try {
    if ($action === 'create_category') {
        createCategory($pdo, $data);
    }

    if ($action === 'update_category') {
        updateCategory($pdo, $data);
    }

    if ($action === 'delete_category') {
        deleteCategory($pdo, $data);
    }

    if ($action === 'create_supply') {
        createSupply($pdo, $data);
    }

    if ($action === 'update_supply') {
        updateSupply($pdo, $data);
    }

    if ($action === 'delete_supply') {
        deleteSupply($pdo, $data);
    }

    jsonResponse(400, [
        'success' => false,
        'message' => 'Invalid action.',
    ]);
} catch (RuntimeException $exception) {
    jsonResponse(422, [
        'success' => false,
        'message' => $exception->getMessage(),
    ]);
} catch (PDOException $exception) {
    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to save supply data right now.',
    ]);
}

function createCategory(PDO $pdo, array $data): void
{
    $name = normalizeName((string) ($data['name'] ?? ''));
    $errors = validateCategory($pdo, $name);

    if ($errors !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the category details.',
            'errors' => $errors,
        ]);
    }

    $statement = $pdo->prepare('INSERT INTO supply_categories (name) VALUES (:name)');
    $statement->execute([
        'name' => $name,
    ]);

    jsonResponse(201, [
        'success' => true,
        'message' => 'Category added successfully.',
        ...getInventorySnapshot($pdo),
    ]);
}

function updateCategory(PDO $pdo, array $data): void
{
    $categoryId = (int) ($data['id'] ?? 0);
    $name = normalizeName((string) ($data['name'] ?? ''));

    if ($categoryId < 1 || findCategoryById($pdo, $categoryId) === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Category not found.',
        ]);
    }

    $errors = validateCategory($pdo, $name, $categoryId);

    if ($errors !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the category details.',
            'errors' => $errors,
        ]);
    }

    $statement = $pdo->prepare('UPDATE supply_categories SET name = :name WHERE id = :id');
    $statement->execute([
        'id' => $categoryId,
        'name' => $name,
    ]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Category updated successfully.',
        ...getInventorySnapshot($pdo),
    ]);
}

function deleteCategory(PDO $pdo, array $data): void
{
    $categoryId = (int) ($data['id'] ?? 0);

    if ($categoryId < 1 || findCategoryById($pdo, $categoryId) === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Category not found.',
        ]);
    }

    $checkUsage = $pdo->prepare('SELECT COUNT(*) FROM supplies WHERE category_id = :category_id');
    $checkUsage->execute([
        'category_id' => $categoryId,
    ]);

    if ((int) $checkUsage->fetchColumn() > 0) {
        jsonResponse(409, [
            'success' => false,
            'message' => 'You cannot delete a category that still has supplies assigned to it.',
        ]);
    }

    $statement = $pdo->prepare('DELETE FROM supply_categories WHERE id = :id');
    $statement->execute([
        'id' => $categoryId,
    ]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Category deleted successfully.',
        ...getInventorySnapshot($pdo),
    ]);
}

function createSupply(PDO $pdo, array $data): void
{
    $payload = validateSupplyPayload($pdo, $data);

    if ($payload['errors'] !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the supply details.',
            'errors' => $payload['errors'],
        ]);
    }

    $imagePath = '';

    if (isset($_FILES['image'])) {
        $imagePath = uploadSupplyImage($_FILES['image']);
    }

    $statement = $pdo->prepare(
        'INSERT INTO supplies (category_id, item_code, name, description, image_path)
         VALUES (:category_id, :item_code, :name, :description, :image_path)'
    );
    $statement->execute([
        'category_id' => $payload['categoryId'],
        'item_code' => $payload['itemCode'],
        'name' => $payload['name'],
        'description' => $payload['description'] !== '' ? $payload['description'] : null,
        'image_path' => $imagePath !== '' ? $imagePath : null,
    ]);

    jsonResponse(201, [
        'success' => true,
        'message' => 'Supply added successfully.',
        ...getInventorySnapshot($pdo),
    ]);
}

function updateSupply(PDO $pdo, array $data): void
{
    $supplyId = (int) ($data['id'] ?? 0);
    $existingSupply = $supplyId > 0 ? findSupplyById($pdo, $supplyId) : null;

    if ($existingSupply === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Supply not found.',
        ]);
    }

    $payload = validateSupplyPayload($pdo, $data, $supplyId);

    if ($payload['errors'] !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the supply details.',
            'errors' => $payload['errors'],
        ]);
    }

    $imagePath = $existingSupply['image_path'] !== null ? (string) $existingSupply['image_path'] : '';

    if (isset($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $imagePath = uploadSupplyImage($_FILES['image'], $imagePath !== '' ? $imagePath : null);
    }

    $statement = $pdo->prepare(
        'UPDATE supplies
         SET category_id = :category_id,
             item_code = :item_code,
             name = :name,
             description = :description,
             image_path = :image_path
         WHERE id = :id'
    );
    $statement->execute([
        'id' => $supplyId,
        'category_id' => $payload['categoryId'],
        'item_code' => $payload['itemCode'],
        'name' => $payload['name'],
        'description' => $payload['description'] !== '' ? $payload['description'] : null,
        'image_path' => $imagePath !== '' ? $imagePath : null,
    ]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Supply updated successfully.',
        ...getInventorySnapshot($pdo),
    ]);
}

function deleteSupply(PDO $pdo, array $data): void
{
    $supplyId = (int) ($data['id'] ?? 0);
    $supply = $supplyId > 0 ? findSupplyById($pdo, $supplyId) : null;

    if ($supply === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Supply not found.',
        ]);
    }

    $checkHistory = $pdo->prepare('SELECT COUNT(*) FROM stock_entries WHERE supply_id = :supply_id');
    $checkHistory->execute([
        'supply_id' => $supplyId,
    ]);

    if ((int) $checkHistory->fetchColumn() > 0) {
        jsonResponse(409, [
            'success' => false,
            'message' => 'You cannot delete a supply that already has stock records.',
        ]);
    }

    $statement = $pdo->prepare('DELETE FROM supplies WHERE id = :id');
    $statement->execute([
        'id' => $supplyId,
    ]);

    $imagePath = $supply['image_path'] !== null ? (string) $supply['image_path'] : '';
    if ($imagePath !== '') {
        $absolutePath = dirname(__DIR__) . '/public' . $imagePath;
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
    }

    jsonResponse(200, [
        'success' => true,
        'message' => 'Supply deleted successfully.',
        ...getInventorySnapshot($pdo),
    ]);
}

function validateCategory(PDO $pdo, string $name, ?int $ignoreId = null): array
{
    $errors = [];

    if ($name === '') {
        $errors['name'] = 'Category name is required.';
    } elseif (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
        $errors['name'] = 'Category name must be between 2 and 100 characters.';
    }

    if (!isset($errors['name'])) {
        $query = 'SELECT id FROM supply_categories WHERE LOWER(name) = LOWER(:name)';

        if ($ignoreId !== null) {
            $query .= ' AND id != :id';
        }

        $query .= ' LIMIT 1';

        $statement = $pdo->prepare($query);
        $parameters = ['name' => $name];

        if ($ignoreId !== null) {
            $parameters['id'] = $ignoreId;
        }

        $statement->execute($parameters);

        if ($statement->fetch()) {
            $errors['name'] = 'Category name already exists.';
        }
    }

    return $errors;
}

function validateSupplyPayload(PDO $pdo, array $data, ?int $ignoreId = null): array
{
    $categoryId = (int) ($data['categoryId'] ?? 0);
    $itemCode = normalizeItemCode((string) ($data['itemCode'] ?? ''));
    $name = normalizeName((string) ($data['name'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $errors = [];

    if ($categoryId < 1 || findCategoryById($pdo, $categoryId) === null) {
        $errors['categoryId'] = 'Please select a valid category.';
    }

    if ($itemCode === '') {
        $errors['itemCode'] = 'Item code is required.';
    } elseif (!preg_match('/^[A-Z0-9_-]{3,60}$/', $itemCode)) {
        $errors['itemCode'] = 'Item code must be 3 to 60 characters using only letters, numbers, hyphen, or underscore.';
    }

    if ($name === '') {
        $errors['name'] = 'Supply name is required.';
    } elseif (mb_strlen($name) < 2 || mb_strlen($name) > 150) {
        $errors['name'] = 'Supply name must be between 2 and 150 characters.';
    }

    if ($description !== '' && mb_strlen($description) > 500) {
        $errors['description'] = 'Description must be 500 characters or fewer.';
    }

    if (!isset($errors['itemCode'])) {
        $query = 'SELECT id FROM supplies WHERE UPPER(item_code) = UPPER(:item_code)';

        if ($ignoreId !== null) {
            $query .= ' AND id != :id';
        }

        $query .= ' LIMIT 1';

        $statement = $pdo->prepare($query);
        $parameters = ['item_code' => $itemCode];

        if ($ignoreId !== null) {
            $parameters['id'] = $ignoreId;
        }

        $statement->execute($parameters);

        if ($statement->fetch()) {
            $errors['itemCode'] = 'Item code already exists.';
        }
    }

    if (!isset($errors['name'])) {
        $query = 'SELECT id FROM supplies WHERE LOWER(name) = LOWER(:name)';

        if ($ignoreId !== null) {
            $query .= ' AND id != :id';
        }

        $query .= ' LIMIT 1';

        $statement = $pdo->prepare($query);
        $parameters = ['name' => $name];

        if ($ignoreId !== null) {
            $parameters['id'] = $ignoreId;
        }

        $statement->execute($parameters);

        if ($statement->fetch()) {
            $errors['name'] = 'Supply name already exists.';
        }
    }

    if (isset($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        $fileType = mime_content_type((string) ($_FILES['image']['tmp_name'] ?? '')) ?: '';
        $fileSize = (int) ($_FILES['image']['size'] ?? 0);

        if (!in_array($fileType, $allowedTypes, true)) {
            $errors['image'] = 'Supply image must be a JPG, PNG, or WEBP file.';
        } elseif ($fileSize < 1 || $fileSize > 2 * 1024 * 1024) {
            $errors['image'] = 'Supply image must be 2MB or smaller.';
        }
    } elseif ($ignoreId === null) {
        $errors['image'] = 'Supply image is required.';
    }

    return [
        'categoryId' => $categoryId,
        'itemCode' => $itemCode,
        'name' => $name,
        'description' => $description,
        'errors' => $errors,
    ];
}
