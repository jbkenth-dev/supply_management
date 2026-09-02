<?php

declare(strict_types=1);

function ensureUserProfileColumns(PDO $pdo): void
{
    $columns = [
        'designation' => 'ALTER TABLE users ADD COLUMN designation VARCHAR(60) NULL AFTER role',
        'id_number' => 'ALTER TABLE users ADD COLUMN id_number VARCHAR(50) NULL AFTER role',
        'contact_number' => 'ALTER TABLE users ADD COLUMN contact_number VARCHAR(20) NULL AFTER email',
        'address' => 'ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL AFTER contact_number',
        'profile_image_path' => 'ALTER TABLE users ADD COLUMN profile_image_path VARCHAR(255) NULL AFTER address',
    ];

    foreach ($columns as $columnName => $statement) {
        $checkColumn = $pdo->prepare('SHOW COLUMNS FROM users LIKE :column_name');
        $checkColumn->execute([
            'column_name' => $columnName,
        ]);

        if (!$checkColumn->fetch()) {
            $pdo->exec($statement);
        }
    }
}

function ensureApprovalColumns(PDO $pdo): void
{
    $columns = [
        'is_verified' => "ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER profile_image_path",
        'approval_status' => "ALTER TABLE users ADD COLUMN approval_status ENUM('pending','approved','rejected','deactivated') NOT NULL DEFAULT 'pending' AFTER is_verified",
    ];

    foreach ($columns as $columnName => $statement) {
        $checkColumn = $pdo->prepare('SHOW COLUMNS FROM users LIKE :column_name');
        $checkColumn->execute([
            'column_name' => $columnName,
        ]);

        if (!$checkColumn->fetch()) {
            $pdo->exec($statement);
        }
    }

    // Ensure 'deactivated' is in the ENUM for existing installations
    $chk = $pdo->prepare("SHOW COLUMNS FROM users LIKE 'approval_status'");
    $chk->execute();
    $col = $chk->fetch();
    if ($col && strpos($col['Type'], 'deactivated') === false) {
        $pdo->exec("ALTER TABLE users MODIFY COLUMN approval_status ENUM('pending','approved','rejected','deactivated') NOT NULL DEFAULT 'pending'");
    }
}

function ensureVerificationTables(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS email_verifications (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            used TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ev_user (user_id),
            INDEX idx_ev_code (user_id, code, used)
        )'
    );
}

function ensurePendingRegistrationsTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS pending_registrations (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            role VARCHAR(60) NOT NULL,
            id_number VARCHAR(50) NOT NULL,
            firstname VARCHAR(100) NOT NULL,
            middlename VARCHAR(100) DEFAULT NULL,
            lastname VARCHAR(100) NOT NULL,
            username VARCHAR(30) NOT NULL,
            email VARCHAR(150) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pr_email (email),
            INDEX idx_pr_code (email, code)
        )'
    );
}

/**
 * Ensure the `role` column in the `users` table accepts all managed roles.
 *
 * The original schema defines `role` as ENUM('Faculty Staff','Property Custodian','Administrator')
 * which rejects roles like 'Resource Planning Officer', 'Vice President for Finance', and
 * 'College President'.  On strict-mode MySQL this causes a PDOException on INSERT.
 *
 * This function converts the column to VARCHAR(60) when it detects an ENUM type.
 * VARCHAR(60) preserves all existing values and accepts any new role string.
 * The conversion is safe — MySQL keeps existing data when ENUM → VARCHAR.
 */
function ensureRoleColumnAcceptsAllManagedRoles(PDO $pdo): void
{
    try {
        $chk = $pdo->prepare("SHOW COLUMNS FROM users LIKE 'role'");
        $chk->execute();
        $col = $chk->fetch();

        if ($col && stripos((string) ($col['Type'] ?? ''), 'enum') === 0) {
            $pdo->exec("ALTER TABLE users MODIFY COLUMN role VARCHAR(60) NOT NULL DEFAULT 'Faculty Staff'");
        }
    } catch (Throwable $e) {
        // Non-fatal: if the ALTER fails (e.g. insufficient privileges on shared
        // hosting), log and continue. The INSERT may still succeed if the ENUM
        // already includes the required values.
        @file_put_contents(
            dirname(__DIR__, 2) . '/api/logs/schema-error.log',
            sprintf("[%s] ensureRoleColumnAcceptsAllManagedRoles: %s\n", date('Y-m-d H:i:s'), $e->getMessage()),
            FILE_APPEND
        );
    }
}
