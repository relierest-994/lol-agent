import { callBackendApi } from '../../http-api.client';

export interface AppLoginCodeRequest {
  phone: string;
}

export interface AppLoginCodeResponse {
  requestId: string;
  expiresAt: string;
  mockCodeHint: string;
}

export interface AppLoginRequest {
  phone: string;
  verificationCode: string;
}

export interface AppProfileDto {
  userId: string;
  phone: string;
  nickname?: string;
  avatarUrl: string;
  profileCompleted: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface AppLoginResponse {
  sessionToken: string;
  isNewUser: boolean;
  profile: AppProfileDto;
}

export interface SetupProfileRequest {
  userId: string;
  nickname: string;
  avatarUrl?: string;
}

export async function sendLoginCodeUseCase(input: AppLoginCodeRequest): Promise<AppLoginCodeResponse> {
  return callBackendApi<AppLoginCodeResponse>({
    path: 'app/auth/send-code',
    method: 'POST',
    body: {
      phone: input.phone,
    },
  });
}

export async function loginWithCodeUseCase(input: AppLoginRequest): Promise<AppLoginResponse> {
  return callBackendApi<AppLoginResponse>({
    path: 'app/auth/login',
    method: 'POST',
    body: {
      phone: input.phone,
      verification_code: input.verificationCode,
    },
  });
}

export async function setupProfileUseCase(input: SetupProfileRequest): Promise<AppProfileDto> {
  return callBackendApi<AppProfileDto>({
    path: 'app/profile/setup',
    method: 'POST',
    body: {
      user_id: input.userId,
      nickname: input.nickname,
      avatar_url: input.avatarUrl,
    },
  });
}

export async function getProfileUseCase(userId: string): Promise<AppProfileDto> {
  return callBackendApi<AppProfileDto>({
    path: `app/profile?user_id=${encodeURIComponent(userId)}`,
  });
}

