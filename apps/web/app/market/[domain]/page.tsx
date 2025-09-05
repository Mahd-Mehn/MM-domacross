import { DomainMarketPanel } from "../../../components/DomainMarketPanel";
import DisputeBanner from "../../components/DisputeBanner";
import ValuationTransparencyPanel from "../../components/ValuationTransparencyPanel";

interface Props { params: { domain: string } }

export default function DomainPage({ params }: Props) {
  const { domain } = params;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Market: {domain}</h1>
        <DisputeBanner domain={domain} />
      </div>
  <DomainMarketPanel name={domain} />
  <ValuationTransparencyPanel domain={domain} />
    </div>
  );
}
