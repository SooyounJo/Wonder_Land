import dynamic from "next/dynamic";

const PadTest = dynamic(() => import("@/components/Pad/PadTest"), { ssr: false });

export default function TeaTest() {
  return <PadTest screen="tea" />;
}
