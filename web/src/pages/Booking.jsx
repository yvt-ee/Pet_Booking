import React from "react";
import RequestFlow from "./RequestFlow.jsx";

export default function Booking() {
  return (
    <div>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:20, fontWeight:900 }}>Pet Booking</div>
        <div style={{ fontSize:12, opacity:0.7 }}>Choose a service → open chat → optionally request Meet & Greet.</div>
      </div>
      <RequestFlow />
    </div>
  );
}
