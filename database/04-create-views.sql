CREATE OR REPLACE VIEW vw_ai_shift_summary AS
SELECT
  s.id AS shift_id,
  s.shift_date,
  s.shift_status,
  e.id AS employee_id,
  e.employee_name,
  e.department,
  e.position,
  c.id AS customer_id,
  c.customer_name,
  st.id AS site_id,
  st.site_name,
  st.city,
  TIMESTAMPDIFF(MINUTE, s.scheduled_start, s.scheduled_end) / 60 AS scheduled_hours,
  COALESCE(a.actual_hours, 0) AS actual_hours
FROM shifts s
LEFT JOIN employees e ON e.id = s.employee_id
JOIN customers c ON c.id = s.customer_id
JOIN sites st ON st.id = s.site_id
LEFT JOIN shift_attendance a ON a.shift_id = s.id;

CREATE OR REPLACE VIEW vw_ai_employee_hours AS
SELECT
  e.id AS employee_id,
  e.employee_name,
  e.department,
  e.position,
  c.id AS customer_id,
  c.customer_name,
  st.id AS site_id,
  st.site_name,
  s.shift_date,
  COALESCE(a.rostered_hours, TIMESTAMPDIFF(MINUTE, s.scheduled_start, s.scheduled_end) / 60) AS rostered_hours,
  COALESCE(a.actual_hours, 0) AS actual_hours,
  COALESCE(a.overtime_hours, 0) AS overtime_hours,
  COALESCE(a.late_minutes, 0) AS late_minutes,
  s.shift_status
FROM shifts s
JOIN employees e ON e.id = s.employee_id
JOIN customers c ON c.id = s.customer_id
JOIN sites st ON st.id = s.site_id
LEFT JOIN shift_attendance a ON a.shift_id = s.id;

CREATE OR REPLACE VIEW vw_ai_attendance_exceptions AS
SELECT
  s.id AS shift_id,
  e.id AS employee_id,
  e.employee_name,
  e.department,
  e.position,
  c.id AS customer_id,
  c.customer_name,
  st.id AS site_id,
  st.site_name,
  s.shift_status,
  s.shift_date,
  a.attendance_status,
  COALESCE(a.late_minutes, 0) AS late_minutes,
  COALESCE(a.early_leave_minutes, 0) AS early_leave_minutes,
  COALESCE(a.actual_hours, 0) AS actual_hours,
  CASE WHEN a.clock_in_datetime IS NOT NULL AND a.clock_out_datetime IS NULL THEN 1 ELSE 0 END AS missing_clock_out,
  CASE WHEN s.shift_status = 'Missed' OR a.attendance_status = 'Missed' THEN 1 ELSE 0 END AS missed_shift
FROM shifts s
LEFT JOIN employees e ON e.id = s.employee_id
JOIN customers c ON c.id = s.customer_id
JOIN sites st ON st.id = s.site_id
LEFT JOIN shift_attendance a ON a.shift_id = s.id
WHERE COALESCE(a.late_minutes, 0) > 0
   OR COALESCE(a.early_leave_minutes, 0) > 0
   OR a.clock_out_datetime IS NULL
   OR s.shift_status IN ('Missed','Unfilled');

CREATE OR REPLACE VIEW vw_ai_customer_performance AS
SELECT
  c.id AS customer_id,
  c.customer_name,
  s.shift_date,
  COUNT(*) AS total_shifts,
  SUM(s.shift_status = 'Completed') AS completed_shifts,
  SUM(s.shift_status = 'Missed') AS missed_shifts,
  SUM(s.shift_status = 'Unfilled') AS unfilled_shifts,
  SUM(COALESCE(a.rostered_hours, TIMESTAMPDIFF(MINUTE, s.scheduled_start, s.scheduled_end) / 60)) AS rostered_hours,
  SUM(COALESCE(a.actual_hours, 0)) AS actual_hours,
  SUM(COALESCE(a.actual_hours, 0) * s.charge_rate) AS revenue,
  SUM(COALESCE(a.actual_hours, 0) * s.pay_rate) AS wages,
  SUM(COALESCE(a.actual_hours, 0) * (s.charge_rate - s.pay_rate)) AS gross_profit
FROM shifts s
JOIN customers c ON c.id = s.customer_id
LEFT JOIN shift_attendance a ON a.shift_id = s.id
GROUP BY c.id, c.customer_name, s.shift_date;

CREATE OR REPLACE VIEW vw_ai_site_performance AS
SELECT
  c.id AS customer_id,
  c.customer_name,
  st.id AS site_id,
  st.site_name,
  s.shift_date,
  COUNT(*) AS total_shifts,
  SUM(s.shift_status = 'Completed') AS completed_shifts,
  SUM(s.shift_status = 'Missed') AS missed_shifts,
  SUM(s.shift_status = 'Unfilled') AS unfilled_shifts,
  SUM(COALESCE(a.actual_hours, 0)) AS actual_hours,
  SUM(COALESCE(a.actual_hours, 0) * s.charge_rate) AS revenue,
  SUM(COALESCE(a.actual_hours, 0) * s.pay_rate) AS wages,
  SUM(COALESCE(a.actual_hours, 0) * (s.charge_rate - s.pay_rate)) AS gross_profit
FROM shifts s
JOIN customers c ON c.id = s.customer_id
JOIN sites st ON st.id = s.site_id
LEFT JOIN shift_attendance a ON a.shift_id = s.id
GROUP BY c.id, c.customer_name, st.id, st.site_name, s.shift_date;

CREATE OR REPLACE VIEW vw_ai_financial_summary AS
SELECT
  s.id AS shift_id,
  s.shift_date,
  e.id AS employee_id,
  e.employee_name,
  e.department,
  e.position,
  c.id AS customer_id,
  c.customer_name,
  st.id AS site_id,
  st.site_name,
  s.shift_status,
  COALESCE(a.actual_hours, 0) AS actual_hours,
  COALESCE(a.actual_hours, 0) * s.charge_rate AS revenue,
  COALESCE(a.actual_hours, 0) * s.pay_rate AS wages,
  COALESCE(a.actual_hours, 0) * (s.charge_rate - s.pay_rate) AS gross_profit,
  CASE
    WHEN COALESCE(a.actual_hours, 0) * s.charge_rate = 0 THEN 0
    ELSE (COALESCE(a.actual_hours, 0) * (s.charge_rate - s.pay_rate))
      / (COALESCE(a.actual_hours, 0) * s.charge_rate) * 100
  END AS gross_margin_percentage
FROM shifts s
LEFT JOIN employees e ON e.id = s.employee_id
JOIN customers c ON c.id = s.customer_id
JOIN sites st ON st.id = s.site_id
LEFT JOIN shift_attendance a ON a.shift_id = s.id;
