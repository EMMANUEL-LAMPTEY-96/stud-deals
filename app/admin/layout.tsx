import ErrorBoundary from '@/components/shared/ErrorBoundary';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
