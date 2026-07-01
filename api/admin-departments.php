<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';

sendApiHeaders(['GET', 'POST', 'PUT', 'DELETE']);

try {
    $pdo = getDatabaseConnection();
    ensureDepartmentTables($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleList($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleCreate($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        handleUpdate($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        handleDelete($pdo);
    }

    jsonResponse(405, ['success' => false, 'message' => 'Method not allowed.']);
} catch (PDOException $exception) {
    jsonResponse(500, ['success' => false, 'message' => 'Unexpected server error.']);
}

function handleList(PDO $pdo): void
{
    $query = $pdo->query(
        'SELECT id, name, created_at, updated_at
         FROM departments
         ORDER BY name ASC'
    );

    jsonResponse(200, [
        'success' => true,
        'departments' => array_map(static fn (array $department): array => serializeDepartment($department), $query->fetchAll()),
    ]);
}

function handleCreate(PDO $pdo): void
{
    $payload = getRequestData();
    $name = trim((string) ($payload['name'] ?? ''));

    $errors = validateDepartmentName($pdo, $name);
    if ($errors !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => reset($errors),
            'errors' => $errors,
        ]);
    }

    $statement = $pdo->prepare('INSERT INTO departments (name) VALUES (:name)');
    $statement->execute(['name' => $name]);

    $department = findDepartment($pdo, (int) $pdo->lastInsertId());

    jsonResponse(201, [
        'success' => true,
        'message' => 'Department created successfully.',
        'department' => serializeDepartment($department),
    ]);
}

function handleUpdate(PDO $pdo): void
{
    $payload = getRequestData();
    $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);
    $name = trim((string) ($payload['name'] ?? ''));

    if (!$id) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Unexpected server error.',
        ]);
    }

    $existingDepartment = findDepartment($pdo, (int) $id);
    if (!$existingDepartment) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Unexpected server error.',
        ]);
    }

    $errors = validateDepartmentName($pdo, $name, (int) $id);
    if ($errors !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => reset($errors),
            'errors' => $errors,
        ]);
    }

    $statement = $pdo->prepare('UPDATE departments SET name = :name WHERE id = :id');
    $statement->execute([
        'id' => (int) $id,
        'name' => $name,
    ]);

    $department = findDepartment($pdo, (int) $id);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Department updated successfully.',
        'department' => serializeDepartment($department),
    ]);
}

function handleDelete(PDO $pdo): void
{
    $payload = getRequestData();
    $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);

    if (!$id) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Unexpected server error.',
        ]);
    }

    $department = findDepartment($pdo, (int) $id);
    if (!$department) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'Unexpected server error.',
        ]);
    }

    $assignedUsers = countUsersAssignedToDepartment($pdo, (string) $department['name']);
    if ($assignedUsers > 0) {
        jsonResponse(409, [
            'success' => false,
            'message' => 'This department cannot be deleted because it is currently assigned to one or more users.',
        ]);
    }

    $statement = $pdo->prepare('DELETE FROM departments WHERE id = :id');
    $statement->execute(['id' => (int) $id]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Department deleted successfully.',
    ]);
}

function validateDepartmentName(PDO $pdo, string $name, ?int $excludeId = null): array
{
    if ($name === '') {
        return ['name' => 'Department name is required.'];
    }

    $statement = $pdo->prepare(
        'SELECT id
         FROM departments
         WHERE LOWER(name) = LOWER(:name)
           AND (:exclude_id IS NULL OR id <> :exclude_id)
         LIMIT 1'
    );
    $statement->bindValue(':name', $name);
    $statement->bindValue(':exclude_id', $excludeId, $excludeId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $statement->execute();

    if ($statement->fetch()) {
        return ['name' => 'Department already exists.'];
    }

    return [];
}

function findDepartment(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare(
        'SELECT id, name, created_at, updated_at
         FROM departments
         WHERE id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);

    $department = $statement->fetch();

    return $department ?: null;
}

function countUsersAssignedToDepartment(PDO $pdo, string $departmentName): int
{
    $statement = $pdo->prepare('SELECT COUNT(*) FROM users WHERE department = :department');
    $statement->execute(['department' => $departmentName]);

    return (int) $statement->fetchColumn();
}

function serializeDepartment(?array $department): array
{
    if ($department === null) {
        return [];
    }

    return [
        'id' => (int) $department['id'],
        'name' => (string) $department['name'],
        'createdAt' => (string) $department['created_at'],
        'updatedAt' => (string) $department['updated_at'],
    ];
}

function ensureDepartmentTables(PDO $pdo): void
{
    $tableCheck = $pdo->query("SHOW TABLES LIKE 'departments'");
    $tableExists = (bool) $tableCheck->fetch();

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS departments (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_department_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    try {
        $pdo->exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL AFTER role');
    } catch (PDOException $exception) {
    }

    if ($tableExists) {
        return;
    }

    $defaultDepartments = [
        'College of Arts and Sciences',
        'College of Business and Accountancy',
        'College of Education',
        'College of Engineering and Technology',
        'College of Nursing and Health Sciences',
        'Senior High School Department',
        'Junior High School Department',
        'Elementary Department',
        'Administration Office',
        'Finance Office',
        'Registrar\'s Office',
        'Library',
        'Guidance Office',
        'MIS/IT Office',
        'Property and Supply Office',
    ];

    $insert = $pdo->prepare('INSERT IGNORE INTO departments (name) VALUES (:name)');
    foreach ($defaultDepartments as $department) {
        $insert->execute(['name' => $department]);
    }
}
