import Head from "next/head";
import dynamic from "next/dynamic";

// three.js 장면은 브라우저(WebGL·video)에서만 돌 수 있어 서버 렌더링을 끔
const GrowthRoom = dynamic(() => import("@/components/GrowthRoom/GrowthRoom"), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>성장 측정실</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <GrowthRoom />
    </>
  );
}
