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
    $search = trim((string) ($_GET['search'] ?? ''));

    jsonResponse(200, [
        'success' => true,
        ...getStockSnapshot($pdo, $search),
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

if ($action !== 'add_stock') {
    jsonResponse(400, [
        'success' => false,
        'message' => 'Invalid action.',
    ]);
}

$supplyId = (int) ($data['supplyId'] ?? 0);
$quantityValue = trim((string) ($data['quantity'] ?? ''));
$referenceNo = normalizeName((string) ($data['referenceNo'] ?? ''));
$remarks = trim((string) ($data['remarks'] ?? ''));
$createdByUserId = isset($data['createdByUserId']) ? (int) $data['createdByUserId'] : 0;
$errors = [];

if ($supplyId < 1) {
    $errors['supplyId'] = 'Please select a supply item.';
}

if ($quantityValue === '') {
    $errors['quantity'] = 'Stock quantity is required.';
} elseif (!preg_match('/^\d+$/', $quantityValue)) {
    $errors['quantity'] = 'Stock quantity must be a whole number.';
} elseif ((int) $quantityValue < 1 || (int) $quantityValue > 1000000) {
    $errors['quantity'] = 'Stock quantity must be between 1 and 1,000,000.';
}

if ($referenceNo !== '' && mb_strlen($referenceNo) > 60) {
    $errors['referenceNo'] = 'Reference number must be 60 characters or fewer.';
}

if ($remarks !== '' && mb_strlen($remarks) > 255) {
    $errors['remarks'] = 'Remarks must be 255 characters or fewer.';
}

$supply = $supplyId > 0 ? findSupplyById($pdo, $supplyId) : null;

if ($supply === null) {
    $errors['supplyId'] = 'Selected supply item does not exist.';
}

if ($errors !== []) {
    jsonResponse(422, [
        'success' => false,
        'message' => 'Please correct the stock details.',
        'errors' => $errors,
    ]);
}

$quantity = (int) $quantityValue;

try {
    $pdo->beginTransaction();

    $insertEntry = $pdo->prepare(
        'INSERT INTO stock_entries (supply_id, quantity, reference_no, remarks, created_by_user_id)
         VALUES (:supply_id, :quantity, :reference_no, :remarks, :created_by_user_id)'
    );
    $insertEntry->execute([
        'supply_id' => $supplyId,
        'quantity' => $quantity,
        'reference_no' => $referenceNo !== '' ? $referenceNo : null,
        'remarks' => $remarks !== '' ? $remarks : null,
        'created_by_user_id' => $createdByUserId > 0 ? $createdByUserId : null,
    ]);

    $updateSupply = $pdo->prepare(
        'UPDATE supplies
         SET quantity_on_hand = quantity_on_hand + :quantity
         WHERE id = :id'
    );
    $updateSupply->execute([
        'id' => $supplyId,
        'quantity' => $quantity,
    ]);

    $pdo->commit();

    jsonResponse(201, [
        'success' => true,
        'message' => 'Stock added successfully.',
        ...getStockSnapshot($pdo),
    ]);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    jsonResponse(500, [
        'success' => false,
        'message' => 'Unable to save stock data right now.',
    ]);
}

