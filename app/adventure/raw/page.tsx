'use client';

import React, { useEffect, useState } from 'react';

type FetchState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.error === 'string'
        ? body.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export default function AdventureRawDataPage() {
  const [state, setState] = useState<FetchState<unknown>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });

    fetchJson('/api/stages')
      .then((stages) => {
        if (active) {
          setState({ status: 'ready', data: stages });
        }
      })
      .catch((error: Error) => {
        if (active) {
          setState({
            status: 'error',
            message: error.message,
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main
      style={{
        padding: '1rem',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
    >
      {state.status === 'loading' && <pre>Loading /api/stages...</pre>}
      {state.status === 'error' && <pre>Error: {state.message}</pre>}
      {state.status === 'ready' && <pre>{JSON.stringify(state.data, null, 2)}</pre>}
    </main>
  );
}
