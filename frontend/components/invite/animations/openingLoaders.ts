/**
 * Literal dynamic imports so webpack emits one chunk per opening module.
 * Do not use template-string imports — that can bundle the whole folder.
 */

export const openingLoaders = {
  envelope_reveal: () => import('./modules/envelope-reveal'),
  curtain_reveal: () => import('./modules/curtain-reveal'),
} as const

export type OpeningModuleId = keyof typeof openingLoaders
