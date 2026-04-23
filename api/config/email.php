<?php

declare(strict_types=1);

require_once __DIR__ . '/env.php';

loadEnvironmentFile(dirname(__DIR__, 2));

function getSmtpConfig(): array
{
    return [
        'host' => getenv('SMTP_HOST') ?: '',
        'port' => (int) (getenv('SMTP_PORT') ?: 587),
        'username' => getenv('SMTP_USERNAME') ?: '',
        'password' => getenv('SMTP_PASSWORD') ?: (getenv('SMTP_API_KEY') ?: ''),
        'from_email' => getenv('SMTP_FROM_EMAIL') ?: '',
        'from_name' => getenv('SMTP_FROM_NAME') ?: 'SFC-G Supply Management',
        'encryption' => strtolower(trim((string) (getenv('SMTP_ENCRYPTION') ?: 'auto'))),
        'timeout' => (int) (getenv('SMTP_TIMEOUT') ?: 20),
        'verify_peer' => filter_var(getenv('SMTP_VERIFY_PEER') ?: 'false', FILTER_VALIDATE_BOOLEAN),
        'verify_peer_name' => filter_var(getenv('SMTP_VERIFY_PEER_NAME') ?: 'false', FILTER_VALIDATE_BOOLEAN),
        'api_key' => getenv('SMTP_API_KEY') ?: '',
    ];
}

function sendSmtpMail(string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): bool
{
    $config = getSmtpConfig();
    $smtpException = null;

    if (hasUsableSmtpConfig($config)) {
        try {
            sendViaSmtpRelay($config, $toEmail, $toName, $subject, $htmlBody, $textBody);
            return true;
        } catch (Throwable $exception) {
            $smtpException = $exception;

            logEmailError(
                $toEmail,
                $subject,
                $config,
                $exception->getMessage(),
                (int) $exception->getCode(),
                $GLOBALS['__last_email_exception'] ?? null,
                'smtp'
            );
        }
    }

    if ($config['api_key'] !== '') {
        try {
            return sendViaBrevoApi($config, $toEmail, $toName, $subject, $htmlBody, $textBody);
        } catch (Throwable $exception) {
            logEmailError(
                $toEmail,
                $subject,
                $config,
                $exception->getMessage(),
                (int) $exception->getCode(),
                $GLOBALS['__last_email_exception'] ?? null,
                'brevo-api'
            );
        }
    }

    if ($smtpException === null && !hasUsableSmtpConfig($config)) {
        logEmailError($toEmail, $subject, $config, 'Missing email configuration.', 0, null, 'config');
    }

    return false;
}

function hasUsableSmtpConfig(array $config): bool
{
    return !(
        $config['host'] === '' ||
        $config['port'] < 1 ||
        $config['username'] === '' ||
        $config['password'] === '' ||
        $config['from_email'] === ''
    );
}

function sendViaSmtpRelay(array $config, string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): void
{
    try {
        [$socket, $ehloResponse] = openSmtpConnection($config);

        if (shouldUseStartTls($config, $ehloResponse)) {
            smtpCommand($socket, 'STARTTLS', [220]);

            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Unable to enable TLS encryption for SMTP relay.');
            }

            $ehloResponse = smtpCommand($socket, 'EHLO localhost', [250]);
        }

        smtpCommand($socket, 'AUTH LOGIN', [334]);
        smtpCommand($socket, base64_encode($config['username']), [334]);
        smtpCommand($socket, base64_encode($config['password']), [235]);
        smtpCommand($socket, 'MAIL FROM:<' . $config['from_email'] . '>', [250]);
        smtpCommand($socket, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
        smtpCommand($socket, 'DATA', [354]);

        $boundary = 'bnd_' . bin2hex(random_bytes(12));
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . formatEmailAddress($config['from_email'], (string) $config['from_name']),
            'To: ' . formatEmailAddress($toEmail, $toName),
            'Subject: ' . encodeHeaderValue($subject),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];

        $message = implode("\r\n", $headers) . "\r\n\r\n"
            . '--' . $boundary . "\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: quoted-printable\r\n\r\n"
            . quoted_printable_encode($textBody) . "\r\n\r\n"
            . '--' . $boundary . "\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: quoted-printable\r\n\r\n"
            . quoted_printable_encode($htmlBody) . "\r\n\r\n"
            . '--' . $boundary . "--\r\n.";

        fwrite($socket, dotStuffSmtpMessage($message) . "\r\n");
        smtpExpect($socket, [250]);
        smtpCommand($socket, 'QUIT', [221]);
    } finally {
        if (isset($socket) && is_resource($socket)) {
            fclose($socket);
        }
    }
}

function sendViaBrevoApi(array $config, string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): bool
{
    if ($config['from_email'] === '') {
        throw new RuntimeException('Brevo API sender email is missing.');
    }

    $payload = [
        'sender' => [
            'name' => (string) $config['from_name'],
            'email' => (string) $config['from_email'],
        ],
        'to' => [[
            'email' => $toEmail,
            'name' => $toName !== '' ? $toName : $toEmail,
        ]],
        'subject' => $subject,
        'htmlContent' => $htmlBody,
        'textContent' => $textBody,
    ];

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_SLASHES);

    if ($jsonPayload === false) {
        throw new RuntimeException('Unable to encode the Brevo email payload.');
    }

    $headers = implode("\r\n", [
        'Content-Type: application/json',
        'Accept: application/json',
        'api-key: ' . $config['api_key'],
    ]);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $headers,
            'content' => $jsonPayload,
            'timeout' => max(5, (int) $config['timeout']),
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents('https://api.brevo.com/v3/smtp/email', false, $context);
    $statusCode = extractHttpStatusCode($http_response_header ?? []);

    if ($response === false || $statusCode < 200 || $statusCode >= 300) {
        $GLOBALS['__last_email_exception'] = is_string($response) ? trim($response) : '';
        throw new RuntimeException(
            'Brevo API request failed with status ' . $statusCode . ($response ? ': ' . trim($response) : '.')
        );
    }

    return true;
}

function extractHttpStatusCode(array $headers): int
{
    foreach ($headers as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})/i', $header, $matches) === 1) {
            return (int) $matches[1];
        }
    }

    return 0;
}

function openSmtpConnection(array $config): array
{
    $transport = shouldUseImplicitSsl($config) ? 'ssl' : 'tcp';
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => (bool) $config['verify_peer'],
            'verify_peer_name' => (bool) $config['verify_peer_name'],
            'allow_self_signed' => true,
            'crypto_method' => STREAM_CRYPTO_METHOD_TLS_CLIENT,
        ],
    ]);

    $socket = stream_socket_client(
        sprintf('%s://%s:%d', $transport, $config['host'], $config['port']),
        $errorNumber,
        $errorMessage,
        max(5, (int) $config['timeout']),
        STREAM_CLIENT_CONNECT,
        $context
    );

    if ($socket === false) {
        throw new RuntimeException(sprintf('Unable to connect to SMTP relay: %s (%d)', $errorMessage, $errorNumber));
    }

    stream_set_timeout($socket, max(5, (int) $config['timeout']));

    smtpExpect($socket, [220]);
    $ehloResponse = smtpCommand($socket, 'EHLO localhost', [250]);

    return [$socket, $ehloResponse];
}

function shouldUseImplicitSsl(array $config): bool
{
    return $config['port'] === 465 || in_array($config['encryption'], ['ssl', 'tls-ssl'], true);
}

function shouldUseStartTls(array $config, string $ehloResponse): bool
{
    if (shouldUseImplicitSsl($config)) {
        return false;
    }

    if (in_array($config['encryption'], ['none', 'off', 'disabled'], true)) {
        return false;
    }

    if (in_array($config['encryption'], ['tls', 'starttls'], true)) {
        return true;
    }

    return stripos($ehloResponse, 'STARTTLS') !== false;
}

function smtpCommand($socket, string $command, array $expectedCodes): string
{
    fwrite($socket, $command . "\r\n");
    return smtpExpect($socket, $expectedCodes);
}

function smtpExpect($socket, array $expectedCodes): string
{
    $response = '';

    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;

        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }

    if ($response === '') {
        throw new RuntimeException('SMTP server did not respond.');
    }

    $code = (int) substr($response, 0, 3);

    if (!in_array($code, $expectedCodes, true)) {
        $GLOBALS['__last_email_exception'] = trim($response);
        throw new RuntimeException('Unexpected SMTP response: ' . trim($response));
    }

    return $response;
}

function formatEmailAddress(string $email, string $name): string
{
    $cleanName = trim($name);

    if ($cleanName === '') {
        return '<' . $email . '>';
    }

    return encodeHeaderValue($cleanName) . ' <' . $email . '>';
}

function encodeHeaderValue(string $value): string
{
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function dotStuffSmtpMessage(string $message): string
{
    $normalized = str_replace(["\r\n", "\r"], "\n", $message);
    $lines = explode("\n", $normalized);
    $stuffed = array_map(static function (string $line): string {
        return str_starts_with($line, '.') ? '.' . $line : $line;
    }, $lines);

    return str_replace("\n", "\r\n", implode("\n", $stuffed));
}

function logEmailError(
    string $recipient,
    string $subject,
    array $config,
    string $errorMessage,
    int $errorNumber = 0,
    ?string $smtpResponse = null,
    string $transport = 'smtp'
): void
{
    $logDirectory = dirname(__DIR__, 2) . '/api/logs';

    if (!is_dir($logDirectory) && !mkdir($logDirectory, 0775, true) && !is_dir($logDirectory)) {
        return;
    }

    $logLine = sprintf(
        "[%s] transport=%s recipient=%s subject=\"%s\" host=%s port=%d encryption=%s error=%s code=%d smtp=%s%s",
        date('Y-m-d H:i:s'),
        $transport,
        $recipient,
        str_replace('"', '\"', $subject),
        (string) $config['host'],
        (int) $config['port'],
        (string) $config['encryption'],
        $errorMessage,
        $errorNumber,
        $smtpResponse ?? '',
        PHP_EOL
    );

    @file_put_contents($logDirectory . '/email.log', $logLine, FILE_APPEND);
}
