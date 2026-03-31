export interface AppUserSession {
  userId: string;
  phone: string;
  nickname?: string;
  avatarUrl: string;
  sessionToken: string;
  profileCompleted: boolean;
}
