<?php

declare(strict_types=1);

/**
 * Application-level timezone configuration.
 *
 * Every API entry point must require this file early so that:
 *   - PHP's date(), DateTimeImmutable, mktime(), strtotime(), etc.
 *     always resolve to Asia/Manila (UTC+08:00).
 *   - MySQL session timestamps (NOW(), CURRENT_TIMESTAMP) are set to
 *     Manila time via SET time_zone = '+08:00' on every connection.
 */

define('APP_TIMEZONE', 'Asia/Manila');

date_default_timezone_set(APP_TIMEZONE);
