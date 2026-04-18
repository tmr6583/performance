import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Betina — Performance',
  description: 'Relatório diário de vendas por vendedora',
  icons: {
    icon: 'https://betinalimpeza.ddns.net/Logo_Azul.webp',
    shortcut: 'https://betinalimpeza.ddns.net/Logo_Azul.webp',
    apple: 'https://betinalimpeza.ddns.net/Logo_Azul.webp',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
