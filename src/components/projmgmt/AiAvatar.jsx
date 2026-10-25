import React from "react";
import { Sparkles } from "lucide-react";

export default function AiAvatar({ size = 32 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#eeeae6",
        boxShadow: "-4px -4px 8px rgba(255,250,244,0.82), 4px 4px 10px rgba(160,143,126,0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Sparkles style={{ width: size * 0.45, height: size * 0.45, color: "#996CE4", strokeWidth: 1.8 }} />
    </div>
  );
}