import { z } from 'zod'

/**
 * `.strict()` en cada nivel rechaza cualquier campo no listado: evita que un
 * workflow de n8n envíe por error (o deliberadamente) objetos financieros
 * completos, balances, registros de IndexedDB o tokens dentro de `context`.
 */
const contextSchema = z.object({
  eventType: z.string().min(1).max(100).optional(),
  workflowId: z.string().min(1).max(100).optional(),
  userReference: z.string().min(1).max(200).optional(),
}).strict()

export const sendTextRequestSchema = z.object({
  requestId: z.string().uuid(),
  recipient: z.string().regex(/^\d{7,20}$/, 'recipient debe ser un número en formato E.164 sin símbolos.'),
  text: z.string().min(1).max(4096),
  context: contextSchema.optional(),
}).strict()

export type SendTextRequest = z.infer<typeof sendTextRequestSchema>

const templateSchema = z.object({
  name: z.string().min(1).max(512),
  languageCode: z.string().min(2).max(35),
  components: z.array(z.unknown()).max(20).optional().default([]),
}).strict()

export const sendTemplateRequestSchema = z.object({
  requestId: z.string().uuid(),
  recipient: z.string().regex(/^\d{7,20}$/, 'recipient debe ser un número en formato E.164 sin símbolos.'),
  template: templateSchema,
  context: contextSchema.optional(),
}).strict()

export type SendTemplateRequest = z.infer<typeof sendTemplateRequestSchema>

export const markAsReadRequestSchema = z.object({
  requestId: z.string().uuid(),
  providerMessageId: z.string().min(1).max(256),
}).strict()

export type MarkAsReadRequest = z.infer<typeof markAsReadRequestSchema>
