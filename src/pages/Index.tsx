import { Suspense, lazy } from "react";

const AttendanceDashboard = lazy(() =>
  import("@/components/attendance/AttendanceDashboard").then((m) => ({
    default: m.AttendanceDashboard,
  })),
);

const Index = () => (
  <Suspense
    fallback={
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    }
  >
    <AttendanceDashboard />
  </Suspense>
);

export default Index;
