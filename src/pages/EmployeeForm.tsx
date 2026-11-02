useEffect(() => {
    refreshData();
    setTableLoading(false);
  }, [refreshData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value || undefined,
    }));
  };

  const handleBooleanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({
      ...prev,
      contract_signed: e.target.checked,
    }));
  };

  const resetForm = () => {
    setForm({
      first_name: '',
      last_name: '',
      employee_number: undefined,
      id_number: undefined,
      date_of_birth: undefined,
      email: undefined,
      phone: undefined,
      address: undefined,
      department: undefined,
      job_title: undefined,
      system_role: 'employee',
      employment_type: 'full_time',
      start_date: undefined,
      supervisor: undefined,
      status: 'active' as const,
      contract_signed: false,
      contract_signed_date: undefined,
      emergency_contact_name: undefined,
      emergency_contact_phone: undefined,
      bank_name: undefined,
      bank_account_number: undefined,
      termination_date: undefined,
      termination_reason: undefined,
      termination_notes: undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('First name and last name are required.');
      return;
    }

    setForm(prev => ({
      ...prev,
      employee_number: prev.employee_number || undefined,
    }));

    try {
      if (editing && selectedEmployee) {
        const result = await updateEmployee(selectedEmployee.id, {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          id_number: form.id_number || undefined,
          date_of_birth: form.date_of_birth || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          department: form.department || undefined,
          job_title: form.job_title || undefined,
          system_role: form.system_role || undefined,
          employment_type: form.employment_type,
          start_date: form.start_date || undefined,
          supervisor: form.supervisor || undefined,
          status: form.status,
          contract_signed: form.contract_signed,
          contract_signed_date:
            form.contract_signed && form.contract_signed_date
              ? form.contract_signed_date
              : undefined,
          emergency_contact_name: form.emergency_contact_name || undefined,
          emergency_contact_phone: form.emergency_contact_phone || undefined,
          bank_name: form.bank_name || undefined,
          bank_account_number: form.bank_account_number || undefined,
        });

        if (result) {
          toast.success('Employee updated successfully');
          setEditing(false);
          setShowForm(false);
          resetForm();
          refreshData();
        }
      } else {
        const result = await addEmployee(form as any);

        if (result) {
          toast.success(`Employee ${result.employee_number} added successfully`);
          resetForm();
          setShowForm(false);
          refreshData();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save employee.');
    }
  };

  const handleEdit = (employee: HREmployee) => {
    setSelectedEmployee(employee);
    setForm({
      employee_number: employee.employee_number,
      first_name: employee.first_name,
      last_name: employee.last_name,
      id_number: employee.id_number,
      date_of_birth: employee.date_of_birth,
      email: employee.email,
      phone: employee.phone,
      address: employee.address,
      department: employee.department,
      job_title: employee.job_title,
      system_role: employee.system_role,
      employment_type: employee.employment_type || 'full_time',
      start_date: employee.start_date,
      supervisor: employee.supervisor,
      status: employee.status,
      contract_signed: employee.contract_signed,
      contract_signed_date: employee.contract_signed_date,
      emergency_contact_name: employee.emergency_contact_name,
      emergency_contact_phone: employee.emergency_contact_phone,
      bank_name: employee.bank_name,
      bank_account_number: employee.bank_account_number,
      termination_date: employee.termination_date,
      termination_reason: employee.termination_reason,
      termination_notes: employee.termination_notes,
    });
    setEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const success = await deleteEmployee(id);
      if (success) {
        toast.success('Employee deleted successfully');
        setShowDeleteConfirm(false);
        refreshData();
      }
    } catch (error) {
      toast.error('Failed to delete employee.');
    } finally {
      setDeleting(false);
    }
  };