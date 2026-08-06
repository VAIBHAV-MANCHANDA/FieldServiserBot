CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_code VARCHAR(40) NOT NULL,
  employee_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL,
  department VARCHAR(80) NOT NULL,
  position VARCHAR(80) NOT NULL,
  hourly_pay_rate DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_employee_code (employee_code),
  UNIQUE KEY uq_employees_email (email)
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_code VARCHAR(40) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_customer_code (customer_code)
);

CREATE TABLE IF NOT EXISTS sites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  site_code VARCHAR(40) NOT NULL,
  site_name VARCHAR(160) NOT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sites_site_code (site_code),
  CONSTRAINT fk_sites_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS shifts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  shift_date DATE NOT NULL,
  scheduled_start DATETIME NOT NULL,
  scheduled_end DATETIME NOT NULL,
  shift_status ENUM('Completed','Missed','Unfilled','Cancelled','Scheduled','In Progress') NOT NULL,
  pay_rate DECIMAL(10,2) NOT NULL,
  charge_rate DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_shifts_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  CONSTRAINT fk_shifts_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_shifts_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS shift_attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shift_id BIGINT UNSIGNED NOT NULL,
  clock_in_datetime DATETIME NULL,
  clock_out_datetime DATETIME NULL,
  rostered_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  actual_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  late_minutes INT NOT NULL DEFAULT 0,
  early_leave_minutes INT NOT NULL DEFAULT 0,
  overtime_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  attendance_status ENUM('Completed','Late','Missed','Incomplete','Clocked In','Not Started') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shift_attendance_shift (shift_id),
  CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_uuid CHAR(36) NOT NULL,
  session_title VARCHAR(180) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_chat_sessions_uuid (session_uuid)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id BIGINT UNSIGNED NOT NULL,
  message_role ENUM('user','assistant','system') NOT NULL,
  message_text TEXT NOT NULL,
  intent_json JSON NULL,
  chart_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_chat_messages_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_query_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id BIGINT UNSIGNED NULL,
  user_message TEXT NOT NULL,
  report_type VARCHAR(80) NULL,
  intent_json JSON NULL,
  result_count INT NOT NULL DEFAULT 0,
  execution_time_ms INT NOT NULL DEFAULT 0,
  status ENUM('success','failed') NOT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ai_query_logs_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL
);
