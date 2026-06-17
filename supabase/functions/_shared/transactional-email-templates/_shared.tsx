/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Img, Section, Row, Column, Text, Link, Button } from 'npm:@react-email/components@0.0.22'

export const BRAND = '#1F7AE0'
export const BRAND_DARK = '#0F5BB8'
export const ACCENT = '#C04ABF'
export const INK = '#0B0B0F'
export const MUTED = '#6B7280'
export const BORDER = '#E5E7EB'
export const SOFT = '#F6F8FB'
export const SITE_URL = 'https://pubstore.app'

export const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }
export const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
export const wrap = { padding: '24px 24px 8px' }

export const Header = ({ tag }: { tag?: string }) => (
  <Section style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${ACCENT} 100%)`, padding: '20px 24px', borderRadius: '0' }}>
    <Row>
      <Column>
        <Text style={{ color: '#fff', fontWeight: 800, fontSize: '22px', letterSpacing: '1.5px', margin: 0 }}>PUBSTORE</Text>
      </Column>
      {tag ? (
        <Column align="right">
          <Text style={{ color: '#fff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0, background: 'rgba(255,255,255,0.18)', padding: '6px 10px', borderRadius: '999px', display: 'inline-block' }}>{tag}</Text>
        </Column>
      ) : null}
    </Row>
  </Section>
)

export const Footer = () => (
  <Section style={{ padding: '24px', borderTop: `1px solid ${BORDER}`, marginTop: '12px' }}>
    <Text style={{ fontSize: '12px', color: MUTED, margin: 0, lineHeight: '1.6' }}>
      You're receiving this email because of activity on your PUBSTORE account.
      <br />
      <Link href={SITE_URL} style={{ color: BRAND, textDecoration: 'none' }}>pubstore.app</Link> · Trusted marketplace for buyers and sellers
    </Text>
  </Section>
)

export type ProductCard = {
  id?: string
  title: string
  image?: string
  price?: number
  qty?: number
  currency?: string
  url?: string
}

const money = (n?: number, c = 'USD') => (typeof n === 'number' ? `${c === 'USD' ? '$' : c + ' '}${n.toFixed(2)}` : '')

export const ProductGrid = ({ items }: { items: ProductCard[] }) => (
  <Section style={{ padding: '0 24px' }}>
    {items.map((p, i) => (
      <Section key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '12px', marginBottom: '10px', background: '#fff' }}>
        <Row>
          <Column style={{ width: '88px', verticalAlign: 'top' }}>
            {p.image ? (
              <Img src={p.image} width="80" height="80" alt={p.title} style={{ borderRadius: '8px', objectFit: 'cover', border: `1px solid ${BORDER}` }} />
            ) : (
              <div style={{ width: '80px', height: '80px', background: SOFT, borderRadius: '8px' }} />
            )}
          </Column>
          <Column style={{ verticalAlign: 'top', paddingLeft: '12px' }}>
            <Text style={{ fontSize: '14px', fontWeight: 700, color: INK, margin: '0 0 6px', lineHeight: '1.3' }}>{p.title}</Text>
            {typeof p.qty === 'number' ? (
              <Text style={{ fontSize: '12px', color: MUTED, margin: '0 0 6px' }}>Qty: {p.qty}</Text>
            ) : null}
            <Row>
              <Column>
                <Text style={{ fontSize: '15px', fontWeight: 800, color: BRAND, margin: 0 }}>{money(p.price, p.currency)}</Text>
              </Column>
              {p.url ? (
                <Column align="right">
                  <Link href={p.url} style={{ fontSize: '12px', color: BRAND, fontWeight: 700, textDecoration: 'none' }}>View →</Link>
                </Column>
              ) : null}
            </Row>
          </Column>
        </Row>
      </Section>
    ))}
  </Section>
)

export const CTAButton = ({ href, label }: { href: string; label: string }) => (
  <Section style={{ padding: '8px 24px 4px', textAlign: 'center' as const }}>
    <Button href={href} style={{ background: BRAND, color: '#fff', padding: '14px 28px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}>
      {label}
    </Button>
  </Section>
)
