<?php

declare(strict_types=1);

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/timezone.php';

loadEnvironmentFile(dirname(__DIR__, 2));

function getDatabaseConnection(): PDO
{
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $port = getenv('DB_PORT') ?: '3306';
    $database = getenv('DB_NAME') ?: 'supply_management';
    $username = getenv('DB_USER') ?: 'root';
    $password = getenv('DB_PASS') ?: '';

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database);

    $pdo = new PDO(
        $dsn,
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    // Force MySQL session timezone to Asia/Manila (UTC+08:00) so that
    // NOW(), CURRENT_TIMESTAMP, and TIMESTAMP column defaults always
    // resolve to Manila time regardless of the database server's
    // system timezone.
    $pdo->exec("SET time_zone = '+08:00'");

    return $pdo;
}
