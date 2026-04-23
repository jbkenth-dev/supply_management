-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 10, 2026 at 05:54 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `supply_management`
--

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `title` varchar(180) NOT NULL,
  `description` varchar(1000) NOT NULL,
  `type` enum('feature','maintenance','update') NOT NULL DEFAULT 'update',
  `created_by_user_id` int(10) UNSIGNED NOT NULL,
  `published_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `login_attempts`
--

CREATE TABLE `login_attempts` (
  `id` int(10) UNSIGNED NOT NULL,
  `identifier_key` varchar(150) NOT NULL,
  `failed_attempts` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `lockout_until` datetime DEFAULT NULL,
  `last_failed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `sender_user_id` int(10) UNSIGNED NOT NULL,
  `recipient_user_id` int(10) UNSIGNED NOT NULL,
  `body` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `message_typing_status`
--

CREATE TABLE `message_typing_status` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `conversation_user_id` int(10) UNSIGNED NOT NULL,
  `is_typing` tinyint(1) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `recipient_user_id` int(10) UNSIGNED NOT NULL,
  `actor_user_id` int(10) UNSIGNED DEFAULT NULL,
  `type` varchar(60) NOT NULL,
  `title` varchar(180) NOT NULL,
  `message` varchar(500) NOT NULL,
  `action_url` varchar(255) NOT NULL,
  `metadata_json` text DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `email_sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `read_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_entries`
--

CREATE TABLE `stock_entries` (
  `id` int(10) UNSIGNED NOT NULL,
  `supply_id` int(10) UNSIGNED NOT NULL,
  `quantity` int(10) UNSIGNED NOT NULL,
  `reference_no` varchar(60) DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  `created_by_user_id` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `stock_entries`
--

INSERT INTO `stock_entries` (`id`, `supply_id`, `quantity`, `reference_no`, `remarks`, `created_by_user_id`, `created_at`) VALUES
(3, 3, 100, NULL, NULL, 4, '2026-04-10 15:51:40'),
(4, 4, 100, NULL, NULL, 4, '2026-04-10 15:51:49'),
(5, 5, 100, NULL, NULL, 4, '2026-04-10 15:51:54'),
(6, 6, 100, NULL, NULL, 4, '2026-04-10 15:52:03');

-- --------------------------------------------------------

--
-- Table structure for table `supplies`
--

CREATE TABLE `supplies` (
  `id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `item_code` varchar(60) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `unit` varchar(30) NOT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `quantity_on_hand` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `supplies`
--

INSERT INTO `supplies` (`id`, `category_id`, `item_code`, `name`, `description`, `unit`, `image_path`, `quantity_on_hand`, `created_at`, `updated_at`) VALUES
(3, 7, '123456', 'Suppy Name 1', 'Details 1', '', '/uploads/supplies/0d750f173f3ff2f1af5c16125dd9c175.png', 100, '2026-04-10 15:37:18', '2026-04-10 15:51:40'),
(4, 8, '231535', 'Supply Name 2', 'Details 2', '', '/uploads/supplies/626482232ff3137f66c8989958f78af5.png', 100, '2026-04-10 15:42:42', '2026-04-10 15:51:49'),
(5, 9, '642370', 'Supply name 3', 'Details 3', '', '/uploads/supplies/88054df9f9ccf184ebb098ebacd02d80.png', 100, '2026-04-10 15:50:02', '2026-04-10 15:51:54'),
(6, 10, '07368', 'Supply Name 4', 'Sample 4', '', '/uploads/supplies/9e7d9fe58d60c5d3ecd6184b84a95839.png', 100, '2026-04-10 15:50:55', '2026-04-10 15:52:03');

-- --------------------------------------------------------

--
-- Table structure for table `supply_categories`
--

CREATE TABLE `supply_categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `supply_categories`
--

INSERT INTO `supply_categories` (`id`, `name`, `created_at`, `updated_at`) VALUES
(7, 'Category 1', '2026-04-10 15:34:21', '2026-04-10 15:34:21'),
(8, 'Category 2', '2026-04-10 15:34:26', '2026-04-10 15:34:26'),
(9, 'Category 3', '2026-04-10 15:34:31', '2026-04-10 15:34:31'),
(10, 'Category 4', '2026-04-10 15:34:37', '2026-04-10 15:34:37');

-- --------------------------------------------------------

--
-- Table structure for table `supply_requests`
--

CREATE TABLE `supply_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `request_number` varchar(40) NOT NULL,
  `requested_by_user_id` int(10) UNSIGNED NOT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected','Fulfilled','Cancelled') NOT NULL DEFAULT 'Pending',
  `total_items` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_quantity` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `reviewed_by_user_id` int(10) UNSIGNED DEFAULT NULL,
  `review_notes` varchar(500) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `fulfilled_by_user_id` int(10) UNSIGNED DEFAULT NULL,
  `fulfilled_at` datetime DEFAULT NULL,
  `issuance_slip_no` varchar(40) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `supply_request_items`
--

CREATE TABLE `supply_request_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `request_id` bigint(20) UNSIGNED NOT NULL,
  `supply_id` int(10) UNSIGNED NOT NULL,
  `quantity_requested` int(10) UNSIGNED NOT NULL,
  `quantity_approved` int(10) UNSIGNED DEFAULT NULL,
  `quantity_fulfilled` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `role` enum('Faculty Staff','Property Custodian','Administrator') NOT NULL DEFAULT 'Faculty Staff',
  `id_number` varchar(50) DEFAULT NULL,
  `firstname` varchar(100) NOT NULL,
  `middlename` varchar(100) DEFAULT NULL,
  `lastname` varchar(100) NOT NULL,
  `username` varchar(30) NOT NULL,
  `email` varchar(150) NOT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `profile_image_path` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `role`, `id_number`, `firstname`, `middlename`, `lastname`, `username`, `email`, `contact_number`, `address`, `profile_image_path`, `password_hash`, `created_at`, `updated_at`) VALUES
(4, 'Administrator', '2026-5342', 'SFCG', NULL, 'Guihulngan City', 'sfcg-admin', 'admin@gmail.com', NULL, NULL, '/uploads/profile-pictures/admin-4-1775834692.jpg', '$2y$10$kaTad0gNVbjluROBe8by4ehqYbtliGvMI3uxBy3.7OYs1g6AZ3T9W', '2026-04-05 13:18:26', '2026-04-10 15:54:09');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_announcements_created_by` (`created_by_user_id`),
  ADD KEY `idx_announcements_published` (`published_at`,`id`);

--
-- Indexes for table `login_attempts`
--
ALTER TABLE `login_attempts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `identifier_key` (`identifier_key`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_messages_pair_created` (`sender_user_id`,`recipient_user_id`,`created_at`),
  ADD KEY `idx_messages_recipient_read` (`recipient_user_id`,`is_read`,`created_at`);

--
-- Indexes for table `message_typing_status`
--
ALTER TABLE `message_typing_status`
  ADD PRIMARY KEY (`user_id`,`conversation_user_id`),
  ADD KEY `fk_message_typing_conversation_user` (`conversation_user_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_notifications_actor` (`actor_user_id`),
  ADD KEY `idx_notifications_recipient_created` (`recipient_user_id`,`created_at`),
  ADD KEY `idx_notifications_recipient_read` (`recipient_user_id`,`is_read`,`created_at`);

--
-- Indexes for table `stock_entries`
--
ALTER TABLE `stock_entries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_stock_entries_supply` (`supply_id`),
  ADD KEY `fk_stock_entries_user` (`created_by_user_id`);

--
-- Indexes for table `supplies`
--
ALTER TABLE `supplies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_supply_name` (`name`),
  ADD UNIQUE KEY `unique_supply_item_code` (`item_code`),
  ADD KEY `fk_supplies_category` (`category_id`);

--
-- Indexes for table `supply_categories`
--
ALTER TABLE `supply_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_supply_category_name` (`name`);

--
-- Indexes for table `supply_requests`
--
ALTER TABLE `supply_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_supply_request_number` (`request_number`),
  ADD KEY `fk_supply_requests_requested_by` (`requested_by_user_id`),
  ADD KEY `fk_supply_requests_reviewed_by` (`reviewed_by_user_id`),
  ADD KEY `idx_supply_requests_issuance_slip_no` (`issuance_slip_no`);

--
-- Indexes for table `supply_request_items`
--
ALTER TABLE `supply_request_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_supply_request_items_request` (`request_id`),
  ADD KEY `fk_supply_request_items_supply` (`supply_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `announcements`
--
ALTER TABLE `announcements`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `login_attempts`
--
ALTER TABLE `login_attempts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `stock_entries`
--
ALTER TABLE `stock_entries`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `supplies`
--
ALTER TABLE `supplies`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `supply_categories`
--
ALTER TABLE `supply_categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `supply_requests`
--
ALTER TABLE `supply_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `supply_request_items`
--
ALTER TABLE `supply_request_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `announcements`
--
ALTER TABLE `announcements`
  ADD CONSTRAINT `fk_announcements_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `fk_messages_recipient` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `message_typing_status`
--
ALTER TABLE `message_typing_status`
  ADD CONSTRAINT `fk_message_typing_conversation_user` FOREIGN KEY (`conversation_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_message_typing_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notifications_recipient` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `stock_entries`
--
ALTER TABLE `stock_entries`
  ADD CONSTRAINT `fk_stock_entries_supply` FOREIGN KEY (`supply_id`) REFERENCES `supplies` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_stock_entries_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `supplies`
--
ALTER TABLE `supplies`
  ADD CONSTRAINT `fk_supplies_category` FOREIGN KEY (`category_id`) REFERENCES `supply_categories` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `supply_requests`
--
ALTER TABLE `supply_requests`
  ADD CONSTRAINT `fk_supply_requests_requested_by` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_supply_requests_reviewed_by` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `supply_request_items`
--
ALTER TABLE `supply_request_items`
  ADD CONSTRAINT `fk_supply_request_items_request` FOREIGN KEY (`request_id`) REFERENCES `supply_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_supply_request_items_supply` FOREIGN KEY (`supply_id`) REFERENCES `supplies` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
