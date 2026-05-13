-- =============================================================
-- SEED: SAMPLE NOTIFICATIONS FOR ALL USERS
-- Run in Supabase SQL Editor after migration-v2-phase1.sql
-- =============================================================

-- Insert sample notifications for every user in the profiles table
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id, full_name FROM profiles LOOP

    -- Cycle launched notification
    INSERT INTO notifications (user_id, type, title, body, link, read, created_at)
    VALUES (
      u.id,
      'cycle_launched',
      'H1 2026 Performance Cycle Launched',
      'The bi-annual appraisal cycle for H1 2026 has been launched. Please begin setting your objectives.',
      '/cycles',
      false,
      now() - interval '2 hours'
    );

    -- Objective reminder
    INSERT INTO notifications (user_id, type, title, body, link, read, created_at)
    VALUES (
      u.id,
      'objective_reminder',
      'Objective Submission Deadline Approaching',
      'You have 5 days left to submit your objectives for the current cycle. Make sure all weights total 100%.',
      '/objectives',
      false,
      now() - interval '1 hour'
    );

    -- Course assigned
    INSERT INTO notifications (user_id, type, title, body, link, read, created_at)
    VALUES (
      u.id,
      'course_assigned',
      'New Course Assigned: Leadership Essentials',
      'Your manager has assigned you a new training course. Please complete it by the end of this month.',
      '/training/my-courses',
      false,
      now() - interval '30 minutes'
    );

    -- Appraisal completed (read)
    INSERT INTO notifications (user_id, type, title, body, link, read, created_at)
    VALUES (
      u.id,
      'appraisal_completed',
      'Q4 2025 Appraisal Finalized',
      'Your performance appraisal for Q4 2025 has been finalized. View your results and feedback.',
      '/appraisals/performance',
      true,
      now() - interval '3 days'
    );

    -- System update (read)
    INSERT INTO notifications (user_id, type, title, body, link, read, created_at)
    VALUES (
      u.id,
      'system',
      'Performance Hub Updated to v2.0',
      'New features include cycle management, cascading objectives, and real-time notifications.',
      NULL,
      true,
      now() - interval '5 days'
    );

    -- Objective approved
    INSERT INTO notifications (user_id, type, title, body, link, read, created_at)
    VALUES (
      u.id,
      'objective_approved',
      'Your Objectives Have Been Approved',
      'All 4 of your objectives for H1 2026 have been approved by your manager. Great work!',
      '/objectives',
      false,
      now() - interval '15 minutes'
    );

    -- IDP suggestion
    INSERT INTO notifications (user_id, type, title, body, link, read, created_at)
    VALUES (
      u.id,
      'idp_suggestion',
      'Development Plan Recommendation',
      'Based on your last appraisal, we recommend focusing on strategic thinking and data analysis skills.',
      NULL,
      true,
      now() - interval '1 day'
    );

  END LOOP;
END $$;

-- Verify
SELECT
  (SELECT count(*) FROM notifications) AS total_notifications,
  (SELECT count(*) FROM notifications WHERE read = false) AS unread,
  (SELECT count(DISTINCT user_id) FROM notifications) AS users_with_notifications;
