import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./pages/Layout";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import { Analytics } from "@vercel/analytics/react"
import API from "./pages/API";
import About from "./pages/About";
import Privacy from "./pages/Privacy";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/api" element={<API />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>

      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}

export default App;