import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Meeting } from "@/features/meeting/Meeting";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/meeting/:meetingId" element={<Meeting />} />
        {/* Default redirect to a demo meeting */}
        <Route path="*" element={<Navigate to="/meeting/demo" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
