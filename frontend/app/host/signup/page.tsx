'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { PasswordRequirements } from '@/components/ui/PasswordRequirements'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import { signup, verifyOtp, setPassword, storeAuthTokens, storedAccessToken, getCurrentUser, otpCodeSchema, newPasswordSchema } from '@/lib/auth/api'
import { MINIMUM_AGE, dateOfBirthProblem, isUnderage, todayIso } from '@/lib/auth/age'
import { afterAuthPath } from '@/lib/auth/returnTo'

const UNDERAGE_MESSAGE = `You must be ${MINIMUM_AGE} or older to create an Ekfern account.`

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  // Under the minimum age is an ordinary field error, so nothing is sent and a
  // mistyped year can simply be corrected. The form validates on submit, so
  // the age limit is not shown before someone answers.
  dateOfBirth: z.string().superRefine((value, ctx) => {
    const problem = dateOfBirthProblem(value) ?? (isUnderage(value) ? UNDERAGE_MESSAGE : null)
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem })
  }),
})

/** The server said the account already has a password - the first save worked. */
function passwordAlreadySet(error: any): boolean {
  return /already set/i.test(error?.response?.data?.error || '')
}

const codeSchema = z.object({
  code: otpCodeSchema,
})

const setPasswordSchema = z.object({
  password: newPasswordSchema,
  confirmPassword: newPasswordSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type SignupForm = z.infer<typeof signupSchema>
type CodeForm = z.infer<typeof codeSchema>
type SetPasswordForm = z.infer<typeof setPasswordSchema>

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [step, setStep] = useState<'signup' | 'verify' | 'set-password'>('signup')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  // Once the password is saved we are on our way out; the buttons stay off so a
  // second press cannot send it again while the next page loads.
  const [leaving, setLeaving] = useState(false)
  const nextPath = afterAuthPath(searchParams)

  // Send an already-authenticated visitor to the dashboard instead of showing
  // the signup form (tokens live in localStorage, shared across tabs).
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let cancelled = false
    const token = storedAccessToken()
    if (!token) {
      setCheckingSession(false)
      return
    }
    getCurrentUser()
      .then(() => {
        if (!cancelled) router.replace(nextPath)
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [router, nextPath])

  const {
    register: registerSignup,
    handleSubmit: handleSubmitSignup,
    setError: setSignupError,
    formState: { errors: signupErrors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: searchParams.get('email') || '' },
  })

  const {
    register: registerCode,
    handleSubmit: handleSubmitCode,
    formState: { errors: codeErrors },
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  })

  const {
    register: registerSetPassword,
    handleSubmit: handleSubmitSetPassword,
    formState: { errors: setPasswordErrors },
    watch: watchSetPassword,
  } = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
  })

  const onSignupSubmit = async (data: SignupForm) => {
    setLoading(true)
    try {
      const response = await signup(data.name, data.email, data.dateOfBirth)

      setEmail(data.email)
      setStep('verify')

      if (response.otp_code) {
        logDebug('🔑 OTP Code (dev mode):', response.otp_code)
        showToast(`OTP Code: ${response.otp_code} (check console for details)`, 'info')
      } else if (response.needs_verification) {
        showToast('This email is registered but not yet verified. A fresh code has been sent.', 'info')
      } else {
        showToast('Verification code sent to your email', 'success')
      }
    } catch (error: any) {
      if (error?.response?.data?.code === 'underage') {
        // The server's own check (e.g. its date differs from the browser's).
        setSignupError('dateOfBirth', { message: UNDERAGE_MESSAGE })
        return
      }
      logError('Signup error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  const onCodeSubmit = async (data: { code: string }) => {
    setLoading(true)
    try {
      const tokens = await verifyOtp(email, data.code)
      storeAuthTokens(tokens)
      showToast('Email verified! 🌿', 'success')
      setStep('set-password')
    } catch (error: any) {
      logError('OTP verification error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  const onSetPasswordSubmit = async (data: SetPasswordForm) => {
    if (leaving) return
    setLoading(true)
    try {
      await setPassword(data.password)
      setLeaving(true)
      showToast('Password set! Welcome! 🌿', 'success')
      router.push(nextPath)
      return
    } catch (error: any) {
      if (passwordAlreadySet(error)) {
        // A repeat of a save that already worked (the account was created a
        // moment ago by this same verified person): carry on, don't alarm them.
        setLeaving(true)
        router.push(nextPath)
        return
      }
      logError('Set password error:', error)
      showToast(getErrorMessage(error), 'error')
    }
    setLoading(false)
  }

  const onSkipPassword = () => {
    setLeaving(true)
    router.push(nextPath)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-eco-beige flex items-center justify-center p-4">
        <p className="text-gray-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eco-beige flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white border-2 border-eco-green-light">
        <CardHeader className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <CardTitle className="text-2xl text-eco-green">Create Your Account</CardTitle>
          <CardDescription className="text-base">
            {step === 'signup'
              ? 'Start planning sustainable celebrations in minutes'
              : step === 'verify'
              ? `Enter the verification code sent to ${email}`
              : 'Set a password for faster sign in, or skip and use a code every time'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'signup' && (
            <form 
              onSubmit={handleSubmitSignup(onSignupSubmit)} 
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Full Name *
                </label>
                <Input
                  type="text"
                  {...registerSignup('name')}
                  placeholder="Your name"
                  className="border-eco-green-light focus:border-eco-green"
                />
                {signupErrors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {signupErrors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Email Address *
                </label>
                <Input
                  type="email"
                  {...registerSignup('email')}
                  placeholder="your@email.com"
                  className="border-eco-green-light focus:border-eco-green"
                />
                {signupErrors.email && (
                  <p className="text-red-500 text-sm mt-1">
                    {signupErrors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="signup-dob" className="block text-sm font-medium mb-1 text-gray-700">
                  Date of Birth *
                </label>
                <Input
                  id="signup-dob"
                  type="date"
                  max={todayIso()}
                  autoComplete="bday"
                  {...registerSignup('dateOfBirth')}
                  className="border-eco-green-light focus:border-eco-green"
                />
                {signupErrors.dateOfBirth ? (
                  <p className="text-red-500 text-sm mt-1" role="alert">{signupErrors.dateOfBirth.message}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Required by law to create an account. We don&apos;t show it to anyone.
                  </p>
                )}
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-eco-green hover:bg-eco-green-dark text-white py-6 text-lg"
              >
                {loading ? 'Creating Account...' : 'Create Account →'}
              </Button>
              <p className="text-xs text-center text-gray-500 mt-4">
                By creating an account, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleSubmitCode(onCodeSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Verification Code
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  {...registerCode('code')}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="border-eco-green-light focus:border-eco-green text-center text-2xl tracking-widest"
                />
                {codeErrors.code && (
                  <p className="text-red-500 text-sm mt-1">
                    {codeErrors.code.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Check your email for the 6-digit code
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('signup')}
                  className="flex-1 border-eco-green text-eco-green"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 bg-eco-green hover:bg-eco-green-dark text-white"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </Button>
              </div>
            </form>
          )}

          {step === 'set-password' && (
            <form onSubmit={handleSubmitSetPassword(onSetPasswordSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Password
                </label>
                <Input
                  type="password"
                  {...registerSetPassword('password')}
                  placeholder="Enter a password (min 8 characters)"
                  autoComplete="new-password"
                  className="border-eco-green-light focus:border-eco-green"
                />
                {setPasswordErrors.password && (
                  <p className="text-red-500 text-sm mt-1">
                    {setPasswordErrors.password.message}
                  </p>
                )}
                <PasswordRequirements password={watchSetPassword('password') || ''} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  {...registerSetPassword('confirmPassword')}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className="border-eco-green-light focus:border-eco-green"
                />
                {setPasswordErrors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    {setPasswordErrors.confirmPassword.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={loading || leaving}
                className="w-full bg-eco-green hover:bg-eco-green-dark text-white py-6 text-lg"
              >
                {leaving ? 'Opening Ekfern...' : loading ? 'Saving...' : 'Set Password & Continue →'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onSkipPassword}
                disabled={loading || leaving}
                className="w-full border-eco-green text-eco-green"
              >
                Skip — continue with OTP
              </Button>
            </form>
          )}

          {step !== 'set-password' && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  href={`/host/login${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
                  className="text-eco-green font-medium hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-eco-beige flex items-center justify-center">Loading...</div>}>
      <SignupForm />
    </Suspense>
  )
}

