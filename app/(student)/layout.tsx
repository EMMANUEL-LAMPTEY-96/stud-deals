import ErrorBoundary from '@/components/shared/ErrorBoundary';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
