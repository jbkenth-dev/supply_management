<?php

declare(strict_types=1);

/**
 * Configure CORS headers for the API.
 *
 * Reads allowed origins from the ALLOWED_ORIGINS environment variable
 * (comma-separated). Falls back to localhost origins for development.
 * If ALLOWED_ORIGINS contains "*", any origin is accepted (but
 * Access-Control-Allow-Credentials is omitted since it's incompatible
 * with wildcard origins).
 */
function configureCors(array $allowedMethods): void
{
    header('Content-Type: application/json; charset=utf-8');

    $allowedOrigins = [];

    // Read from environment (comma-separated list)
    $envOrigins = getenv('ALLOWED_ORIGINS');
    if ($envOrigins !== false && $envOrigins !== '') {
        $allowedOrigins = array_map('trim', explode(',', $envOrigins));
    }

    // Default localhost origins for development
    // Production fallback: include Vercel frontend URL for Awardspace backend
    if ($allowedOrigins === []) {
        $allowedOrigins = [
            'http://127.0.0.1:5173',
            'http://localhost:5173',
        ];
    }

    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $origin = $_SERVER['HTTP_ORIGIN'];

        if (in_array('*', $allowedOrigins, true)) {
            header('Access-Control-Allow-Origin: *');
        } elseif (in_array($origin, $allowedOrigins, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Vary: Origin');
        }
    }

    header('Access-Control-Allow-Methods: ' . implode(', ', $allowedMethods) . ', OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
