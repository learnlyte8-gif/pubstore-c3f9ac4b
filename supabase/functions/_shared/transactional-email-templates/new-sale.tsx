/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Row, Column } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Header, Footer, ProductGrid, CTAButton, main, container, INK, MUTED, BRAND, SOFT, SITE_URL, ProductCard } from './_shared.tsx'

interface Props {
  sellerName?: string
  refCode?: string
  buyerName?: string
  total?: number
  currency?: string
  items?: ProductCard[]
  shippingAddress?: string
}

const money = (n?: number, c = 'USD') => (typeof n === 'number' ? `${c === 'USD' ? '$' : c + ' '}${n.toFixed(2)}` : '—')

const Email = ({ sellerName, refCode, buyerName, total, currency = 'USD', items = [], shippingAddress }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You made a sale on PUBSTORE — {money(total, currency)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Header tag="New Sale" />
        <Section style={{ padding: '24px 24px 8px' }}>
          <Heading style={{ fontSize: '22px', color: INK, margin: '0 0 6px', fontWeight: 800 }}>
            You made a sale{sellerName ? `, ${sellerName}` : ''}! 🎉
          </Heading>
          <Text style={{ fontSize: '14px', color: MUTED, margin: '0 0 4px' }}>
            Order <strong style={{ color: INK }}>{refCode}</strong>{buyerName ? ` from ${buyerName}` : ''}
          </Text>
        </Section>

        <Section style={{ padding: '8px 24px' }}>
          <div style={{ background: SOFT, borderRadius: '12px', padding: '16px' }}>
            <Row>
              <Column><Text style={{ margin: 0, fontSize: '13px', color: MUTED, fontWeight: 600 }}>Order total</Text></Column>
              <Column align="right"><Text style={{ margin: 0, fontSize: '20px', color: BRAND, fontWeight: 800 }}>{money(total, currency)}</Text></Column>
            </Row>
          </div>
        </Section>

        <Section style={{ padding: '12px 24px 4px' }}>
          <Text style={{ fontSize: '12px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>
            Items to fulfill
          </Text>
        </Section>
        <ProductGrid items={items} />

        {shippingAddress ? (
          <Section style={{ padding: '4px 24px 12px' }}>
            <Text style={{ fontSize: '12px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px' }}>Ship to</Text>
            <Text style={{ fontSize: '13px', color: INK, margin: 0, lineHeight: '1.5' }}>{shippingAddress}</Text>
          </Section>
        ) : null}

        <CTAButton href={`${SITE_URL}/orders`} label="Open seller dashboard" />

        <Footer />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `New sale on PUBSTORE — ${money(d?.total, d?.currency)}`,
  displayName: 'New Sale (Seller)',
  previewData: {
    sellerName: 'Alex',
    refCode: 'PS-9F3A21',
    buyerName: 'Sam',
    total: 124.5,
    items: [{ title: 'Wireless ANC Headphones', price: 89.5, qty: 1, image: 'https://picsum.photos/seed/h/200' }],
  },
} satisfies TemplateEntry
