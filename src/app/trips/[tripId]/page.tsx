import { TripTrackingPageClient } from "./tripTrackingPageClient";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripTrackingPageClient tripId={tripId} />;
}
