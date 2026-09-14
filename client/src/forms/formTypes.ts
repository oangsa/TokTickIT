import type { ReactNode } from "react";
import type { FieldValues, Path } from "react-hook-form";

export type SemanticSpan = "full" | "half" | "third" | "quarter";
export type FormFieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "date"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "switch"
  | "readonly"
  | "attachment"
  | "lookup"
  | "custom";

export interface FormOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface CustomFieldRenderProps<TValues extends FieldValues> {
  id: string;
  name: Path<TValues>;
  value: unknown;
  setValue: (value: unknown) => void;
  describedBy?: string;
  invalid: boolean;
}

interface BaseField<TValues extends FieldValues> {
  key: string;
  name: Path<TValues>;
  label: string;
  type: FormFieldType;
  span?: SemanticSpan;
  required?: boolean;
  description?: string;
  helpText?: string;
  maxLength?: number;
  showCount?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  readonly?: boolean;
}

interface TextInputField<TValues extends FieldValues> extends BaseField<TValues> {
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
}

export type TextFormField<TValues extends FieldValues> =
  | (TextInputField<TValues> & { type: "text" })
  | (TextInputField<TValues> & { type: "email" })
  | (TextInputField<TValues> & { type: "password"; passwordToggle?: boolean })
  | (TextInputField<TValues> & { type: "number" })
  | (TextInputField<TValues> & { type: "date" });

export interface TextareaFormField<TValues extends FieldValues> extends BaseField<TValues> {
  type: "textarea";
  rows?: number;
  placeholder?: string;
}

export interface SelectFormField<TValues extends FieldValues> extends BaseField<TValues> {
  type: "select";
  options: readonly FormOption[];
  placeholder?: string;
}

interface ChoiceField<TValues extends FieldValues> extends BaseField<TValues> {
  options?: readonly FormOption[];
}

export type ChoiceFormField<TValues extends FieldValues> =
  | (ChoiceField<TValues> & { type: "radio" })
  | (ChoiceField<TValues> & { type: "checkbox" })
  | (ChoiceField<TValues> & { type: "switch" });

export interface ReadonlyFormField<TValues extends FieldValues> extends BaseField<TValues> {
  type: "readonly";
  value?: ReactNode;
}

export interface AttachmentFormField<TValues extends FieldValues> extends BaseField<TValues> {
  type: "attachment";
  accept?: string;
  multiple?: boolean;
}

export interface LookupFormField<TValues extends FieldValues> extends BaseField<TValues> {
  type: "lookup";
  lookupLabel?: string;
  onLookup?: (name: Path<TValues>) => void;
}

export interface CustomFormField<TValues extends FieldValues> extends BaseField<TValues> {
  type: "custom";
  render: (props: CustomFieldRenderProps<TValues>) => ReactNode;
}

export type FormField<TValues extends FieldValues> =
  | TextFormField<TValues>
  | TextareaFormField<TValues>
  | SelectFormField<TValues>
  | ChoiceFormField<TValues>
  | ReadonlyFormField<TValues>
  | AttachmentFormField<TValues>
  | LookupFormField<TValues>
  | CustomFormField<TValues>;

export interface FormSection<TValues extends FieldValues> {
  key: string;
  title?: string;
  description?: string;
  card?: boolean;
  fields: readonly FormField<TValues>[];
}

export type FormFieldConfig<TValues extends FieldValues> = FormField<TValues>;
export type FormSectionConfig<TValues extends FieldValues> = FormSection<TValues>;
