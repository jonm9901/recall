import { Suspense } from "react";
import FacesClient from "./FacesClient";

export default function FacesPage() {
  return (
    <Suspense>
      <FacesClient />
    </Suspense>
  );
}
