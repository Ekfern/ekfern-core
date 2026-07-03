/**
 * API functions and shared types/schemas for host authentication
 * (signup, login, OTP, password management).
 */

import api from '@/lib/api'
import * as z from 'zod'

export interface AuthUser {
  id: number
  email: string
  name: string
  email_verified: boolean
  has_password: boolean
  created_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export const otpCodeSchema = z.string().length(6, 'Code must be 6 digits')
export const requiredPasswordSchema = z.string().min(1, 'Password is required')

// Mirrors the backend's password rules (SetPasswordSerializer / ChangePasswordSerializer /
// ResetPasswordSerializer in backend/apps/users/serializers.py) so the frontend rejects a
// weak password before it ever reaches the server.
export const passwordRequirements = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'At least one letter', test: (value: string) => /[a-zA-Z]/.test(value) },
  { label: 'At least one number', test: (value: string) => /[0-9]/.test(value) },
]

export const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => /[a-zA-Z]/.test(value), 'Password must contain at least one letter')
  .refine((value) => /[0-9]/.test(value), 'Password must contain at least one number')

export function storeAuthTokens(tokens: AuthTokens) {
  localStorage.setItem('access_token', tokens.access)
  localStorage.setItem('refresh_token', tokens.refresh)
}

export async function signup(
  name: string,
  email: string
): Promise<{ otp_code?: string; needs_verification?: boolean }> {
  const response = await api.post('/api/auth/signup/', { name, email })
  return response.data
}

export async function startOtp(email: string): Promise<{ otp_code?: string }> {
  const response = await api.post('/api/auth/otp/start/', { email })
  return response.data
}

export async function verifyOtp(email: string, code: string): Promise<AuthTokens> {
  const response = await api.post('/api/auth/otp/verify/', { email, code })
  return response.data
}

export async function checkPasswordEnabled(email: string): Promise<boolean> {
  const response = await api.get(
    `/api/auth/check-password-enabled/?email=${encodeURIComponent(email)}`
  )
  return response.data.has_password
}

export async function passwordLogin(email: string, password: string): Promise<AuthTokens> {
  const response = await api.post('/api/auth/password-login/', { email, password })
  return response.data
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await api.get('/api/auth/me/')
  return response.data
}

export async function setPassword(password: string): Promise<void> {
  await api.post('/api/auth/set-password/', { password })
}

export async function changePassword(code: string, newPassword: string): Promise<void> {
  await api.post('/api/auth/change-password/', { code, new_password: newPassword })
}

export async function disablePassword(password: string): Promise<void> {
  await api.post('/api/auth/disable-password/', { password })
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/api/auth/forgot-password/', { email })
}

export async function resetPassword(
  token: string,
  email: string,
  newPassword: string
): Promise<void> {
  await api.post('/api/auth/reset-password/', { token, email, new_password: newPassword })
}
