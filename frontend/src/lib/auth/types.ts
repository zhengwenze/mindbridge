export type AuthorityName = "ROLE_USER" | "ROLE_ADMIN";

export interface Authority {
  authority: AuthorityName | string;
}

export interface UserProfile {
  id: number;
  username: string;
  displayName: string;
  roles: Authority[];
}

export type AppRole = "student" | "admin";

export interface AuthSession {
  token: string;
  profile: UserProfile;
}
