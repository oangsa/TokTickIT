import type { FormSection } from "../../forms/formTypes.js";

export const AUTH_FORM_RULES = {
  password: {
    minLength: 8,
    maxLength: 128,
  },
} as const;

export const LOGIN_FORM_SECTIONS: FormSection<LoginFormValues>[] = [
  {
    key: "credentials",
    card: false,
    fields: [
      { key: "email", name: "email", label: "Email", type: "email", required: true, span: "full", autoComplete: "username" },
      {
        key: "password",
        name: "password",
        label: "Password",
        type: "password",
        required: true,
        span: "full",
        passwordToggle: true,
        autoComplete: "current-password",
        maxLength: AUTH_FORM_RULES.password.maxLength,
      },
      { key: "rememberMe", name: "rememberMe", label: "Remember me", type: "checkbox", span: "full" },
    ],
  },
];

export interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface ChangePasswordFormValues {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}

export const CHANGE_PASSWORD_FORM_SECTIONS: FormSection<ChangePasswordFormValues>[] = [
  {
    key: "password",
    card: false,
    fields: [
      { key: "currentPassword", name: "currentPassword", label: "Current Password", type: "password", required: true, span: "full", passwordToggle: true, autoComplete: "current-password", maxLength: AUTH_FORM_RULES.password.maxLength },
      { key: "newPassword", name: "newPassword", label: "New Password", type: "password", required: true, span: "full", passwordToggle: true, autoComplete: "new-password", maxLength: AUTH_FORM_RULES.password.maxLength },
      { key: "confirmPassword", name: "confirmPassword", label: "Confirm New Password", type: "password", required: true, span: "full", passwordToggle: true, autoComplete: "new-password", maxLength: AUTH_FORM_RULES.password.maxLength },
    ],
  },
];
