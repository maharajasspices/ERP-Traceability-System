import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFMSAuth } from '@/context/FMSAuthContext';
import { toast } from 'sonner';

// HR data types
export interface HREmployee {
  id: string;
  employee_number?: string;

  // Personal
  first_name: string;
  last_name: string;
  id_number?: string;
  date_of_birth?: string;

  // Contact
  email?: string;
  phone?: string;
  address?: string;

  // Employment
  department?: string;
  job_title?: string;
  system_role?: string;
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'intern';
  start_date?: string;
  supervisor?: string;

  // Status
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';

  // Contract
  contract_signed: boolean;
  contract_signed_date?: string;

  // Emergency contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;

  // Banking
  bank_name?: string;
  bank_account_number?: string;

  // Leaving employment
  termination_date?: string;
  termination_reason?: string;

  created_at: string;
  updated_at: string;
}

export interface HRAttendance {
  id: string;
  employee_id: string;
  attendance_date: string;
  time_in?: string;
  time_out?: string;
  hours_worked?: number;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'leave';
  notes?: string;
  created_at: string;
}

export interface HRLeave {
  id: string;
  employee_id: string;
  leave_type: 'annual' | 'sick' | 'family_responsibility' | 'study' | 'unpaid' | 'maternity' | 'paternity';
  start_date: string;
  end_date: string;
  days_requested: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HRDocument {
  id: string;
  employee_id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by: string;
  created_at: string;
}

export interface HRWarning {
  id: string;
  employee_id: string;
  warning_type: 'verbal' | 'written' | 'final' | 'other';
  reason: string;
  details?: string;
  issued_by: string;
  issued_at: string;
  signature: string;
  status: 'issued' | 'acknowledged' | 'disputed' | 'resolved';
  acknowledged_at?: string;
  created_at: string;
  updated_at: string;
}

// Module-level cache for HR data
interface HRDataCache {
  employees: HREmployee[] | null;
  attendance: HRAttendance[] | null;
  leaveRequests: HRLeave[] | null;
  documents: HRDocument[] | null;
  warnings: HRWarning[] | null;
  fetchedAt: number | null;
  userId: string | null;
}

const hrCache: HRDataCache = {
  employees: null,
  attendance: null,
  leaveRequests: null,
  documents: null,
  warnings: null,
  fetchedAt: null,
  userId: null,
};

const HR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// The HR tables were added in migrations but the generated types.ts
// hasn't been regenerated yet. Use this helper for HR table queries.
const hr = {
  employees: () => (supabase as any).from('fms_hr_employees'),
  attendance: () => (supabase as any).from('fms_hr_attendance'),
  leave: () => (supabase as any).from('fms_hr_leave'),
  documents: () => (supabase as any).from('fms_hr_documents'),
  warnings: () => (supabase as any).from('fms_hr_warnings'),
};

export function useHRData() {
  const { user } = useFMSAuth();
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [attendance, setAttendance] = useState<HRAttendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<HRLeave[]>([]);
  const [documents, setDocuments] = useState<HRDocument[]>([]);
  const [warnings, setWarnings] = useState<HRWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Check cache
    const cacheValid = hrCache.fetchedAt !== null &&
      hrCache.userId === user.id &&
      Date.now() - hrCache.fetchedAt < HR_CACHE_TTL &&
      !force;

    if (cacheValid && hrCache.employees && hrCache.attendance) {
      setEmployees(hrCache.employees);
      setAttendance(hrCache.attendance);
      if (hrCache.leaveRequests) setLeaveRequests(hrCache.leaveRequests);
      if (hrCache.documents) setDocuments(hrCache.documents);
      if (hrCache.warnings) setWarnings(hrCache.warnings);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Use allSettled so a failure in one table (e.g. warnings not yet
      // migrated) doesn't prevent employees and other data from loading.
      const [employeesRes, attendanceRes, leaveRes, documentsRes, warningsRes] = await Promise.allSettled([
        hr.employees().select('*').order('last_name'),
        hr.attendance().select('*').order('attendance_date', { ascending: false }).limit(500),
        hr.leave().select('*').order('created_at', { ascending: false }),
        hr.documents().select('*').order('created_at', { ascending: false }),
        hr.warnings().select('*').order('issued_at', { ascending: false }),
      ]);

      // Employees - critical, if this fails we show the error
      if (employeesRes.status === 'fulfilled') {
        if (employeesRes.value.error) throw employeesRes.value.error;
        const empData = (employeesRes.value.data || []) as HREmployee[];
        setEmployees(empData);
        hrCache.employees = empData;
      } else {
        throw employeesRes.reason;
      }

      // Attendance - non-critical
      if (attendanceRes.status === 'fulfilled' && !attendanceRes.value.error) {
        const attData = (attendanceRes.value.data || []) as HRAttendance[];
        setAttendance(attData);
        hrCache.attendance = attData;
      } else {
        console.error('Error fetching attendance:', attendanceRes.status === 'rejected' ? attendanceRes.reason : attendanceRes.value.error);
      }

      // Leave - non-critical
      if (leaveRes.status === 'fulfilled' && !leaveRes.value.error) {
        const leaveData = (leaveRes.value.data || []) as HRLeave[];
        setLeaveRequests(leaveData);
        hrCache.leaveRequests = leaveData;
      } else {
        console.error('Error fetching leave:', leaveRes.status === 'rejected' ? leaveRes.reason : leaveRes.value.error);
      }

      // Documents - non-critical
      if (documentsRes.status === 'fulfilled' && !documentsRes.value.error) {
        const docData = (documentsRes.value.data || []) as HRDocument[];
        setDocuments(docData);
        hrCache.documents = docData;
      } else {
        console.error('Error fetching documents:', documentsRes.status === 'rejected' ? documentsRes.reason : documentsRes.value.error);
      }

      // Warnings - non-critical
      if (warningsRes.status === 'fulfilled' && !warningsRes.value.error) {
        const warnData = (warningsRes.value.data || []) as HRWarning[];
        setWarnings(warnData);
        hrCache.warnings = warnData;
      } else {
        console.error('Error fetching warnings:', warningsRes.status === 'rejected' ? warningsRes.reason : warningsRes.value.error);
      }

      hrCache.fetchedAt = Date.now();
      hrCache.userId = user.id;
    } catch (error) {
      console.error('Error fetching HR data:', error);
      if (user) toast.error('Failed to load HR data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Employee operations
  const addEmployee = async (
    employee: Omit<
      HREmployee,
      'id' | 'employee_number' | 'created_at' | 'updated_at'
    >
  ) => {
    // Get the latest employee number
    const { data: existingEmployees, error: fetchError } = await hr.employees()
      .select('employee_number')
      .order('employee_number', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Employee number error:', fetchError);
      toast.error('Could not generate employee number.');
      return null;
    }

    // Start at EMP-0001 if there are no employees yet
    let nextNumber = 1;

    if (existingEmployees && existingEmployees.length > 0) {
      const lastEmployeeNumber = existingEmployees[0].employee_number;

      if (lastEmployeeNumber) {
        const numberPart = parseInt(
          lastEmployeeNumber.replace('EMP-', ''),
          10
        );

        if (!isNaN(numberPart)) {
          nextNumber = numberPart + 1;
        }
      }
    }

    // Generate the new employee number
    const employeeNumber = `EMP-${String(nextNumber).padStart(4, '0')}`;

    // Add generated employee number to the employee record
    const employeeToInsert = {
      ...employee,
      employee_number: employeeNumber,
    };

    const { data, error } = await hr.employees()
      .insert(employeeToInsert)
      .select()
      .single();

    if (error) {
      console.error('Add employee error:', error);
      toast.error(error.message);
      return null;
    }

    setEmployees(prev => [data as HREmployee, ...prev]);

    // Invalidate cache
    hrCache.fetchedAt = null;

    toast.success(`Employee ${employeeNumber} added successfully`);

    return data as HREmployee;
  };

  const updateEmployee = async (id: string, updates: Partial<HREmployee>) => {
    const { data, error } = await hr.employees()
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update employee error:', error);
      toast.error(error.message);
      return null;
    }

    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } as HREmployee : e));
    hrCache.fetchedAt = null;
    toast.success('Employee updated successfully');
    return data as HREmployee;
  };

  const deleteEmployee = async (id: string) => {
    const { error } = await hr.employees()
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete employee error:', error);
      toast.error(error.message);
      return false;
    }

    setEmployees(prev => prev.filter(e => e.id !== id));
    hrCache.fetchedAt = null;
    toast.success('Employee deleted');
    return true;
  };

  // Document operatios
  const uploadDocument = async (
    employeeId: string,
    file: File,
    documentType: string
  ) => {
    if (!user) {
      toast.error('You must be signed in to upload documents.');
      return null;
    }

    if (!file) {
      toast.error('Please select a file to upload.');
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 10MB.');
      return null;
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${employeeId}/${Date.now()}_${safeFileName}`;

    setUploadingDocument(true);
    try {
      // 1) Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('hr-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Document upload error:', uploadError);
        toast.error(uploadError.message || 'Failed to upload file.');
        return null;
      }

      // 2) Insert document record in the database
      const documentRecord = {
        employee_id: employeeId,
        document_name: file.name,
        document_type: documentType,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      };

      const { data, error } = await hr.documents()
        .insert(documentRecord)
        .select()
        .single();

      if (error) {
        console.error('Document record insert error:', error);
        // Roll back storage upload
        await supabase.storage.from('hr-documents').remove([filePath]);
        toast.error(error.message);
        return null;
      }

      setDocuments(prev => [data as HRDocument, ...prev]);
      toast.success('Document uploaded successfully');

      // Invalidate cache so documents list refreshes
      hrCache.fetchedAt = null;

      return data as HRDocument;
    } catch (err) {
      console.error('Upload document error:', err);
      toast.error('Failed to upload document.');
      return null;
    } finally {
      setUploadingDocument(false);
    }
  };

  const deleteDocument = async (document: HRDocument) => {
    if (!user) {
      toast.error('You must be signed in to delete documents.');
      return false;
    }

    try {
      // 1) Remove file from storage if file_path exists
      if (document.file_path) {
        const { error: storageError } = await supabase.storage
          .from('hr-documents')
          .remove([document.file_path]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
          toast.error(storageError.message || 'Failed to delete file from storage.');
          return false;
        }
      }

      // 2) Delete document record from database
      const { error } = await hr.documents()
        .delete()
        .eq('id', document.id);

      if (error) {
        console.error('Delete document error:', error);
        toast.error(error.message);
        return false;
      }

      setDocuments(prev => prev.filter(d => d.id !== document.id));
      toast.success('Document deleted successfully');

      // Invalidate cache
      hrCache.fetchedAt = null;

      return true;
    } catch (err) {
      console.error('Delete document error:', err);
      toast.error('Failed to delete document.');
      return false;
    }
  };

  // Warning operations
  const issueWarning = async (
    employeeId: string,
    warningType: HRWarning['warning_type'],
    reason: string,
    details?: string,
    signature?: string,
    sendEmail = false,
    sendWhatsApp = false
  ) => {
    if (!user) {
      toast.error('You must be signed in to issue warnings.');
      return null;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the warning.');
      return null;
    }

    // Use employee number as signature if not provided
    const employee = employees.find(e => e.id === employeeId);
    const signatureValue = signature || employee?.employee_number || 'HR';

    try {
      // Insert warning record directly
      const { data, error } = await hr.warnings()
        .insert({
          employee_id: employeeId,
          warning_type: warningType,
          reason: reason.trim(),
          details: details?.trim() || null,
          issued_by: user.id,
          signature: signatureValue,
        })
        .select()
        .single();

      if (error) {
        console.error('Issue warning error:', error);
        toast.error(error.message);
        return null;
      }

      setWarnings(prev => [data as HRWarning, ...prev]);
      hrCache.fetchedAt = null;

      // Send email/WhatsApp notification via edge function
      if (sendEmail || sendWhatsApp) {
        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke('fms-hr-warning', {
            body: {
              operation: 'send_warning',
              employee_id: employeeId,
              warning_type: warningType,
              reason: reason.trim(),
              details: details?.trim() || null,
              signature: signatureValue,
              send_email: sendEmail,
              send_whatsapp: sendWhatsApp,
            },
          });

          if (fnError) {
            console.error('Warning notification error:', fnError);
            toast.warning('Warning issued, but notification could not be sent.');
          } else if (fnData?.email && !fnData.email.sent) {
            toast.warning(`Warning issued. Email not sent: ${fnData.email.reason || 'unknown'}`);
          } else if (fnData?.whatsapp && !fnData.whatsapp.sent) {
            toast.warning(`Warning issued. WhatsApp not sent: ${fnData.whatsapp.reason || 'unknown'}`);
          } else {
            toast.success('Warning issued and notification sent');
          }
        } catch (fnErr) {
          console.error('Edge function error:', fnErr);
          toast.warning('Warning issued, but notification could not be sent.');
        }
      } else {
        toast.success('Warning issued successfully');
      }

      return data as HRWarning;
    } catch (err) {
      console.error('Issue warning error:', err);
      toast.error('Failed to issue warning.');
      return null;
    }
  };

  const deleteWarning = async (id: string) => {
    const { error } = await hr.warnings()
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete warning error:', error);
      toast.error(error.message);
      return false;
    }

    setWarnings(prev => prev.filter(w => w.id !== id));
    hrCache.fetchedAt = null;
    toast.success('Warning deleted');
    return true;
  };

  // Attendance operations
  const addAttendance = async (record: Omit<HRAttendance, 'id' | 'created_at'>) => {
    const { data, error } = await hr.attendance()
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Add attendance error:', error);
      toast.error(error.message);
      return null;
    }

    setAttendance(prev => [data as HRAttendance, ...prev]);
    toast.success('Attendance recorded');
    return data as HRAttendance;
  };

  const updateAttendance = async (id: string, updates: Partial<HRAttendance>) => {
    const { data, error } = await hr.attendance()
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update attendance error:', error);
      toast.error(error.message);
      return null;
    }

    setAttendance(prev => prev.map(a => a.id === id ? { ...a, ...data } as HRAttendance : a));
    toast.success('Attendance updated');
    return data as HRAttendance;
  };

  // Leave operations
  const addLeaveRequest = async (leave: Omit<HRLeave, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await hr.leave()
      .insert(leave)
      .select()
      .single();

    if (error) {
      console.error('Add leave request error:', error);
      toast.error(error.message);
      return null;
    }

    setLeaveRequests(prev => [data as HRLeave, ...prev]);
    toast.success('Leave request created');
    return data as HRLeave;
  };

  const updateLeaveStatus = async (id: string, status: HRLeave['status'], review_notes?: string) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data, error } = await hr.leave()
      .update({
        status,
        reviewed_by: currentUser?.id,
        reviewed_at: new Date().toISOString(),
        review_notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update leave status error:', error);
      toast.error(error.message);
      return null;
    }

    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, ...data } as HRLeave : l));
    toast.success(`Leave ${status}`);
    return data as HRLeave;
  };

  return {
    // Data
    employees,
    attendance,
    leaveRequests,
    documents,
    warnings,
    loading,
    uploadingDocument,

    // Refresh
    refreshData: () => fetchData(true),

    // Operations
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addAttendance,
    updateAttendance,
    addLeaveRequest,
    updateLeaveStatus,
    uploadDocument,
    deleteDocument,
    issueWarning,
    deleteWarning,
  };
}