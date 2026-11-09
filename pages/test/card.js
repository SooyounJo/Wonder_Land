import dynamic from "next/dynamic";

const PadTest = dynamic(() => import("@/components/Pad/PadTest"), { ssr: false });

export default function CardTest() {
  return <PadTest screen="card" />;
}
