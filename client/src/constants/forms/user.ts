import type { FormSection } from "../../forms/formTypes.js";
import type { UserRole } from "../../auth/authTypes.js";

export const USER_FORM_RULES = {
  name: { minLength: 1, maxLength: 120 },
  email: { maxLength: 254 },
} as const;

export interface UserFormValues {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export const USER_FORM_SECTIONS: FormSection<UserFormValues>[] = [
  {
    key: "user",
    title: "User details",
    fields: [
      { key: "name", name: "name", label: "Name", type: "text", required: true, maxLength: USER_FORM_RULES.name.maxLength, span: "half" },
      { key: "email", name: "email", label: "Email", type: "email", required: true, maxLength: USER_FORM_RULES.email.maxLength, span: "half" },
      { key: "role", name: "role", label: "Role", type: "select", required: true, options: [
        { value: "REQUESTER", label: "Requester" },
        { value: "IT_STAFF", label: "IT Staff" },
        { value: "ADMINISTRATOR", label: "Administrator" },
      ], span: "half" },
      { key: "isActive", name: "isActive", label: "Active", type: "switch", span: "half" },
    ],
  },
];
