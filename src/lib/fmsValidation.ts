/**
 * FMS Input Validation Schemas using Zod
 * Server-side validation for all FMS data operations
 */

import { z } from 'zod';

// Common validation patterns
const safeTextPattern = /^[a-zA-Z0-9\s\-_.,()'"&@#!?/\\:;]+$/;
const codePattern = /^[A-Z0-9\s\-_]+$/i;
const phonePattern = /^[+]?[0-9\s\-()]+$/;

// Supplier validation schema
export const supplierSchema = z.object({
  code: z.string()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code must be less than 20 characters')
    .regex(codePattern, 'Code can only contain letters, numbers, spaces, hyphens, and underscores'),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name must be less than 200 characters')
    .trim(),
  contact_name: z.string()
    .max(100, 'Contact name must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string()
    .max(30, 'Phone must be less than 30 characters')
    .regex(phonePattern, 'Invalid phone number format')
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z.string()
    .max(500, 'Address must be less than 500 characters')
    .trim()
    .optional()
    .nullable(),
  is_approved: z.boolean().default(false),
});

// Stock code validation schema
export const stockCodeSchema = z.object({
  stock_code: z.string()
    .min(2, 'Stock code must be at least 2 characters')
    .max(50, 'Stock code must be less than 50 characters')
    .regex(codePattern, 'Stock code can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z.string()
    .min(3, 'Description must be at least 3 characters')
    .max(500, 'Description must be less than 500 characters')
    .trim(),
  item_type: z.enum(['raw_material', 'packaging', 'work_in_progress', 'finished_good'], {
    errorMap: () => ({ message: 'Invalid item type' }),
  }),
  unit_of_measure: z.enum(['kg', 'g', 'litres', 'ml', 'units', 'each'], {
    errorMap: () => ({ message: 'Invalid unit of measure' }),
  }),
  storage_condition: z.enum(['ambient', 'chilled', 'frozen'], {
    errorMap: () => ({ message: 'Invalid storage condition' }),
  }),
  has_allergens: z.boolean().default(false),
  allergen_types: z.array(z.string().max(50)).max(20).default([]),
  approved_supplier_ids: z.array(z.string().uuid('Invalid supplier ID')).default([]),
  status: z.enum(['active', 'inactive']).default('active'),
});

// Receiving record validation schema
export const receivingSchema = z.object({
  internal_lot_number: z.string()
    .min(5, 'Lot number must be at least 5 characters')
    .max(50, 'Lot number must be less than 50 characters'),
  stock_code_id: z.string().uuid('Invalid stock code'),
  quantity_received: z.number()
    .positive('Quantity must be greater than 0')
    .max(1000000, 'Quantity too large'),
  supplier_id: z.string().uuid('Invalid supplier'),
  supplier_batch_number: z.string()
    .min(1, 'Supplier batch number is required')
    .max(100, 'Batch number must be less than 100 characters'),
  manufacturing_date: z.string().optional().nullable(),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  delivery_note_number: z.string()
    .max(50, 'Delivery note must be less than 50 characters')
    .optional()
    .nullable(),
  quality_checks: z.record(z.any()).default({}),
  status: z.enum(['accepted', 'rejected', 'partial', 'pending']).default('pending'),
  rejection_reason: z.string()
    .max(500, 'Rejection reason must be less than 500 characters')
    .optional()
    .nullable(),
  received_by: z.string().uuid('Invalid user'),
  received_at: z.string().optional(),
  cost_price_per_kg: z.number().nonnegative('Cost price must be 0 or more').max(1000000).optional().nullable(),
});

// Processing step schema for BOM
const processingStepSchema = z.object({
  step_order: z.number().int().positive(),
  step_name: z.string().max(100),
  description: z.string().max(500).optional(),
});

// Organoleptic parameter schema for BOM
const organolepticParameterSchema = z.object({
  name: z.string().max(50),
  expected_value: z.string().max(200),
});

// BOM validation schema
export const bomSchema = z.object({
  finished_good_id: z.string().uuid('Invalid finished good'),
  version_number: z.number().int().positive().default(1),
  effective_date: z.string().min(1, 'Effective date is required'),
  status: z.enum(['active', 'obsolete']).default('active'),
  obsolete_reason: z.string()
    .max(500, 'Obsolete reason must be less than 500 characters')
    .optional()
    .nullable(),
  created_by: z.string().uuid('Invalid user'),
  processing_steps: z.array(processingStepSchema).default([]),
  organoleptic_parameters: z.array(organolepticParameterSchema).default([]),
});

// BOM Component validation schema
export const bomComponentSchema = z.object({
  material_stock_code_id: z.string().uuid('Invalid material'),
  quantity_per_batch: z.number()
    .positive('Quantity must be greater than 0')
    .max(100000, 'Quantity too large'),
});

// Production batch validation schema
export const productionBatchSchema = z.object({
  finished_good_id: z.string().uuid('Invalid finished good'),
  bom_id: z.string().uuid('Invalid BOM'),
  planned_batch_size: z.number()
    .positive('Batch size must be greater than 0')
    .max(1000000, 'Batch size too large'),
  actual_quantity_produced: z.number()
    .min(0)
    .max(1000000)
    .optional()
    .nullable(),
  product_size: z.number()
    .positive()
    .max(100000)
    .optional()
    .nullable(),
  status: z.enum(['draft', 'pre_weighing', 'manufacturing', 'in_progress', 'closed', 'cancelled']).default('draft'),
  planned_production_date: z.string().min(1, 'Production date is required'),
  production_start: z.string().optional().nullable(),
  production_end: z.string().optional().nullable(),
  production_instructions: z.string()
    .max(5000, 'Instructions must be less than 5000 characters')
    .optional()
    .nullable(),
  processing_steps: z.array(z.any()).default([]),
  quality_checks: z.array(z.any()).default([]),
  final_quality_checks: z.any().optional().nullable(),
  pre_weigh_approved: z.boolean().default(false),
  pre_weigh_approved_by: z.string().uuid().optional().nullable(),
  pre_weigh_approved_at: z.string().optional().nullable(),
  pre_weigh_materials: z.array(z.any()).default([]),
  scrap_waste: z.number().min(0).max(1000000).optional().nullable(),
  waste_notes: z.string().max(1000).optional().nullable(),
  retention_sample_taken: z.boolean().default(false),
  operator_id: z.string().uuid('Invalid operator'),
  supervisor_id: z.string().uuid().optional().nullable(),
  info_checker_name: z.string().max(100).optional().nullable(),
  steps_checker_name: z.string().max(100).optional().nullable(),
  quality_checker_name: z.string().max(100).optional().nullable(),
});

// Dispatch validation schema
export const dispatchSchema = z.object({
  invoice_number: z.string()
    .min(1, 'Invoice number is required')
    .max(50, 'Invoice number must be less than 50 characters'),
  dispatch_date: z.string().min(1, 'Dispatch date is required'),
  customer_name: z.string()
    .max(200, 'Customer name must be less than 200 characters')
    .trim()
    .transform(val => val || '')
    .optional()
    .default(''),
  customer_id: z.string().uuid().optional().nullable(),
  dispatched_by: z.string().uuid('Invalid user'),
});

// Dispatch item validation schema
export const dispatchItemSchema = z.object({
  batch_id: z.string().uuid('Invalid batch'),
  quantity: z.number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0')
    .max(1000000, 'Quantity too large'),
});

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase(),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters'),
});

export const signupSchema = loginSchema.extend({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
});

// Helper function to validate and return formatted errors
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; error?: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Return the first error message
  const firstError = result.error.issues[0];
  return { success: false, error: firstError.message };
}
