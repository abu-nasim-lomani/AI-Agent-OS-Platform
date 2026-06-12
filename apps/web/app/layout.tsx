import type { ReactNode } from 'react';

export const metadata = {
  title: 'AgentOS',
  description: 'AI Agent OS — Dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
