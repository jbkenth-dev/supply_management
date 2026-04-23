<?php

declare(strict_types=1);

function ensureUserProfileColumns(PDO $pdo): void
{
    $columns = [
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

