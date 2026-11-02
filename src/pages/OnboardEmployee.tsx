import { supabase } from '@/integrations/supabase/client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

const initialForm = {
  title: '',
  first_name: '',
  last_name: '',
  id_number: '',
  passport_country: '',
  date_of_birth: '',
  marital_status: '',
  email: '',
  phone: '',
  contact_no_2: '',
  house_unit_no: '',
  street_name: '',
  suburb: '',
  postal_code: '',
  next_of_kin_1_name: '',
  next_of_kin_1_relation: '',
  next_of_kin_1_phone: '',
  next_of_kin_2_name: '',
  next_of_kin_2_relation: '',
  next_of_kin_2_phone: '',
  dependants: '',
  tax_number: '',
  bank_account_holder: '',
  bank_name: '',
  bank_account_number: '',
  bank_account_type: '',
  bank_account_type_other: '',
  start_date: '',
  department: '',
  job_title: '',
  employment_type: 'full_time',
  supervisor: '',
  criminal_check_acknowledged: false,
  employee_signature: '',
  acknowledgement_date: '',
};

type FormKey = keyof typeof initialForm;

const inputClass =
  'block w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-red-800 focus:bg-white focus:ring-4 focus:ring-red-800/10 disabled:opacity-60';

const labelClass =
  'mb-1.5 block text-sm font-medium text-slate-700';

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-900 focus:outline-none focus:ring-4 focus:ring-red-800/20 disabled:cursor-not-allowed disabled:opacity-60';

const secondaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50';

const OnboardEmployee: React.FC = () => {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  

const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!form.criminal_check_acknowledged) {
    toast.error('Please confirm the criminal record check acknowledgement.');
    return;
  }

  if (!form.employee_signature.trim() || !form.acknowledgement_date) {
    toast.error('Please enter your full name and acknowledgement date.');
    return;
  }

  setIsSubmitting(true);

  try {
    const { data, error } = await supabase.functions.invoke(
      'create-employee',
      {
        body: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          id_number: form.id_number.trim(),
          date_of_birth: form.date_of_birth || undefined,
          email: form.email.trim(),
          phone: form.phone.trim(),
          contact_no_2: form.contact_no_2 || undefined,

          address: [
            form.house_unit_no,
            form.street_name,
            form.suburb,
            form.postal_code,
          ]
            .filter(Boolean)
            .join(', ') || undefined,

          department: form.department || undefined,
          job_title: form.job_title || undefined,
          employment_type: form.employment_type || 'full_time',
          start_date: form.start_date || undefined,
          supervisor: form.supervisor || undefined,

          title: form.title || undefined,
          passport_country: form.passport_country || undefined,
          marital_status: form.marital_status || undefined,

          next_of_kin_1_name: form.next_of_kin_1_name || undefined,
          next_of_kin_1_relation: form.next_of_kin_1_relation || undefined,
          next_of_kin_1_phone: form.next_of_kin_1_phone || undefined,
          next_of_kin_2_name: form.next_of_kin_2_name || undefined,
          next_of_kin_2_relation: form.next_of_kin_2_relation || undefined,
          next_of_kin_2_phone: form.next_of_kin_2_phone || undefined,
          dependants: form.dependants || undefined,
          tax_number: form.tax_number || undefined,

          bank_account_holder: form.bank_account_holder || undefined,
          bank_name: form.bank_name || undefined,
          bank_account_number: form.bank_account_number || undefined,
          bank_account_type: form.bank_account_type || undefined,
          bank_account_type_other:
            form.bank_account_type_other || undefined,

          employee_signature: form.employee_signature.trim(),
          acknowledgement_date: form.acknowledgement_date,
          criminal_check_acknowledged:
            form.criminal_check_acknowledged,
        },
      },
    );

    if (error) {
      console.error('Employee onboarding error:', error);
      toast.error(error.message || 'Failed to submit employee details.');
      return;
    }

    if (!data?.success || !data?.employee_number) {
      toast.error(data?.error || 'Employee submission failed.');
      return;
    }

    setEmployeeNumber(data.employee_number);
    setSubmissionSuccess(true);
    toast.success('Employee details submitted successfully.');
  } catch (error) {
    console.error('Employee onboarding error:', error);
    toast.error('Could not submit the form. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};


  const update = (name: FormKey, value: string | boolean) => {
    setForm(previous => ({ ...previous, [name]: value }));
  };

  const input = (
    name: FormKey,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      placeholder?: string;
      autoComplete?: string;
    } = {},
  ) => (
    <label className="block min-w-0" key={name}>
      <span className={labelClass}>
        {label}
        {options.required && <span className="ml-1 text-red-700">*</span>}
      </span>
      <input
        className={inputClass}
        name={name}
        type={options.type || 'text'}
        value={String(form[name] ?? '')}
        onChange={event => update(name, event.target.value)}
        required={options.required}
        placeholder={options.placeholder || `Enter ${label.toLowerCase()}`}
        autoComplete={options.autoComplete}
      />
    </label>
  );

  const select = (
    name: FormKey,
    label: string,
    options: { value: string; label: string }[],
    required = false,
  ) => (
    <label className="block min-w-0" key={name}>
      <span className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-700">*</span>}
      </span>
      <select
        className={inputClass}
        name={name}
        value={String(form[name] ?? '')}
        onChange={event => update(name, event.target.value)}
        required={required}
      >
        <option value="">Choose an option</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const sectionHeading = (
    icon: React.ReactNode,
    title: string,
    description?: string,
  ) => (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-800">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );

  const cardClass =
    'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7';

  const kinFields = (number: '1' | '2') => (
    <div
      key={number}
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-red-800 ring-1 ring-slate-200">
          {number}
        </span>
        <h3 className="text-sm font-semibold text-slate-800">
          Next of kin {number}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {input(
          `next_of_kin_${number}_name` as FormKey,
          'Full name',
        )}
        {input(
          `next_of_kin_${number}_relation` as FormKey,
          'Relationship',
        )}
        {input(
          `next_of_kin_${number}_phone` as FormKey,
          'Contact number',
          { type: 'tel' },
        )}
      </div>
    </div>
  );

  const handleContinue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.start_date || !form.title || !form.first_name.trim() ||
        !form.last_name.trim() || !form.id_number.trim() || !form.phone.trim()) {
      toast.error('Please complete all required fields before continuing.');
      return;
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (employeeNumber) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-700">
            <CheckCircle2 size={34} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-800">
            Maharaja's Spices
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Information submitted
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Thank you for completing your employee onboarding. HR will review
            your details and follow up about your employment contract.
          </p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Your employee number
            </p>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {employeeNumber}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-800 text-lg font-black text-white shadow-sm">
            M
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-wide text-slate-900">
              MAHARAJA'S SPICES
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              People & Culture · Employee Onboarding
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
            <ShieldCheck size={16} className="text-green-700" />
            Employee information
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <p className="text-sm font-semibold text-red-800">
            EMPLOYEE TAKE-ON
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Let's get you started.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Please provide your details below. This information helps our HR
            team prepare your employment record and contract.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Step {step} of 2
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {step === 1 ? 'Your information' : 'Declarations & review'}
              </p>
            </div>
            <span className="text-sm font-medium text-slate-500">
              {step === 1 ? '50%' : '100%'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-red-800 transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={`flex items-center gap-2 text-sm ${
              step === 1 ? 'font-semibold text-red-800' : 'text-green-700'
            }`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${
                step === 1 ? 'bg-red-50' : 'bg-green-50'
              }`}>
                {step === 1 ? <UserRound size={15} /> : <CheckCircle2 size={15} />}
              </span>
              Your information
            </div>
            <div className={`flex items-center gap-2 text-sm ${
              step === 2 ? 'font-semibold text-red-800' : 'text-slate-400'
            }`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${
                step === 2 ? 'bg-red-50' : 'bg-slate-100'
              }`}>
                <ClipboardCheck size={15} />
              </span>
              Declarations
            </div>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleContinue} className="space-y-5">
            <section className={cardClass}>
              {sectionHeading(
                <UserRound size={20} />,
                'Personal information',
                'Enter your identity details as they appear on your official documents.',
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {input('start_date', 'Employment start date', {
                  type: 'date',
                  required: true,
                })}
                {select('title', 'Title', [
                  { value: 'Mr', label: 'Mr' },
                  { value: 'Ms', label: 'Ms' },
                  { value: 'Mrs', label: 'Mrs' },
                  { value: 'Other', label: 'Other' },
                ], true)}
                {input('first_name', 'First name', {
                  required: true,
                  autoComplete: 'given-name',
                })}
                {input('last_name', 'Surname', {
                  required: true,
                  autoComplete: 'family-name',
                })}
                {input('id_number', 'ID / Passport number', {
                  required: true,
                })}
                {input('passport_country', 'Passport country of issue')}
                {input('date_of_birth', 'Date of birth', { type: 'date' })}
                {select('marital_status', 'Marital status', [
                  { value: 'single', label: 'Single' },
                  { value: 'married', label: 'Married' },
                  { value: 'divorced', label: 'Divorced' },
                  { value: 'widowed', label: 'Widowed' },
                  { value: 'other', label: 'Other' },
                ])}
              </div>
            </section>

            <section className={cardClass}>
              {sectionHeading(
                <MapPin size={20} />,
                'Contact & residential address',
                'How can HR contact you, and where do you currently live?',
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {input('phone', 'Primary contact number', {
                  type: 'tel',
                  required: true,
                  autoComplete: 'tel',
                })}
                {input('contact_no_2', 'Alternative contact number', {
                  type: 'tel',
                })}
                {input('email', 'Email address', {
                  type: 'email',
                  autoComplete: 'email',
                })}
                {input('house_unit_no', 'House / unit number', {
                  autoComplete: 'address-line1',
                })}
                {input('street_name', 'Street name')}
                {input('suburb', 'Suburb', {
                  autoComplete: 'address-level2',
                })}
                {input('postal_code', 'Postal code', {
                  autoComplete: 'postal-code',
                })}
              </div>
            </section>

            <section className={cardClass}>
              {sectionHeading(
                <Users size={20} />,
                'Next of kin',
                'Provide emergency contact details for two people, where available.',
              )}
              <div className="space-y-4">
                {kinFields('1')}
                {kinFields('2')}
                <div className="max-w-xs">
                  {input('dependants', 'Number of dependants', {
                    type: 'number',
                    placeholder: 'e.g. 2',
                  })}
                </div>
              </div>
            </section>

            <section className={cardClass}>
              {sectionHeading(
                <Landmark size={20} />,
                'Tax & banking details',
                'Check that your banking information is correct.',
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {input('tax_number', 'Tax number')}
                {input('bank_account_holder', 'Account holder name')}
                {input('bank_account_number', 'Bank account number')}
                {input('bank_name', 'Bank name')}
                {select('bank_account_type', 'Account type', [
                  { value: 'savings', label: 'Savings' },
                  { value: 'cheque', label: 'Cheque / Current' },
                  { value: 'other', label: 'Other' },
                ])}
                {form.bank_account_type === 'other' &&
                  input('bank_account_type_other', 'Specify account type')}
              </div>
            </section>

            <section className={cardClass}>
              {sectionHeading(
                <FileText size={20} />,
                'Employment details',
                'Complete any additional details you have been given by HR.',
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {input('department', 'Department')}
                {input('job_title', 'Job title')}
                {select('employment_type', 'Employment type', [
                  { value: 'full_time', label: 'Full-time' },
                  { value: 'part_time', label: 'Part-time' },
                  { value: 'contract', label: 'Contract' },
                  { value: 'temporary', label: 'Temporary' },
                ])}
                {input('supervisor', 'Supervisor / manager')}
              </div>
            </section>

            <div className="flex justify-end pt-2">
              <button type="submit" className={primaryButton}>
                Continue to declarations <ArrowRight size={17} />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className={cardClass}>
              {sectionHeading(
                <ShieldCheck size={20} />,
                'Criminal record check',
                'Please read the requirements carefully before confirming.',
              )}
              <div className="rounded-xl bg-slate-50 p-4 sm:p-5">
                <p className="text-sm leading-6 text-slate-700">
                  All employees are required to undergo a criminal record
                  check through the South African Police Service (SAPS) as
                  part of employment verification.
                </p>
                <ul className="mt-4 space-y-3">
                  {[
                    'The criminal record check must be conducted through SAPS.',
                    'For Head Office Support Staff, the cost is covered by the company.',
                    'All other employees are responsible for paying the full cost.',
                    'Employees who pay for the check must provide the official receipt.',
                    'All employees must submit the results once they are available.',
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm leading-5 text-slate-600">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-red-800" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className={cardClass}>
              {sectionHeading(
                <ClipboardCheck size={20} />,
                'Employee acknowledgement',
                'Confirm that you understand the requirements above.',
              )}
              <p className="text-sm leading-6 text-slate-600">
                I confirm that I understand the criminal record check
                requirements and payment arrangements explained above. I
                accept responsibility for arranging and paying for the check
                where applicable. I will provide the official receipt where
                required and submit the results once available.
              </p>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.criminal_check_acknowledged}
                  onChange={event =>
                    update('criminal_check_acknowledged', event.target.checked)
                  }
                  className="mt-1 h-4 w-4 accent-red-800"
                  required
                />
                <span className="text-sm leading-5 text-slate-700">
                  I have read and agree to the criminal record check
                  acknowledgement.
                </span>
              </label>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {input('employee_signature', 'Type your full legal name', {
                  required: true,
                  placeholder: 'Enter your full name as acknowledgement',
                })}
                {input('acknowledgement_date', 'Acknowledgement date', {
                  type: 'date',
                  required: true,
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Typing your name records a typed acknowledgement. It is not
                a handwritten or cryptographic electronic signature.
              </p>
            </section>

            <section className={cardClass}>
              {sectionHeading(
                <FileText size={20} />,
                'Documents checklist',
                'Use this list to prepare the supporting documents HR may request.',
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  'Copy of ID',
                  "Driver's licence (if applicable)",
                  'Bank confirmation letter',
                  'Criminal clearance certificate',
                  'Proof of address',
                  'Credit check report (if applicable)',
                  'Letter of offer',
                  'Employment contract',
                ].map((document, index) => (
                  <div
                    key={document}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    <span className="text-sm text-slate-700">{document}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                This checklist does not upload documents. Please follow HR's
                instructions for supplying supporting documents.
              </p>
            </section>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={secondaryButton}
              >
                <ArrowLeft size={17} /> Back to information
              </button>

              
<button
  type="submit"
  disabled={isSubmitting}
  className={primaryButton}
>
  {isSubmitting ? (
    <>
      <Loader2 size={17} className="animate-spin" />
      Submitting...
    </>
  ) : (
    <>
      Submit employee information <ArrowRight size={17} />
    </>
  )}
</button>

            </div>
          </form>
        )}


        <footer className="mt-10 border-t border-slate-200 py-6 text-center">
          <p className="text-xs text-slate-500">
            Maharaja's Spices · Employee Onboarding
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Please ensure your information is accurate before submission.
          </p>
        </footer>
      </div>
    </main>
  );
};

export default OnboardEmployee;
