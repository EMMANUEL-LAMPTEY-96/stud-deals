import ErrorBoundary from '@/components/shared/ErrorBoundary';

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
