/**
 * Literal dynamic imports so webpack emits one chunk per experience module.
 * Do not use template-string imports — that can bundle the whole folder.
 */

export const experienceLoaders = {
  rose_petals: () => import('./modules/rose-petals'),
} as const

export type ExperienceModuleId = keyof typeof experienceLoaders
