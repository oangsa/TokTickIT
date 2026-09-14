export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
export type SessionStage = "PASSWORD_CHANGE_REQUIRED" | "FULL";

export interface AuthTokenDTO {
  accessToken: string;
  expiresIn: number;
}

export interface CurrentUserDTO {
  publicId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: true;
  mustChangePassword: boolean;
  sessionStage: SessionStage;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}
