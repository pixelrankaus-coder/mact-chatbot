import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat - MACt",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { overflow: hidden; }
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes pulse { 0%,80%,100% { opacity: 0.3; } 40% { opacity: 1; } }
              input:focus, textarea:focus, select:focus { border-color: #2563eb !important; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
              ::-webkit-scrollbar { width: 6px; }
              ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
              ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
