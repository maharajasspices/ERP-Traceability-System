import React, { useMemo, useState, useRef } from 'react';
import { useHRData, HREmployee, HRWarning } from '@/hooks/useHRData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import {
  Users,
  UserCheck,
  UserX,
  Search,
  Plus,
  X,
  FileCheck,
  FileX,
  CalendarDays,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Edit,
  UserCog,
  Trash2,
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  Send,
  PenLine,
} from 'lucide-react';

const Employees: React.FC = () => {
  const {
    employees,
    attendance,
    documents,
    warnings,
    loading,
    uploadingDocument,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    uploadDocument,
    deleteDocument,
    issueWarning,
    deleteWarning,
    sendEmployeeEmail,
    sendContractForSignature,
    contractSignatures,
  } = useHRData();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [selectedEmployee, setSelectedEmployee] =
    useState<HREmployee | null>(null);

  // Send Email state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('contract');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contract signature state
  const [sendingContractSignature, setSendingContractSignature] = useState(false);

  // Warning state
  const [showWarningForm, setShowWarningForm] = useState(false);
  const [warningType, setWarningType] = useState<HRWarning['warning_type']>('verbal');
  const [warningReason, setWarningReason] = useState('');
  const [warningDetails, setWarningDetails] = useState('');
  const [warningSignature, setWarningSignature] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [issuingWarning, setIssuingWarning] = useState(false);

  const [employeeForm, setEmployeeForm] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    id_number: '',
    date_of_birth: '',
    email: '',
    phone: '',
    address: '',
    department: '',
    job_title: '',
    system_role: 'employee',

    employment_type:
      'full_time' as
        | 'full_time'
        | 'part_time'
        | 'contract'
        | 'temporary'
        | 'intern',

    start_date: '',
    supervisor: '',

    status:
      'active' as
        | 'active'
        | 'inactive'
        | 'on_leave'
        | 'terminated',

    contract_signed: false,
    contract_signed_date: '',

    emergency_contact_name: '',
    emergency_contact_phone: '',

    bank_name: '',
    bank_account_number: '',
  });

  // ------------------------------------------------------------
  // Statistics
  // ------------------------------------------------------------

  const activeEmployees = employees.filter(
    employee => employee.status === 'active'
  ).length;

  const inactiveEmployees = employees.filter(
    employee => employee.status === 'inactive'
  ).length;

  const onLeaveEmployees = employees.filter(
    employee => employee.status === 'on_leave'
  ).length;

  // ------------------------------------------------------------
  // Departments
  // ------------------------------------------------------------

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map(employee => employee.department)
          .filter(Boolean)
      )
    ) as string[];
  }, [employees]);

  // ------------------------------------------------------------
  // Search + filters
  // ------------------------------------------------------------

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const fullName =
        `${employee.first_name} ${employee.last_name}`.toLowerCase();

      const searchValue = search.toLowerCase();

      const searchMatch =
        fullName.includes(searchValue) ||
        employee.employee_number
          ?.toLowerCase()
          .includes(searchValue) ||
        employee.id_number
          ?.toLowerCase()
          .includes(searchValue);

      const statusMatch =
        statusFilter === 'all' ||
        employee.status === statusFilter;

      const departmentMatch =
        departmentFilter === 'all' ||
        employee.department === departmentFilter;

      return searchMatch && statusMatch && departmentMatch;
    });
  }, [
    employees,
    search,
    statusFilter,
    departmentFilter,
  ]);

  // ------------------------------------------------------------
  // Attendance statistics
  // ------------------------------------------------------------

  const getAttendanceStats = (employeeId: string) => {
    const employeeAttendance = attendance.filter(
      record => record.employee_id === employeeId
    );

    const daysWorked = employeeAttendance.filter(
      record =>
        record.status === 'present' ||
        record.status === 'late' ||
        record.status === 'half_day'
    ).length;

    const daysAbsent = employeeAttendance.filter(
      record => record.status === 'absent'
    ).length;

    const hoursWorked = employeeAttendance.reduce(
      (total, record) =>
        total + (record.hours_worked || 0),
      0
    );

    return {
      daysWorked,
      daysAbsent,
      hoursWorked,
    };
  };

  // ------------------------------------------------------------
  // Status helpers
  // ------------------------------------------------------------

  const getStatusLabel = (
    status: HREmployee['status']
  ) => {
    switch (status) {
      case 'active':
        return 'Active';

      case 'inactive':
        return 'Inactive';

      case 'on_leave':
        return 'On Leave';

      case 'terminated':
        return 'Terminated';

      default:
        return status;
    }
  };

  const getStatusClass = (
    status: HREmployee['status']
  ) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';

      case 'inactive':
        return 'bg-gray-100 text-gray-600';

      case 'on_leave':
        return 'bg-yellow-100 text-yellow-700';

      case 'terminated':
        return 'bg-red-100 text-red-700';

      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  // ------------------------------------------------------------
  // Reset employee form
  // ------------------------------------------------------------

  const resetEmployeeForm = () => {
    setEmployeeForm({
      employee_number: '',
      first_name: '',
      last_name: '',
      id_number: '',
      date_of_birth: '',
      email: '',
      phone: '',
      address: '',
      department: '',
      job_title: '',
      system_role: 'employee',
      employment_type: 'full_time',
      start_date: '',
      supervisor: '',
      status: 'active',
      contract_signed: false,
      contract_signed_date: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      bank_name: '',
      bank_account_number: '',
    });
  };

  // ------------------------------------------------------------
  // Populate form for editing an employee
  // ------------------------------------------------------------

  const populateEditForm = (employee: HREmployee) => {
    setEmployeeForm({
      employee_number: employee.employee_number || '',
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      id_number: employee.id_number || '',
      date_of_birth: employee.date_of_birth || '',
      email: employee.email || '',
      phone: employee.phone || '',
      address: employee.address || '',
      department: employee.department || '',
      job_title: employee.job_title || '',
      system_role: employee.system_role || 'employee',
      employment_type: employee.employment_type || 'full_time',
      start_date: employee.start_date || '',
      supervisor: employee.supervisor || '',
      status: employee.status,
      contract_signed: employee.contract_signed || false,
      contract_signed_date: employee.contract_signed_date || '',
      emergency_contact_name: employee.emergency_contact_name || '',
      emergency_contact_phone: employee.emergency_contact_phone || '',
      bank_name: employee.bank_name || '',
      bank_account_number: employee.bank_account_number || '',
    });
  };

  // ------------------------------------------------------------
  // Handle edit employee
  // ------------------------------------------------------------

  const handleEditEmployee = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!selectedEmployee) return;

    if (
      !employeeForm.first_name.trim() ||
      !employeeForm.last_name.trim()
    ) {
      toast.error('First name and last name are required.');
      return;
    }

    setSavingEmployee(true);

    try {
      const result = await updateEmployee(selectedEmployee.id, {
        first_name: employeeForm.first_name.trim(),
        last_name: employeeForm.last_name.trim(),
        id_number: employeeForm.id_number || undefined,
        date_of_birth: employeeForm.date_of_birth || undefined,
        email: employeeForm.email || undefined,
        phone: employeeForm.phone || undefined,
        address: employeeForm.address || undefined,
        department: employeeForm.department || undefined,
        job_title: employeeForm.job_title || undefined,
        system_role: employeeForm.system_role || undefined,
        employment_type: employeeForm.employment_type,
        start_date: employeeForm.start_date || undefined,
        supervisor: employeeForm.supervisor || undefined,
        status: employeeForm.status,
        contract_signed: employeeForm.contract_signed,
        contract_signed_date:
          employeeForm.contract_signed &&
          employeeForm.contract_signed_date
            ? employeeForm.contract_signed_date
            : undefined,
        emergency_contact_name:
          employeeForm.emergency_contact_name || undefined,
        emergency_contact_phone:
          employeeForm.emergency_contact_phone || undefined,
        bank_name: employeeForm.bank_name || undefined,
        bank_account_number:
          employeeForm.bank_account_number || undefined,
      });

      if (result) {
        // Update the selected employee with the returned data
        setSelectedEmployee({
          ...selectedEmployee,
          ...result,
        });
        setShowEditEmployee(false);
        resetEmployeeForm();
        toast.success('Employee updated successfully');
      }
    } finally {
      setSavingEmployee(false);
    }
  };

  // ------------------------------------------------------------
  // Handle delete employee
  // ------------------------------------------------------------

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    setDeletingEmployee(true);

    try {
      const success = await deleteEmployee(selectedEmployee.id);

      if (success) {
        setSelectedEmployee(null);
        setConfirmDelete(false);
      }
    } finally {
      setDeletingEmployee(false);
    }
  };

  // ------------------------------------------------------------
  // Handle document upload
  // ------------------------------------------------------------

  const handleDocumentUpload = async () => {
    if (!selectedEmployee) return;
    if (!uploadFile) {
      toast.error('Please select a file to upload.');
      return;
    }

    const result = await uploadDocument(
      selectedEmployee.id,
      uploadFile,
      documentType
    );

    if (result) {
      setUploadFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setDocumentType('contract');
    }
  };

  const getEmployeeDocuments = (employeeId: string) => {
    return documents.filter(doc => doc.employee_id === employeeId);
  };

  const getEmployeeWarnings = (employeeId: string) => {
    return warnings.filter(w => w.employee_id === employeeId);
  };

  const handleIssueWarning = async () => {
    if (!selectedEmployee) return;

    if (!warningReason.trim()) {
      toast.error('Please provide a reason for the warning.');
      return;
    }

    setIssuingWarning(true);

    try {
      const result = await issueWarning(
        selectedEmployee.id,
        warningType,
        warningReason,
        warningDetails || undefined,
        warningSignature || selectedEmployee.employee_number || undefined,
        sendEmail,
        sendWhatsApp
      );

      if (result) {
        setShowWarningForm(false);
        setWarningType('verbal');
        setWarningReason('');
        setWarningDetails('');
        setWarningSignature('');
        setSendEmail(false);
        setSendWhatsApp(false);
      }
    } finally {
      setIssuingWarning(false);
    }
  };

  const openEmailModal = () => {
    setEmailSubject('');
    setEmailMessage('');
    setShowEmailForm(true);
  };

  const handleSendEmployeeEmail = async () => {
    if (!selectedEmployee) return;

    if (!emailSubject.trim()) {
      toast.error('Please provide a subject for the email.');
      return;
    }
    if (!emailMessage.trim()) {
      toast.error('Please write a message before sending.');
      return;
    }

    setSendingEmail(true);

    try {
      const success = await sendEmployeeEmail(
        selectedEmployee.id,
        emailSubject,
        emailMessage
      );

      if (success) {
        setShowEmailForm(false);
        setEmailSubject('');
        setEmailMessage('');
      }
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadDocument = async (doc: {
    file_path: string;
    document_name: string;
  }) => {
    const { data, error } = await supabase.storage
      .from('hr-documents')
      .createSignedUrl(doc.file_path, 60);

    if (error || !data?.signedUrl) {
      toast.error('Could not generate download link.');
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  // The employee's latest contract document (if any) and its signing status.
  const getEmployeeContract = () => {
    if (!selectedEmployee) return undefined;
    const contracts = getEmployeeDocuments(selectedEmployee.id)
      .filter(doc => doc.document_type === 'contract' && doc.file_path);
    return contracts[0];
  };

  const getContractSignature = (documentId?: string) => {
    if (!documentId) return undefined;
    return contractSignatures
      .filter(s => s.document_id === documentId)
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
  };

  // Send the selected employee's contract for electronic signature.
  const handleSendContractForSignature = async () => {
    if (!selectedEmployee) return;
    const contract = getEmployeeContract();
    if (!contract) {
      toast.error('No contract document is attached to this employee yet. Upload one in the Documents section first.');
      return;
    }
    if (!selectedEmployee.email) {
      toast.error('This employee has no email address on file.');
      return;
    }
    setSendingContractSignature(true);
    try {
      await sendContractForSignature(selectedEmployee.id, contract.id);
    } finally {
      setSendingContractSignature(false);
    }
  };

  // ------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading employees...
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // PAGE
  // ------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Employees
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage employee information, employment details and attendance.
          </p>
        </div>

        <button
          onClick={() => {
            resetEmployeeForm();
            setShowAddEmployee(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#ef302b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d92824]"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>

      </div>

      {/* ======================================================
          STATISTICS
      ====================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Total */}

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Total Employees
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {employees.length}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>

          </div>
        </div>

        {/* Active */}

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Active
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {activeEmployees}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-3">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>

          </div>
        </div>

        {/* Inactive */}

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Inactive
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {inactiveEmployees}
              </p>
            </div>

            <div className="rounded-xl bg-gray-100 p-3">
              <UserX className="h-6 w-6 text-gray-500" />
            </div>

          </div>
        </div>

        {/* Leave */}

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                On Leave
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {onLeaveEmployees}
              </p>
            </div>

            <div className="rounded-xl bg-yellow-50 p-3">
              <CalendarDays className="h-6 w-6 text-yellow-600" />
            </div>

          </div>
        </div>

      </div>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">

        <div className="flex flex-col gap-3 lg:flex-row">

          {/* Search */}

          <div className="relative flex-1">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Search by name, employee number or ID number..."
              value={search}
              onChange={event =>
                setSearch(event.target.value)
              }
              className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
            />

          </div>

          {/* Status */}

          <select
            value={statusFilter}
            onChange={event =>
              setStatusFilter(event.target.value)
            }
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
          >
            <option value="all">
              All Statuses
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>

            <option value="on_leave">
              On Leave
            </option>

            <option value="terminated">
              Terminated
            </option>
          </select>

          {/* Department */}

          <select
            value={departmentFilter}
            onChange={event =>
              setDepartmentFilter(event.target.value)
            }
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
          >
            <option value="all">
              All Departments
            </option>

            {departments.map(department => (
              <option
                key={department}
                value={department}
              >
                {department}
              </option>
            ))}
          </select>

        </div>

      </div>

      {/* ======================================================
          EMPLOYEE TABLE
      ====================================================== */}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px] text-left">

            <thead className="border-b bg-gray-50">

              <tr>

                <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                  Employee
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                  Employee No.
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                  Department
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                  Position
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                  Contract
                </th>

                <th className="px-6 py-4 text-xs font-semibold uppercase text-gray-500">
                  Status
                </th>

              </tr>

            </thead>

            <tbody className="divide-y">

              {filteredEmployees.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No employees found.
                  </td>

                </tr>

              ) : (

                filteredEmployees.map(employee => (

                  <tr
                    key={employee.id}
                    onClick={() =>
                      setSelectedEmployee(employee)
                    }
                    className="cursor-pointer transition hover:bg-gray-50"
                  >

                    <td className="px-6 py-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 font-semibold text-[#ef302b]">
                          {employee.first_name.charAt(0)}
                          {employee.last_name.charAt(0)}
                        </div>

                        <div>

                          <p className="font-semibold text-gray-900">
                            {employee.first_name}{' '}
                            {employee.last_name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {employee.email || 'No email'}
                          </p>

                        </div>

                      </div>

                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.employee_number || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.department || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {employee.job_title || '—'}
                    </td>

                    <td className="px-6 py-4">

                      {employee.contract_signed ? (

                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">

                          <FileCheck className="h-3.5 w-3.5" />

                          Signed

                        </span>

                      ) : (

                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">

                          <FileX className="h-3.5 w-3.5" />

                          Not Signed

                        </span>

                      )}

                    </td>

                    <td className="px-6 py-4">

                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                          employee.status
                        )}`}
                      >
                        {getStatusLabel(employee.status)}
                      </span>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ======================================================
          ADD EMPLOYEE MODAL
      ====================================================== */}

      {showAddEmployee && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() =>
            setShowAddEmployee(false)
          }
        >

          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={event =>
              event.stopPropagation()
            }
          >

            {/* Modal Header */}

            <div className="flex items-start justify-between border-b p-6">

              <div>

                <h2 className="text-xl font-bold text-gray-900">
                  Add Employee
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Add a new employee to the HR system.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddEmployee(false)
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            {/* Form */}

            <form
              onSubmit={async (e) => {
                e.preventDefault();

                if (
                  !employeeForm.first_name.trim() ||
                  !employeeForm.last_name.trim()
                ) {
                  return;
                }

                setSavingEmployee(true);

                try {
                  const result = await addEmployee({
                    first_name: employeeForm.first_name.trim(),
                    last_name: employeeForm.last_name.trim(),
                    id_number: employeeForm.id_number || undefined,
                    date_of_birth: employeeForm.date_of_birth || undefined,
                    email: employeeForm.email || undefined,
                    phone: employeeForm.phone || undefined,
                    address: employeeForm.address || undefined,
                    department: employeeForm.department || undefined,
                    job_title: employeeForm.job_title || undefined,
                    system_role: employeeForm.system_role || undefined,
                    employment_type: employeeForm.employment_type,
                    start_date: employeeForm.start_date || undefined,
                    supervisor: employeeForm.supervisor || undefined,
                    status: employeeForm.status,
                    contract_signed: employeeForm.contract_signed,
                    contract_signed_date:
                      employeeForm.contract_signed &&
                      employeeForm.contract_signed_date
                        ? employeeForm.contract_signed_date
                        : undefined,
                    emergency_contact_name:
                      employeeForm.emergency_contact_name || undefined,
                    emergency_contact_phone:
                      employeeForm.emergency_contact_phone || undefined,
                    bank_name: employeeForm.bank_name || undefined,
                    bank_account_number:
                      employeeForm.bank_account_number || undefined,
                  });

                  if (result) {
                    resetEmployeeForm();
                    setShowAddEmployee(false);
                  }
                } finally {
                  setSavingEmployee(false);
                }
              }}
              className="space-y-7 p-6"
            >

              {/* ==================================================
                  PERSONAL INFORMATION
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Personal Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      First Name *
                    </label>

                    <input
                      required
                      value={employeeForm.first_name}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          first_name:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Last Name *
                    </label>

                    <input
                      required
                      value={employeeForm.last_name}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          last_name:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      ID Number
                    </label>

                    <input
                      value={employeeForm.id_number}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          id_number:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Date of Birth
                    </label>

                    <input
                      type="date"
                      value={employeeForm.date_of_birth}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          date_of_birth:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                </div>

              </section>

              {/* ==================================================
                  CONTACT
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Contact Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Email
                    </label>

                    <input
                      type="email"
                      value={employeeForm.email}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          email:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Phone
                    </label>

                    <input
                      value={employeeForm.phone}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          phone:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div className="sm:col-span-2">

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Address
                    </label>

                    <textarea
                      rows={2}
                      value={employeeForm.address}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          address:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                </div>

              </section>

              {/* ==================================================
                  EMPLOYMENT
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Employment Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Department
                    </label>

                    <select
                      value={employeeForm.department}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          department:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                    >

                      <option value="">
                        Select department
                      </option>

                      <option value="HR">
                        HR
                      </option>

                      <option value="Production">
                        Production
                      </option>

                      <option value="Warehouse">
                        Warehouse
                      </option>

                      <option value="Quality Control">
                        Quality Control
                      </option>

                      <option value="Sales">
                        Sales
                      </option>

                      <option value="Finance">
                        Finance
                      </option>

                      <option value="Administration">
                        Administration
                      </option>

                      <option value="IT">
                        IT
                      </option>

                    </select>

                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Job Title
                    </label>

                    <input
                      value={employeeForm.job_title}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          job_title:
                            event.target.value,
                        })
                      }
                      placeholder="Production Worker"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      System Role
                    </label>

                    <select
                      value={employeeForm.system_role}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          system_role:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                    >

                      <option value="employee">
                        Employee
                      </option>

                      <option value="supervisor">
                        Supervisor
                      </option>

                      <option value="manager">
                        Manager
                      </option>

                      <option value="hr_user">
                        HR User
                      </option>

                      <option value="admin">
                        Admin
                      </option>

                    </select>

                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Employment Type
                    </label>

                    <select
                      value={
                        employeeForm.employment_type
                      }
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          employment_type:
                            event.target.value as
                              | 'full_time'
                              | 'part_time'
                              | 'contract'
                              | 'temporary'
                              | 'intern',
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                    >

                      <option value="full_time">
                        Full Time
                      </option>

                      <option value="part_time">
                        Part Time
                      </option>

                      <option value="contract">
                        Contract
                      </option>

                      <option value="temporary">
                        Temporary
                      </option>

                      <option value="intern">
                        Intern
                      </option>

                    </select>

                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Start Date
                    </label>

                    <input
                      type="date"
                      value={employeeForm.start_date}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          start_date:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Supervisor
                    </label>

                    <input
                      value={employeeForm.supervisor}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          supervisor:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Employment Status
                    </label>

                    <select
                      value={employeeForm.status}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          status:
                            event.target.value as
                              | 'active'
                              | 'inactive'
                              | 'on_leave'
                              | 'terminated',
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                    >

                      <option value="active">
                        Active
                      </option>

                      <option value="inactive">
                        Inactive
                      </option>

                      <option value="on_leave">
                        On Leave
                      </option>

                      <option value="terminated">
                        Terminated
                      </option>

                    </select>
                  </div>

                </div>

              </section>

              {/* ==================================================
                  EMERGENCY CONTACT
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Emergency Contact
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Contact Name
                    </label>

                    <input
                      value={
                        employeeForm.emergency_contact_name
                      }
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          emergency_contact_name:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                  <div>

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Contact Phone
                    </label>

                    <input
                      value={
                        employeeForm.emergency_contact_phone
                      }
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          emergency_contact_phone:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                </div>

              </section>

              {/* ==================================================
                  BANKING
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Banking Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Bank Name
                    </label>

                    <input
                      value={employeeForm.bank_name}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          bank_name:
                            event.target.value,
                        })
                      }
                      placeholder="Optional"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                  <div>

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Bank Account Number
                    </label>

                    <input
                      value={
                        employeeForm.bank_account_number
                      }
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          bank_account_number:
                            event.target.value,
                        })
                      }
                      placeholder="Optional"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                </div>

              </section>

              {/* ==================================================
                  CONTRACT
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Employment Contract
                </h3>

                <div className="rounded-xl border p-4">

                  <label className="flex cursor-pointer items-center gap-3">

                    <input
                      type="checkbox"
                      checked={
                        employeeForm.contract_signed
                      }
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          contract_signed:
                            event.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[#ef302b]"
                    />

                    <span className="text-sm font-medium text-gray-700">
                      Contract has been signed
                    </span>

                  </label>

                  {employeeForm.contract_signed && (

                    <div className="mt-4">

                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Contract Signed Date
                      </label>

                      <input
                        type="date"
                        value={
                          employeeForm.contract_signed_date
                        }
                        onChange={event =>
                          setEmployeeForm({
                            ...employeeForm,
                            contract_signed_date:
                              event.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                      />

                    </div>

                  )}

                </div>

              </section>

              {/* ==================================================
                  FORM BUTTONS
              ================================================== */}

              <div className="flex justify-end gap-3 border-t pt-5">

                <button
                  type="button"
                  onClick={() =>
                    setShowAddEmployee(false)
                  }
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEmployee}
                  className="rounded-xl bg-[#ef302b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d92824] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEmployee
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : 'Add Employee'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ======================================================
          EMPLOYEE PROFILE MODAL
      ====================================================== */}

      {selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setSelectedEmployee(null);
            setConfirmDelete(false);
          }}
        >

          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={event =>
              event.stopPropagation()
            }
          >

            {/* Header */}

            <div className="flex items-start justify-between border-b p-6">

              <div>

                <div className="flex items-center gap-4">

                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-[#ef302b]">

                    {selectedEmployee.first_name.charAt(0)}
                    {selectedEmployee.last_name.charAt(0)}

                  </div>

                  <div>

                    <h2 className="text-xl font-bold text-gray-900">

                      {selectedEmployee.first_name}{' '}
                      {selectedEmployee.last_name}

                    </h2>

                    <p className="text-sm text-gray-500">
                      {selectedEmployee.employee_number ||
                        'No employee number'}
                    </p>

                  </div>

                </div>

              </div>

              <button
                onClick={() => {
                  setSelectedEmployee(null);
                  setConfirmDelete(false);
                }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <div className="space-y-6 p-6">

              {/* Status & Actions */}

              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">

                <div>

                  <p className="text-xs uppercase text-gray-500">
                    Employment Status
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                      selectedEmployee.status
                    )}`}
                  >
                    {getStatusLabel(
                      selectedEmployee.status
                    )}
                  </span>

                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openEmailModal}
                    disabled={!selectedEmployee.email}
                    title={selectedEmployee.email
                      ? `Send email to ${selectedEmployee.email}`
                      : 'No email address on file for this employee'}
                    className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                    Send Email
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      populateEditForm(selectedEmployee);
                      setShowEditEmployee(true);
                    }}
                    className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Employee
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>

              </div>

              {/* Delete confirmation */}

              {confirmDelete && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <h4 className="text-sm font-semibold text-red-700">
                    Delete this employee?
                  </h4>
                  <p className="mt-1 text-sm text-red-600">
                    This will permanently remove {selectedEmployee.first_name} {selectedEmployee.last_name} and all associated records. This action cannot be undone.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteEmployee}
                      disabled={deletingEmployee}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {deletingEmployee ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {deletingEmployee ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Personal */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Personal Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  <div>
                    <p className="text-xs text-gray-500">
                      ID Number
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedEmployee.id_number || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Date of Birth
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedEmployee.date_of_birth || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Phone
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {selectedEmployee.phone || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Email
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {selectedEmployee.email || '—'}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500">
                      Address
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {selectedEmployee.address || '—'}
                    </p>
                  </div>

                </div>

              </section>

              {/* Employment */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Employment
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  <div>
                    <p className="text-xs text-gray-500">
                      Department
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                      {selectedEmployee.department || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Job Title
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedEmployee.job_title || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      System Role
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                      <UserCog className="h-4 w-4 text-gray-400" />
                      {selectedEmployee.system_role ||
                        'Employee'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Employment Type
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedEmployee.employment_type ||
                        '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Start Date
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedEmployee.start_date || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Supervisor
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedEmployee.supervisor || '—'}
                    </p>
                  </div>

                </div>

              </section>

              {/* Attendance */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Attendance
                </h3>

                {(() => {

                  const stats =
                    getAttendanceStats(
                      selectedEmployee.id
                    );

                  return (

                    <div className="grid gap-4 sm:grid-cols-3">

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Days Worked
                        </p>

                        <p className="mt-2 text-2xl font-bold">
                          {stats.daysWorked}
                        </p>
                      </div>

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Days Absent
                        </p>

                        <p className="mt-2 text-2xl font-bold">
                          {stats.daysAbsent}
                        </p>
                      </div>

                      <div className="rounded-xl border p-4">
                        <p className="text-xs text-gray-500">
                          Hours Worked
                        </p>

                        <p className="mt-2 text-2xl font-bold">
                          {stats.hoursWorked.toFixed(1)}
                        </p>
                      </div>

                    </div>

                  );

                })()}

              </section>

              {/* Contract */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Employment Contract
                </h3>

                <div className="flex items-center justify-between rounded-xl border p-4">

                  <div className="flex items-center gap-3">

                    {selectedEmployee.contract_signed ? (

                      <FileCheck className="h-5 w-5 text-green-600" />

                    ) : (

                      <FileX className="h-5 w-5 text-red-600" />

                    )}

                    <div>

                      <p className="text-sm font-semibold">

                        {selectedEmployee.contract_signed
                          ? 'Contract Signed'
                          : 'Contract Not Signed'}

                      </p>

                      {selectedEmployee.contract_signed_date && (

                        <p className="text-xs text-gray-500">

                          Signed on{' '}
                          {selectedEmployee.contract_signed_date}

                        </p>

                      )}

                    </div>

                  </div>

                  {(() => {
                    const contract = getEmployeeContract();
                    const docSig = contract ? getContractSignature(contract.id) : undefined;
                    return (
                      <div className="flex flex-col items-end gap-2">
                        {docSig && docSig.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            Signature pending — sent {new Date(docSig.sent_at).toLocaleDateString()}
                          </span>
                        )}
                        {!selectedEmployee.contract_signed && (
                          <button
                            type="button"
                            onClick={handleSendContractForSignature}
                            disabled={sendingContractSignature}
                            title={!contract
                              ? 'No contract document attached. Upload one in the Documents section first.'
                              : 'Email this contract to the employee for electronic signature'}
                            className="flex items-center gap-2 rounded-lg bg-[#ef302b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d92824] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {sendingContractSignature ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <PenLine className="h-4 w-4" />
                            )}
                            {sendingContractSignature ? 'Sending...' : 'Send for Signature'}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                </div>

              </section>

              {/* Documents */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Documents
                </h3>

                <div className="rounded-xl border p-4">

                  {/* Upload form */}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Document Type
                      </label>

                      <select
                        value={documentType}
                        onChange={event =>
                          setDocumentType(event.target.value)
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                      >
                        <option value="contract">Contract</option>
                        <option value="id_document">ID Document</option>
                        <option value="qualification">Qualification</option>
                        <option value="medical">Medical</option>
                        <option value="banking">Banking Details</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        File
                      </label>

                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={event => {
                          const file = event.target.files?.[0] || null;
                          setUploadFile(file);
                        }}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#ef302b]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleDocumentUpload}
                      disabled={uploadingDocument || !uploadFile}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#ef302b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d92824] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadingDocument ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploadingDocument ? 'Uploading...' : 'Upload'}
                    </button>

                  </div>

                  {/* Document list */}

                  <div className="mt-4 space-y-2">
                    {getEmployeeDocuments(selectedEmployee.id).length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-500">
                        No documents uploaded yet.
                      </p>
                    ) : (
                      getEmployeeDocuments(selectedEmployee.id).map(doc => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {doc.document_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {doc.document_type} ·{' '}
                                {doc.file_size
                                  ? `${(doc.file_size / 1024).toFixed(1)} KB`
                                  : 'Unknown size'} ·{' '}
                                {new Date(doc.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadDocument(doc)}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-200"
                              title="Download"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDocument(doc)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                </div>

              </section>

              {/* Warnings */}

              <section>

                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Warnings
                  </h3>

                  <button
                    type="button"
                    onClick={() => setShowWarningForm(!showWarningForm)}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {showWarningForm ? 'Cancel' : 'Issue Warning'}
                  </button>
                </div>

                {showWarningForm && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h4 className="text-sm font-semibold text-amber-800">
                      Issue Warning to {selectedEmployee.first_name} {selectedEmployee.last_name}
                    </h4>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Warning Type
                        </label>
                        <select
                          value={warningType}
                          onChange={event =>
                            setWarningType(event.target.value as HRWarning['warning_type'])
                          }
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                        >
                          <option value="verbal">Verbal</option>
                          <option value="written">Written</option>
                          <option value="final">Final</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Signature (Employee No.)
                        </label>
                        <input
                          value={warningSignature}
                          onChange={event => setWarningSignature(event.target.value)}
                          placeholder={selectedEmployee.employee_number || 'EMP-0000'}
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Defaults to employee number: {selectedEmployee.employee_number || 'N/A'}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Reason *
                        </label>
                        <input
                          value={warningReason}
                          onChange={event => setWarningReason(event.target.value)}
                          placeholder="e.g. Repeated lateness, misconduct, poor performance..."
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Details
                        </label>
                        <textarea
                          rows={3}
                          value={warningDetails}
                          onChange={event => setWarningDetails(event.target.value)}
                          placeholder="Additional details about the warning..."
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                              type="checkbox"
                              checked={sendEmail}
                              onChange={event => setSendEmail(event.target.checked)}
                              className="h-4 w-4 accent-[#ef302b]"
                            />
                            Send via Email
                          </label>

                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                              type="checkbox"
                              checked={sendWhatsApp}
                              onChange={event => setSendWhatsApp(event.target.checked)}
                              className="h-4 w-4 accent-[#ef302b]"
                            />
                            Send via WhatsApp
                          </label>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {selectedEmployee.email ? `Email: ${selectedEmployee.email}` : 'No email on file'} ·{' '}
                          {selectedEmployee.phone ? `Phone: ${selectedEmployee.phone}` : 'No phone on file'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowWarningForm(false)}
                        className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleIssueWarning}
                        disabled={issuingWarning}
                        className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        {issuingWarning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {issuingWarning ? 'Issuing...' : 'Issue Warning'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {getEmployeeWarnings(selectedEmployee.id).length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">
                      No warnings issued for this employee.
                    </p>
                  ) : (
                    getEmployeeWarnings(selectedEmployee.id).map(warning => (
                      <div
                        key={warning.id}
                        className="flex items-start justify-between rounded-lg border bg-gray-50 px-4 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
                          <div>
                            <p className="text-sm font-semibold text-gray-900 capitalize">
                              {warning.warning_type} Warning
                            </p>
                            <p className="mt-0.5 text-sm text-gray-700">
                              {warning.reason}
                            </p>
                            {warning.details && (
                              <p className="mt-1 text-xs text-gray-500">
                                {warning.details}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-gray-400">
                              Issued: {new Date(warning.issued_at).toLocaleDateString()} · Signature: {warning.signature} · Status: {warning.status}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteWarning(warning.id)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                          title="Delete Warning"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </section>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          SEND EMAIL MODAL
      ====================================================== */}

      {showEmailForm && selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowEmailForm(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b p-6">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                  <Mail className="h-5 w-5 text-[#ef302b]" />
                  Send Email
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  To {selectedEmployee.first_name}{' '}
                  {selectedEmployee.last_name} — from zulaigah.benjamin@maharajasspices.co.za
                </p>
              </div>
              <button
                onClick={() => setShowEmailForm(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={event => {
                event.preventDefault();
                handleSendEmployeeEmail();
              }}
              className="space-y-4 p-6"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  To
                </label>
                <input
                  type="email"
                  value={selectedEmployee.email || ''}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 outline-none"
                />
                {!selectedEmployee.email && (
                  <p className="mt-1 text-xs text-red-500">
                    This employee has no email address on file.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Subject *
                </label>
                <input
                  value={emailSubject}
                  onChange={event => setEmailSubject(event.target.value)}
                  placeholder="e.g. Payslip ready for collection..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Message *
                </label>
                <textarea
                  rows={6}
                  value={emailMessage}
                  onChange={event => setEmailMessage(event.target.value)}
                  placeholder="Write your message here..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="flex items-center gap-2 rounded-lg bg-[#ef302b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d42a26] disabled:opacity-60"
                >
                  {sendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          EDIT EMPLOYEE MODAL
      ====================================================== */}

      {showEditEmployee && selectedEmployee && (

        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() =>
            setShowEditEmployee(false)
          }
        >

          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={event =>
              event.stopPropagation()
            }
          >

            {/* Modal Header */}

            <div className="flex items-start justify-between border-b p-6">

              <div>

                <h2 className="text-xl font-bold text-gray-900">
                  Edit Employee
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Update employee information for {selectedEmployee.first_name} {selectedEmployee.last_name}.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowEditEmployee(false)
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            {/* Form */}

            <form
              onSubmit={handleEditEmployee}
              className="space-y-7 p-6"
            >

              {/* ==================================================
                  PERSONAL INFORMATION
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Personal Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      First Name *
                    </label>

                    <input
                      required
                      value={employeeForm.first_name}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          first_name:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Last Name *
                    </label>

                    <input
                      required
                      value={employeeForm.last_name}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          last_name:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      ID Number
                    </label>

                    <input
                      value={employeeForm.id_number}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          id_number:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Date of Birth
                    </label>

                    <input
                      type="date"
                      value={employeeForm.date_of_birth}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          date_of_birth:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                </div>

              </section>

              {/* ==================================================
                  CONTACT
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Contact Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Email
                    </label>

                    <input
                      type="email"
                      value={employeeForm.email}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          email:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Phone
                    </label>

                    <input
                      value={employeeForm.phone}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          phone:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div className="sm:col-span-2">

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Address
                    </label>

                    <textarea
                      rows={2}
                      value={employeeForm.address}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          address:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                </div>

              </section>

              {/* ==================================================
                  EMPLOYMENT
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Employment Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Department
                    </label>

                    <select
                      value={employeeForm.department}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          department:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                    >

                      <option value="">
                        Select department
                      </option>

                      <option value="HR">HR</option>
                      <option value="Production">Production</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Quality Control">Quality Control</option>
                      <option value="Sales">Sales</option>
                      <option value="Finance">Finance</option>
                      <option value="Administration">Administration</option>
                      <option value="IT">IT</option>

                    </select>

                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Job Title
                    </label>

                    <input
                      value={employeeForm.job_title}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          job_title:
                            event.target.value,
                        })
                      }
                      placeholder="Production Worker"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      System Role
                    </label>

                    <select
                      value={employeeForm.system_role}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          system_role:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                    >

                      <option value="employee">Employee</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="manager">Manager</option>
                      <option value="hr_user">HR User</option>
                      <option value="admin">Admin</option>

                    </select>

                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Employment Type
                    </label>

                    <select
                      value={employeeForm.employment_type}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          employment_type:
                            event.target.value as
                              | 'full_time'
                              | 'part_time'
                              | 'contract'
                              | 'temporary'
                              | 'intern',
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                    >

                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="contract">Contract</option>
                      <option value="temporary">Temporary</option>
                      <option value="intern">Intern</option>

                    </select>

                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Start Date
                    </label>

                    <input
                      type="date"
                      value={employeeForm.start_date}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          start_date:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Supervisor
                    </label>

                    <input
                      value={employeeForm.supervisor}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          supervisor:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Employment Status
                    </label>

                    <select
                      value={employeeForm.status}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          status:
                            event.target.value as
                              | 'active'
                              | 'inactive'
                              | 'on_leave'
                              | 'terminated',
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b]"
                    >

                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on_leave">On Leave</option>
                      <option value="terminated">Terminated</option>

                    </select>
                  </div>

                </div>

              </section>

              {/* ==================================================
                  EMERGENCY CONTACT
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Emergency Contact
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Contact Name
                    </label>

                    <input
                      value={employeeForm.emergency_contact_name}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          emergency_contact_name:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                  <div>

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Contact Phone
                    </label>

                    <input
                      value={employeeForm.emergency_contact_phone}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          emergency_contact_phone:
                            event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                </div>

              </section>

              {/* ==================================================
                  BANKING
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Banking Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">

                  <div>

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Bank Name
                    </label>

                    <input
                      value={employeeForm.bank_name}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          bank_name:
                            event.target.value,
                        })
                      }
                      placeholder="Optional"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                  <div>

                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Bank Account Number
                    </label>

                    <input
                      value={employeeForm.bank_account_number}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          bank_account_number:
                            event.target.value,
                        })
                      }
                      placeholder="Optional"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                    />

                  </div>

                </div>

              </section>

              {/* ==================================================
                  CONTRACT
              ================================================== */}

              <section>

                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Employment Contract
                </h3>

                <div className="rounded-xl border p-4">

                  <label className="flex cursor-pointer items-center gap-3">

                    <input
                      type="checkbox"
                      checked={employeeForm.contract_signed}
                      onChange={event =>
                        setEmployeeForm({
                          ...employeeForm,
                          contract_signed:
                            event.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[#ef302b]"
                    />

                    <span className="text-sm font-medium text-gray-700">
                      Contract has been signed
                    </span>

                  </label>

                  {employeeForm.contract_signed && (

                    <div className="mt-4">

                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Contract Signed Date
                      </label>

                      <input
                        type="date"
                        value={employeeForm.contract_signed_date}
                        onChange={event =>
                          setEmployeeForm({
                            ...employeeForm,
                            contract_signed_date:
                              event.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#ef302b] focus:ring-2 focus:ring-red-100"
                      />

                    </div>

                  )}

                </div>

              </section>

              {/* ==================================================
                  FORM BUTTONS
              ================================================== */}

              <div className="flex justify-end gap-3 border-t pt-5">

                <button
                  type="button"
                  onClick={() =>
                    setShowEditEmployee(false)
                  }
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEmployee}
                  className="flex items-center gap-2 rounded-xl bg-[#ef302b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d92824] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEmployee ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
};

export default Employees;
