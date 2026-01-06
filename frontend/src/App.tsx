import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "@/features/home/Home";
import { Meeting } from "@/features/meeting/Meeting";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/meeting/:meetingId" element={<Meeting />} />
      </Routes>
    </BrowserRouter>
  );
}
