import { useCallback, useMemo, useState } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";

import { mapServerFieldErrors, DEFAULT_FORM_ERROR, type ServerErrorResult } from "./serverFieldErrors.js";

export type ManagedFormOptions<TValues extends FieldValues> = Omit<UseFormProps<TValues>, "resolver"> & {
  schema: ZodType<TValues>;
};

export interface ManagedForm<TValues extends FieldValues> extends UseFormReturn<TValues> {
  isDirty: boolean;
  formError?: string;
  setFormError: (message?: string) => void;
  mapServerErrors: (error: unknown, knownFields?: ReadonlySet<string>, fallback?: string) => ServerErrorResult;
}

export function useManagedForm<TValues extends FieldValues>({ schema, ...options }: ManagedFormOptions<TValues>): ManagedForm<TValues> {
  const form = useForm<TValues>({
    ...options,
    defaultValues: options.defaultValues as DefaultValues<TValues> | undefined,
    resolver: zodResolver(schema as never) as never,
    shouldFocusError: true,
  }) as UseFormReturn<TValues>;
  const [formError, setFormError] = useState<string>();

  const mapServerErrors = useCallback(
    (error: unknown, knownFields: ReadonlySet<string> = new Set(), fallback = DEFAULT_FORM_ERROR) => {
      const result = mapServerFieldErrors(error, form.setError, knownFields, fallback);
      setFormError(result.formError);
      if (result.mappedFields.length > 0) {
        queueMicrotask(() => form.setFocus(result.mappedFields[0] as Path<TValues>));
      }
      return result;
    },
    [form.setError],
  );

  return useMemo(() => ({
    ...form,
    get formState() { return form.formState; },
    get isDirty() { return form.formState.isDirty; },
    formError,
    setFormError,
    mapServerErrors,
  }), [form, formError, mapServerErrors]);
}
