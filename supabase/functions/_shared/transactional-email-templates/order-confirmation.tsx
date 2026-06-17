/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Row, Column, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Header, Footer, ProductGrid, CTAButton, main, container, INK, MUTED, BORDER, SOFT, BRAND, SITE_URL, ProductCard } from './_shared.tsx'

interface Props {
  buyerName?: string
  refCode?: string
  orderId?: string
  total?: number
  subtotal?: number
  shipping?: number
  currency?: string
  items?: ProductCard[]
  shippingAddress?: string
  recommended?: ProductCard[]
}

const money = (n?: number, c = 'USD') => (typeof n === 'number' ? `${c === 'USD' ? '$' : c + ' '}${n.toFixed(2)}` : '—')

const Email = ({ buyerName, refCode, orderId, total, subtotal, shipping, currency = 'USD', items = [], shippingAddress, recommended = [] }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your PUBSTORE order {refCode ?? orderId ?? ''} is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header tag="Invoice" />
        <Section style={{ padding: '24px 24px 8px' }}>
          <Heading style={{ fontSize: '22px', color: INK, margin: '0 0 6px', fontWeight: 800 }}>
            Thanks{buyerName ? `, ${buyerName}` : ''} — order confirmed
          </Heading>
          <Text style={{ fontSize: '14px', color: MUTED, margin: '0 0 4px' }}>
            Reference <strong style={{ color: INK }}>{refCode ?? orderId}</strong>
          </Text>
          <Text style={{ fontSize: '13px', color: MUTED, margin: 0 }}>
            We've notified the seller. You'll get another email when it ships.
          </Text>
        </Section>

        <Section style={{ padding: '16px 24px 4px' }}>
          <Text style={{ fontSize: '12px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>
            Items ({items.length})
          </Text>
        </Section>
        <ProductGrid items={items} />

        <Section style={{ padding: '12px 24px' }}>
          <div style={{ background: SOFT, borderRadius: '12px', padding: '16px' }}>
            <Row>
              <Column><Text style={{ margin: 0, fontSize: '13px', color: MUTED }}>Subtotal</Text></Column>
              <Column align="right"><Text style={{ margin: 0, fontSize: '13px', color: INK, fontWeight: 600 }}>{money(subtotal ?? total, currency)}</Text></Column>
            </Row>
            {typeof shipping === 'number' ? (
              <Row>
                <Column><Text style={{ margin: '6px 0 0', fontSize: '13px', color: MUTED }}>Shipping</Text></Column>
                <Column align="right"><Text style={{ margin: '6px 0 0', fontSize: '13px', color: INK, fontWeight: 600 }}>{money(shipping, currency)}</Text></Column>
              </Row>
            ) : null}
            <Hr style={{ borderColor: BORDER, margin: '12px 0' }} />
            <Row>
              <Column><Text style={{ margin: 0, fontSize: '15px', color: INK, fontWeight: 800 }}>Total</Text></Column>
              <Column align="right"><Text style={{ margin: 0, fontSize: '18px', color: BRAND, fontWeight: 800 }}>{money(total, currency)}</Text></Column>
            </Row>
          </div>
        </Section>

        {shippingAddress ? (
          <Section style={{ padding: '4px 24px 12px' }}>
            <Text style={{ fontSize: '12px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px' }}>Ship to</Text>
            <Text style={{ fontSize: '13px', color: INK, margin: 0, lineHeight: '1.5' }}>{shippingAddress}</Text>
          </Section>
        ) : null}

        <CTAButton href={`${SITE_URL}/orders`} label="View order" />

        {recommended.length ? (
          <>
            <Section style={{ padding: '24px 24px 4px' }}>
              <Text style={{ fontSize: '12px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px' }}>
                Picked for you
              </Text>
              <Text style={{ fontSize: '13px', color: MUTED, margin: '0 0 8px' }}>Buyers like you also loved these</Text>
            </Section>
            <ProductGrid items={recommended} />
          </>
        ) : null}

        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Order ${d?.refCode ?? ''} confirmed — PUBSTORE`,
  displayName: 'Order Confirmation (Invoice)',
  previewData: {
    buyerName: 'Sam',
    refCode: 'PS-9F3A21',
    total: 124.5,
    subtotal: 119.5,
    shipping: 5,
    items: [
      { title: 'Wireless ANC Headphones', price: 89.5, qty: 1, image: 'https://picsum.photos/seed/h/200', url: 'https://pubstore.app' },
      { title: 'USB-C Fast Charger 65W', price: 30, qty: 1, image: 'https://picsum.photos/seed/c/200', url: 'https://pubstore.app' },
    ],
    shippingAddress: '12 Main St, Harare, ZW',
    recommended: [
      { title: 'Braided USB-C Cable 2m', price: 9.99, image: 'https://picsum.photos/seed/x/200', url: 'https://pubstore.app' },
    ],
  },
} satisfies TemplateEntry
