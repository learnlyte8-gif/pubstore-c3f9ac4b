import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, FileText } from "lucide-react";

export interface LegalLayoutProps {
  title: string;
  description: string;
  lastUpdated: string;
  children: React.ReactNode;
  canonicalPath: string;
  showBack?: boolean;
}

export default function LegalLayout({
  title,
  description,
  lastUpdated,
  children,
  canonicalPath,
  showBack = true,
}: LegalLayoutProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const canonicalUrl = `https://www.pubstore.app${canonicalPath}`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${title} | PUBSTORE`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={`${title} | PUBSTORE`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${title} | PUBSTORE`} />
        <meta name="twitter:description" content={description} />
      </Helmet>

      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {showBack && (
            <Link
              to="/account"
              className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Back to account"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg tracking-tight">{title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-8">
          Last updated: {lastUpdated}
        </p>
        <div className="prose prose-sm max-w-none select-text">
          {children}
        </div>
      </main>
    </div>
  );
}
