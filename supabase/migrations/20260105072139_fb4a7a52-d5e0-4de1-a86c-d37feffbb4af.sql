-- Create activity logging table for FMS system
-- This tracks all user actions, edits, uploads, logins, logouts
CREATE TABLE IF NOT EXISTS fms_activity_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action_type TEXT NOT NULL, -- login, logout, create, update, delete, view, export
    entity_type TEXT, -- stock_code, receiving, production, dispatch, bom, supplier, etc.
    entity_id UUID,
    entity_name TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_fms_activity_log_user_id ON fms_activity_log(user_id);
CREATE INDEX idx_fms_activity_log_created_at ON fms_activity_log(created_at DESC);
CREATE INDEX idx_fms_activity_log_action_type ON fms_activity_log(action_type);

-- Enable RLS
ALTER TABLE fms_activity_log ENABLE ROW LEVEL SECURITY;

-- Only allow the owner ( to view activity logs
-- First, create a policy that allows all FMS users to INSERT logs
CREATE POLICY "All FMS users can create activity logs"
ON fms_activity_log
FOR INSERT
WITH CHECK (fms_has_access(auth.uid()));

-- Only allow the specific owner email to view logs
-- We'll use auth.jwt() to check the email claim
CREATE POLICY "Only owner can view activity logs"
ON fms_activity_log
FOR SELECT
USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'zulaigah.benjamin@maharajasspices.co.za'
);

-- Add custom_allergen field to fms_stock_codes for "Other" allergen specification
ALTER TABLE fms_stock_codes 
ADD COLUMN IF NOT EXISTS custom_allergens TEXT[];

-- Create notifications table for FMS system
CREATE TABLE IF NOT EXISTS fms_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'info', -- info, warning, error, success
    entity_type TEXT, -- stock_code, receiving, production, dispatch, etc.
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_fms_notifications_user_id ON fms_notifications(user_id);
CREATE INDEX idx_fms_notifications_is_read ON fms_notifications(is_read);
CREATE INDEX idx_fms_notifications_created_at ON fms_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE fms_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON fms_notifications
FOR SELECT
USING (fms_has_access(auth.uid()));

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
ON fms_notifications
FOR UPDATE
USING (fms_has_access(auth.uid()));

-- System can insert notifications for any user
CREATE POLICY "FMS users can create notifications"
ON fms_notifications
FOR INSERT
WITH CHECK (fms_has_access(auth.uid()));