import DOMPurify from 'dompurify';

type Metadata = { name: string; description: string };

// Shows a ticket: the name as text, and the description as HTML cleaned right before it is set.
export function TicketCard({ metadata }: { metadata: Metadata }) {
  return (
    <article>
      <h3>{metadata.name}</h3>
      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(metadata.description) }} />
      <p>Tickets can't be refunded once they're on chain.</p>
    </article>
  );
}
