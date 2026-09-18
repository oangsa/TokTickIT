import { Eye, EyeOff, Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  FormProvider,
  type FieldErrors,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { Card } from "./Card.js";
import { Button } from "./Button.js";
import { IconButton } from "./IconButton.js";
import { ValidationMessage } from "./ValidationMessage.js";
import type { ManagedForm } from "../forms/useManagedForm.js";
import type {
  ChoiceFormField,
  FormField,
  FormMode,
  FormOption,
  FormSection,
  LookupFormField,
  TextFormField,
} from "../forms/formTypes.js";

const SPAN_CLASS: Record<string, string> = {
  full: "col-12",
  half: "col-12 col-md-6",
  third: "col-12 col-md-6 col-lg-4",
  quarter: "col-12 col-md-6 col-lg-3",
};

interface CommonFormProps<TValues extends FieldValues> {
  form: ManagedForm<TValues>;
  sections: readonly FormSection<TValues>[];
  mode?: FormMode;
  disabled?: boolean;
  onSubmit?: (values: TValues) => void | Promise<void>;
  onCancel?: () => void;
  showSubmitButton?: boolean;
  showCancelButton?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  /** Used by workflows with an explicitly offered, already-validated recovery retry. */
  bypassValidation?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
}

function fieldError<TValues extends FieldValues>(errors: FieldErrors<TValues>, name: Path<TValues>): string | undefined {
  let value: unknown = errors;
  for (const segment of String(name).split(".")) {
    if (typeof value !== "object" || value === null) return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  if (typeof value !== "object" || value === null) return undefined;
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function fieldValue<TValues extends FieldValues>(form: ManagedForm<TValues>, name: Path<TValues>): unknown {
  return form.watch(name);
}

function optionNodes(options: readonly FormOption[] | undefined): ReactNode {
  return options?.map((option) => (
    <option key={option.value} value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  ));
}

function optionValue(value: string, options: readonly FormOption[] | undefined): string | number | undefined {
  if (value === "") return undefined;
  return options?.find((option) => String(option.value) === value)?.value ?? value;
}

function labelFor(field: FormField<FieldValues>, id: string, showRequired = true): ReactNode {
  return (
    <label className="form-label fw-medium" htmlFor={id}>
      {field.label}
      {showRequired && field.required ? <span className="tt-required" aria-hidden="true">{" *"}</span> : null}
    </label>
  );
}

function FieldRenderer<TValues extends FieldValues>({
  field,
  form,
  mode,
  disabled,
}: {
  field: FormField<TValues>;
  form: ManagedForm<TValues>;
  mode?: FormMode;
  disabled?: boolean;
}) {
  const isView = mode === "view";
  const isFormDisabled = Boolean(disabled || isView);
  const isFieldDisabled = isFormDisabled || Boolean(field.disabled);
  const showRequired = !isView && Boolean(field.required);

  const id = `field-${String(field.name).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const error = isView ? undefined : fieldError(form.formState.errors, field.name);
  const helperText = isView ? undefined : ([field.description, field.helpText].filter(Boolean).join(" ") || undefined);
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const registered = form.register(
    field.name,
    field.type === "number"
      ? { valueAsNumber: true }
      : field.type === "select"
        ? { setValueAs: (value: string) => optionValue(value, field.options) }
        : undefined,
  );
  const value = fieldValue(form, field.name);
  const hasCounter = Boolean(!isView && field.showCount && typeof value === "string" && field.maxLength);
  const describedBy = [helperText ? descriptionId : null, hasCounter ? counterId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const invalidProps = error ? { "aria-invalid": true, "aria-describedby": describedBy } : { "aria-describedby": describedBy };
  const [visible, setVisible] = useState(false);

  const feedback = (
    <>
      {error ? <ValidationMessage id={errorId}>{error}</ValidationMessage> : null}
      {helperText || hasCounter ? (
        <div className="d-flex justify-content-between gap-3">
          {helperText ? <span id={descriptionId} className="form-text">{helperText}</span> : <span />}
          {hasCounter && typeof value === "string" && field.maxLength ? (
            <span id={counterId} className="form-text tt-counter" aria-live="polite">{Array.from(value).length}/{field.maxLength}</span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (field.type === "readonly") {
    return <div className="mb-3">{labelFor(field as FormField<FieldValues>, id, showRequired)}<output id={id} className="form-control-plaintext" aria-describedby={describedBy}>{field.value ?? String(value ?? "")}</output>{feedback}</div>;
  }

  if (field.type === "custom") {
    return <div className="mb-3">{labelFor(field as FormField<FieldValues>, id, showRequired)}{field.render({ id, name: field.name, value, setValue: (next) => form.setValue(field.name, next as never, { shouldDirty: true }), describedBy, invalid: Boolean(error), disabled: isFieldDisabled })}{feedback}</div>;
  }

  if (field.type === "radio") {
    const radioField = field as ChoiceFormField<TValues>;
    return <fieldset className="mb-3" aria-describedby={describedBy} aria-invalid={error ? true : undefined} aria-required={showRequired || undefined}>
      <legend className="form-label fw-medium fs-6">{field.label}{showRequired ? <span className="tt-required" aria-hidden="true">{" *"}</span> : null}</legend>
      {radioField.options?.map((option, index) => <div className="form-check" key={option.value}><input className={`form-check-input${error ? " is-invalid" : ""}`} id={`${id}-${option.value}`} type="radio" value={option.value} required={showRequired && index === 0} aria-invalid={error ? true : undefined} aria-describedby={describedBy} disabled={isFieldDisabled || option.disabled} {...registered} /><label className="form-check-label" htmlFor={`${id}-${option.value}`}>{option.label}</label></div>)}
      {feedback}
    </fieldset>;
  }

  if (field.type === "switch") {
    const choiceField = field as ChoiceFormField<TValues>;
    if (choiceField.options?.length) {
      return (
        <fieldset className="form-check form-switch mb-3" aria-describedby={describedBy} aria-invalid={error ? true : undefined} aria-required={showRequired || undefined}>
          <legend className="form-label fw-medium fs-6">{field.label}{showRequired ? <span className="tt-required" aria-hidden="true">{" *"}</span> : null}</legend>
          {choiceField.options.map((option, index) => (
            <div className="form-check" key={option.value}>
              <input className={`form-check-input${error ? " is-invalid" : ""}`} id={`${id}-${option.value}`} type="checkbox" role="switch" value={option.value} required={showRequired && index === 0} aria-invalid={error ? true : undefined} aria-describedby={describedBy} disabled={isFieldDisabled || option.disabled} {...registered} />
              <label className="form-check-label" htmlFor={`${id}-${option.value}`}>{option.label}</label>
            </div>
          ))}
          {feedback}
        </fieldset>
      );
    }
    return (
      <div className="mb-3">
        <label className="form-label fw-medium d-block" htmlFor={id}>
          {field.label}
          {showRequired ? <span className="tt-required" aria-hidden="true">{" *"}</span> : null}
        </label>
        <div className="d-flex align-items-center" style={{ minHeight: "38px" }}>
          <div className="form-check form-switch mb-0">
            <input
              className={`form-check-input${error ? " is-invalid" : ""}`}
              id={id}
              type="checkbox"
              role="switch"
              required={showRequired}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              disabled={isFieldDisabled}
              {...registered}
            />
          </div>
        </div>
        {feedback}
      </div>
    );
  }

  if (field.type === "checkbox") {
    const choiceField = field as ChoiceFormField<TValues>;
    const className = "form-check mb-3";
    if (choiceField.options?.length) {
      return <fieldset className={className} aria-describedby={describedBy} aria-invalid={error ? true : undefined} aria-required={showRequired || undefined}><legend className="form-label fw-medium fs-6">{field.label}{showRequired ? <span className="tt-required" aria-hidden="true">{" *"}</span> : null}</legend>{choiceField.options.map((option, index) => <div className="form-check" key={option.value}><input className={`form-check-input${error ? " is-invalid" : ""}`} id={`${id}-${option.value}`} type="checkbox" value={option.value} required={showRequired && index === 0} aria-invalid={error ? true : undefined} aria-describedby={describedBy} disabled={isFieldDisabled || option.disabled} {...registered} /><label className="form-check-label" htmlFor={`${id}-${option.value}`}>{option.label}</label></div>)}{feedback}</fieldset>;
    }
    return <div className={className}><input className={`form-check-input${error ? " is-invalid" : ""}`} id={id} type="checkbox" required={showRequired} aria-invalid={error ? true : undefined} aria-describedby={describedBy} disabled={isFieldDisabled} {...registered} /><label className="form-check-label" htmlFor={id}>{field.label}{showRequired ? <span className="tt-required" aria-hidden="true">{" *"}</span> : null}</label>{feedback}</div>;
  }

  const label = labelFor(field as FormField<FieldValues>, id, showRequired);
  const common = { id, disabled: isFieldDisabled, required: showRequired, autoComplete: field.autoComplete, ...invalidProps };
  let control: ReactNode;
  if (field.type === "select") {
    control = <select className={`form-select${error ? " is-invalid" : ""}`} {...common} {...registered}><option value="">{field.placeholder ?? `Select ${field.label}`}</option>{optionNodes(field.options)}</select>;
  } else if (field.type === "textarea") {
    control = <textarea className={`form-control${error ? " is-invalid" : ""}`} rows={field.rows ?? 4} placeholder={field.placeholder} maxLength={field.enforceMaxLength === false ? undefined : field.maxLength} {...common} {...registered} />;
  } else if (field.type === "lookup") {
    const lookup = field as LookupFormField<TValues>;
    const lookupLabel = lookup.lookupLabel ?? `Lookup ${field.label}`;
    control = <div className="input-group"><input className={`form-control${error ? " is-invalid" : ""}`} readOnly {...common} {...registered} /><IconButton className="btn-outline-secondary flex-shrink-0" label={lookupLabel} title={lookupLabel} disabled={isFieldDisabled} onClick={() => lookup.onLookup?.(field.name)}><Search size={16} aria-hidden="true" focusable="false" /></IconButton></div>;
  } else if (field.type === "attachment") {
    control = <input className={`form-control${error ? " is-invalid" : ""}`} type="file" accept={field.accept} multiple={field.multiple} {...common} {...registered} />;
  } else {
    const textField = field as TextFormField<TValues>;
    const passwordToggle = field.type === "password" && field.passwordToggle === true;
    const type = passwordToggle ? (visible ? "text" : "password") : field.type;
    const maxLength = field.type === "password" || field.enforceMaxLength === false ? undefined : field.maxLength;
    const passwordLabel = visible ? "Hide password" : "Show password";
    control = passwordToggle ? <div className="input-group"><input className={`form-control${error ? " is-invalid" : ""}`} type={type} placeholder={textField.placeholder} maxLength={maxLength} min={textField.min} max={textField.max} step={textField.step} {...common} {...registered} /><IconButton className="btn-outline-secondary flex-shrink-0" label={passwordLabel} title={passwordLabel} disabled={isFieldDisabled} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={16} aria-hidden="true" focusable="false" /> : <Eye size={16} aria-hidden="true" focusable="false" />}</IconButton></div> : <input className={`form-control${error ? " is-invalid" : ""}`} type={field.type} placeholder={textField.placeholder} maxLength={maxLength} min={textField.min} max={textField.max} step={textField.step} {...common} {...registered} />;
  }

  return <div className="mb-3">{label}{control}{feedback}</div>;
}

export function CommonForm<TValues extends FieldValues>({
  form,
  sections,
  mode,
  disabled = false,
  onSubmit,
  onCancel,
  showSubmitButton,
  showCancelButton,
  submitLabel,
  cancelLabel = "Cancel",
  submitting = false,
  submitDisabled = false,
  cancelDisabled = false,
  bypassValidation = false,
  className,
  ariaLabel,
  children,
}: CommonFormProps<TValues>) {
  const isView = mode === "view";
  const cancelVisible = showCancelButton ?? (isView ? false : onCancel !== undefined);
  const submitVisible = showSubmitButton ?? (isView ? false : true);
  const resolvedSubmitLabel = submitLabel ?? (mode === "edit" ? "Save Changes" : "Submit");

  const handleValues = async (values: TValues) => {
    if (!onSubmit) return;
    form.setFormError(undefined);
    try {
      await onSubmit(values);
    } catch (error) {
      const knownFields = new Set(sections.flatMap((section) => section.fields.map((field) => String(field.name))));
      form.mapServerErrors(error, knownFields);
    }
  };
  const submit = bypassValidation
    ? async () => handleValues(form.getValues())
    : form.handleSubmit(handleValues);

  return <FormProvider {...form}>
    <form className={className} aria-label={ariaLabel} noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (isView) return; form.setFormError(undefined); void submit(event); }}>
      {form.formError ? <div className="alert alert-danger" role="alert">{form.formError}</div> : null}
      {sections.map((section) => {
        const content = <div className="row">{section.fields.map((field) => <div key={field.key} className={SPAN_CLASS[field.span ?? "full"]}><FieldRenderer field={field} form={form} mode={mode} disabled={disabled} /></div>)}</div>;
        return section.card === false ? <section key={section.key} {...(section.title ? { "aria-labelledby": `${section.key}-title` } : {})}>{section.title ? <h2 id={`${section.key}-title`} className="h5">{section.title}</h2> : null}{section.description ? <p className="text-secondary">{section.description}</p> : null}{content}</section> : <Card key={section.key} title={section.title} >{section.description ? <p className="text-secondary">{section.description}</p> : null}{content}</Card>;
      })}
      {children}
      {(submitVisible || cancelVisible) ? <div className="d-flex justify-content-end gap-2 mt-3">{cancelVisible ? <Button variant="secondary" type="button" disabled={cancelDisabled} onClick={onCancel}>{cancelLabel}</Button> : null}{submitVisible ? <Button variant="primary" type="submit" busy={submitting} disabled={submitDisabled || disabled}>{resolvedSubmitLabel}</Button> : null}</div> : null}
    </form>
  </FormProvider>;
}

export type { CommonFormProps };
export type {
  FormField,
  FormFieldConfig,
  FormMode,
  FormSection,
  FormSectionConfig,
  FormOption,
  SemanticSpan,
  FormFieldType,
} from "../forms/formTypes.js";
export default CommonForm;
