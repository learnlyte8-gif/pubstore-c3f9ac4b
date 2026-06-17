/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl?: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} sign-in code: {token ?? '------'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your sign-in code</Heading>
        <Text style={text}>
          Enter this 6-digit code in {siteName} to finish signing in. The code
          expires in 10 minutes.
        </Text>
        <div style={codeBox}>{token ?? '------'}</div>
        <Text style={footer}>
          Didn't request this? You can safely ignore this email — no changes
          were made to your account.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 25px', maxWidth: '480px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 24px',
}
const codeBox = {
  display: 'block' as const,
  textAlign: 'center' as const,
  fontSize: '34px',
  fontWeight: 700 as const,
  letterSpacing: '12px',
  color: '#000000',
  backgroundColor: '#f4f4f5',
  border: '1px solid #e4e4e7',
  borderRadius: '12px',
  padding: '20px 0',
  margin: '0 0 28px',
  fontFamily: 'Menlo, Consolas, monospace',
}
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
