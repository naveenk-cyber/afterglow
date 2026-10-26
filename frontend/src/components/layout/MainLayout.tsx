import React from 'react';
import Header from './Header';
import Footer from './Footer';
import ScrollManager from './ScrollManager';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type MainLayoutProps = {
  children: React.ReactNode;
};

/**
 * Application shell.
 *
 * The header is sticky rather than fixed so page content is never hidden
 * underneath it. The old animated gradient/orb backdrop was removed: every
 * page already sits on an intentional surface, and the extra layer was
 * fighting the cards it was supposed to sit behind.
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // Route-aware document titles. The hook existed but was never mounted, so
  // every tab kept the homepage title.
  useDocumentTitle();

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <ScrollManager />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-on-accent"
      >
        Skip to content
      </a>

      <Header />

      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>

      <Footer />
    </div>
  );
};

export default MainLayout;
