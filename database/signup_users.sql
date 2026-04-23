CREATE DATABASE IF NOT EXISTS supply_management;
USE supply_management;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role ENUM('Faculty Staff', 'Property Custodian', 'Administrator') NOT NULL DEFAULT 'Faculty Staff',
    id_number VARCHAR(50) NULL,
    firstname VARCHAR(100) NOT NULL,
    middlename VARCHAR(100) NULL,
    lastname VARCHAR(100) NOT NULL,
    username VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_users_id_number (id_number)
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    identifier_key VARCHAR(150) NOT NULL UNIQUE,
    failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    lockout_until DATETIME NULL,
    last_failed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supply_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_supply_category_name (name)
);

CREATE TABLE IF NOT EXISTS supplies (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    item_code VARCHAR(60) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    image_path VARCHAR(255) NULL,
    quantity_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_supply_item_code (item_code),
    UNIQUE KEY unique_supply_name (name),
    CONSTRAINT fk_supplies_category
        FOREIGN KEY (category_id) REFERENCES supply_categories(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS stock_entries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supply_id INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    reference_no VARCHAR(60) NULL,
    remarks VARCHAR(255) NULL,
    created_by_user_id INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_entries_supply
        FOREIGN KEY (supply_id) REFERENCES supplies(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_stock_entries_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
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
);

CREATE TABLE IF NOT EXISTS supply_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_number VARCHAR(40) NOT NULL,
    requested_by_user_id INT UNSIGNED NOT NULL,
    notes VARCHAR(500) NULL,
    status ENUM('Pending', 'Approved', 'Rejected', 'Fulfilled', 'Cancelled') NOT NULL DEFAULT 'Pending',
    total_items INT UNSIGNED NOT NULL DEFAULT 0,
    total_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    reviewed_by_user_id INT UNSIGNED NULL,
    review_notes VARCHAR(500) NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_supply_request_number (request_number),
    CONSTRAINT fk_supply_requests_requested_by
        FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_supply_requests_reviewed_by
        FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS supply_request_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT UNSIGNED NOT NULL,
    supply_id INT UNSIGNED NOT NULL,
    quantity_requested INT UNSIGNED NOT NULL,
    quantity_approved INT UNSIGNED NULL,
    quantity_fulfilled INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_supply_request_items_request
        FOREIGN KEY (request_id) REFERENCES supply_requests(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_supply_request_items_supply
        FOREIGN KEY (supply_id) REFERENCES supplies(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
