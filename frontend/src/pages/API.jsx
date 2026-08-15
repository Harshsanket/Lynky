import { useState } from 'react';
import { api } from '../api/client.api';
import { getApiKeyUsage } from '../api/usage.api';
import { NavLink } from 'react-router';

const API = () => {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-6 sm:px-8">
      <span
        className="mb-4 text-xs uppercase tracking-widest"
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-ink-soft)',
        }}
      >
        API
      </span>

      <h1
        className="text-3xl sm:text-4xl"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
      >
        Lynky's API for your shortcuts.
      </h1>

      <p
        className="mt-3 max-w-xl text-sm leading-relaxed sm:text-base"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-ink-soft)',
        }}
      >
        Lynky exposes a private, API-key based endpoint for developers and
        iPhone Shortcuts. Authenticate with your API secret, and Lynky cleans
        and shortens a shared URL, then returns only the short link.
      </p>

      <div
        className="mt-6 w-full overflow-hidden rounded-lg border"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-alt)',
        }}
      >
        <pre
          className="overflow-x-auto px-4 py-4 text-xs leading-relaxed"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}
        >
          {`POST /api/v1/api/urls
Authorization: Bearer <your-api-secret>
Content-Type: application/json

{ "url": "https://example.com/?utm_source=x" }

→ { "success": true, "shortUrl": "https://lnky-hs.vercel.app/abc1" }`}
        </pre>
      </div>

      <p
        className="mt-3 max-w-xl text-xs leading-relaxed"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-ink-soft)',
        }}
      >
        Each API secret can shorten up to 10,000 links per month.
      </p>

      <div className="mt-8 flex flex-col items-start gap-3">
        <p
          className="max-w-xl text-xs leading-relaxed"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-ink-soft)',
          }}
        >
          API secrets require approval before they can be issued.
          <br /> For now, contact{' '}
          <b style={{ color: 'var(--color-ink)' }}>Harsh</b> at{' '}
          <a
            href="mailto:harshsanket.dev@gmail.com"
            className="underline"
            style={{ color: 'var(--color-ink)' }}
          >
            harshsanket.dev@gmail.com
          </a>{' '}
          to request one.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        
        <NavLink
  to="/api/usage"
  className="w-fit rounded-md border border-(--color-border) px-5 py-3 text-sm font-medium text-var(--color-ink) hover:border-black"
>
  Have an API key?
</NavLink>
      </div>
    </main>
  );
}

export default API;
