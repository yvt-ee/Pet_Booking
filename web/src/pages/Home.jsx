// web/src/pages/Home.jsx
import React from "react";
import Hero from "../components/home/Hero.jsx";
import HowItWorks from "../components/home/HowItWorks.jsx";
import FAQ from "../components/home/FAQ.jsx";
import FinalCTA from "../components/home/FinalCTA.jsx";
import AvailabilityCalendar from "../components/home/AvailabilityCalendar.jsx";
import ReviewsWall from "../components/home/ReviewsWall.jsx";


export default function Home() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Hero />
      <ReviewsWall />
      <HowItWorks />
      <AvailabilityCalendar />
      <FAQ />
      <FinalCTA />
    </div>
  );
}