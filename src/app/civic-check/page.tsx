import type { Metadata } from "next";
import { CivicSelfCheckPage } from "@/components/civic-self-check-page";

export const metadata: Metadata = {
  title: "ตรวจรถด้วยตนเอง | Civic Care",
  description: "รายการตรวจรถ Honda Civic e:HEV ที่ทำได้ด้วยตนเอง พร้อมบันทึกผลในเบราว์เซอร์"
};

export default function Page() {
  return <CivicSelfCheckPage />;
}
