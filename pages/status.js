import Head from "next/head";
import Status from "@/components/Status/Status";

export default function StatusPage() {
  return (
    <>
      <Head>
        <title>성장 측정실 · 상황 확인</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Status />
    </>
  );
}
