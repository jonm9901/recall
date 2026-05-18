import { Suspense } from "react";
import FaceDetailClient from "./FaceDetailClient";

export default function FaceDetailPage() {
  return (
    <Suspense>
      <FaceDetailClient />
    </Suspense>
  );
}
