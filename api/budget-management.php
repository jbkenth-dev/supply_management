<?php

declare(strict_types=1);

require_once __DIR__ . '/config/admin_inventory.php';
require_once __DIR__ . '/config/notifications.php';

sendApiHeaders(['GET', 'POST']);

try {
    $pdo = getDatabaseConnection();
    ensureInventoryTables($pdo);
    ensureFacultyRequestTables($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleBudgetFetch($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleBudgetAction($pdo);
    }

    jsonResponse(405, ['success' => false, 'message' => 'Method not allowed.']);
} catch (PDOException $exception) {
    jsonResponse(500, ['success' => false, 'message' => 'Unable to process budget data.']);
}

function handleBudgetFetch(PDO $pdo): void
{
    $department = trim((string) ($_GET['department'] ?? ''));
    $fiscalYear = (int) ($_GET['fiscalYear'] ?? date('Y'));

    if ($department !== '') {
        $budget = fetchDepartmentBudget($pdo, $department, $fiscalYear);
        jsonResponse(200, [
            'success' => true,
            'budget' => $budget,
        ]);
        return;
    }

    // Fetch all budgets
    $stmt = $pdo->prepare(
        'SELECT db.*,
                (db.annual_budget - db.total_spent) AS remaining_budget,
                ROUND((db.total_spent / NULLIF(db.annual_budget, 0)) * 100, 2) AS utilization
         FROM department_budgets db
         WHERE db.fiscal_year = :fiscal_year
         ORDER BY db.department ASC'
    );
    $stmt->execute(['fiscal_year' => $fiscalYear]);
    $budgets = $stmt->fetchAll();

    jsonResponse(200, [
        'success' => true,
        'budgets' => array_map(static function (array $b): array {
            return [
                'id' => (int) $b['id'],
                'department' => (string) $b['department'],
                'fiscalYear' => (int) $b['fiscal_year'],
                'annualBudget' => (float) $b['annual_budget'],
                'totalSpent' => (float) $b['total_spent'],
                'remainingBudget' => (float) ($b['remaining_budget'] ?? $b['annual_budget']),
                'utilization' => (float) ($b['utilization'] ?? 0),
                'updatedAt' => (string) $b['updated_at'],
            ];
        }, $budgets),
        'totalAnnualBudget' => array_sum(array_map(static fn (array $b): float => (float) $b['annual_budget'], $budgets)),
        'totalSpent' => array_sum(array_map(static fn (array $b): float => (float) $b['total_spent'], $budgets)),
    ]);
}

function handleBudgetAction(PDO $pdo): void
{
    $payload = getRequestData();
    $action = trim((string) ($payload['action'] ?? 'set_budget'));
    $department = trim((string) ($payload['department'] ?? ''));
    $fiscalYear = (int) ($payload['fiscalYear'] ?? date('Y'));
    $annualBudget = (float) ($payload['annualBudget'] ?? 0);

    if ($department === '' || $annualBudget < 0) {
        jsonResponse(422, ['success' => false, 'message' => 'Valid department and budget amount are required.']);
    }

    // Upsert
    $stmt = $pdo->prepare(
        'INSERT INTO department_budgets (department, fiscal_year, annual_budget, total_spent)
         VALUES (:department, :fiscal_year, :annual_budget, 0)
         ON DUPLICATE KEY UPDATE annual_budget = VALUES(annual_budget), updated_at = NOW()'
    );
    $stmt->execute([
        'department' => $department,
        'fiscal_year' => $fiscalYear,
        'annual_budget' => $annualBudget,
    ]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Budget updated successfully.',
    ]);
}

function fetchDepartmentBudget(PDO $pdo, string $department, int $fiscalYear): ?array
{
    $stmt = $pdo->prepare(
        'SELECT db.*,
                (db.annual_budget - db.total_spent) AS remaining_budget,
                ROUND((db.total_spent / NULLIF(db.annual_budget, 0)) * 100, 2) AS utilization
         FROM department_budgets db
         WHERE db.department = :department AND db.fiscal_year = :fiscal_year
         LIMIT 1'
    );
    $stmt->execute(['department' => $department, 'fiscal_year' => $fiscalYear]);
    $budget = $stmt->fetch();

    if (!$budget) {
        return null;
    }

    return [
        'id' => (int) $budget['id'],
        'department' => (string) $budget['department'],
        'fiscalYear' => (int) $budget['fiscal_year'],
        'annualBudget' => (float) $budget['annual_budget'],
        'totalSpent' => (float) $budget['total_spent'],
        'remainingBudget' => (float) $budget['remaining_budget'],
        'utilization' => (float) $budget['utilization'],
    ];
}

function checkBudgetEnough(PDO $pdo, string $department, float $amount): bool
{
    $budget = fetchDepartmentBudget($pdo, $department, (int) date('Y'));
    if ($budget === null) {
        return true; // No budget set = no restriction
    }
    return $budget['remainingBudget'] >= $amount;
}
