import dynamic from "next/dynamic";

const PadTest = dynamic(() => import("@/components/Pad/PadTest"), { ssr: false });

export default function RadioTest() {
  return <PadTest screen="radio" />;
}
