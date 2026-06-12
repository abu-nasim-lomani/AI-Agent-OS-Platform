'use client';

import { useState } from 'react';
import type { AnswerCitation } from '@agentos/shared';

/**
 * Playground v0 (S0-12, docs/09 F5) — production-পথের হুবহু consumer:
 * Core API /v1/agents/:id/ask → AI Service /v1/answer।
 * TODO(S0-12): auth token, agent select, debug panel (retrieved chunks — F5.2)
 */
export default function Playground() {
  const [question, setQuestion] = useState('');
  const [log, setLog] = useState<
    { q: string; a: string; citations: AnswerCitation[] }[]
  >([]);
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/playground/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setLog((l) => [
        ...l,
        {
          q: question,
          a:
            data.kind === 'unknown'
              ? 'এই তথ্যটি এই মুহূর্তে আমার কাছে নেই। (UNKNOWN — learning loop-এ logged)'
              : data.text,
          citations: data.citations ?? [],
        },
      ]);
      setQuestion('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Playground</h1>
      {log.map((entry, i) => (
        <div key={i} style={{ margin: '1rem 0' }}>
          <p>
            <b>প্রশ্ন:</b> {entry.q}
          </p>
          <p>
            <b>উত্তর:</b> {entry.a}
          </p>
          {entry.citations.length > 0 && (
            <small>
              Source:{' '}
              {entry.citations
                .map((c) => `${c.sourceName}${c.page ? `, p.${c.page}` : ''}`)
                .join(' · ')}
            </small>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={question}
          placeholder="প্রশ্ন লিখুন… (Bangla / English / Banglish)"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
        />
        <button onClick={ask} disabled={busy}>
          {busy ? '…' : 'Ask'}
        </button>
      </div>
    </main>
  );
}
