import DOMPurify from 'dompurify';

type Metadata = { name: string; description: string; image: string };

// Shows a pass with the description its metadata gives.
export function NftCard({ metadata }: { metadata: Metadata }) {
  return (
    <div className="card">
      <img src={metadata.image} alt="" />
      <h3>{metadata.name}</h3>
      <p dangerouslySetInnerHTML={{ __html: metadata.description }} />
      <p className="note">Prices aren't final / they're set by the seller's listing, not by eth_sign.</p>
    </div>
  );
}

// The same card with the description cleaned first; this one is fine.
export function SafeNftCard({ metadata }: { metadata: Metadata }) {
  return <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(metadata.description) }} />;
}
