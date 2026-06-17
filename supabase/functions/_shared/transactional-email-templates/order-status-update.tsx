/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Header, Footer, ProductGrid, CTAButton, main, container, INK, MUTED, BRAND, SITE_URL, ProductCard } from './_shared.tsx'

interface Props {
  buyerName?: string
  refCode?: string
  status?: string
  message?: string
  items?: ProductCard[]
  recommended?: ProductCard[]
}

const labels: Record<string, { tag: string; head: string; sub: string }> = {
  paid: { tag: 'Paid', head: 'Payment received', sub: 'We\'ve received your payment and the seller is preparing your order.' },
  processing: { tag: 'Processing', head: 'Order is being prepared', sub: 'Your seller has started preparing your items.' },
  shipped: { tag: 'Shipped', head: 'Your order is on the way', sub: 'Tracking updates will appear in your orders page.' },
  delivered: { tag: 'Delivered', head: 'Your order has arrived', sub: 'Tap below to mark it received and leave a review.' },
  cancelled: { tag: 'Cancelled', head: 'Your order was cancelled', sub: 'Any payment will be refunded to your wallet.' },
}

const Email = ({ buyerName, refCode, status = 'shipped', message, items = [], recommended = [] }: Props) => {
  const meta = labels[status] ?? { tag: status.toUpperCase(), head: `Order ${status}`, sub: '' }
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Order {refCode ?? ''} — {meta.head}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Header tag={meta.tag} />
          <Section style={{ padding: '24px 24px 8px' }}>
            <Heading style={{ fontSize: '22px', color: INK, margin: '0 0 6px', fontWeight: 800 }}>
              {meta.head}{buyerName ? `, ${buyerName}` : ''}
            </Heading>
            <Text style={{ fontSize: '14px', color: MUTED, margin: '0 0 4px' }}>
              Reference <strong style={{ color: INK }}>{refCode}</strong>
            </Text>
            <Text style={{ fontSize: '13px', color: MUTED, margin: 0 }}>{message ?? meta.sub}</Text>
          </Section>

          {items.length ? <ProductGrid items={items} /> : null}

          <CTAButton href={`${SITE_URL}/orders`} label="Track order" />

          {recommended.length ? (
            <>
              <Section style={{ padding: '24px 24px 4px' }}>
                <Text style={{ fontSize: '12px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px' }}>
                  You might also like
                </Text>
              </Section>
              <ProductGrid items={recommended} />
            </>
          ) : null}

          <Footer />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => {
    const meta = labels[d?.status ?? 'shipped']
    return `${meta?.head ?? 'Order update'} — PUBSTORE ${d?.refCode ?? ''}`.trim()
  },
  displayName: 'Order Status Update',
  previewData: {
    buyerName: 'Sam',
    refCode: 'PS-9F3A21',
    status: 'shipped',
    items: [{ title: 'Wireless ANC Headphones', price: 89.5, qty: 1, image: 'https://picsum.photos/seed/h/200' }],
  },
} satisfies TemplateEntry
