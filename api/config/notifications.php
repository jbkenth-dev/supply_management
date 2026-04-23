<?php

declare(strict_types=1);

require_once __DIR__ . '/email.php';

function ensureNotificationTables(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS notifications (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            recipient_user_id INT UNSIGNED NOT NULL,
            actor_user_id INT UNSIGNED NULL,
            type VARCHAR(60) NOT NULL,
            title VARCHAR(180) NOT NULL,
            message VARCHAR(500) NOT NULL,
            action_url VARCHAR(255) NOT NULL,
            metadata_json TEXT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            email_sent_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME NULL,
            CONSTRAINT fk_notifications_recipient
                FOREIGN KEY (recipient_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT fk_notifications_actor
                FOREIGN KEY (actor_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE SET NULL,
            INDEX idx_notifications_recipient_created (recipient_user_id, created_at DESC),
            INDEX idx_notifications_recipient_read (recipient_user_id, is_read, created_at DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function fetchUserNotifications(PDO $pdo, int $userId, int $limit = 50): array
{
    $statement = $pdo->prepare(
        'SELECT n.id, n.type, n.title, n.message, n.action_url, n.metadata_json, n.is_read, n.created_at, n.read_at,
                CONCAT_WS(" ", actor.firstname, actor.lastname) AS actor_name
         FROM notifications n
         LEFT JOIN users actor ON actor.id = n.actor_user_id
         WHERE n.recipient_user_id = :user_id
         ORDER BY n.created_at DESC, n.id DESC
         LIMIT :limit_value'
    );
    $statement->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $statement->bindValue(':limit_value', $limit, PDO::PARAM_INT);
    $statement->execute();

    $rows = $statement->fetchAll();

    return array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'type' => (string) $row['type'],
            'title' => (string) $row['title'],
            'message' => (string) $row['message'],
            'actionUrl' => (string) $row['action_url'],
            'metadata' => decodeNotificationMetadata($row['metadata_json'] ?? null),
            'isRead' => (bool) $row['is_read'],
            'createdAt' => (string) $row['created_at'],
            'readAt' => $row['read_at'] !== null ? (string) $row['read_at'] : null,
            'actorName' => trim((string) ($row['actor_name'] ?? '')),
        ];
    }, $rows);
}

function countUnreadNotifications(PDO $pdo, int $userId): int
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM notifications WHERE recipient_user_id = :user_id AND is_read = 0'
    );
    $statement->execute([
        'user_id' => $userId,
    ]);

    return (int) $statement->fetchColumn();
}

function markNotificationAsRead(PDO $pdo, int $notificationId, int $userId): void
{
    $statement = $pdo->prepare(
        'UPDATE notifications
         SET is_read = 1,
             read_at = COALESCE(read_at, NOW())
         WHERE id = :id AND recipient_user_id = :user_id'
    );
    $statement->execute([
        'id' => $notificationId,
        'user_id' => $userId,
    ]);
}

function markAllNotificationsAsRead(PDO $pdo, int $userId): void
{
    $statement = $pdo->prepare(
        'UPDATE notifications
         SET is_read = 1,
             read_at = COALESCE(read_at, NOW())
         WHERE recipient_user_id = :user_id AND is_read = 0'
    );
    $statement->execute([
        'user_id' => $userId,
    ]);
}

function createNotificationRecord(
    PDO $pdo,
    int $recipientUserId,
    ?int $actorUserId,
    string $type,
    string $title,
    string $message,
    string $actionUrl,
    array $metadata = []
): int {
    $statement = $pdo->prepare(
        'INSERT INTO notifications (recipient_user_id, actor_user_id, type, title, message, action_url, metadata_json)
         VALUES (:recipient_user_id, :actor_user_id, :type, :title, :message, :action_url, :metadata_json)'
    );
    $statement->execute([
        'recipient_user_id' => $recipientUserId,
        'actor_user_id' => $actorUserId,
        'type' => $type,
        'title' => $title,
        'message' => $message,
        'action_url' => $actionUrl,
        'metadata_json' => $metadata !== [] ? json_encode($metadata, JSON_UNESCAPED_SLASHES) : null,
    ]);

    return (int) $pdo->lastInsertId();
}

function notifyOfficeUsersAboutFacultyRequest(PDO $pdo, array $request, array $facultyUser): void
{
    $recipients = fetchUsersByRoles($pdo, ['Administrator', 'Property Custodian']);
    $title = 'New Faculty Supply Request';
    $message = sprintf(
        '%s submitted %s with %d item(s) and %d total quantity.',
        trim((string) ($facultyUser['full_name'] ?? 'Faculty Staff')),
        (string) $request['requestNumber'],
        (int) $request['totalItems'],
        (int) $request['totalQuantity']
    );

    foreach ($recipients as $recipient) {
        createNotificationRecord(
            $pdo,
            (int) $recipient['id'],
            (int) $facultyUser['id'],
            'request_submitted',
            $title,
            $message,
            $recipient['role'] === 'Administrator' ? '/admin/request-issuance' : '/custodian/request-issuance',
            [
                'requestId' => (int) $request['id'],
                'requestNumber' => (string) $request['requestNumber'],
                'requestStatus' => 'Pending',
            ]
        );
    }

    $subject = 'New Faculty Supply Request - ' . (string) $request['requestNumber'];
    $htmlBody = buildEmailLayout(
        $title,
        sprintf(
            '%s has submitted a new supply request. Review it in the request and issuance page.',
            htmlspecialchars((string) $facultyUser['full_name'], ENT_QUOTES)
        ),
        [
            'Request Number' => (string) $request['requestNumber'],
            'Requested By' => (string) $facultyUser['full_name'],
            'Total Items' => (string) $request['totalItems'],
            'Total Quantity' => (string) $request['totalQuantity'],
        ]
    );
    $textBody = buildEmailText(
        $title,
        sprintf(
            "%s submitted a new supply request.\nRequest Number: %s\nTotal Items: %d\nTotal Quantity: %d",
            (string) $facultyUser['full_name'],
            (string) $request['requestNumber'],
            (int) $request['totalItems'],
            (int) $request['totalQuantity']
        )
    );

    sendBulkNotificationEmails($pdo, $recipients, $subject, $htmlBody, $textBody);
}

function notifyOfficeUsersAboutFacultyRequestCancellation(PDO $pdo, array $request, array $facultyUser): void
{
    $recipients = fetchUsersByRoles($pdo, ['Administrator', 'Property Custodian']);
    $title = 'Faculty Request Cancelled';
    $message = sprintf(
        '%s cancelled request %s before processing.',
        trim((string) ($facultyUser['full_name'] ?? 'Faculty Staff')),
        (string) $request['requestNumber']
    );

    foreach ($recipients as $recipient) {
        createNotificationRecord(
            $pdo,
            (int) $recipient['id'],
            (int) $facultyUser['id'],
            'request_cancelled',
            $title,
            $message,
            $recipient['role'] === 'Administrator' ? '/admin/request-issuance' : '/custodian/request-issuance',
            [
                'requestId' => (int) $request['id'],
                'requestNumber' => (string) $request['requestNumber'],
                'requestStatus' => 'Cancelled',
            ]
        );
    }

    $subject = 'Faculty Request Cancelled - ' . (string) $request['requestNumber'];
    $htmlBody = buildEmailLayout(
        $title,
        sprintf(
            '%s cancelled a pending supply request. Please refresh the request and issuance page for the latest status.',
            htmlspecialchars((string) $facultyUser['full_name'], ENT_QUOTES)
        ),
        [
            'Request Number' => (string) $request['requestNumber'],
            'Requested By' => (string) $facultyUser['full_name'],
            'Status' => 'Cancelled',
            'Total Items' => (string) $request['totalItems'],
            'Total Quantity' => (string) $request['totalQuantity'],
        ]
    );
    $textBody = buildEmailText(
        $title,
        sprintf(
            "%s cancelled request %s.\nStatus: Cancelled\nTotal Items: %d\nTotal Quantity: %d",
            (string) $facultyUser['full_name'],
            (string) $request['requestNumber'],
            (int) $request['totalItems'],
            (int) $request['totalQuantity']
        )
    );

    sendBulkNotificationEmails($pdo, $recipients, $subject, $htmlBody, $textBody);
}

function notifyFacultyAboutRequestDecision(PDO $pdo, array $request, array $facultyUser, array $actorUser, string $statusLabel): void
{
    $title = 'Supply Request ' . $statusLabel;
    $message = sprintf(
        '%s marked your request %s as %s.',
        trim((string) ($actorUser['full_name'] ?? 'Office Staff')),
        (string) $request['requestNumber'],
        strtolower($statusLabel)
    );

    createNotificationRecord(
        $pdo,
        (int) $facultyUser['id'],
        (int) $actorUser['id'],
        'request_' . strtolower($statusLabel),
        $title,
        $message,
        '/my-requests',
        [
            'requestId' => (int) $request['id'],
            'requestNumber' => (string) $request['requestNumber'],
            'requestStatus' => $statusLabel,
        ]
    );

    $htmlBody = buildEmailLayout(
        $title,
        sprintf(
            'Your supply request %s has been marked as %s.',
            htmlspecialchars((string) $request['requestNumber'], ENT_QUOTES),
            htmlspecialchars($statusLabel, ENT_QUOTES)
        ),
        [
            'Request Number' => (string) $request['requestNumber'],
            'Status' => $statusLabel,
            'Processed By' => (string) $actorUser['full_name'],
            'Notes' => (string) ($request['reviewNotes'] !== '' ? $request['reviewNotes'] : 'No notes provided'),
        ]
    );
    $textBody = buildEmailText(
        $title,
        sprintf(
            "Your supply request %s has been marked as %s.\nProcessed By: %s\nNotes: %s",
            (string) $request['requestNumber'],
            $statusLabel,
            (string) $actorUser['full_name'],
            (string) ($request['reviewNotes'] !== '' ? $request['reviewNotes'] : 'No notes provided')
        )
    );

    sendBulkNotificationEmails($pdo, [$facultyUser], $title . ' - ' . (string) $request['requestNumber'], $htmlBody, $textBody);
}

function fetchUsersByRoles(PDO $pdo, array $roles): array
{
    if ($roles === []) {
        return [];
    }

    $placeholders = implode(', ', array_fill(0, count($roles), '?'));
    $statement = $pdo->prepare(
        'SELECT id, role, firstname, middlename, lastname, email
         FROM users
         WHERE role IN (' . $placeholders . ')
         ORDER BY firstname ASC, lastname ASC'
    );
    $statement->execute($roles);

    return array_map(static function (array $user): array {
        return [
            'id' => (int) $user['id'],
            'role' => (string) $user['role'],
            'email' => (string) $user['email'],
            'full_name' => trim(implode(' ', array_filter([
                (string) ($user['firstname'] ?? ''),
                $user['middlename'] !== null ? (string) $user['middlename'] : '',
                (string) ($user['lastname'] ?? ''),
            ]))),
        ];
    }, $statement->fetchAll());
}

function fetchNotificationUserById(PDO $pdo, int $userId): ?array
{
    $statement = $pdo->prepare(
        'SELECT id, role, firstname, middlename, lastname, email
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $statement->execute([
        'id' => $userId,
    ]);
    $user = $statement->fetch();

    if (!$user) {
        return null;
    }

    return [
        'id' => (int) $user['id'],
        'role' => (string) $user['role'],
        'email' => (string) $user['email'],
        'full_name' => trim(implode(' ', array_filter([
            (string) ($user['firstname'] ?? ''),
            $user['middlename'] !== null ? (string) $user['middlename'] : '',
            (string) ($user['lastname'] ?? ''),
        ]))),
    ];
}

function sendBulkNotificationEmails(PDO $pdo, array $recipients, string $subject, string $htmlBody, string $textBody): void
{
    foreach ($recipients as $recipient) {
        $email = trim((string) ($recipient['email'] ?? ''));

        if ($email === '') {
            continue;
        }

        $sent = sendSmtpMail(
            $email,
            trim((string) ($recipient['full_name'] ?? 'Recipient')),
            $subject,
            $htmlBody,
            $textBody
        );

        if ($sent && isset($recipient['id'])) {
            $update = $pdo->prepare(
                'UPDATE notifications
                 SET email_sent_at = NOW()
                 WHERE recipient_user_id = :recipient_user_id
                   AND title = :title
                   AND email_sent_at IS NULL'
            );
            $update->execute([
                'recipient_user_id' => (int) $recipient['id'],
                'title' => extractEmailNotificationTitle($subject),
            ]);
        }
    }
}

function buildEmailLayout(string $title, string $intro, array $details): string
{
    $rows = '';

    foreach ($details as $label => $value) {
        $rows .= sprintf(
            '<tr><td style="padding:8px 0;color:#475569;font-weight:700;">%s</td><td style="padding:8px 0;color:#0f172a;">%s</td></tr>',
            htmlspecialchars((string) $label, ENT_QUOTES),
            nl2br(htmlspecialchars((string) $value, ENT_QUOTES))
        );
    }

    return '<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">'
        . '<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;">'
        . '<div style="background:#0f172a;color:#ffffff;padding:24px 28px;">'
        . '<div style="font-size:12px;letter-spacing:0.24em;font-weight:700;text-transform:uppercase;color:#93c5fd;">SFC-G Supply Management</div>'
        . '<h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">' . htmlspecialchars($title, ENT_QUOTES) . '</h1>'
        . '</div>'
        . '<div style="padding:28px;">'
        . '<p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.7;">' . $intro . '</p>'
        . '<table style="width:100%;border-collapse:collapse;">' . $rows . '</table>'
        . '</div></div></div>';
}

function buildEmailText(string $title, string $body): string
{
    return "SFC-G Supply Management\n" . $title . "\n\n" . $body;
}

function extractEmailNotificationTitle(string $subject): string
{
    $parts = explode(' - ', $subject);
    return trim((string) ($parts[0] ?? $subject));
}

function decodeNotificationMetadata(mixed $value): array
{
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}
