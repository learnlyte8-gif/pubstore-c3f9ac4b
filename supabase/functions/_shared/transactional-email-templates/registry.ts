import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string | ((data: any) => string)
}

import { template as orderConfirmation } from './order-confirmation.tsx'
import { template as orderStatus } from './order-status-update.tsx'
import { template as newSale } from './new-sale.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-confirmation': orderConfirmation,
  'order-status-update': orderStatus,
  'new-sale': newSale,
}
