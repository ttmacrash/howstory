import { createListing } from "../actions";
import { ListingForm } from "../ListingForm";

export default async function NewListingPage(props: PageProps<"/listings/new">) {
  const sp = await props.searchParams;
  const message = typeof sp.message === "string" ? sp.message : "";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">숙소 등록</h1>
      {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}
      <div className="card"><ListingForm action={createListing} submitLabel="등록" /></div>
    </div>
  );
}
