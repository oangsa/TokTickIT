import type { ReactNode } from "react";
import { CommonForm } from "../../components/Common/Form/CommonForm.js";
import { useManagedForm, type ManagedForm } from "../../forms/useManagedForm.js";
import type { FormMode, FormSection } from "../../forms/formTypes.js";
import { USER_FORM_SECTIONS, type UserFormValues } from "../../constants/forms/user.js";

export interface UserFormProps {
  mode: FormMode;
  form?: ManagedForm<UserFormValues>;
  values?: UserFormValues;
  onSubmit?: (values: UserFormValues) => void | Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  isSelf?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  className?: string;
  children?: ReactNode;
}

export function UserForm({
  mode,
  form,
  values,
  onSubmit,
  onCancel,
  submitting = false,
  submitDisabled = false,
  cancelDisabled = false,
  isSelf = false,
  disabled = false,
  submitLabel,
  cancelLabel,
  className,
  children,
}: UserFormProps) {
  const internalForm = useManagedForm<UserFormValues>({
    defaultValues: values ?? { name: "", email: "", role: "REQUESTER", isActive: true },
    values,
  });
  const resolvedForm = form ?? internalForm;

  const sections: FormSection<UserFormValues>[] = USER_FORM_SECTIONS.map((section) => ({
    ...section,
    card: false,
    fields: section.fields.map((field) => {
      if (mode === "edit" && isSelf && (field.name === "role" || field.name === "isActive")) {
        return { ...field, disabled: true };
      }
      return field;
    }),
  }));

  return (
    <CommonForm
      form={resolvedForm}
      sections={sections}
      mode={mode}
      disabled={disabled}
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitting={submitting}
      submitDisabled={submitDisabled}
      cancelDisabled={cancelDisabled}
      submitLabel={submitLabel ?? (mode === "create" ? "Create User" : mode === "edit" ? "Save Changes" : undefined)}
      cancelLabel={cancelLabel}
      className={className}
    >
      {children}
    </CommonForm>
  );
}

export default UserForm;
