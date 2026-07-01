-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: fdb1033.awardspace.net
-- Generation Time: Jul 01, 2026 at 05:46 AM
-- Server version: 8.0.32
-- PHP Version: 8.1.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `4421460_supply`
--

-- --------------------------------------------------------

--
-- Dumping data for table `login_attempts`
--

INSERT INTO `login_attempts` (`id`, `identifier_key`, `failed_attempts`, `lockout_until`, `last_failed_at`, `created_at`, `updated_at`) VALUES
(14, 'crampatanta', 1, NULL, '2026-06-30 14:05:48', '2026-06-30 14:05:48', '2026-06-30 14:05:48'),
(15, 'sarahjanecrampatanta07@gmail.com', 2, NULL, '2026-06-30 14:06:49', '2026-06-30 14:06:01', '2026-06-30 14:06:49');

-- --------------------------------------------------------

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
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `role`, `designation`, `id_number`, `firstname`, `middlename`, `lastname`, `username`, `email`, `contact_number`, `address`, `profile_image_path`, `password_hash`, `created_at`, `updated_at`) VALUES
(4, 'Administrator', NULL, '2026-5342', 'SFCG', NULL, 'Guihulngan City', 'sfcg-admin', 'admin@gmail.com', NULL, NULL, '/uploads/profile-pictures/admin-4-1782794178.png', '$2y$10$kaTad0gNVbjluROBe8by4ehqYbtliGvMI3uxBy3.7OYs1g6AZ3T9W', '2026-04-05 13:18:26', '2026-06-30 04:36:18'),
(10, 'Property Custodian', NULL, 'C2324-0465', 'Jenerose', 'Ampalayohan', 'Macaya', 'Jenerose', 'jenerosemacaya1402@gmail.com', NULL, NULL, NULL, '$2y$10$RCe1odkYvRCTFhAnE7zF1e1Z6L6HdotAWHzafKodNc/9B5KS0uzHe', '2026-06-30 13:41:20', '2026-06-30 13:41:20'),
(11, 'Faculty Staff', NULL, '2023-0110', 'Joyce', 'L.', 'Medes', 'Joyce', 'joycemedes247@gmail.com', NULL, NULL, NULL, '$2y$10$HpSVSqpQsNeEgZjfQEKu0.x/BYO0MbIaHvj9FtUS8BEbad.AjNI3S', '2026-06-30 13:55:30', '2026-06-30 13:55:30'),
(12, 'Property Custodian', NULL, '2024-1001', 'Beng', 'L.', 'Medes', 'Medes', 'joycemedes327@gmail.com', NULL, NULL, NULL, '$2y$10$mWmtvNZjz1i5ph2QU6zuwOI9UNkq5fTx2LgSmvPeGPwE2UhKAtKPm', '2026-06-30 14:02:54', '2026-06-30 14:02:54'),
(13, 'Property Custodian', NULL, '2024-0347', 'Sarahjane', 'T.', 'Crampatanta', 'Sarahjane', 'sarahjanecrampatanta07@gmail.com', NULL, NULL, NULL, '$2y$10$dlCnMSR/umFkZMJplSScEOfkz0qKtz/mDxWRXQ5L1wUshYfOvAo3i', '2026-06-30 14:10:25', '2026-06-30 14:10:25'),
(14, 'Faculty Staff', NULL, '2324-0118', 'sarah jane', NULL, 'crampatanta', 'sarah', 'sarahcrampatanta07@gmail.com', NULL, NULL, NULL, '$2y$10$jy6c6i.h4BqSpSsLiWK7FOcxs38RQS310hhPWGsp2LWUlpdp6gnG6', '2026-06-30 15:53:54', '2026-06-30 15:53:54');

-- --------------------------------------------------------

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
-- Dumping data for table `stock_entries`
--

INSERT INTO `stock_entries` (`id`, `supply_id`, `quantity`, `reference_no`, `remarks`, `created_by_user_id`, `created_at`) VALUES
(3, 3, 100, NULL, NULL, 4, '2026-04-10 15:51:40'),
(4, 4, 100, NULL, NULL, 4, '2026-04-10 15:51:49'),
(5, 5, 100, NULL, NULL, 4, '2026-04-10 15:51:54'),
(6, 6, 100, NULL, NULL, 4, '2026-04-10 15:52:03');

-- --------------------------------------------------------

--
-- Dumping data for table `supply_requests`
--

INSERT INTO `supply_requests` (`id`, `request_number`, `requested_by_user_id`, `purpose`, `department`, `date_needed`, `notes`, `status`, `total_items`, `total_quantity`, `grand_total`, `reviewed_by_user_id`, `review_notes`, `reviewed_at`, `fulfilled_by_user_id`, `fulfilled_at`, `issuance_slip_no`, `receipt_path`, `liquidation_path`, `purchase_date`, `release_date`, `completion_date`, `confirmed_received`, `created_at`, `updated_at`) VALUES
(7, 'REQ-20260630-135739-255B0B', 11, 'I need bond paper rn', NULL, NULL, 'I need bond paper rn', 'Pending', 1, 1, 0.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-06-30 13:57:39', '2026-06-30 13:57:39'),
(8, 'REQ-20260630-135747-C8244D', 11, 'I need bond paper rn', NULL, NULL, 'I need bond paper rn', 'Pending', 1, 1, 0.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-06-30 13:57:47', '2026-06-30 13:57:47'),
(9, 'REQ-20260630-155612-938FD2', 14, 'rush please', NULL, NULL, 'rush please', 'Pending', 3, 3, 0.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-06-30 15:56:12', '2026-06-30 15:56:12'),
(10, 'REQ-20260630-155619-12BCC6', 14, 'rush please', NULL, NULL, 'rush please', 'Pending', 3, 3, 0.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-06-30 15:56:19', '2026-06-30 15:56:19'),
(11, 'REQ-20260630-155643-2D1BC0', 14, 'rush please', NULL, NULL, 'rush please', 'Pending', 3, 3, 0.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-06-30 15:56:43', '2026-06-30 15:56:43');

-- --------------------------------------------------------

--
-- Dumping data for table `supply_request_items`
--

INSERT INTO `supply_request_items` (`id`, `request_id`, `supply_id`, `custom_item_name`, `unit_cost`, `total_amount`, `quantity_requested`, `quantity_approved`, `quantity_fulfilled`, `created_at`, `updated_at`) VALUES
(7, 7, 4, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 13:57:39', '2026-06-30 13:57:39'),
(8, 8, 4, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 13:57:47', '2026-06-30 13:57:47'),
(9, 9, 4, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:12', '2026-06-30 15:56:12'),
(10, 9, 5, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:12', '2026-06-30 15:56:12'),
(11, 9, 6, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:12', '2026-06-30 15:56:12'),
(12, 10, 4, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:19', '2026-06-30 15:56:19'),
(13, 10, 5, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:19', '2026-06-30 15:56:19'),
(14, 10, 6, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:19', '2026-06-30 15:56:19'),
(15, 11, 4, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:43', '2026-06-30 15:56:43'),
(16, 11, 5, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:43', '2026-06-30 15:56:43'),
(17, 11, 6, NULL, 0.00, 0.00, 1, NULL, 0, '2026-06-30 15:56:43', '2026-06-30 15:56:43');

-- --------------------------------------------------------

--
-- Dumping data for table `message_typing_status`
--

INSERT INTO `message_typing_status` (`user_id`, `conversation_user_id`, `is_typing`, `updated_at`) VALUES
(11, 10, 0, '2026-06-30 13:58:13');

-- --------------------------------------------------------

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `recipient_user_id`, `actor_user_id`, `type`, `title`, `message`, `action_url`, `metadata_json`, `is_read`, `email_sent_at`, `created_at`, `read_at`) VALUES
(17, 10, 11, 'request_submitted', 'New Faculty Supply Request', 'Joyce L. Medes submitted REQ-20260630-135739-255B0B with 1 item(s) and 1 total quantity.', '/custodian/request-issuance', '{\"requestId\":7,\"requestNumber\":\"REQ-20260630-135739-255B0B\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 13:57:39', NULL),
(18, 4, 11, 'request_submitted', 'New Faculty Supply Request', 'Joyce L. Medes submitted REQ-20260630-135739-255B0B with 1 item(s) and 1 total quantity.', '/admin/request-issuance', '{\"requestId\":7,\"requestNumber\":\"REQ-20260630-135739-255B0B\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 13:57:39', NULL),
(19, 10, 11, 'request_submitted', 'New Faculty Supply Request', 'Joyce L. Medes submitted REQ-20260630-135747-C8244D with 1 item(s) and 1 total quantity.', '/custodian/request-issuance', '{\"requestId\":8,\"requestNumber\":\"REQ-20260630-135747-C8244D\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 13:57:47', NULL),
(20, 4, 11, 'request_submitted', 'New Faculty Supply Request', 'Joyce L. Medes submitted REQ-20260630-135747-C8244D with 1 item(s) and 1 total quantity.', '/admin/request-issuance', '{\"requestId\":8,\"requestNumber\":\"REQ-20260630-135747-C8244D\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 13:57:47', NULL),
(21, 12, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155612-938FD2 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":9,\"requestNumber\":\"REQ-20260630-155612-938FD2\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:12', NULL),
(22, 10, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155612-938FD2 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":9,\"requestNumber\":\"REQ-20260630-155612-938FD2\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:12', NULL),
(23, 13, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155612-938FD2 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":9,\"requestNumber\":\"REQ-20260630-155612-938FD2\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:12', NULL),
(24, 4, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155612-938FD2 with 3 item(s) and 3 total quantity.', '/admin/request-issuance', '{\"requestId\":9,\"requestNumber\":\"REQ-20260630-155612-938FD2\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:12', NULL),
(25, 12, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155619-12BCC6 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":10,\"requestNumber\":\"REQ-20260630-155619-12BCC6\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:19', NULL),
(26, 10, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155619-12BCC6 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":10,\"requestNumber\":\"REQ-20260630-155619-12BCC6\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:19', NULL),
(27, 13, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155619-12BCC6 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":10,\"requestNumber\":\"REQ-20260630-155619-12BCC6\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:19', NULL),
(28, 4, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155619-12BCC6 with 3 item(s) and 3 total quantity.', '/admin/request-issuance', '{\"requestId\":10,\"requestNumber\":\"REQ-20260630-155619-12BCC6\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:19', NULL),
(29, 12, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155643-2D1BC0 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":11,\"requestNumber\":\"REQ-20260630-155643-2D1BC0\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:43', NULL),
(30, 10, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155643-2D1BC0 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":11,\"requestNumber\":\"REQ-20260630-155643-2D1BC0\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:43', NULL),
(31, 13, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155643-2D1BC0 with 3 item(s) and 3 total quantity.', '/custodian/request-issuance', '{\"requestId\":11,\"requestNumber\":\"REQ-20260630-155643-2D1BC0\",\"requestStatus\":\"Pending\"}', 0, NULL, '2026-06-30 15:56:43', NULL),
(32, 4, 14, 'request_submitted', 'New Faculty Supply Request', 'sarah jane crampatanta submitted REQ-20260630-155643-2D1BC0 with 3 item(s) and 3 total quantity.', '/admin/request-issuance', '{\"requestId\":11,\"requestNumber\":\"REQ-20260630-155643-2D1BC0\",\"requestStatus\":\"Pending\"}', 1, NULL, '2026-06-30 15:56:43', '2026-07-01 01:21:35');

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
