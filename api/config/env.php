<?php

declare(strict_types=1);

function loadEnvironmentFile(?string $basePath = null): void
{
    static $loaded = false;

    if ($loaded) {
        return;
    }

    $loaded = true;
    $rootPath = $basePath ?? dirname(__DIR__, 2);
    $envFile = rtrim($rootPath, '/\\') . DIRECTORY_SEPARATOR . '.env';

    if (!is_file($envFile) || !is_readable($envFile)) {
        return;
    }

    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);

        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        $separatorPosition = strpos($trimmed, '=');

        if ($separatorPosition === false) {
            continue;
        }

        $name = trim(substr($trimmed, 0, $separatorPosition));
        $value = trim(substr($trimmed, $separatorPosition + 1));

        if ($name === '') {
            continue;
        }

        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}
