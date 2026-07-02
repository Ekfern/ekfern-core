'use client'

import { passwordRequirements } from '@/lib/auth/api'

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1">
      {passwordRequirements.map((requirement) => {
        const met = requirement.test(password)
        return (
          <li
            key={requirement.label}
            className={`text-xs flex items-center gap-1.5 ${met ? 'text-eco-green' : 'text-gray-500'}`}
          >
            <span>{met ? '✓' : '○'}</span>
            {requirement.label}
          </li>
        )
      })}
    </ul>
  )
}
