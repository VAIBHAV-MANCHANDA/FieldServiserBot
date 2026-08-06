CREATE INDEX idx_employees_name ON employees(employee_name);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_position ON employees(position);
CREATE INDEX idx_employees_active ON employees(is_active);

CREATE INDEX idx_customers_name ON customers(customer_name);
CREATE INDEX idx_customers_active ON customers(is_active);

CREATE INDEX idx_sites_customer ON sites(customer_id);
CREATE INDEX idx_sites_name ON sites(site_name);
CREATE INDEX idx_sites_city ON sites(city);
CREATE INDEX idx_sites_active ON sites(is_active);

CREATE INDEX idx_shifts_date ON shifts(shift_date);
CREATE INDEX idx_shifts_employee ON shifts(employee_id);
CREATE INDEX idx_shifts_customer ON shifts(customer_id);
CREATE INDEX idx_shifts_site ON shifts(site_id);
CREATE INDEX idx_shifts_status ON shifts(shift_status);

CREATE INDEX idx_attendance_status ON shift_attendance(attendance_status);
CREATE INDEX idx_attendance_clock_in ON shift_attendance(clock_in_datetime);

CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at);
CREATE INDEX idx_ai_query_logs_session_created ON ai_query_logs(session_id, created_at);
CREATE INDEX idx_ai_query_logs_report_type ON ai_query_logs(report_type);
