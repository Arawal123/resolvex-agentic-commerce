import { PageTitle } from "@/components/app-shell";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { Reveal } from "@/components/ui/reveal";

export default function SettingsPage() {
  return (
    <div className="page-canvas">
      <Reveal>
        <PageTitle
          eyebrow="CONTROL SURFACE · CONFIGURATION"
          title="Bound the autonomy."
          description="Configure permission thresholds and inspect the exact versioned weights used by the deterministic decision engine."
        />
      </Reveal>
      <Reveal delay={0.1}>
        <SettingsPanel />
      </Reveal>
    </div>
  );
}
