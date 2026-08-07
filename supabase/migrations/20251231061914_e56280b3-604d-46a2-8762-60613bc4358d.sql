-- Food Manufacturing Traceability System (FMS)
-- All tables are prefixed with 'fms_' to avoid conflicts with existing site tables
-- This is a separate system within the same database

-- Create FMS user roles enum (separate from existing app_role)
CREATE TYPE public.fms_role AS ENUM ('system_admin', 'production_supervisor', 'production_operator', 'stores_operator', 'dispatch_user');

-- FMS Users table (references auth.users but stores FMS-specific data)
CREATE TABLE public.fms_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role fms_role NOT NULL DEFAULT 'production_operator',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fms_users ENABLE ROW LEVEL SECURITY;

-- FMS role check function (separate from site's has_role)
CREATE OR REPLACE FUNCTION public.fms_has_role(_user_id UUID, _role fms_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fms_users
    WHERE user_id = _user_id AND role = _role AND is_active = true
  )
$$;

-- Check if user has any FMS access
CREATE OR REPLACE FUNCTION public.fms_has_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fms_users
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- FMS Users policies
CREATE POLICY "FMS users can view their own profile" ON public.fms_users
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "FMS admins can view all users" ON public.fms_users
FOR SELECT USING (fms_has_role(auth.uid(), 'system_admin'));

CREATE POLICY "FMS admins can manage users" ON public.fms_users
FOR ALL USING (fms_has_role(auth.uid(), 'system_admin'));

-- FMS Suppliers
CREATE TABLE public.fms_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view suppliers" ON public.fms_suppliers
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS admins and supervisors can manage suppliers" ON public.fms_suppliers
FOR ALL USING (fms_has_role(auth.uid(), 'system_admin') OR fms_has_role(auth.uid(), 'production_supervisor'));

-- FMS Stock Codes
CREATE TABLE public.fms_stock_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('raw_material', 'packaging', 'work_in_progress', 'finished_good')),
  unit_of_measure TEXT NOT NULL CHECK (unit_of_measure IN ('kg', 'g', 'litres', 'ml', 'units', 'each')),
  storage_condition TEXT NOT NULL CHECK (storage_condition IN ('ambient', 'chilled', 'frozen')),
  has_allergens BOOLEAN DEFAULT false,
  allergen_types TEXT[] DEFAULT '{}',
  approved_supplier_ids UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_stock_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view stock codes" ON public.fms_stock_codes
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS admins and supervisors can manage stock codes" ON public.fms_stock_codes
FOR ALL USING (fms_has_role(auth.uid(), 'system_admin') OR fms_has_role(auth.uid(), 'production_supervisor'));

-- FMS Receiving Log
CREATE TABLE public.fms_receiving (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_lot_number TEXT NOT NULL UNIQUE,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  quantity_received DECIMAL NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.fms_suppliers(id),
  supplier_batch_number TEXT NOT NULL,
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  delivery_note_number TEXT,
  quality_checks JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('accepted', 'rejected', 'partial', 'pending')),
  rejection_reason TEXT,
  received_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_receiving ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view receiving records" ON public.fms_receiving
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS stores operators can create receiving records" ON public.fms_receiving
FOR INSERT WITH CHECK (fms_has_access(auth.uid()));

-- FMS Bill of Materials
CREATE TABLE public.fms_bom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_good_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  effective_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'obsolete')),
  obsolete_reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(finished_good_id, version_number)
);

ALTER TABLE public.fms_bom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view BOMs" ON public.fms_bom
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS admins and supervisors can manage BOMs" ON public.fms_bom
FOR ALL USING (fms_has_role(auth.uid(), 'system_admin') OR fms_has_role(auth.uid(), 'production_supervisor'));

-- FMS BOM Components
CREATE TABLE public.fms_bom_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES public.fms_bom(id) ON DELETE CASCADE,
  material_stock_code_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  quantity_per_batch DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_bom_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view BOM components" ON public.fms_bom_components
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS admins and supervisors can manage BOM components" ON public.fms_bom_components
FOR ALL USING (fms_has_role(auth.uid(), 'system_admin') OR fms_has_role(auth.uid(), 'production_supervisor'));

-- FMS Production Batches with auto-incrementing batch number
CREATE SEQUENCE public.fms_batch_number_seq START 1;

CREATE TABLE public.fms_production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE DEFAULT 'PB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.fms_batch_number_seq')::TEXT, 5, '0'),
  finished_good_id UUID NOT NULL REFERENCES public.fms_stock_codes(id),
  bom_id UUID NOT NULL REFERENCES public.fms_bom(id),
  planned_batch_size INTEGER NOT NULL,
  actual_quantity_produced INTEGER,
  product_size DECIMAL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pre_weighing', 'manufacturing', 'in_progress', 'closed')),
  planned_production_date DATE NOT NULL,
  production_start TIMESTAMP WITH TIME ZONE,
  production_end TIMESTAMP WITH TIME ZONE,
  production_instructions TEXT,
  processing_steps JSONB DEFAULT '[]',
  quality_checks JSONB DEFAULT '[]',
  final_quality_checks JSONB,
  pre_weigh_approved BOOLEAN DEFAULT false,
  pre_weigh_approved_by UUID,
  pre_weigh_approved_at TIMESTAMP WITH TIME ZONE,
  scrap_waste DECIMAL,
  waste_notes TEXT,
  retention_sample_taken BOOLEAN DEFAULT false,
  operator_id UUID NOT NULL,
  supervisor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.fms_production_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view production batches" ON public.fms_production_batches
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS operators can create production batches" ON public.fms_production_batches
FOR INSERT WITH CHECK (fms_has_access(auth.uid()));

CREATE POLICY "FMS operators can update production batches" ON public.fms_production_batches
FOR UPDATE USING (fms_has_access(auth.uid()));

-- FMS Materials Used in Production
CREATE TABLE public.fms_materials_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.fms_production_batches(id) ON DELETE CASCADE,
  receiving_record_id UUID NOT NULL REFERENCES public.fms_receiving(id),
  quantity_used DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_materials_used ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view materials used" ON public.fms_materials_used
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS operators can manage materials used" ON public.fms_materials_used
FOR ALL USING (fms_has_access(auth.uid()));

-- FMS Dispatch Records
CREATE TABLE public.fms_dispatch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  dispatch_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  customer_name TEXT NOT NULL,
  customer_id UUID,
  dispatched_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_dispatch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view dispatch records" ON public.fms_dispatch
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS dispatch users can create dispatch records" ON public.fms_dispatch
FOR INSERT WITH CHECK (fms_has_access(auth.uid()));

-- FMS Dispatch Items
CREATE TABLE public.fms_dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.fms_dispatch(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.fms_production_batches(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fms_dispatch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view dispatch items" ON public.fms_dispatch_items
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS dispatch users can create dispatch items" ON public.fms_dispatch_items
FOR INSERT WITH CHECK (fms_has_access(auth.uid()));

-- FMS Audit Log (for traceability)
CREATE TABLE public.fms_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_address TEXT
);

ALTER TABLE public.fms_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS admins can view audit logs" ON public.fms_audit_log
FOR SELECT USING (fms_has_role(auth.uid(), 'system_admin'));

CREATE POLICY "All FMS users can create audit logs" ON public.fms_audit_log
FOR INSERT WITH CHECK (fms_has_access(auth.uid()));

-- FMS Settings (admin only)
CREATE TABLE public.fms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.fms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FMS users can view settings" ON public.fms_settings
FOR SELECT USING (fms_has_access(auth.uid()));

CREATE POLICY "FMS admins can manage settings" ON public.fms_settings
FOR ALL USING (fms_has_role(auth.uid(), 'system_admin'));

-- Auto-generate lot numbers sequence
CREATE SEQUENCE public.fms_lot_number_seq START 1;

-- Function to generate lot numbers
CREATE OR REPLACE FUNCTION public.fms_generate_lot_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'LOT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.fms_lot_number_seq')::TEXT, 5, '0')
$$;

-- Updated_at trigger function for FMS tables
CREATE OR REPLACE FUNCTION public.fms_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER fms_users_updated_at BEFORE UPDATE ON public.fms_users
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

CREATE TRIGGER fms_suppliers_updated_at BEFORE UPDATE ON public.fms_suppliers
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

CREATE TRIGGER fms_stock_codes_updated_at BEFORE UPDATE ON public.fms_stock_codes
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

CREATE TRIGGER fms_bom_updated_at BEFORE UPDATE ON public.fms_bom
FOR EACH ROW EXECUTE FUNCTION public.fms_update_updated_at();

-- Insert default settings
INSERT INTO public.fms_settings (setting_key, setting_value, description) VALUES
('company_name', '"Maharaja''s Spices"', 'Company name displayed in reports'),
('default_lot_prefix', '"LOT"', 'Prefix for auto-generated lot numbers'),
('default_batch_prefix', '"PB"', 'Prefix for auto-generated batch numbers'),
('retention_sample_days', '90', 'Number of days to keep retention samples'),
('allergen_declaration_required', 'true', 'Require allergen declaration on all materials');