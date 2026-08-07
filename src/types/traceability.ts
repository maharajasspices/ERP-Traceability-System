// Types for the Food Manufacturing Traceability System

// Enums
export type ItemType = 'raw_material' | 'packaging' | 'work_in_progress' | 'finished_good';
export type StorageCondition = 'ambient' | 'chilled' | 'frozen';
export type UnitOfMeasure = 'kg' | 'g' | 'litres' | 'ml' | 'units' | 'each';
export type StockStatus = 'active' | 'inactive';
export type BomStatus = 'active' | 'obsolete';
export type BatchStatus = 'draft' | 'in_progress' | 'pre_weighing' | 'manufacturing' | 'closed';
export type QualityCheckResult = 'pass' | 'fail' | 'pending';
export type UserRole = 'system_admin' | 'production_supervisor' | 'production_operator' | 'stores_operator' | 'dispatch_user';

// Allergen Types
export type AllergenType = 
  | 'celery' 
  | 'gluten' 
  | 'crustaceans' 
  | 'eggs' 
  | 'fish' 
  | 'lupin' 
  | 'milk' 
  | 'molluscs' 
  | 'mustard' 
  | 'nuts' 
  | 'peanuts' 
  | 'sesame' 
  | 'soybeans' 
  | 'sulphites';

// Supplier
export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

// Stock Code Master
export interface StockCode {
  id: string;
  stock_code: string;
  description: string;
  item_type: ItemType;
  unit_of_measure: UnitOfMeasure;
  storage_condition: StorageCondition;
  has_allergens: boolean;
  allergen_types: AllergenType[];
  approved_supplier_ids: string[];
  status: StockStatus;
  created_at: string;
  updated_at: string;
}

// Receiving Log
export interface ReceivingRecord {
  id: string;
  internal_lot_number: string;
  received_at: string;
  stock_code_id: string;
  stock_code?: StockCode;
  quantity_received: number;
  supplier_id: string;
  supplier?: Supplier;
  supplier_batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  delivery_note_number?: string;
  quality_checks: ReceivingQualityCheck;
  status: 'accepted' | 'rejected' | 'partial';
  rejection_reason?: string;
  received_by: string;
  created_at: string;
}

export interface ReceivingQualityCheck {
  vehicle_clean: QualityCheckResult;
  no_foreign_odours: QualityCheckResult;
  no_pest_activity: QualityCheckResult;
  packaging_intact: QualityCheckResult;
  correct_labelling: QualityCheckResult;
  organoleptic_ok: QualityCheckResult;
  coa_received: QualityCheckResult;
  notes?: string;
}

// Bill of Materials
export interface BillOfMaterials {
  id: string;
  finished_good_id: string;
  finished_good?: StockCode;
  version_number: number;
  effective_date: string;
  status: BomStatus;
  obsolete_reason?: string;
  components: BomComponent[];
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface BomComponent {
  id: string;
  bom_id: string;
  material_stock_code_id: string;
  material?: StockCode;
  quantity_per_batch: number;
  created_at: string;
}

// Production
export interface ProductionBatch {
  id: string;
  batch_number: string;
  finished_good_id: string;
  finished_good?: StockCode;
  bom_id: string;
  bom?: BillOfMaterials;
  planned_batch_size: number;
  actual_quantity_produced?: number;
  product_size?: number;
  status: BatchStatus;
  planned_production_date: string;
  production_start?: string;
  production_end?: string;
  production_instructions?: string;
  materials_used: MaterialUsage[];
  processing_steps: ProcessingStep[];
  quality_checks: InProcessQualityCheck[];
  pre_weigh_approved: boolean;
  pre_weigh_approved_by?: string;
  pre_weigh_approved_at?: string;
  final_quality_checks?: FinalQualityChecks;
  scrap_waste?: number;
  waste_notes?: string;
  retention_sample_taken: boolean;
  operator_id: string;
  supervisor_id?: string;
  created_at: string;
  closed_at?: string;
}

export interface MaterialUsage {
  id: string;
  batch_id: string;
  receiving_record_id: string;
  receiving_record?: ReceivingRecord;
  quantity_used: number;
  created_at: string;
}

export interface ProcessingStep {
  id: string;
  batch_id: string;
  step_order: number;
  step_name: string;
  description?: string;
  required_temperature?: number;
  required_time?: number;
  actual_temperature?: number;
  actual_time?: number;
  completed: boolean;
  completed_by?: string;
  completed_at?: string;
}

export interface InProcessQualityCheck {
  id: string;
  batch_id: string;
  check_name: string;
  description?: string;
  result: QualityCheckResult;
  corrective_action?: string;
  checked_by?: string;
  checked_at?: string;
}

export interface FinalQualityChecks {
  taste: QualityCheckResult;
  scent: QualityCheckResult;
  appearance: QualityCheckResult;
  packaging: QualityCheckResult;
  labelling: QualityCheckResult;
  batch_dates_correct: QualityCheckResult;
  notes?: string;
}

// Dispatch
export interface DispatchRecord {
  id: string;
  invoice_number: string;
  dispatch_date: string;
  customer_name: string;
  customer_id?: string;
  items: DispatchItem[];
  dispatched_by: string;
  created_at: string;
}

export interface DispatchItem {
  id: string;
  dispatch_id: string;
  batch_id: string;
  batch?: ProductionBatch;
  quantity: number;
  created_at: string;
}

// User
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// Audit Trail
export interface AuditLog {
  id: string;
  user_id: string;
  user?: User;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  timestamp: string;
  ip_address?: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalStockCodes: number;
  activeStockCodes: number;
  pendingReceiving: number;
  activeBatches: number;
  todayDispatches: number;
  lowStockAlerts: number;
}
