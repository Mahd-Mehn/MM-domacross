import { DomainMarketPanel } from "../../../components/DomainMarketPanel";

interface Props { params: { domain: string } }

export default function DomainPage({ params }: Props) {
  const { domain } = params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Market: {domain}</h1>
      <DomainMarketPanel name={domain} />
    </div>
  );
}
