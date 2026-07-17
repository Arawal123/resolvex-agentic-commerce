import { AppShell } from "@/components/app-shell";

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
