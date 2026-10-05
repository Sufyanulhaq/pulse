import { z } from 'zod'

const DAY = 86_400_000

export const sessionSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/, 'Use letters, numbers and _ . : - only (up to 64).'),
    start: z.number().int().min(946684800000, 'Start must be after the year 2000.'),
    end: z.number().int(),
    minutes: z.number().min(0).max(1440),
    planned: z.number().int().min(1).max(600),
    label: z.string().trim().max(120).default(''),
    tag: z.string().trim().max(40).default(''),
    interruptions: z.number().int().min(0).max(500).default(0),
    completed: z.boolean(),
  })
  .refine((s) => s.end >= s.start, { message: 'End must not be before start.', path: ['end'] })
  .refine((s) => s.end - s.start <= DAY, { message: 'A session cannot be longer than a day.', path: ['end'] })
  .refine((s) => s.minutes <= (s.end - s.start) / 60_000 + 1, {
    message: 'Focused minutes cannot exceed the time between start and end.',
    path: ['minutes'],
  })
  .refine((s) => s.start <= Date.now() + 5 * 60_000, { message: 'Start cannot be in the future.', path: ['start'] })

export const sessionPatchSchema = z
  .object({
    label: z.string().trim().max(120).optional(),
    tag: z.string().trim().max(40).optional(),
  })
  .strict()

export const email = z.string().trim().toLowerCase().max(254).email('Enter a valid email address.')
export const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'Use at most 200 characters.')

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email,
  password,
})

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.').max(200) })

export const settingsSchema = z
  .object({
    goalMinutes: z.number().int().min(15).max(960),
    focusMinutes: z.number().int().min(1).max(180),
    shortBreakMinutes: z.number().int().min(1).max(60),
    longBreakMinutes: z.number().int().min(1).max(90),
    longBreakEvery: z.number().int().min(2).max(12),
    autoStartBreaks: z.boolean(),
    autoStartFocus: z.boolean(),
    sound: z.boolean(),
    notifications: z.boolean(),
    tags: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  })
  .partial()

export const WEBHOOK_EVENTS = ['session.completed', 'session.deleted', 'goal.reached']

export const webhookSchema = z.object({
  url: z.string().trim().url('Enter a full URL, starting with https://').max(500),
  description: z.string().trim().max(120).default(''),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Pick at least one event.').default(['session.completed']),
  active: z.boolean().default(true),
})

export const tokenSchema = z.object({
  name: z.string().trim().min(1, 'Name the token.').max(60),
  scope: z.enum(['read', 'write']).default('read'),
})

export const teamSchema = z.object({ name: z.string().trim().min(2, 'Use at least 2 characters.').max(60) })

export const assistantSchema = z.object({ question: z.string().trim().min(1, 'Ask a question.').max(500) })
