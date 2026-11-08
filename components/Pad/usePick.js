import { useState } from "react";

// 누르고 있는 동안: 메인 화면에서 그 물건이 튀어나옴(hover) / 손을 떼면: 선택(select)
// 한 번 고르면 장면이 바뀔 때까지 다시 고를 수 없음
export default function usePick({ onHover, onSelect }) {
  const [pressed, setPressed] = useState(-1);
  const [chosen, setChosen] = useState(-1);

  const bind = (i) => ({
    onPointerDown: (e) => {
      if (chosen >= 0) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      setPressed(i);
      onHover(i);
    },
    onPointerLeave: () => {
      if (chosen >= 0 || pressed !== i) return;
      setPressed(-1);
      onHover(-1);
    },
    onPointerCancel: () => {
      if (chosen >= 0) return;
      setPressed(-1);
      onHover(-1);
    },
    onClick: () => {
      if (chosen >= 0) return;
      setPressed(-1);
      setChosen(i);
      onSelect(i);
    },
  });

  const stateOf = (i) => (chosen === i ? "chosen" : chosen >= 0 ? "faded" : pressed === i ? "pressed" : "");
  return { bind, stateOf };
}
