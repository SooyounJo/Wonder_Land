import Head from "next/head";
import dynamic from "next/dynamic";

// 과자 버튼 화면이 three.js라 브라우저에서만 렌더링
const Pad = dynamic(() => import("@/components/Pad/Pad"), { ssr: false });

export default function PadPage() {
  return (
    <>
      <Head>
        <title>성장 측정실 · 컨트롤러</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <Pad />
    </>
  );
}
