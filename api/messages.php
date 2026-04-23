<?php

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
];

if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Vary: Origin');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    ensureMessagesTable($pdo);
    ensureMyAccountColumns($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        handleGetMessages($pdo);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        handleSendMessage($pdo);
    }

    jsonResponse(405, [
        'success' => false,
        'message' => 'Method not allowed.',
    ]);
} catch (PDOException $exception) {
    $message = 'Unable to process messages right now.';

    if ((int) $exception->getCode() === 1049) {
        $message = 'Database "supply_management" was not found. Import the SQL setup file first.';
    }

    jsonResponse(500, [
        'success' => false,
        'message' => $message,
    ]);
}

function handleGetMessages(PDO $pdo): void
{
    $userId = filter_input(INPUT_GET, 'userId', FILTER_VALIDATE_INT);
    $conversationUserId = filter_input(INPUT_GET, 'conversationUserId', FILTER_VALIDATE_INT);

    if (!$userId) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid userId is required.',
        ]);
    }

    $currentUser = findUserById($pdo, (int) $userId);

    if ($currentUser === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'User not found.',
        ]);
    }

    $contacts = fetchContacts($pdo, (int) $userId);

    if ($conversationUserId) {
        $contactExists = false;

        foreach ($contacts as $contact) {
            if ((int) $contact['id'] === (int) $conversationUserId) {
                $contactExists = true;
                break;
            }
        }

        if (!$contactExists && (int) $conversationUserId !== (int) $userId) {
            $contactUser = findUserById($pdo, (int) $conversationUserId);

            if ($contactUser !== null) {
                $contacts[] = [
                    'id' => (int) $contactUser['id'],
                    'name' => buildDisplayName($contactUser),
                    'role' => (string) $contactUser['role'],
                    'email' => (string) $contactUser['email'],
                    'username' => (string) $contactUser['username'],
                    'profileImageUrl' => $contactUser['profile_image_path'] !== null ? (string) $contactUser['profile_image_path'] : null,
                    'lastMessage' => null,
                    'lastMessageAt' => null,
                    'lastMessageSenderId' => null,
                    'unreadCount' => 0,
                ];
            }
        }

        markConversationAsRead($pdo, (int) $userId, (int) $conversationUserId);
    }

    $normalizedConversationUserId = resolveConversationUserId($contacts, (int) $userId, $conversationUserId ? (int) $conversationUserId : null);
    $messages = $normalizedConversationUserId !== null
        ? fetchConversationMessages($pdo, (int) $userId, $normalizedConversationUserId)
        : [];
    $typing = $normalizedConversationUserId !== null
        ? fetchTypingStatus($pdo, (int) $userId, $normalizedConversationUserId)
        : null;

    $contacts = fetchContacts($pdo, (int) $userId);

    jsonResponse(200, [
        'success' => true,
        'currentUser' => [
            'id' => (int) $currentUser['id'],
            'name' => buildDisplayName($currentUser),
            'role' => (string) $currentUser['role'],
        ],
        'contacts' => $contacts,
        'selectedConversationUserId' => $normalizedConversationUserId,
        'messages' => $messages,
        'typing' => $typing,
    ]);
}

function handleSendMessage(PDO $pdo): void
{
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput ?: '', true);

    if (!is_array($payload)) {
        jsonResponse(400, [
            'success' => false,
            'message' => 'Invalid request payload.',
        ]);
    }

    $senderUserId = filter_var($payload['senderUserId'] ?? null, FILTER_VALIDATE_INT);
    $recipientUserId = filter_var($payload['recipientUserId'] ?? null, FILTER_VALIDATE_INT);
    $body = trim((string) ($payload['body'] ?? ''));
    $action = trim((string) ($payload['action'] ?? 'send'));

    if ($action === 'typing') {
        handleTypingStatus($pdo, $payload);
    }

    $errors = [];

    if (!$senderUserId) {
        $errors['senderUserId'] = 'A valid sender user is required.';
    }

    if (!$recipientUserId) {
        $errors['recipientUserId'] = 'A valid recipient user is required.';
    }

    if ($senderUserId && $recipientUserId && (int) $senderUserId === (int) $recipientUserId) {
        $errors['recipientUserId'] = 'You cannot send a message to yourself.';
    }

    if ($body === '') {
        $errors['body'] = 'Message body is required.';
    } elseif (mb_strlen($body) > 2000) {
        $errors['body'] = 'Message body must not exceed 2000 characters.';
    }

    if ($errors !== []) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'Please correct the highlighted fields.',
            'errors' => $errors,
        ]);
    }

    $sender = findUserById($pdo, (int) $senderUserId);
    $recipient = findUserById($pdo, (int) $recipientUserId);

    if ($sender === null || $recipient === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected user was not found.',
        ]);
    }

    $insertMessage = $pdo->prepare(
        'INSERT INTO messages (sender_user_id, recipient_user_id, body)
         VALUES (:sender_user_id, :recipient_user_id, :body)'
    );
    $insertMessage->execute([
        'sender_user_id' => (int) $senderUserId,
        'recipient_user_id' => (int) $recipientUserId,
        'body' => $body,
    ]);

    clearTypingStatus($pdo, (int) $senderUserId, (int) $recipientUserId);

    $messageId = (int) $pdo->lastInsertId();
    $message = fetchMessageById($pdo, $messageId);

    jsonResponse(201, [
        'success' => true,
        'message' => 'Message sent successfully.',
        'data' => $message,
    ]);
}

function ensureMessagesTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS messages (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            sender_user_id INT UNSIGNED NOT NULL,
            recipient_user_id INT UNSIGNED NOT NULL,
            body TEXT NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            read_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_messages_sender
                FOREIGN KEY (sender_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT fk_messages_recipient
                FOREIGN KEY (recipient_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            INDEX idx_messages_pair_created (sender_user_id, recipient_user_id, created_at),
            INDEX idx_messages_recipient_read (recipient_user_id, is_read, created_at)
        )'
    );
}

function ensureTypingStatusTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS message_typing_status (
            user_id INT UNSIGNED NOT NULL,
            conversation_user_id INT UNSIGNED NOT NULL,
            is_typing TINYINT(1) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, conversation_user_id),
            CONSTRAINT fk_message_typing_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            CONSTRAINT fk_message_typing_conversation_user
                FOREIGN KEY (conversation_user_id) REFERENCES users(id)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        )'
    );
}

function ensureMyAccountColumns(PDO $pdo): void
{
    $columns = [
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

function findUserById(PDO $pdo, int $userId): ?array
{
    $query = $pdo->prepare(
        'SELECT id, role, firstname, middlename, lastname, username, email, profile_image_path
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $query->execute([
        'id' => $userId,
    ]);

    $user = $query->fetch();

    return $user ?: null;
}

function handleTypingStatus(PDO $pdo, array $payload): void
{
    $senderUserId = filter_var($payload['senderUserId'] ?? null, FILTER_VALIDATE_INT);
    $recipientUserId = filter_var($payload['recipientUserId'] ?? null, FILTER_VALIDATE_INT);
    $isTyping = (bool) ($payload['isTyping'] ?? false);

    if (!$senderUserId || !$recipientUserId || (int) $senderUserId === (int) $recipientUserId) {
        jsonResponse(422, [
            'success' => false,
            'message' => 'A valid sender and recipient are required.',
        ]);
    }

    if (findUserById($pdo, (int) $senderUserId) === null || findUserById($pdo, (int) $recipientUserId) === null) {
        jsonResponse(404, [
            'success' => false,
            'message' => 'The selected user was not found.',
        ]);
    }

    ensureTypingStatusTable($pdo);

    $statement = $pdo->prepare(
        'INSERT INTO message_typing_status (user_id, conversation_user_id, is_typing)
         VALUES (:user_id, :conversation_user_id, :is_typing)
         ON DUPLICATE KEY UPDATE
            is_typing = VALUES(is_typing),
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'user_id' => (int) $senderUserId,
        'conversation_user_id' => (int) $recipientUserId,
        'is_typing' => $isTyping ? 1 : 0,
    ]);

    jsonResponse(200, [
        'success' => true,
        'message' => 'Typing status updated.',
    ]);
}

function fetchContacts(PDO $pdo, int $userId): array
{
    $query = $pdo->prepare(
        'SELECT
            u.id,
            u.role,
            u.firstname,
            u.middlename,
            u.lastname,
            u.username,
            u.email,
            u.profile_image_path,
            latest.body AS last_message,
            latest.created_at AS last_message_at,
            latest.sender_user_id AS last_message_sender_id,
            COALESCE(unread.unread_count, 0) AS unread_count
         FROM users u
         LEFT JOIN (
            SELECT
                CASE
                    WHEN sender_user_id = :user_id_latest THEN recipient_user_id
                    ELSE sender_user_id
                END AS contact_user_id,
                body,
                created_at,
                sender_user_id,
                ROW_NUMBER() OVER (
                    PARTITION BY CASE
                        WHEN sender_user_id = :user_id_partition THEN recipient_user_id
                        ELSE sender_user_id
                    END
                    ORDER BY created_at DESC, id DESC
                ) AS row_num
            FROM messages
            WHERE sender_user_id = :user_id_sent OR recipient_user_id = :user_id_received
         ) latest
            ON latest.contact_user_id = u.id
           AND latest.row_num = 1
         LEFT JOIN (
            SELECT sender_user_id AS contact_user_id, COUNT(*) AS unread_count
            FROM messages
            WHERE recipient_user_id = :user_id_unread
              AND is_read = 0
            GROUP BY sender_user_id
         ) unread
            ON unread.contact_user_id = u.id
         WHERE u.id <> :current_user_id
         ORDER BY
            CASE WHEN latest.created_at IS NULL THEN 1 ELSE 0 END,
            latest.created_at DESC,
            u.lastname ASC,
            u.firstname ASC'
    );
    $query->execute([
        'user_id_latest' => $userId,
        'user_id_partition' => $userId,
        'user_id_sent' => $userId,
        'user_id_received' => $userId,
        'user_id_unread' => $userId,
        'current_user_id' => $userId,
    ]);

    return array_map(
        static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'name' => buildDisplayName($row),
                'role' => (string) $row['role'],
                'email' => (string) $row['email'],
                'username' => (string) $row['username'],
                'profileImageUrl' => $row['profile_image_path'] !== null ? (string) $row['profile_image_path'] : null,
                'lastMessage' => $row['last_message'] !== null ? (string) $row['last_message'] : null,
                'lastMessageAt' => $row['last_message_at'] !== null ? (string) $row['last_message_at'] : null,
                'lastMessageSenderId' => $row['last_message_sender_id'] !== null ? (int) $row['last_message_sender_id'] : null,
                'unreadCount' => (int) $row['unread_count'],
            ];
        },
        $query->fetchAll()
    );
}

function fetchConversationMessages(PDO $pdo, int $userId, int $conversationUserId): array
{
    $query = $pdo->prepare(
        'SELECT id, sender_user_id, recipient_user_id, body, is_read, read_at, created_at
         FROM messages
         WHERE (sender_user_id = :user_id AND recipient_user_id = :contact_user_id)
            OR (sender_user_id = :contact_user_id_reply AND recipient_user_id = :user_id_reply)
         ORDER BY created_at ASC, id ASC'
    );
    $query->execute([
        'user_id' => $userId,
        'contact_user_id' => $conversationUserId,
        'contact_user_id_reply' => $conversationUserId,
        'user_id_reply' => $userId,
    ]);

    return array_map('normalizeMessageRow', $query->fetchAll());
}

function fetchTypingStatus(PDO $pdo, int $userId, int $conversationUserId): array
{
    ensureTypingStatusTable($pdo);

    $query = $pdo->prepare(
        'SELECT is_typing, updated_at
         FROM message_typing_status
         WHERE user_id = :conversation_user_id
           AND conversation_user_id = :user_id
         LIMIT 1'
    );
    $query->execute([
        'conversation_user_id' => $conversationUserId,
        'user_id' => $userId,
    ]);

    $row = $query->fetch();

    if (!$row) {
        return [
            'isTyping' => false,
            'updatedAt' => null,
        ];
    }

    $updatedAt = new DateTimeImmutable((string) $row['updated_at']);
    $isFresh = $updatedAt->getTimestamp() >= (time() - 8);

    return [
        'isTyping' => ((bool) $row['is_typing']) && $isFresh,
        'updatedAt' => (string) $row['updated_at'],
    ];
}

function fetchMessageById(PDO $pdo, int $messageId): ?array
{
    $query = $pdo->prepare(
        'SELECT id, sender_user_id, recipient_user_id, body, is_read, read_at, created_at
         FROM messages
         WHERE id = :id
         LIMIT 1'
    );
    $query->execute([
        'id' => $messageId,
    ]);

    $message = $query->fetch();

    return $message ? normalizeMessageRow($message) : null;
}

function markConversationAsRead(PDO $pdo, int $userId, int $conversationUserId): void
{
    $statement = $pdo->prepare(
        'UPDATE messages
         SET is_read = 1,
             read_at = NOW()
         WHERE sender_user_id = :conversation_user_id
           AND recipient_user_id = :user_id
           AND is_read = 0'
    );
    $statement->execute([
        'conversation_user_id' => $conversationUserId,
        'user_id' => $userId,
    ]);
}

function clearTypingStatus(PDO $pdo, int $userId, int $conversationUserId): void
{
    ensureTypingStatusTable($pdo);

    $statement = $pdo->prepare(
        'INSERT INTO message_typing_status (user_id, conversation_user_id, is_typing)
         VALUES (:user_id, :conversation_user_id, 0)
         ON DUPLICATE KEY UPDATE
            is_typing = 0,
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        'user_id' => $userId,
        'conversation_user_id' => $conversationUserId,
    ]);
}

function resolveConversationUserId(array $contacts, int $userId, ?int $requestedConversationUserId): ?int
{
    if ($requestedConversationUserId !== null && $requestedConversationUserId !== $userId) {
        return $requestedConversationUserId;
    }

    return $contacts !== [] ? (int) $contacts[0]['id'] : null;
}

function normalizeMessageRow(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'senderUserId' => (int) $row['sender_user_id'],
        'recipientUserId' => (int) $row['recipient_user_id'],
        'body' => (string) $row['body'],
        'isRead' => (bool) $row['is_read'],
        'readAt' => $row['read_at'] !== null ? (string) $row['read_at'] : null,
        'createdAt' => (string) $row['created_at'],
    ];
}

function buildDisplayName(array $user): string
{
    $parts = array_filter([
        trim((string) ($user['firstname'] ?? '')),
        trim((string) ($user['middlename'] ?? '')),
        trim((string) ($user['lastname'] ?? '')),
    ]);

    return $parts !== [] ? implode(' ', $parts) : (string) ($user['username'] ?? 'User');
}

function jsonResponse(int $statusCode, array $body): void
{
    http_response_code($statusCode);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
