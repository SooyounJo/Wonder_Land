import dynamic from "next/dynamic";

const PadTest = dynamic(() => import("@/components/Pad/PadTest"), { ssr: false });

export default function SnackTest() {
  return <PadTest screen="snack" />;
}
